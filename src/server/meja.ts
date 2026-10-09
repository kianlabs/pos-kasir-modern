import { prisma } from "@/server/db";
import type { Prisma } from "@prisma/client";
import type { StatusMeja } from "@/types";

// Client minimal yang dibutuhkan helper ini — bisa `prisma` maupun `tx` di
// dalam $transaction. Tipe `Prisma.TransactionClient` kompatibel dengan
// PrismaClient untuk operasi baca/tulis yang dipakai di sini.
type Db = Prisma.TransactionClient;

// Helper manajemen meja + bill DRAFT (Tahap 3).
//
// Prinsip skema (lampiran §2 koreksi #4):
// - Meja TIDAK punya kolom `status`. KOSONG/TERISI di-derive dari ada/tidaknya
//   Transaction {status: DRAFT, mejaId} yang terbuka → bebas race check-then-act.
// - Satu bill DRAFT terbuka per meja ditegakkan DI DALAM $transaction oleh
//   pemanggil DAN di level DB lewat partial unique index `tx_one_draft_per_meja`
//   (Postgres; lihat migrations/20261009100000_init_postgres). Endpoint buka-bill
//   menangkap P2002 → 409. Invarian "satu shift BUKA per warung" juga ditegakkan
//   DB lewat index `shifts_one_buka_per_warung` (migrations/20261009120000_shift_one_open).
// - warungId SELALU dari session (aturan #8), tidak pernah dari client.

export type MejaDenganStatus = {
  id: string;
  nomor: string;
  status: StatusMeja;
  billId: string | null;
  // Ringkasan bill terbuka (null bila KOSONG) — dipakai peta meja agar kasir
  // melihat jumlah item & total tanpa perlu membuka tiap meja.
  itemCount: number;
  total: number;
};

// Peta seluruh meja warung + statusnya + id bill DRAFT terbuka (bila ada).
// Satu query meja + satu query bill terbuka (dengan agregat item) per render.
export async function deriveStatusMeja(warungId: string): Promise<MejaDenganStatus[]> {
  const [mejas, openBills] = await Promise.all([
    prisma.meja.findMany({
      where: { warungId },
      // `nomor` disimpan sebagai String; orderBy asc SQLite mengurutkan
      // leksikografis → "10" muncul sebelum "2" (1, 10, 2, 3, …). Urutkan
      // numerik di sini agar peta meja tampil 1, 2, 3, … 10.
      select: { id: true, nomor: true },
    }),
    prisma.transaction.findMany({
      where: { warungId, status: "DRAFT", mejaId: { not: null } },
      select: {
        id: true,
        mejaId: true,
        total: true,
        items: { select: { qty: true } },
      },
    }),
  ]);

  mejas.sort((a, b) => {
    const na = Number(a.nomor);
    const nb = Number(b.nomor);
    // Nomor numerik diutamakan; nomor non-numerik (mis. "A1") jatuh ke
    // perbandingan string agar tetap deterministik.
    if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb;
    return a.nomor.localeCompare(b.nomor, "id");
  });

  const billByMeja = new Map<string, { id: string; itemCount: number; total: number }>();
  for (const b of openBills) {
    // Bila karena suatu hal ada >1 DRAFT di meja yang sama, ambil yang pertama;
    // invarian "satu DRAFT per meja" dijaga di endpoint buka bill.
    if (b.mejaId && !billByMeja.has(b.mejaId)) {
      billByMeja.set(b.mejaId, {
        id: b.id,
        itemCount: b.items.reduce((n, i) => n + i.qty, 0),
        total: b.total,
      });
    }
  }

  return mejas.map((m) => {
    const bill = billByMeja.get(m.id) ?? null;
    return {
      id: m.id,
      nomor: m.nomor,
      status: bill ? "TERISI" : "KOSONG",
      billId: bill?.id ?? null,
      itemCount: bill?.itemCount ?? 0,
      total: bill?.total ?? 0,
    };
  });
}

export class BillError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = "BillError";
  }
}

// Ambil bill DRAFT yang ter-scope tenant, atau lempar BillError(404).
// Dipakai semua endpoint bill agar validasi kepemilikan tidak terduplikasi.
export async function requireBillDraft(id: string, warungId: string) {
  const bill = await prisma.transaction.findFirst({
    where: { id, warungId, status: "DRAFT" },
    include: { items: true },
  });
  if (!bill) throw new BillError("Bill tidak ditemukan.", 404);
  return bill;
}

// Hitung ulang subtotal/discount/tax/total bill dari item-nya (server-side,
// bukan percaya angka client). Uang integer rupiah (aturan #3):
// discount = min(discount, subtotal), tax = round(...). Reuse di semua mutasi.
//
// Fix A13: kembalikan DUA nilai diskon. `rawDiscount` = diskon yang diniatkan
// kasir (nilai tersimpan, TIDAK di-clamp) — inilah yang WAJIB disimpan ulang
// oleh pemanggil. `discount` = clamp ke subtotal, dipakai HANYA untuk pajak &
// total. Tanpa pemisahan ini, menerapkan diskon ke bill kosong (subtotal 0)
// langsung menulis discount=0 → diskon kasir hilang tanpa jejak, dan diskon
// yang lebih besar dari subtotal terpotong permanen.
//
// PENTING (dibuktikan lewat probe): pada Prisma+SQLite, client ROOT `prisma`
// TIDAK melihat tulisan yang belum di-commit dari dalam `$transaction` — ia
// membaca snapshot pra-mutasi (qty via tx=3, via root=0). Karena itu panggil
// helper ini DENGAN `tx` bila dipakai di dalam $transaction; dengan `prisma`
// (default) hanya aman di luar transaksi.
export async function hitungUlangBill(
  billId: string,
  warungId: string,
  db: Db = prisma
): Promise<{
  subtotal: number;
  rawDiscount: number;
  discount: number;
  tax: number;
  total: number;
}> {
  const [items, bill] = await Promise.all([
    db.transactionItem.findMany({
      where: { transactionId: billId, warungId },
      select: { price: true, qty: true },
    }),
    db.transaction.findFirst({
      where: { id: billId, warungId },
      select: { discount: true },
    }),
  ]);

  const subtotal = items.reduce((n, i) => n + i.price * i.qty, 0);
  // Nilai diskon yang diniatkan kasir (tersimpan di DB) — TIDAK di-clamp.
  const rawDiscount = Math.max(0, bill?.discount ?? 0);
  // Clamp ke subtotal: hanya untuk perhitungan pajak/total agar total tak negatif.
  const discount = Math.min(rawDiscount, subtotal);

  const setting = await db.setting.findUnique({ where: { warungId } });
  const taxEnabled = setting ? !!setting.taxEnabled : true;
  const taxPct = setting ? Math.min(100, Math.max(0, Number(setting.taxPct) || 0)) : 10;
  const tax = taxEnabled ? Math.round(((subtotal - discount) * taxPct) / 100) : 0;

  return { subtotal, rawDiscount, discount, tax, total: subtotal - discount + tax };
}
