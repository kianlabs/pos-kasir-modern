import { NextResponse } from "next/server";
import { transaksi } from "@/lib/prisma";
import { catat } from "@/lib/audit";
import { currentWarungId, currentKasirId } from "@/lib/warung";
import { BillError } from "@/lib/meja";

export const dynamic = "force-dynamic";

// POST /api/meja/[id]/bill → buka bill DRAFT baru di meja [id].
//
// Invarian (plan §4.2, pola sama dengan aturan #11 "satu shift BUKA per warung"):
// - meja [id] WAJIB milik warung ini (warungId dari session, aturan #8);
// - WAJIB belum ada bill DRAFT lain di meja itu;
// - WAJIB ada shift BUKA (alur kasir: login → shift aktif → pilih meja);
// Semua pengecekan dilakukan DI DALAM $transaction agar bebas race
// check-then-act (dua klik "buka bill" bersamaan tidak menghasilkan 2 DRAFT).
// Catatan: pada SQLite + Prisma, transaksi interaktif di-serialize sehingga cek
// ini efektif atomik antar-request. TIDAK ada constraint DB — saat migrasi ke
// Postgres WAJIB tambah partial unique index (warungId, mejaId) WHERE
// status='DRAFT' (lihat schema.prisma).
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
    const message = e instanceof Error ? e.message : "Gagal buka bill.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
