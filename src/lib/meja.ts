import { prisma } from "@/lib/prisma";
import type { StatusMeja } from "@/types";

// Helper manajemen meja + bill DRAFT (Tahap 3).
//
// Prinsip skema (lampiran §2 koreksi #4):
// - Meja TIDAK punya kolom `status`. KOSONG/TERISI di-derive dari ada/tidaknya
//   Transaction {status: DRAFT, mejaId} yang terbuka → bebas race check-then-act.
// - Satu bill DRAFT terbuka per meja ditegakkan DI DALAM $transaction oleh
//   pemanggil (aturan #11: pola sama dengan "satu shift BUKA per warung").
// - warungId SELALU dari session (aturan #8), tidak pernah dari client.

export type MejaDenganStatus = {
  id: string;
  nomor: string;
  status: StatusMeja;
  billId: string | null;
};

// Peta seluruh meja warung + statusnya + id bill DRAFT terbuka (bila ada).
// Satu query grouped per render — murah untuk 10–20 meja.
export async function deriveStatusMeja(warungId: string): Promise<MejaDenganStatus[]> {
  const [mejas, openBills] = await Promise.all([
    prisma.meja.findMany({
      where: { warungId },
      orderBy: { nomor: "asc" },
      select: { id: true, nomor: true },
    }),
    prisma.transaction.findMany({
      where: { warungId, status: "DRAFT", mejaId: { not: null } },
      select: { id: true, mejaId: true },
    }),
  ]);

  const billByMeja = new Map<string, string>();
  for (const b of openBills) {
    // Bila karena suatu hal ada >1 DRAFT di meja yang sama, ambil yang pertama;
    // invarian "satu DRAFT per meja" dijaga di endpoint buka bill.
    if (b.mejaId && !billByMeja.has(b.mejaId)) billByMeja.set(b.mejaId, b.id);
  }

  return mejas.map((m) => {
    const billId = billByMeja.get(m.id) ?? null;
    return { id: m.id, nomor: m.nomor, status: billId ? "TERISI" : "KOSONG", billId };
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
export async function hitungUlangBill(
  billId: string,
  warungId: string
): Promise<{ subtotal: number; discount: number; tax: number; total: number }> {
  const [items, bill] = await Promise.all([
    prisma.transactionItem.findMany({
      where: { transactionId: billId, warungId },
      select: { price: true, qty: true },
    }),
    prisma.transaction.findFirst({
      where: { id: billId, warungId },
      select: { discount: true },
    }),
  ]);

  const subtotal = items.reduce((n, i) => n + i.price * i.qty, 0);
  const discount = Math.min(bill?.discount ?? 0, subtotal);

  const setting = await prisma.setting.findUnique({ where: { warungId } });
  const taxEnabled = setting ? !!setting.taxEnabled : true;
  const taxPct = setting ? Math.min(100, Math.max(0, Number(setting.taxPct) || 0)) : 10;
  const tax = taxEnabled ? Math.round(((subtotal - discount) * taxPct) / 100) : 0;

  return { subtotal, discount, tax, total: subtotal - discount + tax };
}
