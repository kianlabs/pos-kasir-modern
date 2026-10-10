// Sumber kebenaran TUNGGAL untuk rumus uang (subtotal/diskon/pajak/total) — m5.
//
// Semua uang adalah INTEGER rupiah. Modul ini MURNI (tanpa efek samping, tanpa
// `node:*`, tanpa Prisma) sehingga aman dipakai di SERVER maupun CLIENT
// (lihat docs/NAMING.md — `shared/` boleh diimpor dua sisi).
//
// Sebelumnya rumus yang sama disalin di ≥5 tempat (meja.ts, settings.ts,
// /api/settings, offline-sync.ts, page.tsx, struk offline) — risiko divergensi
// pada matematika uang. Semua pemanggil kini dirutekan lewat helper di sini.
//
// Bentuk KANONIK:
//   disc  = min(discount, subtotal)              // diskon tak boleh > subtotal
//   tax   = taxEnabled ? round((subtotal - disc) * taxPct / 100) : 0
//   total = subtotal - disc + tax
//
// Catatan kontrak persen pajak: setiap pemanggil tetap melakukan koersi yang
// sudah ada (`Number(x) || 0`) SEBELUM memanggil helper ini — agar NaN → 0 dan
// `null`/string tetap ditangani seperti semula. Helper `clampTaxPct` sendiri
// menerima angka yang SUDAH jadi number dan hanya melakukan clamp [0, 100].

/**
 * Clamp persen pajak ke rentang [0, 100].
 *
 * Murni: TIDAK melakukan koersi tipe (pemanggil yang mengubah `Number(x) || 0`).
 * Contoh: `clampTaxPct(150) → 100`, `clampTaxPct(-5) → 0`, `clampTaxPct(10) → 10`.
 */
export function clampTaxPct(pct: number): number {
  return Math.min(100, Math.max(0, pct));
}

export type HitungUangInput = {
  subtotal: number;
  discount: number;
  taxEnabled: boolean;
  taxPct: number;
  /**
   * Batas atas diskon (default = subtotal → tak ada klamp tambahan). Dipakai
   * jalur sync offline yang mengklamp diskon ke BATAS_UANG sebelum dipakai.
   */
  discountMax?: number;
};

export type HitungUangHasil = {
  subtotal: number;
  /** Diskon terpakai (sudah di-clamp ke [0, subtotal]). */
  discount: number;
  tax: number;
  total: number;
};

/**
 * Rumus uang kanonik (integer rupiah).
 *
 * Implementasi PERSIS sama dengan rumus yang dulu tersebar — termasuk
 * `Math.round` dan urutan operasi — agar hasil numerik IDENTIK.
 */
export function hitungUang(input: HitungUangInput): HitungUangHasil {
  const { subtotal, taxEnabled, taxPct } = input;
  const discountMax = input.discountMax ?? subtotal;
  const discount = Math.min(input.discount, discountMax, subtotal);
  const tax = taxEnabled ? Math.round(((subtotal - discount) * taxPct) / 100) : 0;
  const total = subtotal - discount + tax;
  return { subtotal, discount, tax, total };
}

export type SeimbangkanInput = {
  subtotal: number;
  /** Diskon yang diminta kasir (sudah di-clamp pemanggil ke [0, BATAS_UANG]). */
  discountIn: number;
  /** Pajak acuan dari setting — dipakai menyerap selisih ke total client. */
  tax0: number;
  /** Total otoritatif dari client (uang sudah diterima kasir saat offline). */
  total: number;
};

export type SeimbangkanHasil = {
  discount: number;
  tax: number;
};

/**
 * Jalur SYNC OFFLINE: sesuaikan diskon/pajak agar invarian uang
 * `subtotal - discount + tax === total` PERSIS (integer rupiah), dengan
 * `total` dari client sebagai otoritatif dan `tax0` (pajak acuan setting)
 * sebagai penyerap selisih.
 *
 * Diskon di-clamp ke [discountIn, subtotal] (diskon tersimpan tak pernah lebih
 * kecil dari niat kasir, tak pernah melebihi subtotal). Pajak tersimpan adalah
 * sisa penyeimbang sehingga invarian selalu eksak.
 */
export function seimbangkanKeTotal(input: SeimbangkanInput): SeimbangkanHasil {
  const { subtotal, discountIn, tax0, total } = input;
  const discount = Math.min(Math.max(discountIn, subtotal + tax0 - total), subtotal);
  const tax = total - (subtotal - discount);
  return { discount, tax };
}
