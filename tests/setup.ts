// Setup per-worker: arahkan Prisma ke DB TEST sebelum modul apa pun mengimpor
// `@/lib/prisma`. Env ini harus di-set di sini (bukan di global-setup) karena
// global-setup jalan di proses terpisah dari worker test.
process.env.DATABASE_URL = "file:./test.db";
