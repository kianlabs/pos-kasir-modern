// 7 tool query DETERMINISTIK untuk "KRING! Insight" (lampiran AI §3).
//
// ATURAN KEAMANAN KERAS (lampiran §1.4, §7.2):
//  1. Setiap fungsi menerima `warungId` sebagai ARGUMEN PERTAMA — disuntik
//     server-side dari session owner oleh pemanggil. Model/prompt TIDAK PERNAH
//     memegang `warungId`. Tidak ada tool baru tanpa review lampiran §3.
//  2. Semua query difilter `warungId`. Tool yang menerima id anak (mis. shiftId)
//     WAJIB memverifikasi id itu milik warung yang sama; bila tidak → `ToolError`.
//  3. Tidak ada text-to-SQL, tidak ada input bebas SQL/kolom, tidak ada tool
//     yang MENGUBAH data. Semua tool MURNI BACA.
//  4. Keluaran = agregat KECIL (≤ 50 baris). Model tidak menerima buku besar
//     mentah (prinsip data minimization §1.7).
//
// Semua uang = integer rupiah (hindari float). Tanggal dihitung dengan zona
// WIB (`Asia/Jakarta`) agar konsisten lintas server (kompensasi audit §4).
//
// Pembatalan/perbedaan tenant → `ToolError` (pesan Indonesia). Tool tidak
// menangkap error DB lain; itu tanggung jawab pemanggil (endpoint).

import { prisma } from "@/server/db";
import type { AnomaliRule } from "@/server/ai/types";

// ── Tenant guard ────────────────────────────────────────────────────────────

/**
 * Error saat pemanggilan tool melanggar batas tenant / input tidak valid.
 * Dipetakan pemanggil menjadi 403/404 — JANGAN pernah membocorkan data tenant
 * lain sebagai respons sukses.
 */
export class ToolError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ToolError";
  }
}

// ── Zona waktu WIB (kompensasi audit §4: semua date-math AI dipaksa WIB) ────
//
// Server bisa berjalan di UTC; perhitungan "hari ini" / "7 hari terakhir" HARUS
// memakai batas hari WIB yang sama dengan yang dilihat owner. Offset WIB tetap
// UTC+7 (tanpa DST), jadi aman memakai offset jam eksplisit.

const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;

// Awal hari (00:00:00.000) WIB untuk sebuah instan, dikembalikan sebagai Date.
function awalHariWib(d: Date): Date {
  const shifted = new Date(d.getTime() + WIB_OFFSET_MS);
  shifted.setUTCHours(0, 0, 0, 0);
  return new Date(shifted.getTime() - WIB_OFFSET_MS);
}

// Parse string tanggal "YYYY-MM-DD" menjadi instan awal hari WIB. Bila tidak
// valid, fallback ke hari ini WIB. Tombol-tombol tanggal dari UI memakai format
// ini (lihat server/http.ts `isDateStr`).
function tanggalWib(tanggal?: string): Date {
  if (tanggal && /^\d{4}-\d{2}-\d{2}$/.test(tanggal)) {
    // "T00:00:00+07:00" = awal hari WIB eksplisit.
    const d = new Date(`${tanggal}T00:00:00+07:00`);
    if (!isNaN(d.getTime())) return d;
  }
  return awalHariWib(new Date());
}

// Label "YYYY-MM-DD" untuk sebuah instan pada zona WIB (untuk kunci hari).
function labelHariWib(d: Date): string {
  const shifted = new Date(d.getTime() + WIB_OFFSET_MS);
  return shifted.toISOString().slice(0, 10);
}

// Batas maksimum baris keluaran tool (lampiran §3: agregat ≤ 50 baris).
const MAKS_BARIS = 50;

// Tipe row JSON-safe untuk nilai uang — selalu integer rupiah.
type RingkasanHarian = {
  tanggal: string;
  omzet: number;
  trx: number;
  tunai: number;
  qris: number;
  rataRata: number;
  topProduk: { name: string; qty: number; omzet: number }[];
};

