import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readJson } from "@/lib/request";
import { catat } from "@/lib/audit";
import { currentWarungId, currentKasirId } from "@/lib/warung";
import { hitungUlangBill, BillError } from "@/lib/meja";

export const dynamic = "force-dynamic";

type Params = { params: { id: string } };

// POST /api/bills/[id]/gabung { sourceBillId }
// Pindahkan SEMUA TransactionItem dari bill sumber ke bill tujuan [id]
// (bill tujuan WAJIB DRAFT), lalu hapus bill sumber → meja sumber jadi KOSONG.
//
// Prinsip (plan §4.3, §7 keputusan 3): gabung TIDAK menyentuh stok — hanya
// memindahkan baris item. Item dipindah (update transactionId), BUKAN disalin,
// sehingga snapshot name/price tiap item tetap utuh dan tidak ada duplikasi.
export async function POST(req: Request, { params }: Params) {
  const warungId = await currentWarungId();
  const kasirId = await currentKasirId(warungId);

  const body = await readJson(req);
  if (!body) return NextResponse.json({ error: "Body tidak valid." }, { status: 400 });

  const sourceBillId = typeof body.sourceBillId === "string" ? body.sourceBillId.trim() : "";
  if (!sourceBillId) return NextResponse.json({ error: "sourceBillId wajib." }, { status: 400 });
  if (sourceBillId === params.id) {
    return NextResponse.json({ error: "Bill sumber dan tujuan tidak boleh sama." }, { status: 400 });
  }

  try {
    let moved = 0;

    // Validasi + pindah + hapus dalam satu $transaction (atomik).
    // Cek dilakukan via `tx` (bukan helper global) agar tidak ada race
    // check-then-act — pola sama "satu shift BUKA per warung" (aturan #11).
    await prisma.$transaction(async (tx) => {
      const target = await tx.transaction.findFirst({
        where: { id: params.id, warungId, status: "DRAFT" },
        select: { id: true },
      });
      if (!target) throw new BillError("Bill tujuan tidak ditemukan.", 404);

      const source = await tx.transaction.findFirst({
        where: { id: sourceBillId, warungId, status: "DRAFT" },
        select: { id: true },
      });
      if (!source) throw new BillError("Bill sumber tidak ditemukan.", 404);

      // Pindahkan seluruh item sumber ke tujuan (warungId tetap, snapshot utuh).
      const res = await tx.transactionItem.updateMany({
        where: { transactionId: source.id, warungId },
        data: { transactionId: target.id },
      });
      moved = res.count;

      // Hapus bill sumber (item sudah kosong → cascade tidak menyisakan apa pun).
      await tx.transaction.delete({ where: { id: source.id } });
    });

    // Hitung ulang total bill tujuan dari item hasil gabung (server-side,
    // uang integer rupiah — aturan #3, #12).
    const totals = await hitungUlangBill(params.id, warungId);
    await prisma.transaction.update({ where: { id: params.id }, data: totals });

    await catat({
      warungId,
      userId: kasirId,
      action: "MEJA_GABUNG",
      meta: { target: params.id, source: sourceBillId, items: moved, total: totals.total },
    });

    return NextResponse.json({ ok: true, id: params.id, moved, ...totals });
  } catch (e) {
    if (e instanceof BillError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    const message = e instanceof Error ? e.message : "Gagal gabung bill.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
