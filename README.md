# 🧾 KRING! — POS Kasir Modern (SaaS Multi-Tenant)

[![CI](https://github.com/kianlabs/pos-kasir-modern/actions/workflows/ci.yml/badge.svg)](https://github.com/kianlabs/pos-kasir-modern/actions/workflows/ci.yml)
[![Live Demo](https://img.shields.io/badge/Live_Demo-kringkasir.vercel.app-00C7B7?logo=vercel&logoColor=white)](https://kringkasir.vercel.app)
![Next.js 16](https://img.shields.io/badge/Next.js-16-000000?logo=nextdotjs&logoColor=white)
![React 19](https://img.shields.io/badge/React-19-20232A?logo=react&logoColor=61DAFB)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![Tailwind CSS 4](https://img.shields.io/badge/Tailwind_CSS-4-38B2AC?logo=tailwindcss&logoColor=white)
![Prisma ORM](https://img.shields.io/badge/Prisma-6-2D3748?logo=prisma&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Supabase-4169E1?logo=postgresql&logoColor=white)
[![License: MIT](https://img.shields.io/badge/License-MIT-emerald.svg)](./LICENSE)

Aplikasi kasir (Point of Sale) modern siap produksi untuk bisnis kuliner dan warung makan, disajikan sebagai **SaaS multi-tenant self-serve**: satu deployment melayani banyak gerai/warung dengan isolasi data menyeluruh.

🌐 **Staging Live:** [https://kringkasir.vercel.app](https://kringkasir.vercel.app)

---

## Arsitektur Sistem

```mermaid
flowchart TD
    subgraph ClientApp["Aplikasi Web Kasir & PWA (Next.js 16 + React 19)"]
        Landing["Landing Page SaaS & 1-Click Demo Launcher"]
        Cashier["Mesin Kasir (Numpad + QRIS + Struk 80mm)"]
        Tables["Manajemen 10 Meja (Bill Draft, Split & Merge)"]
        Inventory["Manajemen Produk, Stok & Mutasi StockMove"]
        Shifts["Shift Kasir & Rekap Modal Kas"]
        InsightUI["Insight AI Chat & Dashboard Metrik"]
    end

    subgraph AppRouter["Next.js App Router & Server Logic"]
        AuthModule["Auth & RBAC (Owner Password / Kasir PIN)"]
        CheckoutEngine["Engine Checkout Atomik & Validasi Stok"]
        TableEngine["Engine Bill Meja (tx_one_draft_per_meja)"]
        AiEngine["Engine Insight AI (7 Deterministic Tool Calling)"]
    end

    subgraph StorageLayer["Database & Cloud Services"]
        PrismaORM["Prisma ORM 6"]
        SupabasePg[("PostgreSQL Database (Supabase)")]
        PgBouncer["PgBouncer Transaction Connection Pooling"]
        LLMGateway["OpenAI-Compatible LLM Gateway (9router / Managed)"]
    end

    Landing --> AuthModule
    Cashier --> CheckoutEngine
    Tables --> TableEngine
    Shifts --> CheckoutEngine
    Inventory --> CheckoutEngine
    InsightUI --> AiEngine

    AuthModule --> PrismaORM
    CheckoutEngine --> PrismaORM
    TableEngine --> PrismaORM
    AiEngine -->|1. Ekstrak Data Agregat| PrismaORM
    AiEngine -->|2. Rangkai Narasi Angka| LLMGateway

    PrismaORM --> PgBouncer
    PgBouncer --> SupabasePg
```

---

## Fitur Unggulan & Inovasi Terbaru

- ⚡ **1-Click Instant Demo Mode**: Akses demonstrasi instan langsung dari landing page tanpa perlu mengisi formulir pendaftaran. Penguji dapat masuk dengan 1-klik sebagai **Owner** (`owner@warung-berkah-jaya.demo`) atau **Kasir** (`123456`) ke warung uji coba yang sudah dilengkapi 38 menu kuliner siap transaksi, denah meja, dan riwayat pesanan.
- 🤖 **Insight AI Deterministic & Kuota Token**: Asisten analitik bisnis berbasis data nyata warung tanpa tebak-tebakan halusinasi. Pertanyaan pemilik dipetakan deterministik melalui pencocokan kata kunci ke 7 modul agregasi data nyata (penjualan harian, tren omzet, produk terlaris, kasir terproduktif, stok menipis, rekapitulasi shift, dan deteksi anomali). Jawaban disusun menjadi narasi terstruktur dengan pelacakan kuota token AI per warung (`ai_usage`) dan kartu pemantauan pemakaian bulanan.
- 🪑 **Manajemen Meja Dinamis & Bill Engine**: Denah interaktif 10 meja dengan status `KOSONG`/`TERISI` yang di-derive otomatis dari transaksi draft aktif. Dilengkapi kemampuan membuka bill baru, menambah item fleksibel, diskon khusus, penggabungan (*merge*) bill, dan pemindahan/pemisahan (*split*) bill antar-meja. Dijamin dengan partial unique index PostgreSQL `tx_one_draft_per_meja` di level database.
- 💳 **Checkout Atomik & Akurasi Stok Real-Time**: Transaksi pembayaran kasir diproses atomik (`interactiveTransaction`)—kuantitas stok diverifikasi dan dipotong seketika saat status berpindah dari `DRAFT` menjadi `LUNAS`, dilengkapi pencatatan riwayat kartu stok (`StockMove`).
- 🧾 **Mesin Kasir Cepat & Struk 80mm**: Pencarian produk instan, keranjang interaktif, kalkulasi pajak otomatis, numpad pembayaran tunai dengan hitung kembalian cepat, pembayaran QRIS, dan cetak struk thermal 80mm siap pakai via browser print CSS.
- 🏢 **Multi-Tenant SaaS Self-Serve**: Registrasi warung mandiri (`POST /api/auth/daftar`) secara otomatis membuat entitas warung, profil owner, 10 meja default, dan pengaturan toko dalam satu transaksi basis data.
- 🛡️ **Keamanan Berlapis**: Proteksi sesi berbasis HMAC signed cookie, pembatasan akses berbasis peran (RBAC Kasir vs Owner), proteksi CSRF, header keamanan Content Security Policy (CSP), dan isolasi Supabase Row-Level Security (RLS).

---

## Alur Routing Aplikasi

| Jalur (Route) | Kegunaan | Aksesibilitas |
|---|---|---|
| `/` | Landing page SaaS (Hero, Fitur, CTA Coba Demo, Harga) | Publik (otomatis redirect ke `/kasir` bila sudah login) |
| `/daftar` | Registrasi warung baru self-serve (TRIAL 30 hari gratis) | Publik |
| `/masuk` | Login tunggal (Email owner ATAU Slug + PIN kasir) | Publik |
| `/kasir` | Antarmuka mesin kasir POS utama | Memerlukan Sesi (Kasir / Owner) |
| `/meja` | Peta 10 meja & manajemen bill DRAFT | Memerlukan Sesi |
| `/transaksi` | Riwayat 50 transaksi lunas terakhir + cetak ulang struk | Memerlukan Sesi |
| `/shift` | Buka/tutup shift kasir & rekapitulasi selisih uang fisik | Memerlukan Sesi |
| `/stok` | Kartu stok real-time (penjualan, kulakan, koreksi opname)| Memerlukan Sesi |
| `/produk` | Katalog menu makanan/minuman, harga, & stok awal | Owner-only |
| `/laporan` | Laporan omzet, filter rentang tanggal, & ekspor CSV | Owner-only |
| `/dashboard` | Dashboard live real-time (omzet hari ini & grafik per jam)| Owner-only |
| `/promo` | Pengaturan voucher, diskon persentase, nominal, happy hour| Owner-only |
| `/notifikasi` | Template pesan ringkasan shift siap salin ke WhatsApp | Owner-only |
| `/insight` | Asisten analitik bisnis Insight AI & chat interaktif | Owner-only |
| `/pengaturan`| Konfigurasi persentase pajak & identitas warung | Owner-only |

---

## Tech Stack

| Lapisan | Teknologi | Catatan |
|---|---|---|
| **Frontend Framework** | [Next.js 16](https://nextjs.org/) (App Router) | React Server Components, Server Actions |
| **UI Library** | [React 19](https://react.dev/) | Hooks modern, Suspense, Concurrent rendering |
| **Bahasa & Typing** | TypeScript 5 (Strict Mode) | Full type-safety ujung-ke-ujung |
| **Styling** | [Tailwind CSS v4](https://tailwindcss.com/) | Desain responsif mobile-first, print stylesheet |
| **ORM & Database** | [Prisma ORM 6](https://www.prisma.io/) + [PostgreSQL](https://www.postgresql.org/) | Supabase cluster, partial unique index, ACID |
| **Connection Pooling** | PgBouncer (Port 6543) | Tuning connection limit ramah serverless |
| **Autentikasi** | Stateless HMAC Cookies | Login multi-role (Email/Password & PIN Kasir) |
| **AI Inference** | OpenAI-Compatible API | Integrasi 9router / Managed Gateway LLM |

---

## Panduan Instalasi & Menjalankan Lokal

### 1. Prasyarat Sistem
- Node.js versi 20+ dan npm
- Database PostgreSQL (Lokal atau proyek cloud [Supabase](https://supabase.com/))

### 2. Konfigurasi Environment (`.env`)

Buat file `.env` di direktori utama:

```env
# Koneksi pooled PgBouncer (port 6543) untuk serverless runtime
DATABASE_URL="postgresql://postgres:[PASSWORD]@[HOST]:6543/postgres?pgbouncer=true&connection_limit=1"

# Koneksi langsung (port 5432) untuk eksekusi migrasi skema Prisma
DIRECT_URL="postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres"

# Kunci rahasia signing sesi (minimal 16 karakter acak)
SESSION_SECRET="kunci-rahasia-sesi-acak-pos-kasir-modern-12345"

# Konfigurasi Insight AI (Opsional)
AI_ENABLED="true"
AI_PROVIDER="managed"
AI_BASE_URL="https://api.openai.com/v1"
AI_MODEL="gpt-4o-mini"
AI_API_KEY="sk-..."
```

### 3. Instalasi Dependensi & Setup Basis Data

```bash
# 1. Install seluruh package (otomatis menjalankan 'prisma generate' via postinstall)
npm install

# 2. Terapkan migrasi skema ke database PostgreSQL
npm run db:deploy

# 3. Masukkan data benih demo (warung demo, 38 menu makanan/minuman, meja)
npm run db:seed

# 4. Jalankan server pengembangan
npm run dev
```

Buka peramban di [http://localhost:3000](http://localhost:3000).

---

## Kredensial Akun Demonstrasi

Setelah menjalankan `npm run db:seed` atau menekan tombol **"Coba Demo Instan"** di landing page:

| Peran (Role) | Kredensial Masuk | Hak Akses |
|---|---|---|
| **Pemilik (Owner)** | Email: `owner@warung-berkah-jaya.demo`<br>Password: `password123` | Akses penuh (Kasir, Meja, Produk, Laporan, Omzet, Insight AI, Pengaturan) |
| **Kasir** | PIN: `123456`<br>Warung: `Warung Berkah Jaya` | Akses operasional (Mesin Kasir, Buka/Tutup Shift, Transaksi, Meja) |

Halaman masuk terpadu: [http://localhost:3000/masuk](http://localhost:3000/masuk).

---

## Pengujian & Continuous Integration (CI)

```bash
# Verifikasi tipe TypeScript tanpa emit berkas
npm run typecheck

# Jalankan linter ESLint
npm run lint

# Jalankan build produksi Next.js
npm run build

# Menjalankan suite pengujian integrasi database (wajib DB terpisah)
TEST_DATABASE_URL="postgresql://user:pass@localhost:5432/pos_test" npm test
```

> **Aturan Pengujian DB:** Demi mencegah penghapusan data uji/produksi secara tidak sengaja, suite pengujian integrasi (`tests/env-guard.ts`) mewajibkan environment `TEST_DATABASE_URL` dengan host yang berbeda dari database utama dan menolak berjalan bila kosong. Workflow CI GitHub Actions (`.github/workflows/ci.yml`) secara otomatis memvalidasi linting, typecheck, dan production build pada setiap push.

---

## Lisensi

Proyek ini didistribusikan di bawah lisensi [MIT](./LICENSE) © 2026 Ridzkyan Buti Pratama (Kyan).
