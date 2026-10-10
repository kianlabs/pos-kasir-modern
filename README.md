# 🧾 KasirKu — POS Kasir Modern

Aplikasi kasir warung makan single-codebase: **Next.js 16 + TypeScript + Tailwind 4 + Prisma + PostgreSQL (Supabase)**.

## Fitur

- **Kasir** (`/`) — kategori, cari produk, keranjang +/−, diskon Rp, pajak otomatis, bayar Tunai (numpad + kembalian) / QRIS
- **Produk** (`/produk`) — tambah, edit, hapus, stepper stok, nilai total stok
- **Transaksi** (`/transaksi`) — riwayat 50 transaksi terakhir + link struk
- **Meja** (`/meja`) — peta 10 meja (status KOSONG/TERISI di-derive dari bill DRAFT terbuka), bill per meja: tambah item, diskon, bayar, batal, gabung/pisah bill
- **Shift** (`/shift`) — buka/tutup shift, rekap modal vs kas fisik + selisih
- **Stok** (`/stok`) — kartu stok: tiap penjualan/kulakan/koreksi tercatat
- **Struk** (`/struk/[id]`) — struk 80mm + tombol cetak (print CSS)
- **Laporan** (`/laporan`) — filter tanggal, export CSV, grafik 7 hari, produk terlaris, stok menipis
- **Pengaturan** (`/pengaturan`) — pajak otomatis on/off + tarif
- **Auth & RBAC** (`/masuk/[slug]`) — login multi-role: owner (email + password) & kasir (PIN); session HMAC cookie; kasir dibatasi (403 di `/produk`, `/laporan`, `/pengaturan`)
- Checkout atomik: validasi stok + kurangi stok dalam satu transaksi DB

### Perilaku stok pada bill meja (disengaja)

Bill meja disimpan sebagai `Transaction{status: DRAFT}`. **Stok baru berkurang saat bill
dibayar (`DRAFT → LUNAS`), bukan saat bill dibuka atau item ditambahkan.** Karena itu:

- Buka/ubah item/batal/gabung/pisah bill **tidak** menyentuh `Product.stock` maupun `StockMove`.
- Karena DRAFT tidak mengurangi stok, dua bill terbuka boleh sama-sama memuat qty melebihi
  stok tersedia. Yang **bayar lebih dulu menang**; bill kedua gagal dengan pesan stok kurang.
  Ini konsisten dengan PRD §12 (stok minus sementara saat offline, konflik ditandai untuk review owner).
- Reservasi stok sementara **ditolak** secara desain: menambah kompleksitas pembatalan & offline.
- Menutup shift **diblokir (409)** bila masih ada bill terbuka — uang tak boleh menggantung lintas shift.

## Menjalankan

