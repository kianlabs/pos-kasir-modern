import type { Prisma } from "@prisma/client";
import { rupiah } from "@/shared/rupiah";

// Outbox notifikasi (Fase 2 §7a) — fondasi PROVIDER-AGNOSTIC.
//
// Saat shift ditutup kita menyusun laporan ringkas (teks siap-kirim ke WA
// owner) dan MENYIMPANNYA ke tabel `notifikasi` (bukan mengirim). Pengiriman
// nyata (WhatsApp/Fonnte/Cloud API) = adapter terpisah yang menyusul; untuk
// sekarang owner menyalin `body` dari UI (semi-manual). Modul ini sengaja TIDAK
// menyentuh jaringan/HTTP sama sekali.
//
// Aturan tenant #1: SEMUA query difilter `warungId` — tidak pernah dari client.

// Client minimal yang dibutuhkan helper ini — bisa `prisma` root maupun `tx`
// di dalam $transaction. Tipe `Prisma.TransactionClient` kompatibel dengan
// PrismaClient untuk operasi baca/tulis yang dipakai di sini (pola sama dengan
// src/server/meja.ts).
type Db = Prisma.TransactionClient;

export type RingkasanShift = {
  shiftId: string;
  warungNama: string;
  kasirNama: string;
  openedAt: Date;
  closedAt: Date;
  modalAwal: number;
  tunai: number; // Σ total transaksi CASH
  qris: number; // Σ total transaksi QRIS
  totalOmzet: number; // tunai + qris (semua LUNAS)
  trxCount: number; // jumlah transaksi LUNAS
  expected: number; // modalAwal + tunai (uang yang seharusnya ada di kas)
  kasFisik: number; // uang fisik yang dihitung kasir saat tutup
  selisih: number; // kasFisik - expected
  topProducts: { name: string; qty: number }[];
  stokMenipis: { name: string; stock: number }[];
};

// Ambang "stok menipis" — samakan dengan laporan UI (stats/route.ts: stock ≤ 5).
const AMBANG_STOK_MENIPIS = 5;
// Berapa produk terlaris & stok menipis yang dimasukkan ke laporan (WA ringkas).
const MAKS_TERLARIS = 5;
const MAKS_STOK_MENIPIS = 5;

