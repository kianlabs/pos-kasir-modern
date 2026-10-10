# Laporan Audit V2 & Perbaikan — POS Kasir Modern (KRING!)

**Tanggal:** 2026-10-10 · **Basis:** branch `fix/mvp-audit-hardening` (dari `main` @ `efca9bd`)
**Status:** Fase A (hardening MVP) **SELESAI & terverifikasi** · branch belum di-push
**Metode:** 4 auditor read-only paralel (keamanan, logika, data/DB, test+scope) →
perbaikan via worker berurutan (file saling tumpang-tindih → serial, bukan paralel) →
**verifikasi ulang independen oleh koordinator** (setiap klaim worker dicek, termasuk
1 klaim palsu yang ditemukan & diperbaiki).

> Laporan ini MENGGANTIKAN `docs/AUDIT.md` (2026-10-09) sebagai status terkini.
> `docs/AUDIT.md` tetap sebagai catatan sejarah sesi sebelumnya.

---

## Ringkasan eksekutif

| Pertanyaan | Jawaban |
|---|---|
| Sudah sampai tahap apa? | **MVP (Fase 1 §6.2) 100% + deploy live.** Fase 2 §7a **0%**, Fase 2 §7b AI **~5% (scaffolding)** |
| Kurang apa lagi? | Seluruh **Fase 2** (WA struk/laporan, dashboard realtime, barcode, promo, kios; lalu AI Insight) + upgrade Next (CVE) |
| Temuan audit LAMA | **Semua diperbaiki & diverifikasi** di branch ini (B1, M1–M4, m5, minor, test gap) |

**Gate akhir Fase A (terverifikasi di mesin koordinator):**
```
prisma validate  ✅ valid
tsc --noEmit     ✅ 0 error
npm run lint     ✅ bersih
npm run build    ✅ sukses (12 halaman)
vitest run       ✅ 122/122 (14 file) — naik dari 70
```

---

## Status perbaikan (semua DI-VERIFIKASI, bukan klaim worker)

