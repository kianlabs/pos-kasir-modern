import { NextResponse } from "next/server";
import { prisma, transaksi } from "@/server/db";
import { readJson } from "@/server/http";
import { catat } from "@/server/audit";
import { currentWarungId, currentKasirId } from "@/server/tenant";
import { isUniqueConstraintError } from "@/client/offline-sync";

export const dynamic = "force-dynamic";

/** Error buka-shift dengan status HTTP — selaras pola BillError di server/meja. */
class ShiftError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = "ShiftError";
  }
}

export type ShiftSummary = {
  id: string;
  openedAt: string;
  closedAt: string | null;
  modalAwal: number;
  kasFisik: number | null;
  status: string;
  tunai: number;
  qris: number;
  trxCount: number;
  expected: number; // modal + tunai
  selisih: number | null; // kasFisik - expected (bila tutup)
};

// GET /api/shifts → riwayat + ringkasan per shift
export async function GET() {
  const warungId = await currentWarungId();
  const shifts = await prisma.shift.findMany({
    where: { warungId },
    orderBy: { openedAt: "desc" },
    take: 20,
    include: {
      transactions: {
        where: { status: "LUNAS" },
        select: { total: true, payment: true },
      },
    },
  });

  const out: ShiftSummary[] = shifts.map((s) => {
    const tunai = s.transactions.filter((t) => t.payment === "CASH").reduce((n, t) => n + t.total, 0);
    const qris = s.transactions.filter((t) => t.payment === "QRIS").reduce((n, t) => n + t.total, 0);
    const expected = s.modalAwal + tunai;
    return {
      id: s.id,
      openedAt: s.openedAt.toISOString(),
      closedAt: s.closedAt?.toISOString() ?? null,
      modalAwal: s.modalAwal,
      kasFisik: s.kasFisik,
      status: s.status,
      tunai,
      qris,
      trxCount: s.transactions.length,
      expected,
      selisih: s.kasFisik != null ? s.kasFisik - expected : null,
    };
  });
  return NextResponse.json(out);
}

// POST /api/shifts { modalAwal } → buka shift baru
export async function POST(req: Request) {
  const warungId = await currentWarungId();
  const cashierId = await currentKasirId(warungId);

  const body = await readJson(req);
  if (!body) return NextResponse.json({ error: "Body tidak valid." }, { status: 400 });
  const modalAwal = Math.max(0, Math.floor(Number(body.modalAwal) || 0));

  try {
    const shift = await transaksi(async (tx) => {
      const active = await tx.shift.findFirst({
        where: { warungId, status: "BUKA" },
      });
      if (active) {
        throw new ShiftError("Masih ada shift terbuka. Tutup dulu.", 409);
      }
      return tx.shift.create({
        data: {
          warungId,
          cashierId,
          modalAwal,
        },
      });
    });

    await catat({
      warungId,
      userId: cashierId,
      action: "SHIFT_OPEN",
      meta: { modalAwal },
    });

    return NextResponse.json(shift, { status: 201 });
  } catch (e) {
    if (e instanceof ShiftError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    // Race dua "buka shift" bersamaan: cek-then-act di atas bisa lolos di kedua
    // request, lalu partial unique index DB (shifts_one_buka_per_warung,
    // WHERE status='BUKA') menolak yang kalah dengan P2002 → 409 yang sama.
    if (isUniqueConstraintError(e)) {
      return NextResponse.json({ error: "Masih ada shift terbuka." }, { status: 409 });
    }
    const message = e instanceof Error ? e.message : "Gagal buka shift.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
