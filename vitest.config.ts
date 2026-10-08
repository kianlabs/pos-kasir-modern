import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

// Vitest untuk proyek Next.js 14 App Router + Prisma SQLite.
//
// - vite-tsconfig-paths → alias `@/*` → `./src/*` (sama dengan tsconfig.json)
//   supaya import di test persis seperti di kode aplikasi.
// - environment "node" (bukan jsdom): test menyentuh Prisma + Node crypto.
// - setupFiles menjalankan migrasi ke DB test terpisah SEBELUM test berjalan
//   (lihat tests/setup.ts).
export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    environment: "node",
    globals: true,
    include: ["tests/**/*.test.ts"],
    globalSetup: ["tests/global-setup.ts"],
    setupFiles: ["tests/setup.ts"],
    // Test menyentuh satu file SQLite bersama → jangan jalankan file test
    // secara paralel agar isolasi data antar-file dapat dijamin.
    fileParallelism: false,
  },
});
