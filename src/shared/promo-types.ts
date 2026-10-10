// Tipe + helper MURNI untuk promo engine (Fase 2 §7a).
//
// Modul ini aman diimpor DUA SISI (server & client) — tanpa `node:*`, tanpa
// Prisma — seperti `shared/hitung-uang.ts` (lihat docs/NAMING.md).
//
// PRINSIP NON-NEGOTIABLE: promo = KALKULATOR + KATALOG, bukan jalur uang.
// Diskon yang dihitung di sini dikirim kasir lewat field `discount` yang SUDAH
// ADA di checkout — rumus uang kanonik (`hitungUang`) tidak diubah sama sekali.

/** Tipe promo yang didukung (const union string — konsisten dengan konvensi repo). */
export type PromoTipe = "PERSEN" | "NOMINAL" | "BELI_1_GRATIS_1" | "HAPPY_HOUR";

export const PROMO_TIPE: readonly PromoTipe[] = [
  "PERSEN",
  "NOMINAL",
  "BELI_1_GRATIS_1",
  "HAPPY_HOUR",
];

/** Bentuk promo yang dibutuhkan kalkulator (subset kolom DB, cukup untuk evaluasi). */
export type Promo = {
  id: string;
  kode: string | null;
  nama: string;
  tipe: PromoTipe;
  nilai: number;
  minSubtotal: number;
  jamMulai: string | null;
  jamSelesai: string | null;
  aktif: boolean;
};

/** Satu baris keranjang yang dievaluasi — qty integer > 0. */
export type PromoItem = { productId: string; qty: number };

/** Konteks evaluasi: subtotal (rupiah, integer), harga per produk, jam WIB opsional. */
export type CartCtx = {
  /** Subtotal dari harga SERVER (jangan pernah mempercayai subtotal client). */
  subtotal: number;
  /** Peta harga produk (rupiah) — dibutuhkan BELI_1_GRATIS_1. */
  prices: Map<string, number>;
  /** "HH:MM" waktu WIB saat evaluasi — hanya dipakai HAPPY_HOUR. */
  jam?: string;
};

/** Input endpoint /api/promo/evaluate. */
export type EvaluateInput = {
  warungId: string;
  items: PromoItem[];
  subtotal: number;
  /** "HH:MM" WIB; bila kosong server memakai jam WIB saat ini. */
  jam?: string;
};

/** Satu promo yang menang + alasan singkat (untuk struk/UI kasir). */
export type PromoDipakai = {
  promoId: string;
  kode: string | null;
  nama: string;
  alasan: string;
};

/** Hasil evaluasi — diskon integer rupiah (0 bila tak ada promo cocok). */
export type EvaluateResult = {
  diskon: number;
  dipakai: PromoDipakai[];
};

// ── Helper waktu WIB (offset tetap UTC+7, tanpa DST — sama dgn dashboard/ai) ──

const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;

/**
 * Jam "HH:MM" pada zona WIB untuk instan `d` (default: sekarang). Murni —
 * menambah offset +7 jam lalu membaca UTC (trik yang sama dipakai modul lain).
 */
export function jamWIB(d: Date = new Date()): string {
  const shifted = new Date(d.getTime() + WIB_OFFSET_MS);
  const hh = String(shifted.getUTCHours()).padStart(2, "0");
  const mm = String(shifted.getUTCMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

/**
 * Ubah "HH:MM" menjadi menit sejak tengah malam. Mengembalikan null bila format
 * tidak valid (dipakai untuk menolak konfig jam HAPPY_HOUR yang salah).
 */
export function menitHHMM(hhmm: string): number | null {
  if (!/^\d{2}:\d{2}$/.test(hhmm)) return null;
  const [h, m] = hhmm.split(":").map(Number);
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return h * 60 + m;
}

/**
 * Apakah `jam` ("HH:MM" WIB) berada di dalam jendela [mulai, selesai].
 * Jendela normal (mulai <= selesai) dan jendela lintas-tengah-malam
 * (mis. 22:00–02:00, mulai > selesai) dua-duanya didukung.
 */
export function dalamJam(jam: string, mulai: string | null, selesai: string | null): boolean {
  if (!mulai || !selesai) return false;
  const now = menitHHMM(jam);
  const a = menitHHMM(mulai);
  const b = menitHHMM(selesai);
  if (now === null || a === null || b === null) return false;
  if (a <= b) return now >= a && now <= b;
  // Lintas tengah malam: mis. 22:00 s.d. 02:00.
  return now >= a || now <= b;
}
