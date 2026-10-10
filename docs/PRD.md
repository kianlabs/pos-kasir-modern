# PRD: KRING! — POS Kasir Modern untuk Warung Makan Indonesia

**Versi:** 1.2 — 8 Oktober 2026
**Status:** Siap eksekusi — dikembangkan dari repo `pos-kasir-modern` (KasirKu)
**Pemilik:** Kyan (KyanDev)
**Changelog v1.1:** tambah keputusan multi-tenant (§3, §6.2, §10), section Pricing (§5b), metrik sync + willingness-to-pay (§5), klarifikasi QR statis (§8, §9), acceptance per item MVP (§6.2), kriteria keluar minggu 2 (§13). Detail skema: lihat lampiran `PRD-lampiran-skema-db.md` (kini v1.2).
**Changelog v1.2:** tambah keputusan AI-integrated — fitur "KRING! Insight" di §7b (laporan naratif tutup-shift, deteksi anomali "mata owner", tanya-laporan chat) + daftar tolak di §7b; gating fitur AI ke plan berbayar (§5b); sinkronisasi timeline (§13). Detail teknis: lampiran `PRD-lampiran-ai.md` v1.0.

---

## 1. Nama & Branding

**Nama produk: KRING!** 🔔

Kenapa "Kring!":
- Bunyi mesin kasir saat duit masuk — nama yang *berbunyi*, langsung kebayang fungsinya
- Playful dan beda dari semua POS yang namanya kaku-kaku; gampang dijadiin logo & maskot (lonceng kasir)
- Satu suku kata + tanda seru = nempel di kepala, gampang diucapkan semua umur
- Tagline alami: *"Kring! Kasir bunyi, cuan masuk."*
- Nama domain & handle sosmed kemungkinan masih tersedia (cek: kring.id / kringpos.id)

Alternatif yang dipertimbangkan: **Saji** (elegan, artinya "menyajikan"), **Mampir** (hangat & akrab), **Ngebul** (dari "dapur ngebul"), **Jajan** (fun, kata sehari-hari). Nama "Laris" sempat diusulkan tapi ditolak — terlalu generik.

---

## 2. Ringkasan Produk

KRING! adalah aplikasi kasir (POS) berbasis web yang dirancang khusus untuk **warung makan dan UMKM kuliner Indonesia**. Berbeda dari POS generik, KRING! dibangun dengan asumsi dunia nyata warung: WiFi sering mati, pemilik butuh laporan di WhatsApp, dan kasir berganti shift.

Arsitektur sejak awal: **single database multi-tenant** — satu install melayani banyak warung dengan isolasi data total (keputusan §10, skema di lampiran v1.1).

Fondasi yang sudah ada (dari KasirKu): kasir + keranjang + diskon/pajak, CRUD produk, riwayat transaksi, shift + rekap kas, kartu stok, struk 80mm, laporan + export CSV, checkout atomik.

---

## 3. Target Pengguna

| Persona | Deskripsi | Kebutuhan utama |
|---|---|---|
| **Bu Sari — Pemilik warung** (35–55 th) | Punya 1 warung makan, gaptek sedang, HP Android | Tahu omzet harian tanpa harus ke warung; laporan otomatis; gampang dipakai karyawan |
| **Dimas — Kasir** (18–25 th) | Karyawan shift, gonta-ganti | Buka aplikasi langsung bisa jualan; nggak perlu training lama; tetap jalan saat internet mati |
| **KyanDev — Developer/agensi** | Menjual & mengimplementasikan ke banyak warung | Multi-tenant (satu install, banyak warung); setup < 30 menit per warung; **data antar warung terisolasi total — menu/laporan warung A tidak boleh bocor ke warung B** |

---

## 4. Masalah yang Dipecahkan

1. **Internet warung tidak stabil** → kasir mati = penjualan berhenti. (Solusi: offline-first)
2. **Owner tidak tahu kondisi warung real-time** → harus telepon kasir / datang langsung. (Solusi: dashboard realtime + laporan WA otomatis)
3. **Struk kertas boros & printer sering macet** → biaya + drama. (Solusi: struk digital via WhatsApp)
4. **Warung makan butuh kelola meja** → bill tercampur, kasir bingung. (Solusi: manajemen meja)
5. **Catatan manual rawan selisih** → uang hilang tanpa jejak. (Solusi: shift + kartu stok + audit trail — sudah ada, dipertahankan)

