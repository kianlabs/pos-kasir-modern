import { NextResponse } from "next/server";
import { transaksi } from "@/server/db";
import { catat } from "@/server/audit";
import { currentWarungId, currentKasirId } from "@/server/tenant";
import { BillError } from "@/server/meja";
import { isUniqueConstraintError } from "@/client/offline-sync";

export const dynamic = "force-dynamic";

// POST /api/meja/[id]/bill → buka bill DRAFT baru di meja [id].
//
// Invarian (plan §4.2, pola sama dengan aturan #11 "satu shift BUKA per warung"):
// - meja [id] WAJIB milik warung ini (warungId dari session, aturan #8);
// - WAJIB belum ada bill DRAFT lain di meja itu;
// - WAJIB ada shift BUKA (alur kasir: login → shift aktif → pilih meja);
// Semua pengecekan dilakukan DI DALAM $transaction agar bebas race
// check-then-act (dua klik "buka bill" bersamaan tidak menghasilkan 2 DRAFT).
// Di level DB, partial unique index `tx_one_draft_per_meja` (Postgres,
// migrations/20261009100000_init_postgres) menjadi jaring kedua: bila dua
// request lolos cek bersamaan, yang kalah kena P2002 → ditangkap di catch → 409.
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const warungId = await currentWarungId();
  const cashierId = await currentKasirId(warungId);

  try {
    const bill = await transaksi(async (tx) => {
      const meja = await tx.meja.findFirst({
        where: { id: params.id, warungId },
        select: { id: true },
      });
      if (!meja) throw new BillError("Meja tidak ditemukan.", 404);

      const existing = await tx.transaction.findFirst({
        where: { warungId, mejaId: meja.id, status: "DRAFT" },
        select: { id: true },
      });
      if (existing) throw new BillError("Meja sudah punya bill terbuka.", 409);

      const shift = await tx.shift.findFirst({
        where: { warungId, status: "BUKA" },
        orderBy: { openedAt: "desc" },
        select: { id: true },
      });
      if (!shift) throw new BillError("Belum ada shift terbuka. Buka shift dulu.", 400);

      // DRAFT tidak menyentuh stok (plan §7 keputusan 3): total masih 0,
      // stok/StockMove baru disentuh saat transisi DRAFT → LUNAS (bayar).
      return tx.transaction.create({
        data: {
          warungId,
          mejaId: meja.id,
          shiftId: shift.id,
          cashierId,
          status: "DRAFT",
          total: 0,
        },
      });
    });

    // catat() tidak pernah throw (audit gagal tidak boleh menggagalkan aksi).
    await catat({
      warungId,
      userId: cashierId,
      action: "MEJA_BUKA",
      meta: { billId: bill.id, mejaId: bill.mejaId },
    });

    return NextResponse.json({ id: bill.id, mejaId: bill.mejaId, status: bill.status }, { status: 201 });
  } catch (e) {
    if (e instanceof BillError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    // Race dua "buka bill" bersamaan untuk meja yang sama: cek-then-act di atas
    // bisa lolos di kedua request, lalu partial unique index DB
    // (tx_one_draft_per_meja, WHERE status='DRAFT') menolak yang kalah dengan
    // P2002. Itu bukan error server — jawab 409 yang sama seperti jalur cek.
    if (isUniqueConstraintError(e)) {
      return NextResponse.json({ error: "Meja sudah punya bill terbuka." }, { status: 409 });
    }
    const message = e instanceof Error ? e.message : "Gagal buka bill.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
