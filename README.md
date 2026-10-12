# 🧾 KRING! — POS Kasir Modern (SaaS multitenant)

Aplikasi kasir warung makan single-codebase, disajikan sebagai **SaaS multitenant self-serve**: satu deploy melayani banyak warung, masing-masing terisolasi per tenant. Stack: **Next.js 16 + TypeScript + Tailwind 4 + Prisma + PostgreSQL (Supabase)**.

## Alur masuk (routing)

| Route | Isi | Akses |
|---|---|---|
| `/` | **Landing page SaaS** (hero, fitur, harga, CTA) | publik — bila sudah login → redirect `/kasir` |
| `/daftar` | **Pendaftaran warung baru** (self-serve signup) | publik |
| `/masuk` | **Login tunggal** (email owner ATAU slug+pin kasir) | publik |
| `/kasir` | Mesin kasir (dulu `/`) | butuh sesi |
| sisanya | `/meja`, `/transaksi`, `/shift`, `/stok`, `/produk`, `/promo`, `/laporan`, `/dashboard`, `/insight`, `/notifikasi`, `/pengaturan` | butuh sesi; owner-only sebagian |

Signup `POST /api/auth/daftar` membuat **warung + owner + setting + 10 meja** dalam satu transaksi, lalu auto-login. Email owner unik global (login tunggal memakai email untuk menemukan warung).

## Fitur

- **Landing & Signup** (`/`, `/daftar`) — halaman jualan + pendaftaran warung self-serve (gratis 30 hari, status TRIAL)
- **Kasir** (`/kasir`) — kategori, cari produk, keranjang +/−, diskon Rp, pajak otomatis, bayar Tunai (numpad + kembalian) / QRIS
- **Produk** (`/produk`) — tambah, edit, hapus, stepper stok, nilai total stok
- **Transaksi** (`/transaksi`) — riwayat 50 transaksi terakhir + link struk
- **Meja** (`/meja`) — peta 10 meja (status KOSONG/TERISI di-derive dari bill DRAFT terbuka), bill per meja: tambah item, diskon, bayar, batal, gabung/pisah bill
- **Shift** (`/shift`) — buka/tutup shift, rekap modal vs kas fisik + selisih
- **Stok** (`/stok`) — kartu stok: tiap penjualan/kulakan/koreksi tercatat
- **Struk** (`/struk/[id]`) — struk 80mm + tombol cetak (print CSS)
- **Laporan** (`/laporan`) — filter tanggal, export CSV, grafik 7 hari, produk terlaris, stok menipis
- **Dashboard Live** (`/dashboard`) — omzet real-time, grafik per jam, transaksi terakhir
- **Promo** (`/promo`) — diskon persen / nominal / happy-hour + kode voucher
- **Notifikasi** (`/notifikasi`) — laporan shift siap salin ke WhatsApp owner
- **Pengaturan** (`/pengaturan`) — pajak otomatis on/off + tarif
- **Auth & RBAC** (`/masuk`) — login multi-role: owner (email + password) & kasir (PIN); session HMAC cookie; kasir dibatasi (403 di halaman owner-only)
- **Insight AI** (`/insight`, `/insight/chat`) — ringkasan otomatis, **chat owner** (tanya-jawab atas data warung sendiri), deteksi anomali. Model **tidak menebak**: pertanyaan dipetakan deterministik ke 7 tool angka, lalu dirangkai jadi kalimat. **Pemakaian token AI dicatat per warung** (`ai_usage`) & diringkas di `/api/ai/usage` + kartu "Pemakaian AI bulan ini"
- Checkout atomik: validasi stok + kurangi stok dalam satu transaksi DB

### Insight AI — cara kerja singkat