/**
 * `getRingkasanHari(warungId, { tanggal? })` (lampiran §3).
 * Omzet, jumlah trx, split tunai/qris, dan top-3 produk pada satu hari WIB.
 * `tanggal` default = hari ini WIB (string "YYYY-MM-DD").
 */
export async function getRingkasanHari(
  warungId: string,
  input: { tanggal?: string } = {},
): Promise<RingkasanHarian> {
  const mulai = tanggalWib(input.tanggal);
  const selesai = new Date(mulai.getTime() + 24 * 60 * 60 * 1000);

  const trx = await prisma.transaction.findMany({
    where: { warungId, status: "LUNAS", createdAt: { gte: mulai, lt: selesai } },
    select: { id: true, total: true, payment: true },
  });

  const omzet = trx.reduce((n, t) => n + t.total, 0);
  const tunai = trx.filter((t) => t.payment === "CASH").reduce((n, t) => n + t.total, 0);
  const qris = trx.filter((t) => t.payment === "QRIS").reduce((n, t) => n + t.total, 0);
  const trxCount = trx.length;

  // Top-3 produk hari ini: group by productId di transactionItem yang
  // transaksinya LUNAS dalam jendela hari (scoped warungId — denormalisasi
  // warungId pada TransactionItem membuat scope eksplisit, bukan lewat join).
  const trxIds = trx.map((t) => t.id);
  const grup = trxIds.length
    ? await prisma.transactionItem.groupBy({
        by: ["productId"],
        where: { warungId, transactionId: { in: trxIds }, transaction: { status: "LUNAS" } },
        _sum: { qty: true },
        orderBy: { _sum: { qty: "desc" } },
        take: 3,
      })
    : [];

  const topIds = grup.map((g) => g.productId);
  const produk = topIds.length
    ? await prisma.product.findMany({
        where: { id: { in: topIds }, warungId },
        select: { id: true, name: true, price: true },
      })
    : [];
  const byId = new Map(produk.map((p) => [p.id, p]));
  const topProduk = grup.map((g) => {
    const qty = g._sum.qty ?? 0;
    const harga = byId.get(g.productId)?.price ?? 0;
    return { name: byId.get(g.productId)?.name ?? "?", qty, omzet: harga * qty };
  });

  return {
    tanggal: labelHariWib(mulai),
    omzet,
    trx: trxCount,
    tunai,
    qris,
    rataRata: trxCount > 0 ? Math.round(omzet / trxCount) : 0,
    topProduk,
  };
}

type RekapShift = {
  shiftId: string;
  kasirNama: string;
  status: string;
  modalAwal: number;
  tunai: number;
  qris: number;
  expected: number;
  kasFisik: number | null;
  selisih: number | null;
  trx: number;
};

/**
 * `getRekapShift(warungId, { shiftId })` (lampiran §3).
 * Modal, kas fisik, expected, selisih, dan jumlah trx/shift kasir.
 * WAJIB memverifikasi `shift.warungId === warungId`; beda → `ToolError`.
 */
export async function getRekapShift(
  warungId: string,
  input: { shiftId: string },
): Promise<RekapShift> {
  if (!input.shiftId) throw new ToolError("shiftId wajib diisi.");

  const shift = await prisma.shift.findFirst({
    where: { id: input.shiftId, warungId },
    include: {
      cashier: { select: { name: true } },
      // HANYA transaksi LUNAS yang masuk hitungan (DRAFT = bill terbuka).
      transactions: { where: { status: "LUNAS" }, select: { total: true, payment: true } },
    },
  });
  // findFirst + filter warungId: shift warung lain = "tidak ditemukan" (404),
  // tidak pernah mengembalikan data lintas tenant (§7.2).
  if (!shift) throw new ToolError("Shift tidak ditemukan untuk warung ini.");

  const tunai = shift.transactions
    .filter((t) => t.payment === "CASH")
    .reduce((n, t) => n + t.total, 0);
  const qris = shift.transactions
    .filter((t) => t.payment === "QRIS")
    .reduce((n, t) => n + t.total, 0);
  const expected = shift.modalAwal + tunai;
  const kasFisik = shift.kasFisik;
  const selisih = kasFisik === null ? null : kasFisik - expected;

  return {
    shiftId: shift.id,
    kasirNama: shift.cashier.name,
    status: shift.status,
    modalAwal: shift.modalAwal,
    tunai,
    qris,
    expected,
    kasFisik,
    selisih,
    trx: shift.transactions.length,
  };
}

