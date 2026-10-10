// Rules anomali DETERMINISTIK untuk "KRING! Insight" (lampiran AI §4).
//
// PRINSIP (§4, §1.6): temuan dihitung MURNI kode — bukan tebakan model. AI (bila
// dipakai) hanya MERANGKAI kalimat dari daftar `[{rule, bukti, angka}]`; ia tidak
// pernah menentukan siapa bersalah. Ini mencegah AI "mengarang" tuduhan ke kasir.
//
// ATURAN KERAS:
//  1. Semua fungsi menerima `warungId` sebagai ARGUMEN PERTAMA (disuntik dari
//     session server-side); SEMUA query difilter `warungId` (§7.2).
//  2. Semua ambang batas = named const (tunable nanti per warung).
//  3. Semua date-math dipaksa WIB `Asia/Jakarta` (kompensasi audit §4), meniru
//     pola helper di `src/server/ai/tools.ts`.
//  4. Uang selalu integer rupiah (hindari float).
//
// `simpanAnomali` menyimpan tiap temuan lewat `tulisInsight` bertipe ANOMALY.
// Body disusun DETERMINISTIK dari angka (bukan LLM) agar temuan SELALU tersimpan
// walau provider AI mati (§9) — narasi AI atas anomali bisa ditambahkan kemudian.

import { prisma } from "@/server/db";
import { rupiah } from "@/shared/rupiah";
import { tulisInsight } from "@/server/ai/insight";
import type { AnomaliRule, AnomaliSeverity, TemuanAnomali } from "@/server/ai/types";

// ── Zona waktu WIB (kompensasi audit §4: semua date-math AI dipaksa WIB) ────
//
// Salinan pola dari src/server/ai/tools.ts (offset tetap UTC+7, tanpa DST) agar
// "hari ini" / jendela jam sama dengan yang dilihat owner.

const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;

// Berapa hari ke belakang untuk baseline OMZET_ANJLOK (rata-rata omzet).
const BASELINE_HARI = 7;

// ── Ambang batas rules (§4 — tunable per warung kelak) ──────────────────────

/** DISKON_BESAR: diskon nominal minimum (rupiah) agar dianggap besar. */
const DISKON_NOMINAL_MAKS = 50_000;
/** DISKON_BESAR: persentase diskon minimum terhadap subtotal (0.30 = 30%). */
const DISKON_PERSEN_MAKS = 0.3;
/** DISKON_BESAR: frekuensi per shift → severity "tinggi" bila ≥ nilai ini. */
const DISKON_FREKUENSI_TINGGI = 3;

/** SELISIH_KAS_NEGATIF: selisih kas di bawah ambang ini (rupiah, negatif). */
const SELISIH_KAS_AMBANG = -5_000;
/** SELISIH_KAS_NEGATIF: kasir sama ≥ nilai ini → eskalasi/"tinggi". */
const SELISIH_KAS_ESKALASI_SHIFT = 2;

/** OMZET_ANJLOK: rasio omzet hari ini vs rata-rata baseline (0.5 = 50%). */
const OMZET_ANJLOK_RASIO = 0.5;

/** CHECKOUT_ANEH: rasio rata-rata nilai trx/shift vs median warung (3×). */
const CHECKOUT_ANEH_RASIO = 3;

// ── Helper waktu (WIB) ───────────────────────────────────────────────────────

// Awal hari (00:00:00.000) WIB untuk sebuah instan, dikembalikan sebagai Date.
function awalHariWib(d: Date): Date {
  const shifted = new Date(d.getTime() + WIB_OFFSET_MS);
  shifted.setUTCHours(0, 0, 0, 0);
  return new Date(shifted.getTime() - WIB_OFFSET_MS);
}

// Label "YYYY-MM-DD" untuk sebuah instan pada zona WIB.
function labelHariWib(d: Date): string {
  const shifted = new Date(d.getTime() + WIB_OFFSET_MS);
  return shifted.toISOString().slice(0, 10);
}

