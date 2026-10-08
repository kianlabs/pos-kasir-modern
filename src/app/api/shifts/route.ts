import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readJson } from "@/lib/request";
import { currentWarungId, currentKasirId } from "@/lib/warung";

export const dynamic = "force-dynamic";

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
    const shift = await prisma.$transaction(async (tx) => {
      const active = await tx.shift.findFirst({
        where: { warungId, status: "BUKA" },
      });
      if (active) {
        throw new Error("Masih ada shift buka. Tutup dulu.");
      }
      return tx.shift.create({
        data: {
          warungId,
          cashierId,
          modalAwal,
        },
      });
    });

    return NextResponse.json(shift, { status: 201 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Gagal buka shift.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