---

## 5. Tujuan & Metrik Sukses

**Tujuan 3 bulan:** 5 warung aktif memakai KRING! harian di area Solo–Sukoharjo.

| Metrik | Target |
|---|---|
| Warung aktif harian | 5 warung |
| Transaksi per hari per warung | ≥ 20 |
| Transaksi offline tersync tanpa hilang/duplikat | 100% (audit via log sync — lihat §11) |
| Warung bersedia bayar setelah pilot | ≥ 3 dari 5 (lihat §5b) |
| Uptime kasir saat internet mati | 100% (mode offline) |
| Waktu setup warung baru | < 30 menit |
| Laporan harian terkirim ke WA owner | 100% tutup shift |

### 5b. Pricing

- **Fase pilot (5 warung, 3 bulan): GRATIS** — imbalan: feedback tiap 2 minggu + izin pakai testimoni/logo untuk marketing.
- **Setelah validasi: Rp99rb/warung/bln** — di bawah Moka/Majoo, di atas biaya server (±Rp30rb). Keputusan final setelah minggu 6 berdasarkan willingness-to-pay 5 warung pilot (target: ≥ 3 bersedia lanjut berbayar).
- **Fitur AI ("KRING! Insight") = pembeda plan berbayar** — plan gratis/gratis-pilot tetap dapat ringkasan angka template (tanpa AI); naratif laporan, deteksi anomali, dan tanya-laporan khusus plan ACTIVE (lihat §7b). Biaya token AI ditanggung KRING! dan wajib < Rp5rb/warung/bln (lihat lampiran §8).

---

## 6. Scope MVP (Fase 1) — 4–6 minggu

### 6.1. Sudah ada — pertahankan & poles
- [x] Kasir: kategori, cari produk, keranjang, diskon Rp, pajak otomatis
- [x] Produk: CRUD + stepper stok + nilai total stok
- [x] Transaksi: riwayat + struk per transaksi
- [x] Shift: buka/tutup + rekap modal vs kas fisik + selisih
- [x] Stok: kartu stok (audit trail tiap pergerakan)
- [x] Struk 80mm + cetak (print CSS)
- [x] Laporan: filter tanggal, export CSV, grafik 7 hari, produk terlaris, stok menipis
- [x] Checkout atomik (validasi stok + kurangi stok dalam 1 transaksi DB)

### 6.2. Baru di MVP
- [x] **Multi-tenant single-DB** — semua tabel bisnis punya `warungId`; semua query di-scope per warung (tenant di-resolve dari user login, lihat §10). *Selesai bila: test isolasi hijau — user warung A request data warung B → 403/kosong.*
  > **Status implementasi (Tahap 2):** session HMAC cookie; `warungId` diambil dari session (bukan dari input/parameter user); semua query di-scope per `warungId` session.
- [x] **Login multi-role** (owner vs kasir) — kasir hanya bisa jualan, owner bisa ubah produk/harga/laporan. *Selesai bila: kasir buka /produk langsung ditolak 403; owner bisa semuanya. Login kasir = pilih nama dari daftar → ketik PIN → verifikasi hash server-side.*
  > **Status implementasi (Tahap 2):** gate 403 kasir di `/produk` (juga `/laporan`, `/pengaturan`); rate-limit PIN 5× gagal / 5 menit; AuditLog mencatat login (`LOGIN_OK`/`LOGIN_FAIL`).
