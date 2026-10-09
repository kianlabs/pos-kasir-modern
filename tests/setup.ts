// Setup per-worker: arahkan Prisma ke DB TEST Postgres sebelum modul apa pun
// mengimpor `@/lib/prisma`. Env ini harus di-set di sini (bukan di global-setup)
// karena global-setup jalan di proses terpisah dari worker test.
//
// Sumber URL test, berurutan: TEST_DATABASE_URL → DATABASE_URL.
// (global-setup.ts memakai urutan yang sama untuk `prisma migrate deploy`.)
const testUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
if (!testUrl) {
  throw new Error(
    "Test butuh koneksi Postgres. Set TEST_DATABASE_URL (disarankan) atau DATABASE_URL.",
  );
}
process.env.DATABASE_URL = testUrl;
process.env.DIRECT_URL = testUrl;