// Parse string tanggal "YYYY-MM-DD" → instan awal hari WIB. Tidak valid → hari
// ini WIB (pola sama dengan tools.ts `tanggalWib`).
function tanggalWib(tanggal?: string): Date {
  if (tanggal && /^\d{4}-\d{2}-\d{2}$/.test(tanggal)) {
    const d = new Date(`${tanggal}T00:00:00+07:00`);
    if (!isNaN(d.getTime())) return d;
  }
  return awalHariWib(new Date());
}

// Menit-sejak-tengah-malam WIB untuk sebuah instan — dipakai aturan jam operasional.
function menitHariWib(d: Date): number {
  const shifted = new Date(d.getTime() + WIB_OFFSET_MS);
  return shifted.getUTCHours() * 60 + shifted.getUTCMinutes();
}

// Parse "HH:MM" → menit sejak tengah malam. Tidak valid → null.
function menitDariJam(jam: string | null | undefined): number | null {
  if (!jam || !/^\d{1,2}:\d{2}$/.test(jam.trim())) return null;
  const [h, m] = jam.trim().split(":").map((x) => Number(x));
  if (!Number.isFinite(h) || !Number.isFinite(m) || h < 0 || h > 23 || m < 0 || m > 59) return null;
  return h * 60 + m;
}

// Median dari deret angka. Deret kosong → 0.
function median(nilai: number[]): number {
  if (nilai.length === 0) return 0;
  const urut = [...nilai].sort((a, b) => a - b);
  const tengah = Math.floor(urut.length / 2);
  return urut.length % 2 === 0 ? Math.round((urut[tengah - 1] + urut[tengah]) / 2) : urut[tengah];
}

// ── Konteks pemanggilan ──────────────────────────────────────────────────────

export type AnomaliContext = {
  /** Tanggal (WIB) yang discan untuk rules harian, "YYYY-MM-DD". Default hari ini. */
  hari?: string;
  /** Bila diisi (dari tutup-shift), rules ber-fokus shift memakai shift ini. */
  shiftId?: string;
};

// Helper internal: bangun satu temuan.
function temuan(
  rule: AnomaliRule,
  severity: AnomaliSeverity,
  bukti: string,
  angka: Record<string, number>,
): TemuanAnomali {
  return { rule, severity, bukti, angka };
}

// ── Rule: DISKON_BESAR (§4) ──────────────────────────────────────────────────
//
// Diskonto > Rp50.000 ATAU > 30% subtotal. Severity "tinggi" bila frekuensi
// temuan ≥ 3× dalam satu shift, selain itu "sedang". Bila `shiftId` diisi,
// hitungan dibatasi pada transaksi shift itu; bila tidak, seluruh hari WIB.

async function ruleDiskonBesar(
  warungId: string,
  ctx: AnomaliContext,
): Promise<TemuanAnomali | null> {
  const mulai = tanggalWib(ctx.hari);
  const selesai = new Date(mulai.getTime() + 24 * 60 * 60 * 1000);

  const trx = await prisma.transaction.findMany({
    where: {
      warungId,
      status: "LUNAS",
      discount: { gt: 0 },
      ...(ctx.shiftId ? { shiftId: ctx.shiftId } : { createdAt: { gte: mulai, lt: selesai } }),
    },
    select: { discount: true, subtotal: true },
  });

  // Temuan = diskon > nominal MAKS ATAU > persen MAKS dari subtotal.
  const besar = trx.filter(
    (t) =>
      t.discount > DISKON_NOMINAL_MAKS ||
      (t.subtotal > 0 && t.discount > t.subtotal * DISKON_PERSEN_MAKS),
  );
  if (besar.length === 0) return null;

  const totalDiskon = besar.reduce((n, t) => n + t.discount, 0);
  const maksDiskon = besar.reduce((n, t) => Math.max(n, t.discount), 0);
  const severity: AnomaliSeverity = besar.length >= DISKON_FREKUENSI_TINGGI ? "tinggi" : "sedang";

  return temuan(
    "DISKON_BESAR",
    severity,
    `${besar.length} transaksi dengan diskon besar (total ${rupiah(totalDiskon)}, terbesar ${rupiah(maksDiskon)}); ambang ${rupiah(DISKON_NOMINAL_MAKS)} atau >${DISKON_PERSEN_MAKS * 100}% subtotal.`,
    { jumlah: besar.length, totalDiskon, maksDiskon, ambangNominal: DISKON_NOMINAL_MAKS },
  );
}