- [x] **Manajemen meja** — 10–20 meja, status kosong/terisi, bill per meja, gabung/pisah bill. *Selesai bila: 2 meja aktif bersamaan tanpa bill tercampur; tutup meja mengosongkan status.* — Halaman `/meja` (peta status di-derive dari bill DRAFT, bukan kolom tersimpan), bill DRAFT per meja, gabung/pisah, tutup shift 409 bila ada bill terbuka. Stok berkurang saat bayar, bukan saat buka bill (lihat README).
- [x] **Mode offline-first** — transaksi tersimpan lokal (IndexedDB) saat offline, auto-sync saat online kembali (upsert by UUID client-side, idempotent); indikator status koneksi jelas di UI. *Selesai bila: matikan internet → 5 transaksi → nyalakan → kelimanya muncul di server tanpa duplikat.*
  > **Status implementasi (Tahap 4):** antrean `outbox` IndexedDB (native, nol dep) + `/api/sync` batch idempotent (`upsert` by id); banner kuning/hijau; struk inline saat offline. **E2E terbukti** (Playwright + production build): 5 transaksi offline → tersync, antrean 0, 8/8 id unik (0 duplikat); idempotency resend → 1 baris. Stok boleh minus saat sync, ditandai `SYNC_CONFLICT` (PRD §12).
- [x] **PWA installable** — bisa di-install di tablet/HP kasir seperti aplikasi native, ikon KRING! di home screen. *Selesai bila: instal dari Chrome Android, buka fullscreen tanpa address bar.*
  > **Status implementasi (Tahap 4):** `manifest.webmanifest` (standalone, ikon 192/512) + service worker manual (`public/sw.js`: app-shell cache-first, HTML network-first, GET produk/settings stale-while-revalidate). Aset PWA publik (di allow-list middleware). Terverifikasi: `Page.getAppManifest errors: []`, SW `activated`.
- [x] **Deploy production** — migrasi SQLite → PostgreSQL (termasuk skema multi-tenant sejak awal, lihat lampiran), deploy (Vercel + Postgres managed). *Selesai bila: URL staging live, 1 warung fiktif bisa jualan penuh.*
  > **Status implementasi (Tahap 5, SELESAI):** provider Prisma → `postgresql` (Supabase); migrasi `init_postgres` + partial unique index `tx_one_draft_per_meja`; test runner parametrisasi `TEST_DATABASE_URL`; 32/32 test hijau di Supabase. Deploy live di **Vercel** → https://pos-kasir-modern-sigma.vercel.app (env `DATABASE_URL` pooled + `DIRECT_URL` + `SESSION_SECRET`). Verifikasi staging: login owner+kasir, gate 403 kasir, isolasi tenant (warungId dari session), checkout penuh (total + pajak otomatis) — semua lolos.

### 6.3. Kriteria "MVP selesai"
Kasir warung bisa dipakai **jualan seharian penuh tanpa internet**, owner terima rekap di akhir shift, dan data tidak ada yang hilang.

---

## 7. Fase 2 (setelah MVP stabil)

### 7a. Fase 2 — inti

- [ ] **Struk digital via WhatsApp** — kirim struk ke nomor pembeli, gantikan (opsional) struk kertas
- [ ] **Laporan harian otomatis ke WA owner** — tiap tutup shift, ringkasan omzet + produk terlaris terkirim sendiri *(narasi AI menyusul di §7b — channel & trigger yang sama)*
- [ ] **Dashboard realtime owner** — pantau penjualan live dari HP di rumah (polling → upgrade WebSocket)
- [ ] **Mode barcode scanner** — untuk warung yang jual produk kemasan (input keyboard wedge)
- [ ] **Promo engine** — beli 1 gratis 1, diskon jam sepi (happy hour), voucher
- [ ] **Mode kios fullscreen** — untuk tablet kasir yang hanya menampilkan halaman kasir

### 7b. Fase 2 — "KRING! Insight" (AI) — baru di v1.2

**Prinsip non-negotiable (detail di lampiran `PRD-lampiran-ai.md`):**
AI adalah **lapisan insight di atas data, bukan di jalur kritikal kasir**. Checkout, stok, dan sync offline tetap deterministik — tanpa AI, tanpa internet. AI hanya dipanggil saat owner meminta (biaya terkendali, kasir tidak pernah menunggu API). Keras: **owner-only**, tool di-allowlist (tidak ada SQL/text-to-SQL mentah), `warungId` disuntik dari session — **bukan dari prompt**, kirim ringkasan agregat — bukan buku besar mentah.

Fitur, berurutan prioritas:

