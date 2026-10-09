# Prompt Swarm — Deploy Vercel (Tahap 5, sisa terakhir MVP)

File ini berisi prompt siap-tempel untuk worker Herdr. **Jangan** copy seluruh
file — ambil blok di bagian bawah, sesuai peran.

## Ringkasan

| Item | Nilai |
|---|---|
| Tugas | Deploy app ke Vercel staging + verifikasi (PRD §6.2) |
| Worker | `hswarm 1 claude` (satu worker, auto-approve, worktree auto) |
| Reviewer | `hswarm -r reviewer 1 codex` (read-only, verifikasi) |
| Agent | **`claude`** (opencode SIGILL di box ini — handover §3) |
| Irreversible | `vercel --prod`, `git push` → **minta user** |

## Prasyarat (verifikasi SEBELUM spawn)

- `.env` berisi `DATABASE_URL` (pooled 6543) + `DIRECT_URL` (5432) + `SESSION_SECRET` — ✅ sudah ada.
- Supabase sudah di-migrate + seed — ✅ sudah (`init_postgres`, warung-berkah-jaya, 38 produk).
- `vercel whoami` → login (`kyanlabs`).
- Gate lokal hijau: `npx tsc --noEmit && npm run lint && npm run build` — ✅ terverifikasi.

## Aturan yang WAJIB dipatuhi worker

1. **Konvensi struktur baru:** impor dari `@/server/*`, `@/client/*`, `@/shared/*` — **bukan** `@/lib/*` (sudah dihapus). Lihat `docs/NAMING.md`.
2. **Jangan hardcode/print secret.** Env Vercel di-set lewat `vercel env add` atau dashboard. `.env` tidak di-commit.
3. **`git push` & deploy produksi = irreversible** → berhenti & minta user.
4. Gate tiap langkah: `npx tsc --noEmit && npm run lint && npm run build`.
5. Commit Conventional Commits (Indonesia), satu concern per commit.
6. Jangan sentuh `prisma/migrations/` (sudah final) kecuali ada masalah nyata.

---

## PROMPT — WORKER (copy ini)

```
Kamu worker deploy untuk project POS kasir (Next.js 14 + Prisma + Supabase Postgres)
di /home/kian/Projects/pos-kasir-modern. Tugas: deploy ke Vercel STAGING lalu
verifikasi, supaya URL staging live dan 1 warung fiktif bisa jualan penuh
(Definition of Done PRD §6.2).

KONTEKS (jangan riset ulang):
- DB = Supabase Postgres, sudah di-migrate (migrasi init_postgres) + seed
  (warung "warung-berkah-jaya": owner owner@warung-berkah-jaya.demo / password123;
  kasir PIN 123456; halaman masuk /masuk/warung-berkah-jaya).
- Struktur kode BARU: @/server/* (db, session, tenant, audit, settings,
  rate-limit, meja, http), @/client/* (offline-db, offline-sync, offline-types),
  @/shared/* (session-types, rupiah, nav, category-icon). @/lib/* SUDAH DIHAPUS.
  Baca docs/NAMING.md sebelum menulis impor.
- .env sudah berisi DATABASE_URL (pooled 6543, ?pgbouncer=true&connection_limit=1),
  DIRECT_URL (5432), SESSION_SECRET. JANGAN print nilainya.
- Vercel CLI sudah login (akun kyanlabs). Belum ada link .vercel.

LANGKAH:
1. Gate lokal: bash -lc 'npx tsc --noEmit && npm run lint && npm run build'.
   Betulkan dulu bila ada error. JANGAN lanjut bila build gagal.
2. Link project Vercel: `vercel link` (buat project baru bernama pos-kasir-modern).
   Jangan deploy dulu.
3. Set env Vercel (PRODUCTION + PREVIEW):
   - DATABASE_URL  = nilai pooled dari .env
   - DIRECT_URL    = nilai direct dari .env
   - SESSION_SECRET= nilai SESSION_SECRET dari .env (>=16 char)
   Pakai `vercel env add <NAMA>` (tempel dari .env, jangan echo ke terminal
   history). Untuk migrasi saat build, JANGAN jalankan migrate otomatis di
   buildCommand kecuali perlu — kalau perlu, pastikan pakai DIRECT_URL.
4. Deploy PREVIEW dulu (bukan produksi): `vercel deploy` (tanpa --prod).
   Catat URL preview yang muncul.
5. Verifikasi preview (bukti nyata, bukan klaim):
   - URL bisa diakses (HTTP 200 di /masuk/warung-berkah-jaya).
   - Login owner berhasil; buka /produk (owner boleh).
   - Login kasir (PIN 123456); buka /produk → harus 403/redirect (bukan konten).
   - Isolasi tenant: request data warung lain → kosong/403.
   - Cek manifest PWA (/manifest.webmanifest) & /sw.js bisa diakses publik.
   Gunakan skill headless-browser kalau perlu cek halaman.
6. LAPOR ke user: URL preview + hasil verifikasi (centang/ silang + bukti),
   lalu BERHENTI dan MINTA IZIN untuk `vercel --prod` (produksi = irreversible).
   Jangan promosikan ke produksi sendiri.
7. Jika ada yang perlu diubah di kode: commit (Conventional Commits, Indonesia),
   satu concern per commit, lalu lanjut. Jangan push tanpa izin user.

ATURAN: jangan print/commit secret; jangan ubah prisma/migrations; jangan
force-push; jangan deploy produksi tanpa izin. Bila ada langkah yang butuh
kredensial/dashboard yang hanya user punya, BERHENTI dan tanyakan — jangan tebak.
```

