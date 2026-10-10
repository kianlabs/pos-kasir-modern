import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// ESLint flat config (ESLint 9). Menggantikan `.eslintrc.json` (`next lint`
// sudah deprecated di Next 16). Aturan tetap sama seperti sebelumnya:
// next/core-web-vitals + next/typescript.
//
// Catatan aturan "baru": eslint-config-next@16 memakai react-hooks v6 yang
// menambahkan aturan baru (set-state-in-effect, purity, immutability, dst.)
// serta @typescript-eslint/no-require-imports. Aturan-aturan ini menandai pola
// yang SUDAH ADA dan sah di kode lama (mis. data-fetch di useEffect, require()
// di test). Menjadikannya error akan memaksa refactor di luar cakupan bump
// dependency, jadi diturunkan ke "warn" untuk mempertahankan sinyal lint lama.
const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/purity": "warn",
      "@typescript-eslint/no-require-imports": "warn",
    },
  },
  globalIgnores([
    // Default ignores of eslint-config-next.
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Arsip/dok/skrip non-aplikasi yang tak perlu di-lint.
    "node_modules/**",
    "docs/**",
    ".omo/**",
    ".kilo/**",
  ]),
]);

export default eslintConfig;
