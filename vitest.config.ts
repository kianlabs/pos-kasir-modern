import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

// Vitest untuk proyek Next.js 14 App Router + Prisma (PostgreSQL/Supabase).
//
// - vite-tsconfig-paths → alias `@/*` → `./src/*` (sama dengan tsconfig.json)
//   supaya import di test persis seperti di kode aplikasi.
// - environment "node" (bukan jsdom): test menyentuh Prisma + Node crypto.
// - setupFiles mengarahkan Prisma ke DB test (TEST_DATABASE_URL) SEBELUM test
//   berjalan (lihat tests/setup.ts); globalSetup menjalankan migrate deploy.
export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    environment: "node",
    globals: true,
    include: ["tests/**/*.test.ts"],
    globalSetup: ["tests/global-setup.ts"],
    setupFiles: ["tests/setup.ts"],
    // Satu DB dipakai bersama → jangan jalan paralel antar-file agar isolasi
    // data tetap terjamin.
    fileParallelism: false,
    // Timeout longgar: DB test bisa berupa Postgres remote (mis. Supabase)
    // dengan latensi tinggi; seed penuh + cascade delete dalam satu `it()`
    // bisa jauh melewati default.
    testTimeout: 120000,
    hookTimeout: 120000,
  },
});