Prasyarat: buat file `.env` dengan **`DATABASE_URL`**, **`DIRECT_URL`** (Postgres/Supabase), dan **`SESSION_SECRET`**. Untuk menjalankan test, tambahkan juga **`TEST_DATABASE_URL`** (lihat [Menjalankan test](#menjalankan-test)).

```bash
# .env
# Pooled (pgbouncer, port 6543) untuk runtime/serverless:
DATABASE_URL="postgresql://USER:PASSWORD@HOST:6543/DB?pgbouncer=true&connection_limit=1"
# Direct (port 5432) untuk migrasi:
DIRECT_URL="postgresql://USER:PASSWORD@HOST:5432/DB"
SESSION_SECRET=ganti-dengan-string-acak-min-16-karakter
```

Lalu jalankan:

```bash
npm install                # otomatis menjalankan prisma generate via postinstall
npm run db:deploy          # terapkan migrasi ke DB (prisma migrate deploy)
npm run db:seed            # isi data demo (idempoten — dilewati bila sudah ada)
npm run dev                # buka http://localhost:3000
```

> Catatan: `npm install` sudah otomatis men-generate Prisma Client (via script `postinstall: prisma generate`) — tidak perlu menjalankan `npx prisma generate` secara terpisah. Prisma dipakai versi 6. Provider DB = **PostgreSQL**.

### Menjalankan test

Test membutuhkan koneksi Postgres dan **WAJIB** diarahkan ke DB terpisah lewat `TEST_DATABASE_URL`:

```bash
TEST_DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/DB_TEST" npm test
```

Aturan pengaman (lihat `tests/env-guard.ts`):

- **`TEST_DATABASE_URL` wajib** — test **tidak** fallback ke `DATABASE_URL`/`DIRECT_URL`. Bila kosong, suite langsung gagal dengan pesan jelas. Ini mencegah test menghapus data warung uji di DB dev/produksi.
- **Host harus berbeda** dari `DATABASE_URL`/`DIRECT_URL`. Bila host-nya sama (mis. sama-sama project Supabase produksi, walau beda port 5432/6543), suite menolak jalan.
- Gunakan **koneksi direct (port 5432)**, bukan pooled (6543): test memakai interactive transaction yang tak didukung transaction pooler.

Cara paling aman: buat **project Supabase terpisah untuk test** dan pakai connection string-nya sebagai `TEST_DATABASE_URL`.

`tests/global-setup.ts` menjalankan `prisma migrate status` ke URL test sebelum suite berjalan (migrasi sendiri dijalankan manual dengan `npm run db:deploy`).

### CI (GitHub Actions)

Workflow [`.github/workflows/ci.yml`](.github/workflows/ci.yml) berjalan pada setiap **push** dan **pull_request**: satu job `ubuntu-latest` (Node 20) yang menjalankan **typecheck → lint → build** (dengan env placeholder non-secret agar `prisma generate` / `next build` tidak gagal).

- **Typecheck:** `npm run typecheck` (`tsc --noEmit`).
- **Lint:** `npm run lint`.
- **Build:** `npm run build`.
- **Test TIDAK dijalankan di CI** — suite bersifat integrasi DB dan butuh `TEST_DATABASE_URL` + Postgres hidup (host berbeda dari DB utama). Jalankan `npm test` secara manual dengan `TEST_DATABASE_URL` yang valid (lihat [Menjalankan test](#menjalankan-test)).

## Akun demo

Setelah `db:seed`, gunakan akun berikut:

- **Owner** — email `owner@warung-berkah-jaya.demo`, password `password123`
- **Kasir** — PIN `123456`
- **Akses halaman masuk:** `/masuk/warung-berkah-jaya` (per-warung) atau `/masuk/_` (fallback tanpa slug)

## Keamanan

- **`SESSION_SECRET` wajib diisi di produksi** (minimal 16 karakter) — tanpa ini sesi tidak aman.
- **Rate-limit PIN masih in-memory** (5× gagal → blokir 5 menit). Pindahkan ke DB/Redis saat deploy multi-instance, karena state in-memory tidak terbagi antar proses.
- **RLS (defense-in-depth isolasi tenant)** — migrasi `20261020000000_rls_policies` mengaktifkan Row Level Security untuk role PostgREST Supabase (`anon` ditolak total; `authenticated` ter-scope per `warungId` dari klaim JWT). **Bukan pengganti** filter `warungId` di aplikasi: koneksi app memakai role owner yang **bypass RLS** (tanpa `FORCE ROW LEVEL SECURITY`). Lihat [docs/RLS.md](docs/RLS.md).

## Deploy (Vercel + Supabase)

**Staging live:** https://pos-kasir-modern-sigma.vercel.app

1. **Supabase** → buat project → ambil dua connection string: pooled (6543) dan direct (5432).
2. **Vercel** → import repo → set env:
   - `DATABASE_URL` = pooled URL (`?pgbouncer=true&connection_limit=1`)
   - `DIRECT_URL` = direct URL
   - `SESSION_SECRET` = string acak ≥16 karakter
3. **Migrasi** dijalankan ke DB: `npx prisma migrate deploy` (memakai `DIRECT_URL`).
4. **Seed warung fiktif:** `npm run db:seed` (idempoten).
5. Verifikasi: URL staging live, login owner + kasir, jualan penuh (checkout → struk → laporan), PWA installable (HTTPS), isolasi tenant benar.

> **Login demo staging:** owner `owner@warung-berkah-jaya.demo` / `password123`; kasir PIN `123456`; halaman masuk `/masuk/warung-berkah-jaya`.

> **Invarian Postgres:** partial unique index `tx_one_draft_per_meja` (di migrasi `init_postgres`) menegakkan **satu bill DRAFT per meja** di level DB. Di SQLite invarian ini hanya dijaga aplikasi; di Postgres kini dijamin database.

## Struktur

```
src/app/
  layout.tsx + SidebarNav.tsx → sidebar + topbar mobile
  page.tsx            → kasir (diskon, pajak otomatis, shift banner)
  produk/page.tsx     → CRUD produk + stepper stok
  transaksi/page.tsx  → riwayat transaksi (query langsung, hanya LUNAS)
  meja/page.tsx       → peta meja (KOSONG/TERISI, derive dari bill DRAFT)
  meja/[id]/page.tsx  → bill DRAFT satu meja + BillPanel (aksi bill)
  shift/page.tsx      → buka/tutup + selisih kas
  stok/page.tsx       → kartu stok
  laporan/page.tsx    → dashboard + filter tanggal + export CSV
  struk/[id]/page.tsx → struk + cetak (PrintButton.tsx)
  pengaturan/page.tsx → pajak otomatis
  api/
    products/         → GET + POST
    products/[id]/    → PATCH + DELETE
    checkout/         → POST (transaksi atomik + pajak otomatis; mejaId opsional)
    meja/[id]/bill/   → POST buka bill DRAFT di meja
    bills/[id]/       → PATCH tambah/ubah item + diskon, DELETE batal bill
    bills/[id]/bayar/ → POST bayar DRAFT → LUNAS (kurangi stok + StockMove)
    bills/[id]/gabung/→ POST gabung bill sumber ke bill ini
    bills/[id]/pisah/ → POST pisah item ke meja lain (pindah, bukan salin)
    stats/            → GET (omzet, range tanggal)
    shifts/           → GET + POST, /active, /[id]/close
    stock-moves/      → GET kartu stok
    settings/         → GET + PATCH pajak
    export/           → GET CSV transaksi
src/server/           → server-only: prisma (db.ts), session, tenant, audit, settings, rate-limit, meja, http
src/client/           → client-only: offline-db, offline-sync, offline-types (IndexedDB)
src/shared/           → aman dua sisi: session-types, rupiah, nav, category-icon
src/types/            → tipe global (Role, dll)
prisma/
  schema.prisma       → Warung, User, Product, Transaction(+diskon/pajak/shift), Shift, StockMove, Setting, Meja, AuditLog, Insight (PostgreSQL)
  migrations/         → migrasi Postgres (init_postgres + partial unique index DRAFT-per-meja)
  migrations-sqlite-archive/ → riwayat migrasi SQLite (arsip, sebelum pindah Postgres)
  seed.ts             → 38 menu warung + pajak default 10% (parameter --warungs=N)
```

## Ide pengembangan lanjut

- Mode barcode scanner (input keyboard wedge)
- Mode kios fullscreen
- Deploy live (Vercel + Postgres)
