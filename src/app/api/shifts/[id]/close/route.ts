import { NextResponse } from "next/server";
import { transaksi } from "@/server/db";
import { readJson } from "@/server/http";
import { catat } from "@/server/audit";
import { currentWarungId, currentKasirId } from "@/server/tenant";

export const dynamic = "force-dynamic";

// POST /api/shifts/[id]/close { kasFisik } → tutup shift + hitung selisih
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const warungId = await currentWarungId();
  const kasirId = await currentKasirId(warungId);

  const body = await readJson(req);
  if (!body) return NextResponse.json({ error: "Body tidak valid." }, { status: 400 });
  const kasFisik = Number(body.kasFisik);

  if (!Number.isInteger(kasFisik) || kasFisik < 0) {
    return NextResponse.json({ error: "Kas fisik tidak valid." }, { status: 400 });
  }
  // Cek shift + guard DRAFT + update ditutup dalam SATU $transaction agar
  // tidak ada jendela TOCTOU (bill dibuka tepat setelah cek DRAFT lolos).
  try {
    const result = await transaksi(async (tx) => {
      const shift = await tx.shift.findFirst({
        where: { id: params.id, warungId },
        include: {
          transactions: {
            where: { status: "LUNAS" },
            select: { total: true, payment: true },
          },
        },
      });
      if (!shift || shift.status !== "BUKA") {
        throw new CloseError("Shift tidak ditemukan / sudah tutup.", 404);
      }

      // Guard (plan §7 keputusan 1): bill DRAFT TIDAK boleh menggantung lintas
      // shift. Bila masih ada bill terbuka di warung → 409.
      // Hitungan bill DRAFT sengaja WARUNG-WIDE (bukan per-shift): bill tidak
      // boleh menggantung lintas shift, jadi seluruh warung harus bersih dulu.
      const openBills = await tx.transaction.count({
        where: { warungId, status: "DRAFT" },
      });
      if (openBills > 0) {
        throw new CloseError(
          `Masih ada ${openBills} bill terbuka di warung ini. Selesaikan atau batalkan dulu.`,
          409
        );
      }

      const tunai = shift.transactions
        .filter((t) => t.payment === "CASH")
        .reduce((n, t) => n + t.total, 0);
      const expected = shift.modalAwal + tunai;

      const closed = await tx.shift.update({
        where: { id: params.id },
        data: { status: "TUTUP", closedAt: new Date(), kasFisik },
      });

      return { closed, expected };
    });

    await catat({
      warungId,
      userId: kasirId,
      action: "SHIFT_CLOSE",
      meta: { kasFisik, selisih: kasFisik - result.expected },
    });
    return NextResponse.json({
      ...result.closed,
      expected: result.expected,
      selisih: kasFisik - result.expected,
    });
  } catch (e) {
    if (e instanceof CloseError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    const message = e instanceof Error ? e.message : "Gagal tutup shift.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

class CloseError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = "CloseError";
  }
}
