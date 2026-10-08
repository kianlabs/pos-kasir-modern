# 🧾 KasirKu — POS Kasir Modern

Aplikasi kasir warung makan single-codebase: **Next.js 14 + TypeScript + Tailwind + Prisma + SQLite**.

## Fitur

- **Kasir** (`/`) — kategori, cari produk, keranjang +/−, diskon Rp, pajak otomatis, bayar Tunai (numpad + kembalian) / QRIS
- **Produk** (`/produk`) — tambah, edit, hapus, stepper stok, nilai total stok
- **Transaksi** (`/transaksi`) — riwayat 50 transaksi terakhir + link struk
- **Shift** (`/shift`) — buka/tutup shift, rekap modal vs kas fisik + selisih
- **Stok** (`/stok`) — kartu stok: tiap penjualan/kulakan/koreksi tercatat
- **Struk** (`/struk/[id]`) — struk 80mm + tombol cetak (print CSS)
- **Laporan** (`/laporan`) — filter tanggal, export CSV, grafik 7 hari, produk terlaris, stok menipis
- **Pengaturan** (`/pengaturan`) — pajak otomatis on/off + tarif
- **Auth & RBAC** (`/masuk/[slug]`) — login multi-role: owner (email + password) & kasir (PIN); session HMAC cookie; kasir dibatasi (403 di `/produk`, `/laporan`, `/pengaturan`)
- Checkout atomik: validasi stok + kurangi stok dalam satu transaksi DB

## Menjalankan

Prasyarat: buat file `.env` dengan **`SESSION_SECRET`** (wajib, minimal 16 karakter) dan **`DATABASE_URL`**.

```bash
# .env
SESSION_SECRET=ganti-dengan-string-acak-min-16-karakter
DATABASE_URL="file:./dev.db"
```

Lalu jalankan:

```bash
npm install                # otomatis menjalankan prisma generate via postinstall
npx prisma migrate deploy  # terapkan migrasi ke DB
npx tsx prisma/seed.ts     # isi data demo (idempoten — dilewati bila sudah ada)
npm run dev                # buka http://localhost:3000
```

> Catatan: `npm install` sudah otomatis men-generate Prisma Client (via script `postinstall: prisma generate`) — tidak perlu menjalankan `npx prisma generate` secara terpisah. Prisma dipakai versi 6.

## Akun demo

Setelah `seed.ts`, gunakan akun berikut:

- **Owner** — email `owner@warung-berkah-jaya.demo`, password `password123`
- **Kasir** — PIN `123456`
- **Akses halaman masuk:** `/masuk/warung-berkah-jaya` (per-warung) atau `/masuk/_` (fallback tanpa slug)

## Keamanan

- **`SESSION_SECRET` wajib diisi di produksi** (minimal 16 karakter) — tanpa ini sesi tidak aman.
- **Rate-limit PIN masih in-memory** (5× gagal → blokir 5 menit). Pindahkan ke DB/Redis saat deploy multi-instance, karena state in-memory tidak terbagi antar proses.

## Struktur

```
src/app/
  layout.tsx + SidebarNav.tsx → sidebar + topbar mobile
  page.tsx            → kasir (diskon, pajak otomatis, shift banner)
  produk/page.tsx     → CRUD produk + stepper stok
  transaksi/page.tsx  → riwayat transaksi (query langsung)
  shift/page.tsx      → buka/tutup + selisih kas
  stok/page.tsx       → kartu stok
  laporan/page.tsx    → dashboard + filter tanggal + export CSV
  struk/[id]/page.tsx → struk + cetak (PrintButton.tsx)
  pengaturan/page.tsx → pajak otomatis
  api/
    products/         → GET + POST
    products/[id]/    → PATCH + DELETE
    checkout/         → POST (transaksi atomik + pajak otomatis)
    stats/            → GET (omzet, range tanggal)
    shifts/           → GET + POST, /active, /[id]/close
    stock-moves/      → GET kartu stok
    settings/         → GET + PATCH pajak
    export/           → GET CSV transaksi
src/lib/              → prisma client + format rupiah + ikon kategori + pajak
prisma/
  schema.prisma       → Product, Transaction(+diskon/pajak/shift), Shift, StockMove, Setting
  seed.ts             → 38 menu warung + pajak default 10%
```

## Ide pengembangan lanjut

- Mode barcode scanner (input keyboard wedge)
- Mode kios fullscreen
- Deploy live (Vercel + Postgres)
