// Validator yang bisa dipakai KLIEN (form) maupun SERVER (route API), supaya
// aturan & pesan error-nya identik di dua sisi — tidak ada drift.
// Murni & tanpa dependensi. Pesan dalam Bahasa Indonesia.

/** Email: pola praktis (bukan RFC penuh) — cukup untuk menolak salah ketik. */
export function emailError(v: string): string | null {
  const s = v.trim();
  if (s.length === 0) return "Email wajib diisi.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) {
    return "Format email tidak valid (contoh: owner@warung.com).";
  }
  return null;
}

/** Nama warung: minimal 2 karakter, maksimal 80. */
export function namaWarungError(v: string): string | null {
  const s = v.trim();
  if (s.length === 0) return "Nama warung wajib diisi.";
  if (s.length < 2) return "Nama warung minimal 2 karakter.";
  if (s.length > 80) return "Nama warung maksimal 80 karakter.";
  return null;
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

/**
 * Validasi kekuatan kata sandi owner. Kembalikan pesan error (Indonesia) bila
 * tidak lolos, atau null bila OK. Aturan: minimal 8 karakter, bukan deret/
 * pengulangan karakter sederhana, dan bukan salah satu sandi umum.
 */
export function passwordError(v: string): string | null {
  if (v.length === 0) return "Kata sandi wajib diisi.";
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

/** Konfirmasi kata sandi (ketik ulang) — wajib sama persis dengan yang pertama. */
export function konfirmasiError(pw: string, pw2: string): string | null {
  if (pw2.length === 0) return "Ulangi kata sandi untuk konfirmasi.";
  if (pw !== pw2) return "Konfirmasi kata sandi tidak cocok.";
  return null;
}

// Skor kekuatan sederhana 0–4 untuk indikator visual di form (bukan gerbang
// keamanan — gerbang sebenarnya tetap passwordError di atas).
export function skorSandi(v: string): number {
  if (v.length === 0) return 0;
  let s = 0;
  if (v.length >= 8) s++;
  if (v.length >= 12) s++;
  if (/[a-z]/.test(v) && /[A-Z]/.test(v)) s++;
  if (/\d/.test(v)) s++;
  if (/[^A-Za-z0-9]/.test(v)) s++;
  return Math.min(4, s);
}