// ── Rule: SELISIH_KAS_NEGATIF (§4) ───────────────────────────────────────────
//
// Selisih kas < -Rp5.000. Eskalasi "tinggi" bila KASIR yang sama punya ≥ 2 shift
// dengan selisih negatif (pola berulang, bukan salah hitung sesekali).
// Bila `shiftId` diisi → nilai yang diperiksa = shift itu; histori tetap dihitung
// warung-wide untuk deteksi pengulangan per kasir.

async function ruleSelisihKasNegatif(
  warungId: string,
  ctx: AnomaliContext,
): Promise<TemuanAnomali | null> {
  if (!ctx.shiftId) return null; // rule ini butuh shift konkret (kas fisik diisi saat tutup)

  const shift = await prisma.shift.findFirst({
    where: { id: ctx.shiftId, warungId },
    include: {
      cashier: { select: { name: true } },
      transactions: { where: { status: "LUNAS" }, select: { total: true, payment: true } },
    },
  });
  if (!shift || shift.kasFisik === null) return null;

  const tunai = shift.transactions
    .filter((t) => t.payment === "CASH")
    .reduce((n, t) => n + t.total, 0);
  const expected = shift.modalAwal + tunai;
  const selisih = shift.kasFisik - expected;
  if (selisih >= SELISIH_KAS_AMBANG) return null;

  // Hitung berapa shift kasir ini (TUTUP) yang juga berselisih < ambang.
  const riwayat = await prisma.shift.findMany({
    where: { warungId, cashierId: shift.cashierId, status: "TUTUP", kasFisik: { not: null } },
    select: { modalAwal: true, kasFisik: true, transactions: { where: { status: "LUNAS", payment: "CASH" }, select: { total: true } } },
  });
  const negatifCount = riwayat.filter((s) => {
    const t = s.transactions.reduce((n, x) => n + x.total, 0);
    return (s.kasFisik ?? 0) - (s.modalAwal + t) < SELISIH_KAS_AMBANG;
  }).length;

  const severity: AnomaliSeverity = negatifCount >= SELISIH_KAS_ESKALASI_SHIFT ? "tinggi" : "sedang";

  return temuan(
    "SELISIH_KAS_NEGATIF",
    severity,
    `Kasir ${shift.cashier.name}: kas fisik ${rupiah(shift.kasFisik)} vs expected ${rupiah(expected)} → selisih ${rupiah(selisih)} (ambang ${rupiah(SELISIH_KAS_AMBANG)}). ${negatifCount} shift kasir ini bernilai negatif.`,
    { selisih, expected, kasFisik: shift.kasFisik, negatifCount, ambang: SELISIH_KAS_AMBANG },
  );
}

// ── Rule: TRANSAKSI_LUAR_JAM (§4) ────────────────────────────────────────────
//
// Transaksi LUNAS di luar jam operasional Setting (jamBuka/jamTutup). Bila
// setting tidak diisi → pakai default 07:00–21:00 (sama dengan fallback UI).
// Jendela jam sengaja sederhana (bukan lintas tengah malam) — cukup untuk pola
// warung; jam tutup ≥ jam buka diasumsikan.

