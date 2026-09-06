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
- Checkout atomik: validasi stok + kurangi stok dalam satu transaksi DB

## Cara jalan

```bash
cd pos-kasir-modern
npm install --ignore-scripts
npx prisma migrate dev   # buat DB SQLite
npx tsx prisma/seed.ts   # isi 38 menu warung (dilewati bila sudah ada transaksi)
npm run dev              # buka http://localhost:3000
```

> Catatan: project ini pakai `npm install --ignore-scripts` karena policy `allow-scripts` di mesin ini. Prisma dipakai versi 6 (stabil, perintah `migrate dev`).

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

- Login kasir/admin (NextAuth) + hak akses
- Mode barcode scanner (input keyboard wedge)
- Mode kios fullscreen
- Deploy live (Vercel + Postgres)
