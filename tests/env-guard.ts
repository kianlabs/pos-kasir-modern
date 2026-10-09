import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

// Guard lingkungan test.
//
// BLOCKER yang dicegah di sini: test dulu fallback ke DIRECT_URL/DATABASE_URL
// saat TEST_DATABASE_URL kosong, sehingga `deleteMany` warung uji bisa menghapus
// data di DB PRODUKSI. Sekarang test WAJIB punya TEST_DATABASE_URL yang
// menunjuk DB terpisah; tidak ada fallback, dan host yang sama dengan
// DATABASE_URL/DIRECT_URL ditolak.
//
// File ini dipakai dua proses terpisah (global-setup & worker test), jadi env
// dimuat di sini alih-alih mengandalkan pewarisan runtime.

/**
 * Muat `.env` ke `process.env` (tanpa menimpa variabel yang sudah ada).
 * Vitest juga memuat `.env`, tapi memuat eksplisit di sini membuat
 * `global-setup` (proses utama) dan `setup` (worker) konsisten.
 */
export function loadEnv(): void {
  const envPath = resolve(process.cwd(), ".env");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^([A-Z_]+)="?([^"\n]*)"?$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

/**
 * Hostname sebuah URL (lowercase). Mengembalikan `null` bila URL tidak bisa
 * di-parse (mis. bukan URL valid). Hanya hostname — tidak pernah kredensial.
 *
 * Perbandingan sengaja memakai hostname SAJA (mengabaikan port & nama DB):
 * pada provider terkelola (Supabase/Neon) satu host = satu database, dan
 * pooled (6543) vs direct (5432) pada host yang sama tetap DB produksi yang
 * sama. Jadi host test yang sama dengan DB dev/produksi = tolak.
 */
export function hostOf(rawUrl: string): string | null {
  try {
    return new URL(rawUrl).hostname.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Ambil URL DB test yang sudah divalidasi.
 *
 * - WAJIB `TEST_DATABASE_URL`; throw bila kosong (TIDAK fallback ke
 *   DIRECT_URL/DATABASE_URL).
 * - Throw bila URL test identik dengan, atau berbagi host yang sama dengan,
 *   DIRECT_URL/DATABASE_URL — itu berarti menunjuk DB dev/produksi.
 */
export function resolveTestDatabaseUrl(): string {
  const testUrl = process.env.TEST_DATABASE_URL?.trim();
  if (!testUrl) {
    throw new Error(
      "TEST_DATABASE_URL wajib diisi untuk menjalankan test. Test sengaja " +
        "TIDAK fallback ke DIRECT_URL/DATABASE_URL agar tidak menyentuh DB " +
        "dev/produksi. Arahkan ke Postgres test terpisah, mis.\n" +
        '  TEST_DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/DB_TEST"',
    );
  }

  const testHost = hostOf(testUrl);
  const others: Array<[string, string | undefined]> = [
    ["DIRECT_URL", process.env.DIRECT_URL],
    ["DATABASE_URL", process.env.DATABASE_URL],
  ];

  for (const [name, raw] of others) {
    const other = raw?.trim();
    if (!other) continue;
    const otherHost = hostOf(other);
    const sameUrl = other === testUrl;
    const sameHost = testHost !== null && otherHost !== null && testHost === otherHost;
    if (sameUrl || sameHost) {
      throw new Error(
        `TEST_DATABASE_URL menunjuk ke host yang sama dengan ${name} ` +
          `(host: ${testHost ?? "URL identik"}). Test menghapus data warung uji — ` +
          "dilarang menyentuh DB dev/produksi. Pakai Postgres test di host yang " +
          "benar-benar terpisah (mis. project Supabase khusus test).",
      );
    }
  }

  return testUrl;
}