type StokMenipis = { rows: { name: string; stock: number; category: string }[]; batas: number };

/**
 * `getStokMenipis(warungId, { batas? })` (lampiran §3).
 * Produk dengan stok ≤ batas (default 5), maksimum 50 baris.
 */
export async function getStokMenipis(
  warungId: string,
  input: { batas?: number } = {},
): Promise<StokMenipis> {
  // Clamp batas ke [0, 1000] agar input liar tidak menghabiskan memori.
  const batas = Number.isFinite(input.batas) ? Math.max(0, Math.min(1000, Math.trunc(input.batas as number))) : 5;

  const rows = await prisma.product.findMany({
    where: { warungId, stock: { lte: batas } },
    orderBy: { stock: "asc" },
    take: MAKS_BARIS,
    select: { name: true, stock: true, category: true },
  });

  return { batas, rows };
}

type PenjualanProduk = {
  dari: string;
  sampai: string;
  rows: { name: string; qty: number; omzet: number }[];
};

/**
 * `getPenjualanProduk(warungId, { dari, sampai, limit? })` (lampiran §3).
 * Qty & omzet per produk dalam rentang tanggal (inklusif, WIB).
 */
export async function getPenjualanProduk(
  warungId: string,
  input: { dari: string; sampai: string; limit?: number },
): Promise<PenjualanProduk> {
  const mulai = tanggalWib(input.dari);
  // "sampai" inklusif → akhir hari = awal hari berikutnya (lt).
  const selesai = new Date(tanggalWib(input.sampai).getTime() + 24 * 60 * 60 * 1000);
  const limit = Number.isFinite(input.limit)
    ? Math.max(1, Math.min(MAKS_BARIS, Math.trunc(input.limit as number)))
    : MAKS_BARIS;

  const grup = await prisma.transactionItem.groupBy({
    by: ["productId"],
    where: {
      warungId,
      transaction: { status: "LUNAS", createdAt: { gte: mulai, lt: selesai } },
    },
    _sum: { qty: true },
    orderBy: { _sum: { qty: "desc" } },
    take: limit,
  });

  const ids = grup.map((g) => g.productId);
  const produk = ids.length
    ? await prisma.product.findMany({
        where: { id: { in: ids }, warungId },
        select: { id: true, name: true, price: true },
      })
    : [];
  const byId = new Map(produk.map((p) => [p.id, p]));

  const rows = grup.map((g) => {
    const qty = g._sum.qty ?? 0;
    const harga = byId.get(g.productId)?.price ?? 0;
    return { name: byId.get(g.productId)?.name ?? "?", qty, omzet: harga * qty };
  });

  return { dari: labelHariWib(mulai), sampai: labelHariWib(new Date(selesai.getTime() - 1)), rows };
}

type PenjualanKasir = {
  dari: string;
  sampai: string;
  rows: { kasir: string; trx: number; omzet: number }[];
};

/**
 * `getPenjualanKasir(warungId, { dari, sampai })` (lampiran §3).
 * Jumlah trx & omzet per kasir dalam rentang (owner-only view).
 */
export async function getPenjualanKasir(
  warungId: string,
  input: { dari: string; sampai: string },
): Promise<PenjualanKasir> {
  const mulai = tanggalWib(input.dari);
  const selesai = new Date(tanggalWib(input.sampai).getTime() + 24 * 60 * 60 * 1000);

  const grup = await prisma.transaction.groupBy({
    by: ["cashierId"],
    where: { warungId, status: "LUNAS", createdAt: { gte: mulai, lt: selesai } },
    _sum: { total: true },
    _count: true,
    orderBy: { _sum: { total: "desc" } },
    take: MAKS_BARIS,
  });

  const ids = grup.map((g) => g.cashierId);
  const kasirs = ids.length
    ? await prisma.user.findMany({
        where: { id: { in: ids }, warungId },
        select: { id: true, name: true },
      })
    : [];
  const byName = new Map(kasirs.map((u) => [u.id, u.name]));

  const rows = grup.map((g) => ({
    kasir: byName.get(g.cashierId) ?? "?",
    trx: g._count,
    omzet: g._sum.total ?? 0,
  }));

  return { dari: labelHariWib(mulai), sampai: labelHariWib(new Date(selesai.getTime() - 1)), rows };
}

