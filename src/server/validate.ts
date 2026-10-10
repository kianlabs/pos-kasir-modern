// Validator kecil tanpa dependensi (tanpa zod) — dipakai route API untuk
// mengetatkan input (temuan S4). Semua fungsi murni dan aman.

/**
 * Koersi nilai ke string yang sudah di-trim, lalu potong ke panjang maksimum.
 * Nilai non-string → "" (bukan "undefined"/"null").
 */
export function str(v: unknown, max = 200): string {
  const s = typeof v === "string" ? v : v === null || v === undefined ? "" : String(v);
  return s.trim().slice(0, max);
}

/**
 * Seperti `str`, tetapi nilai kosong/null/undefined → null (bukan "").
 * Berguna untuk kolom nullable (mis. receiptName, jamBuka).
 */
export function optionalStr(v: unknown, max = 200): string | null {
  const s = str(v, max);
  return s.length > 0 ? s : null;
}

/**
 * Validasi format jam "HH:MM" 24-jam. Menolak jam di luar 00-23 dan menit di
 * luar 00-59. Contoh: `isHHMM("07:30") → true`, `isHHMM("24:00") → false`.
 */
export function isHHMM(v: string): boolean {
  if (!/^\d{2}:\d{2}$/.test(v)) return false;
  const [h, m] = v.split(":").map(Number);
  return h >= 0 && h <= 23 && m >= 0 && m <= 59;
}
