# 🧾 KasirKu — POS Kasir Modern

Aplikasi kasir modern single-codebase: **Next.js 14 + TypeScript + Tailwind + Prisma + SQLite**.

## Fitur

- **Kasir** (`/`) — cari produk, keranjang +/−, bayar Tunai (hitung kembalian) / QRIS
- **Produk** (`/produk`) — tambah & hapus produk, tabel harga/stok
- **Struk** (`/struk/[id]`) — struk transaksi + tombol cetak (print CSS)
- **Laporan** (`/laporan`) — omzet & transaksi hari ini, peringatan stok menipis, 10 transaksi terakhir
- Checkout atomik: validasi stok + kurangi stok dalam satu transaksi DB

## Cara jalan

```bash
cd pos-kasir-modern
npm install --ignore-scripts
npx prisma migrate dev   # buat DB SQLite
npx tsx prisma/seed.ts   # isi 8 produk contoh (sekali saja)
npm run dev              # buka http://localhost:3000
```

> Catatan: project ini pakai `npm install --ignore-scripts` karena policy `allow-scripts` di mesin ini. Prisma dipakai versi 6 (stabil, perintah `migrate dev`).

## Struktur

```
src/app/
  page.tsx            → kasir
  produk/page.tsx     → CRUD produk
  laporan/page.tsx    → dashboard
  struk/[id]/page.tsx → struk + cetak
  api/
    products/         → GET + POST
    products/[id]/    → PATCH + DELETE
    checkout/         → POST (transaksi atomik)
    stats/            → GET (omzet hari ini)
src/lib/              → prisma client + format rupiah
prisma/
  schema.prisma       → Product, Transaction, TransactionItem
  seed.ts             → 8 produk warung contoh
```

## Ide pengembangan lanjut

- Login kasir/admin (NextAuth) + hak akses
- Diskon / pajak per transaksi
- Export laporan ke CSV/Excel
- Mode barcode scanner (input keyboard wedge)
- Dark mode + mode kios fullscreen