---

## PROMPT — REVIEWER (copy ini, read-only)

```
Kamu reviewer read-only (JANGAN tulis file) untuk deploy Vercel project POS kasir
di /home/kian/Projects/pos-kasir-modern. Tugas: audit konfigurasi & keamanan
deploy, tanpa mengubah apa pun.

PERIKSA:
1. Env & rahasia: pastikan tidak ada secret ter-commit (grep DATABASE_URL/
   SESSION_SECRET di file yang ter-track; .env harus ter-ignore). Laporkan bila
   ada nilai rahasia nyata di repo.
2. Kebocoran client/server: pastikan tak ada impor @/server/* atau @/client/*
   yang salah sisi (mis. modul server di komponen "use client"). Cek docs/NAMING.md
   sebagai acuan aturan.
3. Impor usang @/lib/* (harus nol).
4. Migration: pastikan tiap device/build memakai DIRECT_URL untuk migrate, dan
   runtime memakai pooled (pgbouncer=true).
5. Partial unique index tx_one_draft_per_meja: pastikan ada di migrasi.
6. SESSION_SECRET: produksi harus bukan default dev.
7. .gitignore: .kilo/, learn-supabase/, .omo/, .env, .vercel harus ter-ignore.

OUTPUT: daftar temuan severity (BLOCKER/MAJOR/MINOR) + lokasi file:line + bukti,
diakhiri verdict: APPROVE / APPROVE WITH NITS / REQUEST CHANGES.
```

---

## Catatan untuk Fase 2 (swarm berikutnya, nanti)

Bila nanti mengerjakan Fase 2 (setelah staging live):
- Fitur **independen** yang boleh fan-out: barcode (`src/app/page.tsx`), kios
  (route baru), dashboard realtime — `hswarm 2 claude`.
- **Promo engine** (sentuh schema + checkout) → **serial 1 worker**.
- **Fitur AI** → 1 worker + reviewer codex **wajib** (security).
- Semua pekerjaan yang menyentuh DB: ingat pool Supabase ketat + latensi Sydney
  → hindari banyak worker menulis DB bersamaan.

## Verifikasi swarm sehat

```
herdr agent list          # pastikan worker hidup
herdr agent get worker-1  # state: working/idle/done (blocked = minta izin!)
```
`blocked` = worker tanya izin → **jawab user**, jangan abaikan.