- [ ] **1. Laporan naratif tutup-shift** — ringkasan ke WA/dashboard berupa bahasa manusia, bukan angka telanjang: *"Omzet Rp1,8jt (23 trx), naik 12% dari kemarin; Laris: Bakso Urat ×18; selisih kas +Rp2.000 (aman); Telur tinggal 4 — besok kulakan ya, Bu."* Template angka → 1 call AI. *Selesai bila: tiap tutup shift owner menerima ringkasan yang terbaca tanpa membuka dashboard, dan angkanya identik dengan /laporan.*
- [ ] **2. Deteksi anomali "mata owner"** — aturan statistik deterministik (diskon tak wajar, selisih kas berulang per kasir, transaksi di luar jam shift, omzet anjlok vs 7 hari) → AI hanya merangkai temuan jadi narasi → alert ke owner. *Selesai bila: 3 skenario curang berikutnya terdeteksi & terkirim dalam 1 hari uji.*
- [ ] **3. Tanya-laporan (chat owner)** — bahasa sehari-hari: *"stok apa yang menipis?"*, *"Dimas berapa omzet minggu ini?"* → AI jawab + chart dari data tenant-nya sendiri. *Selesai bila: 10 pertanyaan sampel terjawab benar; pertanyaan/permintaan lintas-warung selalu gagal atau diarahkan kembali ke data sendiri.*
- [ ] **4. (Fase 3 evaluasi)** — OCR onboarding foto daftar harga → draft produk; prediksi stok & saran kulakan (statistik dulu, AI merangkai kalimat); bot WA AI dua arah (WA API resmi, jangan unofficial); input suara kasir.

**Daftar tolak (diputuskan di v1.2, jangan diangkat lagi tanpa alasan baru):** AI di jalur checkout / latensi kasir; AI mengubah harga/produk otomatis tanpa konfirmasi manusia; text-to-SQL bebas; chatbot RAG umum tentang internet; model besar / fine-tune lokal.

**Kriteria keluar KRING! Insight:** owner aktif memakai ≥ 1 fitur AI di minggu pertama pilot, tanpa keluhan kepercayaan pada angka, dan biaya token < Rp5.000/warung/bln (terukur di dashboard billing).

---

## 8. Future / Di luar scope saat ini

- Multi-cabang & konsolidasi laporan antar cabang
- Integrasi QRIS dinamis via payment gateway (QR per transaksi + webhook). **Catatan MVP: hanya QR statis print + catat manual** (lihat alur §9)
- Akuntansi penuh (jurnal, laba rugi) — cukup rekap kas untuk sekarang
- Aplikasi mobile native — PWA sudah cukup untuk target pasar

---

## 9. Alur Pengguna Kunci

### Kasir jualan (mode normal)
1. Buka KRING! di tablet → login sebagai kasir (pilih nama → PIN) → shift otomatis aktif (atau buka shift + input modal)
2. Pilih meja (atau "bawa pulang") → tambah item → terapkan diskon jika ada
3. Bayar: Tunai (numpad + hitung kembalian) / QRIS (tunjukkan QR statis print yang ditempel di meja, catat sebagai pembayaran QRIS di aplikasi)
4. Struk tercetak / terkirim WA → stok berkurang otomatis → meja kembali kosong

### Kasir jualan (internet mati)
1. Banner kuning muncul: "Mode offline — transaksi tersimpan lokal"
2. Alur jualan **tetap sama persis**, tidak ada yang berubah
3. Internet kembali → banner hijau "Menyinkronkan…" → semua transaksi terkirim, tidak ada duplikat

### Owner tutup hari
1. Tutup shift → input kas fisik → sistem hitung selisih otomatis
2. Ringkasan hari (omzet, transaksi, produk terlaris, selisih kas) **terkirim otomatis ke WhatsApp owner**
3. Owner bisa buka laporan kapan saja dari HP

---

## 10. Arsitektur Teknis

```
Tablet/HP Kasir (PWA)
  ├── Next.js 16 App Router + TypeScript + Tailwind
  ├── IndexedDB (antrean offline) + status koneksi
  └── API Routes (Next.js)
        ├── Prisma ORM
        └── PostgreSQL (Supabase) — dev & production
HP Owner
  ├── Dashboard realtime (polling → WebSocket)
  └── Notifikasi via WhatsApp API (Fase 2)
```