- **Provider**: OpenAI-compatible (9router Tier 1 / `managed`). Semua env dibaca HANYA di `src/server/ai/config.ts`.
- **Alur**: pertanyaan owner → `pilihToolDari()` (keyword matching, **tanpa LLM**) → 7 tool allowlist (ringkasan hari, tren, penjualan produk, penjualan kasir, stok menipis, rekap shift, anomali) → hanya **agregat angka** yang dikirim ke LLM untuk dirangkai.
- **Tenant-safe**: `warungId` HANYA dari session; model tak pernah memegangnya. System prompt menegaskan teks data = DATA bukan INSTRUKSI (anti prompt-injection).
- **Degradasi aman**: provider down/timeout → jawaban template angka, tetap HTTP 200 (bukan 500). Kasir tak pernah terpengaruh (AI bukan di jalur kasir).
- **Gating**: owner-only + plan `ACTIVE` (gratis/TRIAL = tanpa LLM) + rate-limit 20 req/menit/user.

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
- **Halaman masuk:** `/masuk` (login tunggal — isi email owner ATAU pilih warung + PIN kasir)

## Keamanan

- **`SESSION_SECRET` wajib diisi di produksi** (minimal 16 karakter) — tanpa ini sesi tidak aman.
- **Rate-limit PIN masih in-memory** (5× gagal → blokir 5 menit). Pindahkan ke DB/Redis saat deploy multi-instance, karena state in-memory tidak terbagi antar proses.
- **Pool koneksi Prisma di-tuning** (`src/server/db.ts`): `connection_limit=5`, `connect_timeout=15`, `pool_timeout=20`. Tanpa ini, request paralel ke Supabase sering gagal `P1001` (default Prisma = 2×CPU+1 koneksi → menabrak batas pooler). Bisa ditimpa lewat env `DB_CONNECTION_LIMIT` / `DB_CONNECT_TIMEOUT` / `DB_POOL_TIMEOUT`.
- **RLS (defense-in-depth isolasi tenant)** — migrasi `20261020000000_rls_policies` mengaktifkan Row Level Security untuk role PostgREST Supabase (`anon` ditolak total; `authenticated` ter-scope per `warungId` dari klaim JWT). **Bukan pengganti** filter `warungId` di aplikasi: koneksi app memakai role owner yang **bypass RLS** (tanpa `FORCE ROW LEVEL SECURITY`). Lihat [docs/RLS.md](docs/RLS.md).

## Deploy (Vercel + Supabase)

**Staging live:** https://pos-kasir-modern-sigma.vercel.app

1. **Supabase** → buat project → ambil dua connection string: pooled (6543) dan direct (5432).
2. **Vercel** → import repo → set env:
   - `DATABASE_URL` = pooled URL (`?pgbouncer=true&connection_limit=1`)
   - `DIRECT_URL` = direct URL
   - `SESSION_SECRET` = string acak ≥16 karakter
   - `AI_ENABLED` = `true` (untuk mengaktifkan fitur Insight AI)
   - `AI_PROVIDER` = `9router`
   - `AI_BASE_URL` = `https://llm.kianlabs.my.id/v1` (Cloudflare tunnel ke 9router; `127.0.0.1` TIDAK bisa diakses dari server Vercel)
   - `AI_MODEL` = nama model (mis. `agentic-hemat`)
   - `AI_API_KEY` = key gateway 9router
3. **Migrasi** dijalankan ke DB: `npx prisma migrate deploy` (memakai `DIRECT_URL`).
4. **Seed warung fiktif:** `npm run db:seed` (idempoten).
5. Verifikasi: URL staging live, landing + signup jalan, login owner + kasir, jualan penuh (checkout → struk → laporan), chat Insight AI menjawab, PWA installable (HTTPS), isolasi tenant benar.

> **Catatan AI di produksi:** `AI_BASE_URL` harus menunjuk ke endpoint yang **publik-reachable** (Cloudflare tunnel `llm.kianlabs.my.id`). Jangan pakai IP Tailscale/LAN — Vercel tak bisa menjangkau. Untuk pilot, Tier 1 (9router pribadi) hanya untuk demo; pelanggan berbayar sebaiknya pakai `AI_PROVIDER=managed`.

> **Login demo staging:** owner `owner@warung-berkah-jaya.demo` / `password123`; kasir PIN `123456`; halaman masuk `/masuk`.

> **Invarian Postgres:** partial unique index `tx_one_draft_per_meja` (di migrasi `init_postgres`) menegakkan **satu bill DRAFT per meja** di level DB. Di SQLite invarian ini hanya dijaga aplikasi; di Postgres kini dijamin database.