const JAM_BUKA_DEFAULT = "07:00";
const JAM_TUTUP_DEFAULT = "21:00";

async function ruleTransaksiLuarJam(
  warungId: string,
  ctx: AnomaliContext,
): Promise<TemuanAnomali | null> {
  const mulai = tanggalWib(ctx.hari);
  const selesai = new Date(mulai.getTime() + 24 * 60 * 60 * 1000);

  const setting = await prisma.setting.findUnique({
    where: { warungId },
    select: { jamBuka: true, jamTutup: true },
  });
  const bukaMenit = menitDariJam(setting?.jamBuka) ?? menitDariJam(JAM_BUKA_DEFAULT)!;
  const tutupMenit = menitDariJam(setting?.jamTutup) ?? menitDariJam(JAM_TUTUP_DEFAULT)!;

  const trx = await prisma.transaction.findMany({
    where: { warungId, status: "LUNAS", createdAt: { gte: mulai, lt: selesai } },
    select: { createdAt: true },
  });

  const luar = trx.filter((t) => {
    const menit = menitHariWib(t.createdAt);
    return menit < bukaMenit || menit > tutupMenit;
  });
  if (luar.length === 0) return null;

  return temuan(
    "TRANSAKSI_LUAR_JAM",
    "sedang",
    `${luar.length} transaksi di luar jam operasional (${setting?.jamBuka ?? JAM_BUKA_DEFAULT}–${setting?.jamTutup ?? JAM_TUTUP_DEFAULT}).`,
    { jumlah: luar.length, bukaMenit, tutupMenit },
  );
}

// ── Rule: OMZET_ANJLOK (§4) ──────────────────────────────────────────────────
//
// Omzet hari ini < 50% rata-rata 7 hari sebelumnya. Hanya bila ada baseline
// (rata-rata > 0) agar warung baru tanpa histori tidak menimbulkan false positive.

async function ruleOmzetAnjok(
  warungId: string,
  ctx: AnomaliContext,
): Promise<TemuanAnomali | null> {
  const hariIni = tanggalWib(ctx.hari);
  const selesai = new Date(hariIni.getTime() + 24 * 60 * 60 * 1000);
  const baselineMulai = new Date(hariIni.getTime() - BASELINE_HARI * 24 * 60 * 60 * 1000);

  const [hariTrx, baselineTrx] = await Promise.all([
    prisma.transaction.aggregate({
      _sum: { total: true },
      _count: true,
      where: { warungId, status: "LUNAS", createdAt: { gte: hariIni, lt: selesai } },
    }),
    prisma.transaction.findMany({
      where: { warungId, status: "LUNAS", createdAt: { gte: baselineMulai, lt: hariIni } },
      select: { total: true, createdAt: true },
    }),
  ]);

  const omzetHari = hariTrx._sum.total ?? 0;

  // Rata-rata omzet per hari WIB selama baseline (hari tanpa trx dihitung 0).
  let totalBaseline = 0;
  for (let i = 0; i < BASELINE_HARI; i++) {
    const d = new Date(baselineMulai.getTime() + i * 24 * 60 * 60 * 1000);
    const next = new Date(d.getTime() + 24 * 60 * 60 * 1000);
    totalBaseline += baselineTrx
      .filter((t) => t.createdAt >= d && t.createdAt < next)
      .reduce((n, t) => n + t.total, 0);
  }
  const rataBaseline = totalBaseline / BASELINE_HARI;
  if (rataBaseline <= 0) return null; // tak ada baseline → jangan menuduh

  if (omzetHari >= rataBaseline * OMZET_ANJLOK_RASIO) return null;

  return temuan(
    "OMZET_ANJLOK",
    "sedang",
    `Omzet ${labelHariWib(hariIni)} = ${rupiah(omzetHari)} (${hariTrx._count} trx), jauh di bawah rata-rata ${BASELINE_HARI} hari (${rupiah(Math.round(rataBaseline))}) — ambang ${OMZET_ANJLOK_RASIO * 100}%.`,
    { omzetHari, rataBaseline: Math.round(rataBaseline), trx: hariTrx._count, rasio: OMZET_ANJLOK_RASIO },
  );
}

