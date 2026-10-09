# Laporan Audit Menyeluruh — POS Kasir Modern

**Tanggal:** 2026-10-09 · **Basis:** `main` @ `3c4a998` · **Status:** siap production (dengan catatan)
**Metode:** 4 subagent audit paralel (keamanan, logika, data/DB, test/kualitas) +
perbaikan swarm (3 worker/worktree) + verifikasi silang manual.

---

## Ringkasan

| Dimensi | Verdict |
|---|---|
| Keamanan (tenant/auth/RBAC/injeksi) | ✅ Baik — isolasi tenant solid, 0 raw SQL, 0 secret ter-commit |
| Kebenaran logika | ✅ Baik — uang integer, stok atomik, idempotensi sync |
| Integritas data/DB | ✅ Baik — partial index, FK, migrasi konsisten |
| Test & kualitas | ✅ Meningkat — 32 → **70 test**, GAP besar tertutup |

**Tidak ada temuan CRITICAL** (tidak ada kebocoran tenant / auth bypass / injeksi).

---

## Temuan & Status Perbaikan

### 🔴 BLOCKER
| # | Temuan | Status |
|---|---|---|
| B1 | Test menyentuh DB produksi (fallback `DIRECT_URL` + `deleteMany`) | ✅ **FIXED** — `tests/env-guard.ts`: wajib `TEST_DATABASE_URL`, tolak host sama. Escape hatch `ALLOW_TEST_ON_SHARED_DB=1` (darurat). |

### 🟠 MAJOR
| # | Temuan | Status |
|---|---|---|
| M1 | Runtime pakai pooler transaction-mode (6543) untuk interactive tx | ✅ **FIXED** — `server/db.ts`: `datasourceUrl = DIRECT_URL ?? DATABASE_URL` |
| M2 | Buka-bill tak tangani P2002 → 500 mentah | ✅ **FIXED** — tangkap `isUniqueConstraintError` → 409 |
| M3 | "Satu shift BUKA" tanpa proteksi DB | ✅ **FIXED** — migrasi `20261009120000_shift_one_open` (partial unique index) |
| M4 | Sync terima `total`/`qty` tanpa clamp (overflow int32) | ✅ **FIXED** — `BATAS_UANG`/`BATAS_QTY` + clamp diskon ≥0 |
| M5 | Test menguji tiruan, bukan route asli | ✅ **FIXED** — test baru panggil route asli (rbac/bills/stats/auth) |
| M6 | GAP test keamanan (RBAC, auth, HMAC, export) | ✅ **FIXED** — 38 test baru |
| M7 | Tak ada retry deadlock P2034 | ✅ **FIXED** — `transaksi()` retry 3× backoff |

### 🟡 MINOR
| # | Temuan | Status |
|---|---|---|
| m1 | Rate-limit PIN bisa di-spam (userId acak) | ✅ **FIXED** — key userId/email dikirim + catat gagal |
| m2 | `catch{}` telan error di products/[id] | ✅ **FIXED** — P2025→404, lainnya→500+log |
| m3 | Komentar stale "index belum ada" | ✅ **FIXED** |
| m4 | `.env.example` fallback tak konsisten | ✅ **FIXED** |
| m5 | Dup rumus subtotal/tax (≥4 tempat) | ⚠️ Belum (backlog) |
| m6 | Omzet top-produk pakai harga live | ⚠️ Belum (backlog) |

### 🔵 LOW / Utang
| # | Temuan | Status |
|---|---|---|
| L1 | Rate-limit in-memory (tak terbagi antar-instance Vercel) | ⚠️ **Utang** — perlu Redis/DB sebelum multi-instance |
| L2 | Header keamanan absen | ✅ **FIXED** — `next.config.mjs` (X-Frame-Options, HSTS, dll) |
| L3 | `prosesCheckout` di `client/` diimpor route server | ⚠️ **Utang** — batas modul rapuh |
| L4 | **Next.js 14.2.35 punya 5 CVE (4 high, 1 critical)** | ⚠️ **Utang upgrade** — lihat bawah |

---

## ⚠️ Kerentanan Dependency (Next.js)

`npm audit`: **5 vulnerabilities (4 high, 1 critical)** di Next 14.2.35.

**Analisis dampak nyata** (fitur rentan yang TIDAK dipakai):
| CVE area | Dipakai? | Risiko |
|---|---|---|
| Image Optimization RCE (AVIF) | ❌ tak pakai `next/image` | tak terpapar |
| Server Actions payload/SSRF | ❌ tak pakai `"use server"` | tak terpapar |
| Rewrites SSRF | ❌ tak pakai rewrites | tak terpapar |
| Cache confusion / internal endpoint disclosure | ⚠️ App Router selalu ada | risiko rendah–sedang |

**Rekomendasi:** upgrade `next` ke 15/16 (breaking) di sesi khusus. 14.2.35 = patch 14 terakhir; tak ada fix di 14.x.

---

## Verifikasi (gate)

| Gate | Hasil |
|---|---|
| `npx tsc --noEmit` | ✅ 0 error |
| `npm run lint` | ✅ bersih |
| `npm run build` | ✅ sukses (12 halaman) |
| `npm test` | ✅ **70/70** (9 file) |
| Staging live | ✅ https://pos-kasir-modern-sigma.vercel.app |

**Verifikasi live staging:** login owner/kasir ✅, rate-limit 429 ✅, shift 409 ✅, checkout penuh ✅, isolasi tenant (`warungId` dari session) ✅.

---

## Daftar Test (70)

| File | Jumlah | Isi |
|---|---|---|
| `meja-bill.test.ts` | 14 | bill DRAFT, stok, gabung/pisah kontrak domain |
| `sync.test.ts` | 5 | idempotensi, stok minus, isolasi tenant |
| `tenant-isolation.test.ts` | 6 | isolasi tenant |
| `pin-ratelimit.test.ts` | 7 | rate-limit modul |
| `session.test.ts` | 8 | HMAC tamper/expiry/payload cacat |
| `rbac-products.test.ts` | 5 | gate owner-only via route asli |
| `bills-gabung-pisah.test.ts` | ~12 | gabung/pisah via route asli |
| `stats-export.test.ts` | ~10 | LUNAS-only, export CSV |
| `auth-login.test.ts` | ~8 | login owner/kasir + rate-limit |

---

## Verdict: ✅ SIAP PRODUCTION (dengan utang tercatat)

**Siap** untuk uji lapangan (PRD §13). Utang yang **perlu diselesaikan sebelum multi-instance/traffic tinggi:**
1. Rate-limit → Redis/DB (L1)
2. Upgrade Next (CVE) (L4)
3. Pindahkan `prosesCheckout` ke `server/` (L3)

Semua temuan BLOCKER/MAJOR sudah diperbaiki & terverifikasi.
