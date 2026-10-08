---
version: alpha
name: KRING!
description: "Hangat, playful, dan cepat dibaca — nuansa warung makan (krem gading, oranye bakar) dengan chrome gelap untuk sidebar kasir."
colors:
  primary: "#C2410C"
  primary-hover: "#9A3412"
  primary-bright: "#EA580C"
  secondary: "#18181B"
  tertiary: "#15803D"
  neutral: "#FAF6F0"
  surface: "#FFFFFF"
  text-muted: "#71717A"
  success-bg: "#DCFCE7"
  warning: "#92400E"
  warning-bg: "#FEF3C7"
  danger: "#B91C1C"
  danger-bg: "#FEF2F2"
  accent-bg: "#FFF7ED"
typography:
  h1:
    fontFamily: Inter
    fontSize: 1.5rem
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.01em"
  h2:
    fontFamily: Inter
    fontSize: 1.125rem
    fontWeight: 700
    lineHeight: 1.3
  body-md:
    fontFamily: Inter
    fontSize: 1rem
    fontWeight: 400
    lineHeight: 1.5
  body-sm:
    fontFamily: Inter
    fontSize: 0.875rem
    fontWeight: 400
    lineHeight: 1.5
  label-sm:
    fontFamily: Inter
    fontSize: 0.75rem
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "0.01em"
  receipt:
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace"
    fontSize: 0.75rem
    fontWeight: 400
    lineHeight: 1.45
rounded:
  md: 6px
  lg: 8px
  xl: 12px
  full: 9999px
spacing:
  sm: 8px
  md: 16px
  lg: 24px
components:
  page:
    backgroundColor: "{colors.neutral}"
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "#FFFFFF"
    typography: "{typography.body-md}"
    rounded: "{rounded.lg}"
    padding: "10px 16px"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
    textColor: "#FFFFFF"
    typography: "{typography.body-md}"
    rounded: "{rounded.lg}"
    padding: "10px 16px"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.primary}"
    typography: "{typography.body-md}"
    rounded: "{rounded.lg}"
    padding: "10px 16px"
  button-secondary-hover:
    backgroundColor: "{colors.neutral}"
    textColor: "{colors.primary}"
    typography: "{typography.body-md}"
    rounded: "{rounded.lg}"
    padding: "10px 16px"
  button-danger:
    backgroundColor: "{colors.danger}"
    textColor: "#FFFFFF"
    typography: "{typography.body-md}"
    rounded: "{rounded.lg}"
    padding: "10px 16px"
  button-disabled:
    backgroundColor: "#FFEDD5"
    textColor: "#9A3412"
    typography: "{typography.body-md}"
    rounded: "{rounded.lg}"
    padding: "10px 16px"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.secondary}"
    typography: "{typography.body-md}"
    rounded: "{rounded.lg}"
    padding: "8px 12px"
  card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.lg}"
    padding: "{spacing.md}"
  table-cell-meta:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-muted}"
    typography: "{typography.body-sm}"
  sidebar:
    backgroundColor: "{colors.secondary}"
    textColor: "#D4D4D8"
    typography: "{typography.body-sm}"
  sidebar-item-active:
    backgroundColor: "{colors.primary}"
    textColor: "#FFFFFF"
    typography: "{typography.body-sm}"
    rounded: "{rounded.lg}"
    padding: "10px 12px"
  badge-success:
    backgroundColor: "{colors.success-bg}"
    textColor: "{colors.tertiary}"
    typography: "{typography.label-sm}"
    rounded: "{rounded.full}"
    padding: "2px 10px"
  badge-warning:
    backgroundColor: "{colors.warning-bg}"
    textColor: "{colors.warning}"
    typography: "{typography.label-sm}"
    rounded: "{rounded.full}"
    padding: "2px 10px"
  badge-danger:
    backgroundColor: "{colors.danger-bg}"
    textColor: "{colors.danger}"
    typography: "{typography.label-sm}"
    rounded: "{rounded.full}"
    padding: "2px 10px"
  badge-accent:
    backgroundColor: "{colors.accent-bg}"
    textColor: "{colors.primary}"
    typography: "{typography.label-sm}"
    rounded: "{rounded.full}"
    padding: "2px 10px"
  empty-state:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-muted}"
    typography: "{typography.body-sm}"
  receipt:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.secondary}"
    typography: "{typography.receipt}"
---

## Overview

KRING! 🔔 — *"Kasir bunyi, cuan masuk."* Identitas visualnya hangat seperti warung
makan itself: krem gading sebagai kanvas, oranye bakar sebagai warna aksi dan
karakter, ditopang chrome gelap untuk sidebar kasir. Playful lewat emoji per
produk dan radius yang ramah — bukan lewat dekorasi yang memperlambat kasir.
Emoji adalah **identitas produk/kategori** (pilihan pelanggan saat input menu);
ikon chrome UI (nav, judul section, placeholder pencarian) memakai satu set ikon
SVG — lihat Don'ts.