// ── Rule: TRX_TANPA_SHIFT (§4) ───────────────────────────────────────────────
//
// Transaksi LUNAS dengan `shiftId` null (dijual saat tak ada shift BUKA) →
// kasnya tak bisa direkonsiliasi. Sinyal ini sudah ditandai audit
// CHECKOUT_TANPA_SHIFT (M3, checkout/route.ts); di sini kita pakai ulang sinyal
// itu sebagai sumber rule agar konsisten (bukan menghitung ulang heuristik lain).

const CHECKOUT_TANPA_SHIFT_ACTION = "CHECKOUT_TANPA_SHIFT";

async function ruleTrxTanpaShift(
  warungId: string,
  ctx: AnomaliContext,
): Promise<TemuanAnomali | null> {
  const mulai = tanggalWib(ctx.hari);
  const selesai = new Date(mulai.getTime() + 24 * 60 * 60 * 1000);

  const audit = await prisma.auditLog.findMany({
    where: {
      warungId,
      action: CHECKOUT_TANPA_SHIFT_ACTION,
      createdAt: { gte: mulai, lt: selesai },
    },
    select: { id: true },
  });
  if (audit.length === 0) return null;

  return temuan(
    "TRX_TANPA_SHIFT",
    "sedang",
    `${audit.length} transaksi tercatat tanpa shift terbuka (kas tak bisa direkonsiliasi ke rekap shift).`,
    { jumlah: audit.length },
  );
}

// ── Rule: CHECKOUT_ANEH (§4) ─────────────────────────────────────────────────
//
// Rata-rata nilai trx per shift > 3× median nilai trx warung. Severity rendah
// (informatif). Butuh `shiftId` (rule per-shift); median dihitung warung-wide.

async function ruleCheckoutAneh(
  warungId: string,
  ctx: AnomaliContext,
): Promise<TemuanAnomali | null> {
  if (!ctx.shiftId) return null;

  const shift = await prisma.shift.findFirst({
    where: { id: ctx.shiftId, warungId },
    include: { transactions: { where: { status: "LUNAS" }, select: { total: true } } },
  });
  if (!shift || shift.transactions.length === 0) return null;

  const nilai = shift.transactions.map((t) => t.total);
  const rataShift = nilai.reduce((n, t) => n + t, 0) / nilai.length;

  // Median nilai trx warung (semua LUNAS) sebagai pembanding.
  const semua = await prisma.transaction.findMany({
    where: { warungId, status: "LUNAS" },
    select: { total: true },
    take: 2000,
  });
  const medianWarung = median(semua.map((t) => t.total));
  if (medianWarung <= 0) return null; // tak ada pembanding → jangan menuduh

  if (rataShift <= medianWarung * CHECKOUT_ANEH_RASIO) return null;

  return temuan(
    "CHECKOUT_ANEH",
    "rendah",
    `Rata-rata nilai transaksi shift ${rupiah(Math.round(rataShift))} > ${CHECKOUT_ANEH_RASIO}× median warung (${rupiah(medianWarung)}).`,
    { rataShift: Math.round(rataShift), medianWarung, rasio: CHECKOUT_ANEH_RASIO },
  );
}

// ── Orkestrator: jalankan semua rule yang berlaku (§4) ───────────────────────