**Keputusan teknis penting:**
- Tetap **single-codebase Next.js** (frontend + API satu repo) — gampang deploy & maintain untuk tim kecil
- **PostgreSQL** untuk production (concurrency kasir + sync offline butuh transaksi DB yang kuat)
- **Prisma** dipertahankan — migrasi SQLite → Postgres relatif mulus
- **Multi-tenant sejak awal:** kolom `warungId` di semua tabel bisnis; tenant di-resolve dari user yang login — **tidak ada pilihan warung di UI kasir** (anti salah input). Detail skema: lampiran v1.1
- Offline sync: **last-write-wins per transaksi** dengan ID unik client-side (UUID, dibuat di tablet sebelum sync); server `upsert` by id → idempotent, aman dari duplikat saat retry
- Auth: kredensial owner = email + password hash; kasir = pilih nama + PIN (hash, verifikasi server-side — hash tidak bisa di-lookup, jadi wajib alur pilih-nama-dulu)

---

## 11. Non-Functional Requirements

- **Performa:** halaman kasir interaktif < 1 detik (di HP Android kentang); tambah item ke keranjang terasa instan (< 100ms)
- **Reliabilitas:** nol transaksi hilang — setiap checkout offline harus bisa dibuktikan tersync. **Cara ukur:** tiap transaksi offline ber-UUID; rasio (transaksi tersync ÷ transaksi dibuat offline) = 100% via log sync (lihat metrik §5)
- **Kemudahan:** kasir baru bisa jualan dalam 10 menit tanpa training formal
- **Keamanan:** kasir tidak bisa ubah harga/produk/lihat laporan; semua aksi tercatat (siapa, kapan)
- **Bahasa:** seluruh UI Bahasa Indonesia, format Rupiah (Rp) konsisten

---

## 12. Risiko & Pertanyaan Terbuka

| Risiko / Pertanyaan | Mitigasi / Jawaban sementara |
|---|---|
| Konflik sync offline (2 kasir jual stok terakhir bersamaan) | Stok boleh minus sementara saat offline; saat sync, tandai transaksi konflik untuk review owner — transparan > sempurna |
| Biaya WhatsApp API | Fase 2; mulai dari provider termurah, atau mode semi-otomatis (template pesan + 1 klik kirim) |
| Owner gaptek takut data hilang | Edukasi saat setup + fitur "backup" satu klik; data tersimpan di cloud, bukan di tablet |
| Kompetitor (Moka, Majoo, Olsera) | Mereka mahal & berat untuk warung kecil; KRING! menang di harga, kesederhanaan, dan offline-first |
| Kolom skema lama tercecer saat migrasi multi-tenant | Wajib lewat checklist mapping lama→baru di lampiran §3 sebelum migrasi dinyatakan selesai |

---

## 13. Estimasi Timeline

| Minggu | Fokus | Kriteria keluar |
|---|---|---|
| 1–2 | Login multi-role + skema multi-tenant + migrasi Postgres + deploy staging | Staging live, 1 warung fiktif bisa jualan penuh |
| 3–4 | Manajemen meja + offline-first (IndexedDB + sync engine + indikator koneksi) + PWA | 5 transaksi offline tersync tanpa duplikat |
| 5–6 | Uji lapangan di 1–2 warung sungguhan, perbaiki dari feedback | Keputusan pricing final (target 3/5 bersedia bayar) |
| 7+ | Fase 2: struk WA → laporan WA otomatis → dashboard realtime → **KRING! Insight (AI, §7b)** | — |

> **Progres (2026-10-09):** Minggu 3–4 **selesai** (Manajemen meja Tahap 3, offline-first + PWA Tahap 4 — keduanya terverifikasi E2E). Sisa MVP: **Deploy production** (§6.2 — migrasi SQLite→PostgreSQL + staging). Prasyarat sebelum uji lapangan.

---

*Dokumen ini hidup — update setiap fase selesai. Keputusan besar berikutnya: validasi ke 1 warung sungguhan sebelum tulis kode offline-first.*
