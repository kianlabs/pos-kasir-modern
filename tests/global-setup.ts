import { execSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import { loadEnv, resolveTestDatabaseUrl } from "./env-guard";

// Global setup Vitest (lampiran skema §2 aturan #2 & #9 butuh DB nyata).
//
// Provider DB = Postgres (Supabase). Test WAJIB memakai DB TERPISAH dari
// produksi via TEST_DATABASE_URL (lihat tests/env-guard.ts — tidak ada fallback
// ke DIRECT_URL/DATABASE_URL, dan host yang sama dengan DB dev/produksi ditolak).
// Jangan pooled (6543): test memakai interactive transaction yang tak didukung
// transaction pooler.
//
// Karena DB Postgres BERSIFAT PERSISTEN (beda dari SQLite yang file-nya dihapus
// tiap run), setup ini membersihkan warung uji sisa run sebelumnya agar test
// idempoten. Warung uji dikenali dari slug berpola test (lihat TEST_SLUGS).
// Warung asli (mis. "warung-berkah-jaya") TIDAK tersentuh.

// Awalan slug yang hanya dipakai test. Aman: tidak ada warung produksi bernama ini.
const TEST_SLUG_PREFIXES = [
  "warung-meja-",
  "warung-sync-",
  "warung-alpha-test",
  "warung-beta-test",
  "warung-sementara-",
];

export default async function globalSetup() {
  loadEnv();
  const url = resolveTestDatabaseUrl();

  // Verifikasi koneksi + status migrasi (jangan migrate ulang: itu langkah deploy,
  // dan menjalankannya tiap test-run ke DB remote memicu P1001 flaky).
  try {
    execSync("npx prisma migrate status", {
      stdio: "inherit",
      env: { ...process.env, DATABASE_URL: url, DIRECT_URL: url },
    });
  } catch {
    throw new Error(
      "Tak bisa menyambung / status migrasi DB test bermasalah. Pastikan " +
        "TEST_DATABASE_URL menunjuk Postgres yang hidup dan sudah di-migrate " +
        "(`npm run db:deploy`).",
    );
  }

  // Bersihkan warung uji sisa (cascade akan menghapus produk/meja/trx/users).
  const prisma = new PrismaClient({ datasourceUrl: url });
  try {
    const stale = await prisma.warung.findMany({
      where: { OR: TEST_SLUG_PREFIXES.map((p) => ({ slug: { startsWith: p } })) },
      select: { id: true, slug: true },
    });
    if (stale.length) {
      await prisma.warung.deleteMany({ where: { id: { in: stale.map((w) => w.id) } } });
      console.log(
        `[test-setup] membersihkan ${stale.length} warung uji sisa: ` +
          stale.map((w) => w.slug).join(", "),
      );
    }
  } finally {
    await prisma.$disconnect();
  }
}