/**
 * Jalankan seluruh rule anomali yang berlaku (§4) untuk sebuah warung.
 *
 * `warungId` = argumen pertama (disuntik dari session; model tak pernah pegang).
 * `hari` default = hari ini WIB. `shiftId` (dari tutup-shift) mengaktifkan rule
 * ber-fokus shift (SELISIH_KAS_NEGATIF, CHECKOUT_ANEH) dan memfokuskan
 * DISKON_BESAR pada shift itu.
 *
 * Mengembalikan daftar `TemuanAnomali` (bisa kosong). Rule dijalankan paralel;
 * urutan temuan = urutan rule (deterministik). TIDAK menangkap error DB — itu
 * tanggung jawab pemanggil (endpoint dibungkus try/catch).
 */
export async function jalankanAnomali(
  warungId: string,
  ctx: AnomaliContext = {},
): Promise<TemuanAnomali[]> {
  const hasil = await Promise.all([
    ruleDiskonBesar(warungId, ctx),
    ruleSelisihKasNegatif(warungId, ctx),
    ruleTransaksiLuarJam(warungId, ctx),
    ruleOmzetAnjok(warungId, ctx),
    ruleTrxTanpaShift(warungId, ctx),
    ruleCheckoutAneh(warungId, ctx),
  ]);

  // Buang null, jaga urutan rule (§4).
  return hasil.filter((t): t is TemuanAnomali => t !== null);
}

// ── Penyimpan hasil → Insight ANOMALY (§5, §9) ───────────────────────────────

// Judul ringkas per rule untuk title Insight (deterministik).
const JUDUL_RULE: Record<AnomaliRule, string> = {
  DISKON_BESAR: "Diskon besar terdeteksi",
  SELISIH_KAS_NEGATIF: "Selisih kas negatif",
  TRANSAKSI_LUAR_JAM: "Transaksi di luar jam operasional",
  OMZET_ANJLOK: "Omzet anjlok",
  TRX_TANPA_SHIFT: "Transaksi tanpa shift",
  CHECKOUT_ANEH: "Pola nilai transaksi tidak wajar",
};

// Tautan sumber laporan agar owner bisa menelusuri klaim (>angka asli, §1.6).
function sumberUntuk(ctx: AnomaliContext): string {
  const hari = ctx.hari ?? labelHariWib(new Date());
  return `/laporan?dari=${hari}&sampai=${hari}`;
}

/**
 * Simpan temuan hasil scan sebagai Insight ANOMALY (§5).
 *
 * Body disusun DETERMINISTIK dari angka (§4) — TIDAK memanggil LLM, sehingga
 * temuan SELALU tersimpan walau provider AI mati (§9). Dedup ditangani
 * `tulisInsight` (type + warungId + hari WIB yang sama = 1 baris, di-update).
 *
 * `findings` = daftar temuan ringkas (bukti angka) untuk verifikasi owner.
 * Mengembalikan jumlah insight yang ditulis (0 bila tidak ada temuan).
 */
export async function simpanAnomali(
  warungId: string,
  temuanList: TemuanAnomali[],
  ctx: AnomaliContext = {},
): Promise<number> {
  if (temuanList.length === 0) return 0;

  const source = sumberUntuk(ctx);
  const hari = ctx.hari ?? labelHariWib(new Date());

  // Satu Insight ringkas memuat SEMUA temuan hari itu (judul = rule terbanyak
  // severity-nya). Ini menjaga dashboard tetap rapi + dedup per hari (§4).
  const prioritas: Record<AnomaliSeverity, number> = { tinggi: 3, sedang: 2, rendah: 1 };
  const tertinggi = temuanList.reduce(
    (acc, t) => (prioritas[t.severity] > prioritas[acc.severity] ? t : acc),
    temuanList[0],
  );

  const body = [
    `Scan anomali ${hari}: ${temuanList.length} temuan.`,
    ...temuanList.map((t) => `• [${t.rule}] ${t.bukti}`),
  ].join("\n");

  await tulisInsight(warungId, {
    type: "ANOMALY",
    title: `${JUDUL_RULE[tertinggi.rule]} (+${temuanList.length - 1} temuan lain)`,
    body,
    findings: temuanList,
    source,
  });

  return 1;
}