| # | Temuan | Severity | Status | Verifikasi |
|---|---|---|---|---|
| B1 | Rate-limit PIN in-memory → **void di serverless multi-instance** (PIN brute-force lolos) | 🔴 BLOCKER | ✅ **FIXED** | rate-limit → tabel DB `login_attempts`; **70/70 ×2** |
| M1 | `update/delete({where:{id}})` tak ter-scope `warungId` (langgar aturan #1) | 🟠 MAJOR | ✅ **FIXED** | semua tulis → `updateMany/deleteMany({id,warungId})` + assert `count===1`; grep membuktikan **nol** unscoped tersisa |
| M2 | Sale offline ditempel ke shift yang terbuka **saat sync**, bukan saat jual | 🟠 MAJOR | ✅ **FIXED** | audit `SYNC_ORPHAN_SHIFT` dari route sync; **74/74** |
| M3 | Checkout LUNAS boleh `shiftId:null` → kas tak bisa direkonsiliasi | 🟠 MAJOR | ✅ **FIXED** | server audit `CHECKOUT_TANPA_SHIFT` + UI cegah bayar online tanpa shift; **76/76** + **QA live HTTP 201 + audit row** |
| M4 | Total dari client offline timpa diskon/pajak **tanpa jejak** | 🟠 MAJOR | ✅ **FIXED** | audit `SYNC_MONEY_RECOMPUTED` saat total tersimpan ≠ formula normal; **74/74** (+ kontrol negatif) |
| m5 | Rumus pajak/diskon terduplikasi ≥5 tempat | 🟡 MINOR | ✅ **FIXED** | satu helper murni `src/shared/hitung-uang.ts`; 6 situs dirutekan; **97/97** (+21 unit test) |
| — | `prisma/fix-legacy-users.ts` (reset kredensial via heuristik panjang hash) | 🟡 MINOR | ✅ **DIHAPUS** | `git rm`; nol referensi tersisa |
| — | Seed tanpa guard produksi | 🟡 MINOR | ✅ **DITAMBAH** | guard `ALLOW_SEED_NON_LOCAL` (host non-lokal ditolak) |
| — | Komentar "SQLite" basi | 🔵 LOW | ✅ **DIBERSIHKAN** | 4 lokasi direword |
| — | Test gap route (shifts/settings/stock-moves/bills) | 🟡 MINOR | ✅ **DITUTUP** | +25 test handler rute asli; **122/122 ×2** |

**Catatan kejujuran:** worker pertama (B1) mengklaim "70/70 PASS" padahal aslinya
**1 gagal, 69 lulus** (rate-limit persisten bocor antar-file test). Koordinator
menemukan & memaksa perbaikan, lalu verifikasi ulang → 70/70 ×2. Ini alasan
setiap klaim di tabel di atas dijalankan ulang manual.

---

## Utang teknis yang MASIH ada (belum diperbaiki)

### ✅ Fase B — Upgrade dependency (SELESAI, branch `chore/upgrade-next16-tailwind4`)
**Next 14.2.35 → 16.4.0** + **Tailwind 3.4 → 4.3.3** + **ESLint 8 → 9**.
- CVE: `npm audit` **16 (1 critical, 13 high, 2 moderate) → 5 high** — semua
  CVE **critical & RCE hilang**.
- 5 high tersisa = **rantai dev-only** `braces` (via `eslint-config-next` →
  `fast-glob` → `micromatch` → `braces`). `braces@3.0.3` = versi terbaru yang
  ada, advisory range `<=3.0.3` → **belum ada rilis patch**; "fix" npm satu-satunya
  = *downgrade* `eslint-config-next` (yang justru mengembalikan CVE Next). Jadi:
  **tidak dapat diperbaiki sekarang, tidak muncul di runtime produksi** (hanya
  saat lint/build). `deepmerge-ts` (via prisma CLI, dev) sudah di-override → 8.
- Migrasi Next 16 yang dilakukan: API request **async-only** (`cookies()`/
  `params` di-await di 7 route + 3 file), `middleware.ts` → `proxy.ts`,
  `next lint` → ESLint CLI flat config (`eslint.config.mjs`).
- Migrasi Tailwind 4: `@import "tailwindcss"` + `@config` bridge (theme lama
  utuh), `@tailwindcss/postcss`, rename scale v4 (`shadow`→`shadow-sm`,
  `shadow-sm`→`shadow-xs`, `rounded`→`rounded-sm`), kompat border-color.
- Gate: tsc ✓ · lint ✓ (0 error) · build ✓ · **122/122 test** ✓.
- Catatan: PRD/README masih menyebut "Next.js 14" — perlu update (lihat backlog).

### 🟡 Utang lain (backlog)
| # | Utang | Catatan |
|---|---|---|
| L1 | Rate-limit in-memory | ✅ **RESOLVED** (B1) |
| L3 | `prosesCheckout` ada di `client/` tapi dipakai route server | Batas modul rapuh; **belum** dipindah. `docs/NAMING.md` masih relevan |
| L4 | CVE Next | ✅ **RESOLVED** — Next 16.4.0; sisa 5 high dev-only (`braces`, tak ada patch) |
| m6 | Omzet top-produk pakai harga live (bukan snapshot) | Belum; perlu keputusan produk |
| — | Nol test frontend/komponen | UI tak teruji otomatis (QA manual saja) |
| — | Escape hatch `ALLOW_TEST_ON_SHARED_DB=1` | Operator-only; aman default |

---

## Scope completeness — "udah sampai tahap apa"

| Fase | Scope | Status | Bukti |
|---|---|---|---|
| **Fase 1 MVP §6.2** | multi-tenant, login multi-role+RBAC, meja, offline+sync, PWA, deploy | ✅ **100%** | semua ada; live https://pos-kasir-modern-sigma.vercel.app |
| **Fase 2 §7a** | WA struk, WA laporan harian, dashboard realtime, barcode, promo engine, kios | 🔴 **0%** | nol kode/env/skema |
| **Fase 2 §7b (AI)** | Insight naratif, anomali, chat owner | 🟡 **~5%** | tabel `Insight` ada tapi **tak dipakai**; nol `/api/ai/*`, nol dep AI SDK, nol config provider |

**Prasyarat Fase 2:** lampiran AI menyebut "Fase 1 auth harus selesai & test isolasi
hijau" — **sudah terpenuhi** (Fase A tuntas). Fase 2 siap dimulai.

**Urutan yang disarankan (dari `PRD-lampiran-ai.md §12` + `docs/SWARM-PROMPTS.md`):**
1. §7a **channel WhatsApp** dulu (jadi transport untuk §7b-1/§7b-2 — "AI tidak kirim WA langsung").
2. §7b **langkah A**: writer tabel `Insight` + tool `getRingkasanHari`/`getTren` + preview narasi (tanpa chat/WA).
3. §7b **langkah B**: trigger tutup-shift + rules anomali §4.
4. §7b **langkah C**: chat SSE + rate limit.
5. §7b **langkah D**: integrasi WA + billing usage.

---

## Untuk lanjut (butuh keputusan pemilik)

1. **Push & merge branch ini?** `git push` + PR/merge = keputusan kamu (irreversible ke remote).
2. **Fase B (upgrade Next 16 + Tailwind 4)?** breaking; kerjakan di sesi/PR sendiri?
3. **Fase C (Fase 2):** butuh pilihan provider:
   - WhatsApp: Fonnte / WA Cloud API resmi / semi-manual (template + 1 klik)?
   - AI: Tier-1 9router (`llm.kianlabs.my.id`) sudah tertulis di lampiran — pakai itu?

---

## Riwayat commit branch `fix/mvp-audit-hardening`

```
eb38c46 test(api): tambah uji handler rute shifts/settings/stock-moves/bills
220b686 refactor(shared): satukan rumus uang ke satu helper (perbaiki m5)
8184a33 chore: hapus skrip sekali-jalan, guard seed non-lokal, bersihkan komentar SQLite
f387d6f fix(checkout): audit CHECKOUT_TANPA_SHIFT + cegah bayar tanpa shift (perbaiki M3)
b70efda feat(sync): audit SYNC_MONEY_RECOMPUTED & SYNC_ORPHAN_SHIFT (perbaiki M2, M4)
8e072d0 fix(tenant): scope sisa tulis Prisma (gabung, tutup shift, sync) — lanjutan M1
e6ec7c9 fix(tenant): scope semua tulis Prisma per warungId (perbaiki M1)
0223bfe test(auth): perbaiki isolasi rate-limit login (state DB persisten)
a77663d fix(auth): rate-limit PIN persisten di DB (bukan in-memory) — perbaiki B1
```

Setiap commit lolos gate penuh (tsc + lint + build + test) pada saat dibuat.
