import { execSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import { resolve } from "node:path";

// Global setup Vitest (lampiran skema §2 aturan #2 & #9 butuh DB nyata).
//
// Memakai DATABASE_URL TEST TERPISAH (`prisma/test.db`) supaya seed/test tidak
// pernah menyentuh dev.db. File dihapus tiap run → tiap test mulai dari skema
// bersih (test isolasi tenant bergantung pada data yang kita kontrol penuh).
//
// Dipanggil sekali sebelum semua worker test jalan.
export default function globalSetup() {
  const dbPath = resolve(process.cwd(), "prisma/test.db");
  for (const f of [dbPath, `${dbPath}-journal`]) {
    if (existsSync(f)) rmSync(f, { force: true });
  }

  execSync("npx prisma migrate deploy", {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: "file:./test.db" },
  });
}