// Format tanggal ringkas "10 Okt 2026 14:30" (locale id-ID, deterministik
// sepanjang ada ICU; sengaja tanpa zona eksplisit agar ramah server apa pun).
function tanggalRingkas(d: Date): string {
  return d.toLocaleString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Tanda & label selisih kas: "aman" bila 0, "lebih"/"kurang" bila ≠ 0.
function labelSelisih(selisih: number): string {
  if (selisih === 0) return "pas";
  const arah = selisih > 0 ? "lebih" : "kurang";
  return `${arah} ${rupiah(Math.abs(selisih))}`;
}

/**
 * Bangun teks laporan shift siap-kirim (plain text, tanpa HTML) untuk WhatsApp.
 *
 * PURE — tidak menyentuh DB/jaringan; mudah diuji. Deterministik: masukan sama
 * → keluaran sama. Daftar kosong ditampilkan sebagai "—" agar pesan tetap rapi.
 */
export function renderLaporanShift(r: RingkasanShift): { subject: string; body: string } {
  const subject = `Laporan Shift — ${r.warungNama}`;

  const terlaris =
    r.topProducts.length > 0
      ? r.topProducts.map((p) => `${p.name} ×${p.qty}`).join(", ")
      : "—";

  const stokMenipis =
    r.stokMenipis.length > 0
      ? r.stokMenipis.map((p) => `${p.name} (${p.stock})`).join(", ")
      : "—";

  const selisihTanda = r.selisih > 0 ? "+" : r.selisih < 0 ? "−" : "±";

  const lines = [
    `🧾 Laporan Shift — ${r.warungNama}`,
    `${r.kasirNama} · ${tanggalRingkas(r.openedAt)}–${tanggalRingkas(r.closedAt)}`,
    ``,
    `Omzet: ${rupiah(r.totalOmzet)} (${r.trxCount} transaksi)`,
    `Tunai: ${rupiah(r.tunai)} · QRIS: ${rupiah(r.qris)}`,
    `Modal awal: ${rupiah(r.modalAwal)} · Kas fisik: ${rupiah(r.kasFisik)}`,
    `Expected: ${rupiah(r.expected)} · Selisih: ${selisihTanda}${rupiah(
      Math.abs(r.selisih),
    )} (${labelSelisih(r.selisih)})`,
    ``,
    `Terlaris: ${terlaris}`,
    `Stok menipis: ${stokMenipis}`,
  ];

  return { subject, body: lines.join("\n") };
}

/**
 * Susun ringkasan shift dari data DB (ter-scope tenant), simpan baris outbox
 * `notifikasi` jenis LAPORAN_SHIFT berstatus PENDING, kembalikan id-nya.
 *
 * Idempoten-ish: bila sudah ada baris LAPORAN_SHIFT dengan refId = shiftId,
 * kembalikan baris itu alih-alih membuat duplikat (mis. close ditrigger ulang).
 *
 * Terima `txOrPrisma` (transaksi ATAU client root) agar bisa dipanggil di dalam
 * maupun di luar $transaction. Return null bila shift tak ditemukan (mis.
 * sudah dihapus) — pemanggil TIDAK boleh gagal karena ini.
 */
export async function buatLaporanShift(
  txOrPrisma: Db,
  { warungId, shiftId }: { warungId: string; shiftId: string },
): Promise<{ id: string } | null> {
  const db = txOrPrisma;

  const shift = await db.shift.findFirst({
    where: { id: shiftId, warungId },
    include: {
      cashier: { select: { name: true } },
      warung: { select: { nama: true } },
      transactions: {
        where: { status: "LUNAS" },
        select: { id: true, total: true, payment: true },
      },
    },
  });
  if (!shift) return null;

  // Idempotensi: satu laporan per shift. Kembalikan yang sudah ada.
  const sudah = await db.notifikasi.findFirst({
    where: { warungId, jenis: "LAPORAN_SHIFT", refId: shiftId },
    select: { id: true },
  });
  if (sudah) return { id: sudah.id };

  const tunai = shift.transactions
    .filter((t) => t.payment === "CASH")
    .reduce((n, t) => n + t.total, 0);
  const qris = shift.transactions
    .filter((t) => t.payment === "QRIS")
    .reduce((n, t) => n + t.total, 0);
  const totalOmzet = tunai + qris;
  const expected = shift.modalAwal + tunai;
  const kasFisik = shift.kasFisik ?? expected;
  const selisih = kasFisik - expected;

  // Produk terlaris DALAM JENDELA SHIFT INI (bukan sepanjang masa): batasi lewat
  // relasi transaction → shiftId & status LUNAS. Group by productId, ambil qty.
  const trxIds = shift.transactions.map((t) => t.id);
  const grupTerlaris = trxIds.length
    ? await db.transactionItem.groupBy({
        by: ["productId"],
        where: { warungId, transactionId: { in: trxIds }, transaction: { status: "LUNAS" } },
        _sum: { qty: true },
        orderBy: { _sum: { qty: "desc" } },
        take: MAKS_TERLARIS,
      })
    : [];

  const topIds = grupTerlaris.map((g) => g.productId);
  const topByName = topIds.length
    ? await db.product.findMany({
        where: { id: { in: topIds }, warungId },
        select: { id: true, name: true },
      })
    : [];
  const nameById = new Map(topByName.map((p) => [p.id, p.name]));
  const topProducts = grupTerlaris.map((g) => ({
    name: nameById.get(g.productId) ?? "?",
    qty: g._sum.qty ?? 0,
  }));

  const lowStockRows = await db.product.findMany({
    where: { warungId, stock: { lte: AMBANG_STOK_MENIPIS } },
    orderBy: { stock: "asc" },
    take: MAKS_STOK_MENIPIS,
    select: { name: true, stock: true },
  });

  const ringkasan: RingkasanShift = {
    shiftId,
    warungNama: shift.warung.nama,
    kasirNama: shift.cashier.name,
    openedAt: shift.openedAt,
    closedAt: shift.closedAt ?? new Date(),
    modalAwal: shift.modalAwal,
    tunai,
    qris,
    totalOmzet,
    trxCount: shift.transactions.length,
    expected,
    kasFisik,
    selisih,
    topProducts,
    stokMenipis: lowStockRows.map((p) => ({ name: p.name, stock: p.stock })),
  };

  const { subject, body } = renderLaporanShift(ringkasan);

  const dibuat = await db.notifikasi.create({
    data: {
      warungId,
      jenis: "LAPORAN_SHIFT",
      channel: "WA",
      tujuan: null, // nomor owner belum ditentukan (semi-manual)
      subject,
      body,
      status: "PENDING",
      refId: shiftId,
      // Angka pendukung untuk audit/verifikasi (jangan data mentah pelanggan).
      meta: JSON.stringify({
        totalOmzet,
        trxCount: ringkasan.trxCount,
        tunai,
        qris,
        modalAwal: shift.modalAwal,
        expected,
        kasFisik,
        selisih,
      }),
    },
    select: { id: true },
  });

  return { id: dibuat.id };
}