Prinsipnya satu: **kontras & kecepatan baca di atas keindahan.** Kasir membaca
layar dalam 1 detik sambil melayani antrean; pemilik membaca angka di HP-nya di
rumah. Warna status selalu berpasangan dengan teks — jangan pernah menyampaikan
"lunas"/"menipis" lewat warna saja.

## Colors

- **Primary (#C2410C) — "Oranye Bakar":** driver interaksi tunggal: tombol
  utama, link, fokus, aksen badge, latar item sidebar aktif (putih di atasnya
  5.2:1 — lolos WCAG AA). Itulah kenapa base-nya orange-700, bukan orange-600.
- **Primary Hover (#9A3412):** versi lebih gelap untuk hover/pressed — kontras
  7.3:1, memberi rasa "ditekan" tanpa animasi.
- **Primary Bright (#EA580C) — orange-600:** aksen dekoratif & sorotan di atas
  gelap (5.0:1 di atas secondary). **Bukan** latar teks putih kecil — putih
  di atasnya hanya 3.0:1 (gagal AA; tercatat di UI sekarang: nav aktif memakai
  orange-500 → 2.8:1).
- **Secondary (#18181B) — zinc-900:** sidebar, chrome gelap, dan teks kuat di
  kartu. Teks putih di atasnya 17.9:1.
- **Tertiary (#15803D) — hijau daun:** teks status sukses ("LUNAS", stok aman)
  di atas surface 5.0:1 — pasangan dengan `success-bg`.
- **Neutral (#FAF6F0) — krem gading:** latar halaman. Satu-satunya warna "hangat"
  besar; jangan ditimpa abu-abu murni yang membuat app terasa dingin.
- **Surface (#FFFFFF):** kartu, input, tabel — kontras dengan neutral supaya
  konten "terangkat" tanpa perlu bayangan tebal.
- **Text Muted (#71717A) — zinc-500:** teks sekunder (tanggal, sub-teks) —
  4.8:1 di putih. **Bukan zinc-400** (2.8:1, gagal — tercatat di audit).
- **Status trio:** `success-bg`/`tertiary`, `warning-bg`/`warning`,
  `danger-bg`/`danger` — semua lolos AA sebagai badge. Untuk tombol destruktif
  pakai `danger` (#B91C1C) dengan teks putih.
- **Accent BG (#FFF7ED):** oranye sangat muda untuk sorotan baris/hover ringan
  di tabel tanpa mengubah hierarki.

## Typography

Inter untuk seluruh UI (**catatan implementasi:** `globals.css` sudah merujuk
Inter tetapi belum dimuat — muat via `next/font` sekali di `layout.tsx`, atau
jatuhkan sengaja ke system-ui dan hapus rujukan matinya; jangan biarkan
tergantung seperti sekarang).

- Hierarki berat: **700** untuk judul (h1 24px, h2 18px), **600** untuk label
  kecil/heading tabel, **400** untuk isi. Tidak ada font-weight aneh.
- `label-sm` (12px/600) = kapital opsional untuk header tabel & badge; jangan
  turun di bawah 12px untuk teks berisi (audit menemukan label 10px — hindari).
- `receipt` memakai monospace stack system (tanpa webfont tambahan) — kolom
  struk 80mm wajib monospace supaya rata.

## Layout & Spacing

- Skala spacing: `sm` 8 / `md` 16 / `lg` 24. Pola lapangan: `gap-3`–`gap-4`
  antar kartu, `p-3`–`p-4` dalam kartu, `p-6`–`p-8` margin halaman.
- Grid kasir: katalog (2–4 kolom responsif) + panel keranjang 360px sticky di
  `xl`; di bawah `xl` keranjang turun ke bawah (target perbaikan: sticky lebih
  awal atau tombol bayar mengambang — lihat audit UX).
- Tabel selalu dibungkus `overflow-x-auto` + `min-w-*` — HP kasir jangan
  pernah menyebabkan zoom-out.
- Sidebar gelap tetap (desktop) + topbar scroll horizontal (mobile) — item
  aktif memakai `sidebar-item-active`.
- Kontrol yang disentuh jari (tombol aksi, stepper ±, chip uang cepat) punya
  area sentuh **≥44×44px** — padding bukan ukuran teks yang menentukan.

## Elevation & Depth

Ringan dan datar: **`shadow-sm`** untuk kartu/tabel (17 pemakaian — default),
**`shadow-md`** hanya untuk modal & dropdown. Tidak ada shadow tebal/neon.
Kartu dibedakan dari latar lewat `surface` vs `neutral`, bukan bayangan.
Scrollbar ramping 6px (`.nice-scroll`) — milik KRING!, pertahankan.

## Shapes

Diukur dari UI berjalan (bukan tebakan) — nilai = nilai default Tailwind,
sehingga merge token tidak mengubah render:

- `rounded-md` (6px) = kontrol kecil (stepper stok) — pemakaian jarang.
- `rounded-lg` (8px) = **default interaktif & kartu**: tombol CTA, input,
  kartu, item sidebar aktif (41+ pemakaian).
- `rounded-xl` (12px) = panel besar (keranjang pesanan, kartu KPI).
- `rounded-full` = badge status, chip kategori, chip uang cepat.
- Struk cetak: tanpa radius (dibersihkan di print CSS).

## Components

- **`button-primary`** satu-satunya aksi high-emphasis per layar (mis. "Bayar").
  Pasangan hover-nya wajib `button-primary-hover`. Jangan ada dua tombol
  primary di satu viewport.
- **`button-secondary`** untuk aksi sekunder (Batal, Kembali); **`button-danger`**
  hanya untuk aksi merusak & selalu di belakang aksi aman, dengan konfirmasi
  modal (bukan `confirm()` native — lihat Do's).
- **`button-disabled`** untuk CTA yang belum bisa dijalankan (mis. "Bayar Rp0"):
  oranye sangat muda + teks oranye gelap — terbaca "mati tapi jelas"; jangan
  putih-di-atas-oranye-pucat yang hilang di mata.
- **`input`** = field standar; fokus memakai ring `primary` (2px, offset 2px).
- **`card`** = wadah konten utama; jangan bersarang lebih dari 2 tingkat.
- **`sidebar` / `sidebar-item-active`** = navigasi; item aktif memakai bg
  `primary` + teks putih (5.2:1). UI sekarang memakai orange-500/putih (2.8:1,
  gagal AA) — koreksi masuk Fase 0.
- **Badge** (`success`/`warning`/`danger`/`accent`) selalu berisi teks —
  warna hanya memperkuat.
- **`empty-state`** untuk setiap area data kosong (chart, tabel, list, KPI):
  satu baris teks muted "Belum ada …". Chart kosong = sembunyikan sumbu atau
  tampilkan pesan — jangan kanvas bertulang kosong (bug tercatat: sumbu tanpa
  bar).
- **`receipt`** khusus pratinjau & area cetak struk 80mm.

## Do's and Don'ts

**Do**
- DO gunakan `rupiah()`/format Rupiah terpusat untuk semua angka — konsistensi `Rp12.000`.
- DO teks sekunder minimal `text-muted` (#71717A) — sudah lolos AA.
- DO status = warna + label teks (dan ikon), selalu bertiga.
- DO sediakan `focus-visible` ring (2px `primary`) di setiap kontrol interaktif.
- DO muat Inter via `next/font` sekali, atau hapus rujukan font-nya.
- DO jaga satu `button-primary` per layar; sisanya secondary/danger.
- DO beri `empty-state` di setiap area data kosong (chart, tabel, list, KPI).
- DO tampilkan nilai kosong/nol dengan teks `text-muted` (`—`, `Rp0`) — bukan
  warna aksi (dash "Kembalian —" jangan oranye).
- DO jaga target sentuh ≥44px untuk kontrol kasir — stepper ±, chip uang cepat,
  dan segmen Tunai/QRIS di UI sekarang 28–38px, tambah padding.

**Don't**
- DON'T pakai `text-zinc-400`/`#A1A1AA` untuk teks kecil (2.8:1 — gagal WCAG, tercatat di audit).
- DON'T pakai `primary-bright` (#EA580C) sebagai latar teks putih kecil — hanya untuk aksen di atas gelap atau elemen tanpa teks.
- DON'T beri latar oranye terang (orange-500/600) pada teks putih di bawah 18px (2.8–3.0:1, gagal AA) — latar tombol/chip/nav aktif pakai `primary` (#C2410C).
- DON'T pakai hitam solid sebagai latar tombol aksi (tercatat: `Terapkan`) —
  aksi selalu `button-primary`/`button-secondary`; hitam hanya chrome sidebar
  (`secondary`).
- DON'T pakai emoji sebagai ikon chrome UI (nav, judul section, placeholder
  pencarian) — emoji khusus identitas produk/kategori; chrome pakai satu set
  ikon SVG.
- DON'T sampaikan makna status lewat warna saja (buta warna).
- DON'T pakai `alert()`/`confirm()` native — pakai modal komponen KRING!.
- DON'T menambah webfont kedua (biaya loading di HP Android kentang).
- DON'T memakai bayangan tebal, gradient mencolok, atau oranye terang sebagai latar area baca besar.
