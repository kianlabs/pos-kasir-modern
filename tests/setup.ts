// Setup per-worker: arahkan Prisma ke DB TEST Postgres sebelum modul apa pun
// mengimpor `@/server/db`. Env ini harus di-set di sini (bukan di global-setup)
// karena global-setup jalan di proses terpisah dari worker test.
//
// Sumber URL test, berurutan: TEST_DATABASE_URL → DIRECT_URL.
// (global-setup.ts memakai urutan yang sama.)
const testUrl = process.env.TEST_DATABASE_URL || process.env.DIRECT_URL;
if (!testUrl) {
  throw new Error(
    "Test butuh koneksi Postgres. Set TEST_DATABASE_URL (disarankan) atau DIRECT_URL.",
  );
}

// Batasi ukuran pool di sisi aplikasi.
//
// DB remote (mis. Supabase) punya batas koneksi ketat, dan suite ini membuat
// BEBERAPA PrismaClient (test + seed + global-setup). Default Prisma
// (connection_limit = num_cpus*2+1 ~ 17) mudah membuat pool timeout saat
// koneksi lambat. Kita paksa limit kecil + pool_timeout longgar via connection
// string, kecuali pemanggil sudah mengaturnya eksplisit.
function withPoolLimits(url: string): string {
  try {
    const u = new URL(url);
    if (!u.searchParams.has("connection_limit")) u.searchParams.set("connection_limit", "5");
    if (!u.searchParams.has("pool_timeout")) u.searchParams.set("pool_timeout", "30");
    return u.toString();
  } catch {
    return url; // bukan URL valid — serahkan apa adanya
  }
}

const tuned = withPoolLimits(testUrl);
process.env.DATABASE_URL = tuned;
process.env.DIRECT_URL = tuned;
process.env.TEST_DATABASE_URL = tuned;
