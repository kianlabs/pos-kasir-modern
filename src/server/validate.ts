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

// Minimal panjang kata sandi akun owner (audit keamanan: 6 terlalu tipis untuk
// app yang memegang uang). PIN kasir terpisah (6 digit) & tidak lewat sini.
export const MIN_PASSWORD_LEN = 8;

// Kata sandi yang terlalu mudah ditebak — ditolak walau panjangnya cukup.
// Daftar pendek & fokus (bukan wordlist besar): pola paling umum di Indonesia
// + pola berurutan. Cukup untuk memaksa owner memilih sandi yang tak instan.
const PASSWORD_UMUM = new Set([
  "password", "password123", "password1", "passw0rd",
  "12345678", "123456789", "1234567890", "1234567",
  "qwertyui", "qwerty123", "11111111", "00000000",
  "iloveyou", "admin123", "adminadmin", "warung123",
  "kasir123", "kring123", "rahasia", "rahasia123",
  "bismillah", "indonesia", "jakarta123",
]);

/**
 * Validasi kekuatan kata sandi owner. Kembalikan pesan error (Indonesia) bila
 * tidak lolos, atau null bila OK. Aturan: minimal 8 karakter, bukan deret/
 * pengulangan karakter sederhana, dan bukan salah satu sandi umum.
 */
export function passwordError(v: string): string | null {
  if (v.length < MIN_PASSWORD_LEN) {
    return `Kata sandi minimal ${MIN_PASSWORD_LEN} karakter.`;
  }
  const lower = v.toLowerCase();
  if (PASSWORD_UMUM.has(lower)) {
    return "Kata sandi terlalu mudah ditebak. Pakai kombinasi lain.";
  }
  // Semua karakter sama (mis. "aaaaaaaa") atau deret angka/huruf naik-turun.
  if (/^(.)\1+$/.test(v)) {
    return "Kata sandi tidak boleh berulang satu karakter.";
  }
  if (isSequential(v)) {
    return "Kata sandi tidak boleh berupa deret berurutan.";
  }
  return null;
}

function isSequential(v: string): boolean {
  if (v.length < 4) return false;
  let naik = true;
  let turun = true;
  for (let i = 1; i < v.length; i++) {
    const diff = v.charCodeAt(i) - v.charCodeAt(i - 1);
    if (diff !== 1) naik = false;
    if (diff !== -1) turun = false;
  }
  return naik || turun;
}