## Struktur

```
src/app/
  layout.tsx + SidebarNav.tsx → sidebar + topbar mobile (hanya saat login)
  page.tsx            → LANDING page SaaS (publik; redirect /kasir bila login)
  daftar/             → pendaftaran warung baru (self-serve signup)
  masuk/              → login tunggal (email owner / slug+pin kasir)
  kasir/page.tsx      → mesin kasir (diskon, pajak otomatis, shift banner)
  produk/page.tsx     → CRUD produk + stepper stok
  transaksi/page.tsx  → riwayat transaksi (query langsung, hanya LUNAS)
  meja/page.tsx       → peta meja (KOSONG/TERISI, derive dari bill DRAFT)
  meja/[id]/page.tsx  → bill DRAFT satu meja + BillPanel (aksi bill)
  shift/page.tsx      → buka/tutup + selisih kas
  stok/page.tsx       → kartu stok
  laporan/page.tsx    → dashboard + filter tanggal + export CSV
  dashboard/page.tsx  → dashboard live (omzet real-time)
  promo/page.tsx      → promo/diskon + voucher
  notifikasi/page.tsx → laporan shift siap kirim WA
  insight/            → Insight AI (ringkasan + chat owner)
  struk/[id]/page.tsx → struk + cetak (PrintButton.tsx)
  pengaturan/page.tsx → pajak otomatis
  api/
    auth/daftar/      → POST signup warung baru (warung+owner+setting+meja, auto-login)
    auth/login/       → POST login (owner/kasir)
    auth/warung/      → POST resolve email/slug → {slug,nama} (untuk login tunggal)
    products/         → GET + POST
    products/[id]/    → PATCH + DELETE
    checkout/         → POST (transaksi atomik + pajak otomatis; mejaId opsional)
    meja/[id]/bill/   → POST buka bill DRAFT di meja
    bills/[id]/       → PATCH tambah/ubah item + diskon, DELETE batal bill
    bills/[id]/bayar/ → POST bayar DRAFT → LUNAS (kurangi stok + StockMove)
    bills/[id]/gabung/→ POST gabung bill sumber ke bill ini
    bills/[id]/pisah/ → POST pisah item ke meja lain (pindah, bukan salin)
    stats/            → GET (omzet, range tanggal)
    dashboard/        → GET (omzet real-time + grafik per jam)
    shifts/           → GET + POST, /active, /[id]/close
    stock-moves/      → GET kartu stok
    settings/         → GET + PATCH pajak
    promo/            → GET + POST + /evaluate
    notifikasi/       → GET + tandai terkirim
    sync/             → POST sinkron transaksi offline
    export/           → GET CSV transaksi
    ai/               → insights, chat (SSE), anomaly, report/preview, usage
src/server/           → server-only: prisma (db.ts), session, tenant, audit, settings, rate-limit, meja, http, promo, notif, wa/, ai/
src/client/           → client-only: offline-db, offline-sync, offline-types (IndexedDB)
src/shared/           → aman dua sisi: session-types, rupiah, nav, icons, hitung-uang, promo-types, ReceiptView
src/types/            → tipe global (Role, AuditAction, dll)
prisma/
  schema.prisma       → Warung, User, Product, Transaction(+diskon/pajak/shift), Shift, StockMove, Setting, Meja, AuditLog, Insight, AiUsage (PostgreSQL)
  migrations/         → migrasi Postgres (init_postgres + partial unique index DRAFT-per-meja + RLS)
  migrations-sqlite-archive/ → riwayat migrasi SQLite (arsip, sebelum pindah Postgres)
  seed.ts             → 38 menu warung + pajak default 10% (parameter --warungs=N)
```

## Ide pengembangan lanjut

- Mode barcode scanner (input keyboard wedge) — dasar sudah ada (`ScanListener.tsx`)
- Mode kios fullscreen — dasar sudah ada (`KiosToggle.tsx`)
- Billing/langganan otomatis (midtrans/Xendit) + enforcement masa trial
- Session rate-limit ke DB/Redis (saat ini in-memory)