type Tren = { hari: number; rows: { tanggal: string; omzet: number; trx: number }[] };

/**
 * `getTren(warungId, { hari? })` (lampiran §3).
 * Deret omzet per hari (default 7 hari, termasuk hari ini) untuk chart.
 */
export async function getTren(warungId: string, input: { hari?: number } = {}): Promise<Tren> {
  // Clamp hari ke [1, 90] agar deret tetap kecil & query murah.
  const hari = Number.isFinite(input.hari)
    ? Math.max(1, Math.min(90, Math.trunc(input.hari as number)))
    : 7;

  const hariIni = awalHariWib(new Date());
  const mulai = new Date(hariIni.getTime() - (hari - 1) * 24 * 60 * 60 * 1000);
  const selesai = new Date(hariIni.getTime() + 24 * 60 * 60 * 1000);

  const trx = await prisma.transaction.findMany({
    where: { warungId, status: "LUNAS", createdAt: { gte: mulai, lt: selesai } },
    select: { total: true, createdAt: true },
  });

  // Susun deret kontinu (hari tanpa trx → omzet 0) memakai batas WIB.
  const rows: { tanggal: string; omzet: number; trx: number }[] = [];
  for (let i = 0; i < hari; i++) {
    const d = new Date(mulai.getTime() + i * 24 * 60 * 60 * 1000);
    const next = new Date(d.getTime() + 24 * 60 * 60 * 1000);
    const hariTrx = trx.filter((t) => t.createdAt >= d && t.createdAt < next);
    rows.push({
      tanggal: labelHariWib(d),
      omzet: hariTrx.reduce((n, t) => n + t.total, 0),
      trx: hariTrx.length,
    });
  }

  return { hari, rows };
}

type AnomaliAktif = {
  hari: number;
  rows: { id: string; title: string; rule: AnomaliRule | null; severity: string | null; createdAt: Date }[];
};

/**
 * `getAnomaliAktif(warungId, { hari? })` (lampiran §3).
 * Insight ANOMALY yang BELUM dibaca (`readAt = null`) dalam N hari terakhir.
 * `rule`/`severity` diambil dari `findings` JSON (bukti §4); null bila tak ada.
 */
export async function getAnomaliAktif(
  warungId: string,
  input: { hari?: number } = {},
): Promise<AnomaliAktif> {
  const hari = Number.isFinite(input.hari)
    ? Math.max(1, Math.min(90, Math.trunc(input.hari as number)))
    : 7;

  const hariIni = awalHariWib(new Date());
  const mulai = new Date(hariIni.getTime() - (hari - 1) * 24 * 60 * 60 * 1000);

  const insights = await prisma.insight.findMany({
    where: { warungId, type: "ANOMALY", readAt: null, createdAt: { gte: mulai } },
    orderBy: { createdAt: "desc" },
    take: MAKS_BARIS,
    select: { id: true, title: true, findings: true, createdAt: true },
  });

  const rows = insights.map((i) => {
    let rule: AnomaliRule | null = null;
    let severity: string | null = null;
    // `findings` = JSON string; parse defensif — jangan crash bila cacat.
    if (i.findings) {
      try {
        const f = JSON.parse(i.findings) as { rule?: AnomaliRule; severity?: string };
        rule = f.rule ?? null;
        severity = f.severity ?? null;
      } catch {
        // Abaikan JSON rusak.
      }
    }
    return { id: i.id, title: i.title, rule, severity, createdAt: i.createdAt };
  });

  return { hari, rows };
}
