// Utilitas IP klien dari header proxy (Vercel men-set x-forwarded-for).
// Dipakai rate-limit per-IP (login, signup, probe kasir) agar penyerang yang
// menyebar percobaan lintas-akun tetap dibatasi per sumber.
//
// CATATAN: header ini bisa dipalsukan HANYA bila request tidak lewat proxy
// tepercaya. Di Vercel, x-forwarded-for di-set oleh edge dan hop pertama =
// IP klien asli, jadi aman dipakai sebagai kunci rate-limit (bukan untuk
// otorisasi). Untuk deployment self-host, pastikan reverse-proxy menimpa
// header ini.

export function ipKlien(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) {
    const first = fwd.split(",")[0]?.trim();
    if (first) return first;
  }
  return req.headers.get("x-real-ip")?.trim() || "unknown";
}
