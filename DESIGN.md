# KRING! — Design specification

## Dokumen acuan

Dokumen ini menjadi sumber acuan visual dan UX untuk membuat rancangan KRING! di Google Stitch. KRING! adalah aplikasi point of sale berbasis web untuk warung makan dan UMKM kuliner Indonesia. Pengguna utamanya adalah kasir yang bekerja cepat melalui tablet serta owner yang memantau usaha melalui ponsel.

**Tagline:** Kring! Kasir bunyi, cuan masuk.

**Arah visual:** monochrome, hangat, bersih, premium, tetapi tetap terasa ramah dan membumi. Hindari tampilan enterprise yang padat, kaku, atau terlalu teknis.

---

## Tujuan pengalaman

1. Kasir dapat menyelesaikan transaksi umum dalam maksimal dua langkah utama setelah produk dipilih.
2. Total belanja, nominal pembayaran, dan kembalian selalu menjadi informasi paling menonjol.
3. Semua kontrol utama nyaman disentuh di tablet tanpa bergantung pada hover.
4. Owner dapat memahami kondisi usaha dalam beberapa detik dari layar ponsel.
5. Status online, offline, sinkronisasi, shift, meja, dan stok tidak boleh ambigu.
6. Antarmuka tetap terasa konsisten pada tablet, desktop, dan ponsel.

## Karakter produk

- **Cepat:** aksi utama terlihat tanpa perlu mencari.
- **Tenang:** sedikit warna, hierarki kuat, dan ruang kosong cukup.
- **Ramah:** bahasa Indonesia sehari-hari, bukan istilah teknis.
- **Terpercaya:** status transaksi dan data ditampilkan secara eksplisit.
- **Touch-first:** target sentuh minimum 48 x 48 px.

## Bahasa antarmuka

Gunakan Bahasa Indonesia di seluruh tampilan.

- Gunakan **Bayar**, bukan *Checkout*.
- Gunakan **Kembalian**, bukan *Change*.
- Gunakan **Buka Shift** dan **Tutup Shift**, bukan *Start/End Session*.
- Gunakan **Bawa Pulang**, bukan *Takeaway*.
- Gunakan **Tersimpan di perangkat**, bukan pesan teknis tentang cache.
- Pesan error harus menjelaskan masalah dan tindakan berikutnya.

---

## Sistem visual

### Palet warna

KRING! menggunakan grayscale sebagai identitas utama. Warna semantik hanya muncul saat benar-benar diperlukan.

| Token | Nilai | Penggunaan |
|---|---|---|
| Ink 950 | `#171717` | Teks utama, tombol primer |
| Ink 700 | `#404040` | Teks sekunder kuat |
| Ink 500 | `#737373` | Teks pendukung |
| Ink 300 | `#D4D4D4` | Border kuat, disabled |
| Ink 200 | `#E5E5E5` | Border standar |
| Ink 100 | `#F5F5F5` | Selected surface ringan |
| Canvas | `#FAFAFA` | Latar aplikasi |
| Surface | `#FFFFFF` | Kartu, modal, panel |
| Success | `#16803A` | Pembayaran sukses saja |
| Danger | `#C52A2A` | Gagal, batal, void |

**Aturan warna:**

- Tombol primer menggunakan `#171717` dengan teks putih.
- Jangan memakai oranye, biru korporat, pastel, atau gradient dekoratif.
- Status offline menggunakan grayscale dengan ikon dan label eksplisit; jangan mengandalkan warna saja.
- Success dan danger hanya dipakai untuk umpan balik penting, bukan dekorasi.
- Setiap teks harus memiliki kontras yang jelas terhadap latarnya.

### Tipografi

Gunakan sans-serif modern yang bersih dan mudah dibaca, misalnya Inter atau Geist. Jangan memakai lebih dari satu keluarga font.

- **Display:** 32–40 px, bobot 700; angka kembalian dan total besar.
- **Heading 1:** 28–32 px, bobot 700.
- **Heading 2:** 20–24 px, bobot 650–700.
- **Body:** 15–16 px, bobot 400–500.
- **Label:** 13–14 px, bobot 600.
- **Caption:** 12–13 px, bobot 500.
- Gunakan angka tabular untuk harga, total, omzet, dan laporan.
- Format mata uang: `Rp25.000`, tanpa angka desimal.

### Bentuk dan kedalaman

- Radius kartu: 16 px.
- Radius tombol dan input: 12 px.
- Radius modal besar: 24 px.
- Border standar: 1 px solid `#E5E5E5`.
- Shadow ringan: `0 8px 24px rgba(0,0,0,0.06)`.
- Hindari glassmorphism, blur berlebihan, neon, dan shadow gelap.
- Ikon menggunakan gaya outline sederhana dengan ketebalan konsisten.

---

## Struktur navigasi

### Kasir

Navigasi kasir harus sangat terbatas agar fokus tetap pada transaksi.

- Kasir
- Meja
- Transaksi
- Shift

### Owner

Owner menggunakan sidebar pada desktop dan bottom navigation pada ponsel.

- Ringkasan
- Kasir
- Produk
- Transaksi
- Stok
- Meja
- Laporan
- Pengaturan

Header menampilkan nama outlet, status koneksi, status sinkronisasi, shift aktif, dan profil pengguna. Jangan memenuhi header dengan tombol sekunder.

---

## Spesifikasi layar

### 1. Login dan pilih peran

**Tujuan:** pengguna masuk dengan cepat sesuai perannya.

- Logo KRING! dan tagline tampil sederhana di bagian atas.
- Pilihan peran berupa dua kartu besar: **Owner** dan **Kasir**.
- Alur kasir: pilih nama kasir, lalu masukkan PIN melalui numpad besar.
- Alur owner: email/nomor ponsel dan kata sandi.
- Pesan kesalahan muncul di dekat input, bukan hanya melalui toast.
- Pada tablet, form berada di kartu terpusat dengan lebar maksimum sekitar 480 px.

### 2. Kasir utama

**Prioritas tertinggi.** Rancang untuk tablet landscape 1024–1440 px.

Gunakan struktur tiga area:

1. **Kategori:** rail atau bar chip yang mudah disentuh; kategori aktif berwarna hitam dengan teks putih.
2. **Katalog produk:** grid kartu 3–5 kolom tergantung lebar layar.
3. **Keranjang:** panel sticky di kanan, lebar sekitar 340–400 px.

Isi layar:

- Header ringkas: outlet, kasir, shift, koneksi, dan sinkronisasi.
- Pencarian produk selalu terlihat.
- Pilihan **Makan di Tempat** atau **Bawa Pulang** berada dekat bagian atas.
- Jika makan di tempat, tampilkan pemilih meja.
- Kartu produk berisi foto opsional, nama, harga, dan status stok.
- Tanpa foto, gunakan bidang grayscale dengan inisial atau ikon makanan.
- Produk habis tetap terlihat tetapi tidak dapat ditekan, dengan label **Habis**.
- Menekan produk langsung menambahkannya ke keranjang.
- Keranjang menampilkan kuantitas, catatan, harga, diskon, pajak, subtotal, dan total.
- Tombol **BAYAR** hitam, selebar panel, tinggi minimum 64 px, selalu terlihat.
- Total adalah angka terbesar di panel keranjang.
- Empty state: **Belum ada pesanan. Pilih menu untuk mulai.**

### 3. Pembayaran

Gunakan modal atau sheet berukuran besar, tanpa memindahkan konteks transaksi.

- Tab metode: **Tunai** dan **QRIS**.
- Tab aktif hitam; tab lain putih dengan border.
- Tunai menampilkan total, nominal diterima, kembalian otomatis, dan numpad besar.
- Sediakan nominal cepat sesuai total: uang pas dan pembulatan umum.
- Tombol **Proses Pembayaran** hanya aktif jika input valid.
- QRIS menampilkan QR statis, total, serta tombol konfirmasi pembayaran.
- Selalu sediakan tombol kembali yang tidak menghapus keranjang.

### 4. Pembayaran berhasil

Ini adalah momen brand utama, tetapi tetap minimal.

- Ikon lonceng dengan animasi singkat dan teks **KRING! Pembayaran berhasil**.
- Kembalian menjadi elemen terbesar pada pembayaran tunai.
- Ringkasan kecil: nomor transaksi, metode, dan total.
- Aksi: **Transaksi Baru** sebagai primer; **Cetak Struk** dan **Kirim Struk via WhatsApp** sebagai sekunder.
- Success green hanya muncul pada ikon atau label sukses.
- Jangan memakai confetti berlebihan atau animasi yang memperlambat kasir.

### 5. Produk

- Toolbar berisi pencarian, filter kategori, status stok, dan **Tambah Produk**.
- Desktop menggunakan tabel yang lapang atau grid kartu; tablet memakai kartu.
- Informasi utama: produk, kategori, harga, stok, dan status.
- Aksi edit berada dalam menu tiga titik agar tampilan tidak ramai.
- Form produk menggunakan satu kolom pada ponsel dan dua kolom pada desktop.
- Penghapusan memerlukan konfirmasi yang menyebut nama produk.

### 6. Transaksi

- Filter tanggal, kasir, metode pembayaran, serta status sinkronisasi.
- Setiap baris menampilkan nomor, waktu, kasir, total, metode, dan status.
- Detail transaksi dibuka sebagai drawer di desktop dan halaman penuh di ponsel.
- Aksi detail: cetak ulang, kirim struk, atau void sesuai izin pengguna.
- Void menggunakan danger hanya pada dialog konfirmasi dan hasil akhirnya.

### 7. Shift

- Status **Shift Buka** atau **Shift Tutup** terlihat jelas di bagian atas.
- Buka shift meminta modal awal melalui numpad.
- Tutup shift menampilkan penjualan tunai, non-tunai, kas seharusnya, kas fisik, dan selisih.
- Selisih tidak boleh tersembunyi; tampilkan label teks selain indikator warna.
- Aksi tutup shift memerlukan konfirmasi final.

### 8. Stok

- Ringkasan atas: stok menipis, habis, dan pergerakan hari ini.
- Daftar pergerakan mencakup penjualan, restock, dan koreksi.
- Setiap perubahan memperlihatkan waktu, produk, jumlah, alasan, dan pengguna.
- Koreksi stok memakai stepper besar serta kolom alasan wajib.
- Gunakan label **Stok menipis** atau **Habis**; jangan mengandalkan warna.

### 9. Meja

- Grid meja menjadi tampilan utama.
- Meja kosong: kartu putih dengan border.
- Meja terisi: kartu hitam dengan teks putih.
- Tiap kartu menampilkan nomor meja, status, durasi, dan total sementara.
- Menekan meja terisi membuka detail bill dan aksi tambah pesanan.
- Menekan meja kosong memulai pesanan baru.
- Sediakan filter semua, kosong, dan terisi.

### 10. Laporan owner

Rancang mobile-first untuk dibaca cepat melalui ponsel.

- Filter periode tetap mudah dijangkau.
- Kartu utama: omzet, transaksi, rata-rata transaksi, dan laba jika datanya tersedia.
- Grafik tujuh hari menggunakan grayscale dengan satu garis hitam tegas.
- Daftar menu terlaris menampilkan peringkat, jumlah terjual, dan omzet.
- Tampilkan stok menipis dan ringkasan metode pembayaran.
- Gunakan insight deskriptif singkat; hindari dashboard penuh grafik kecil.
- Tombol export diletakkan sebagai aksi sekunder.

### 11. Pengaturan

Kelompokkan pengaturan berdasarkan topik:

- Profil outlet
- Pajak dan layanan
- Metode pembayaran
- Printer struk
- Pengguna dan peran
- Sinkronisasi dan perangkat

Gunakan switch hanya untuk pengaturan biner. Perubahan berisiko harus memiliki penjelasan dan konfirmasi.

---

## Komponen inti

### Tombol

- **Primer:** hitam, teks putih; satu aksi primer per area.
- **Sekunder:** putih, teks hitam, border abu.
- **Tersier:** teks atau ikon tanpa container dominan.
- **Danger:** merah hanya untuk aksi destruktif yang sudah dikonfirmasi.
- Tinggi minimum 48 px; tombol pembayaran minimum 64 px.
- Label menggunakan kata kerja yang jelas: **Simpan Produk**, bukan **Simpan** bila konteks berpotensi ambigu.

### Input

- Tinggi minimum 48 px dengan label selalu terlihat.
- Teks petunjuk di dalam field tidak menggantikan label.
- Error diletakkan di bawah field dan menjelaskan cara memperbaiki.
- Input uang menggunakan angka tabular dan format rupiah.
- Numpad memiliki jarak cukup dan tombol hapus yang jelas.

### Kartu produk

- Seluruh kartu dapat ditekan.
- Nama maksimal dua baris.
- Harga selalu terlihat.
- Status stok berada di bagian bawah atau sudut kanan atas.
- Feedback pressed harus terasa melalui perubahan surface atau scale yang sangat halus.

### Dialog, drawer, dan toast

- Modal untuk keputusan singkat dan fokus.
- Drawer untuk melihat detail tanpa kehilangan daftar.
- Halaman penuh untuk proses kompleks pada ponsel.
- Toast hanya untuk konfirmasi ringan; error penting tidak boleh hanya berupa toast.

---

## Status sistem

### Offline dan sinkronisasi

KRING! dirancang agar transaksi tetap dapat berlangsung saat koneksi terputus.

- Tampilkan pill status **Online**, **Offline**, atau **Menyinkronkan** di header.
- Saat offline, tampilkan banner tipis: **Tidak ada koneksi. Transaksi disimpan di perangkat dan akan disinkronkan otomatis.**
- Setiap transaksi yang belum tersinkron memiliki ikon dan label **Belum tersinkron**.
- Setelah koneksi kembali, tampilkan progres singkat dan hasil sinkronisasi.
- Konflik atau kegagalan sinkronisasi harus memiliki aksi **Coba lagi** dan akses ke detail.

### Loading

- Gunakan skeleton untuk daftar dan kartu.
- Jangan menutupi seluruh layar saat hanya satu panel yang dimuat.
- Pada pembayaran, tombol menampilkan progres dan mencegah tap ganda.

### Empty state

Empty state harus menjelaskan kondisi dan menawarkan satu aksi yang relevan. Gunakan ilustrasi outline monochrome sederhana bila perlu, tanpa dekorasi berlebihan.

---

## Responsivitas

### Tablet landscape: prioritas kasir

- Tiga area tetap terlihat.
- Keranjang sticky di kanan.
- Kategori dapat menjadi rail atau bar horizontal.
- Produk tetap memiliki target sentuh minimum 48 px.

### Desktop

- Sidebar owner dapat diperluas.
- Konten memakai maksimum lebar agar baris tidak terlalu panjang.
- Tabel diperbolehkan, tetapi tinggi baris minimum 52 px.

### Ponsel

- Bottom navigation untuk lima tujuan utama owner.
- Panel kasir berubah menjadi katalog dan keranjang dalam dua layar atau bottom sheet.
- Tombol aksi utama sticky di bawah dengan memperhatikan safe area.
- Hindari tabel horizontal; ubah data menjadi kartu atau list.

---

## Aksesibilitas dan usability

- Target sentuh minimum 48 x 48 px dengan jarak antarkontrol yang cukup.
- Fokus keyboard harus terlihat jelas.
- Semua ikon penting memiliki label atau tooltip.
- Informasi status tidak boleh dibedakan hanya melalui warna.
- Teks utama minimum 15 px pada layar operasional kasir.
- Hindari teks abu-abu muda untuk informasi penting.
- Dialog destruktif menyebut objek dan dampaknya dengan jelas.
- Pastikan alur transaksi dapat diselesaikan dengan sentuhan, keyboard, atau barcode scanner.

## Detail interaksi

- Menambahkan produk memberi feedback instan pada kartu dan keranjang.
- Perubahan jumlah tidak membuka dialog baru.
- Menahan aksi atau menampilkan loading tidak boleh membuat kasir ragu apakah tap diterima.
- Suara lonceng pembayaran bersifat opsional dan dapat dimatikan di pengaturan.
- Animasi menggunakan durasi sekitar 150–250 ms; animasi sukses maksimal sekitar 600 ms.
- Jangan menggunakan carousel, parallax, atau transisi dekoratif pada alur kasir.

---

## Larangan desain

- Tidak memakai oranye, gradient, glassmorphism, neon, atau warna pastel.
- Tidak membuat dashboard enterprise dengan terlalu banyak grafik dan angka kecil.
- Tidak memakai sidebar besar pada layar kasir.
- Tidak menyembunyikan aksi primer dalam menu tiga titik.
- Tidak membuat kontrol yang hanya muncul saat hover.
- Tidak memakai teks putih pada abu terang.
- Tidak memakai ilustrasi besar yang mengurangi ruang kerja.
- Tidak mengandalkan ikon tanpa label untuk aksi pembayaran, shift, atau void.
- Tidak menampilkan data contoh seolah-olah data usaha nyata pada produk final.

---

## Brief untuk Google Stitch

Buat seluruh layar sebagai satu sistem desain yang konsisten. Mulai dari layar **Kasir utama**, **Pembayaran**, **Pembayaran berhasil**, dan **Laporan owner** karena keempat layar ini menentukan pola utama produk. Setelah arah visual stabil, lanjutkan ke layar lainnya.

### Prompt utama

```text
Design a cohesive responsive web application called “KRING!”, a point-of-sale system for Indonesian food stalls and culinary micro-businesses. Use Bahasa Indonesia for every label and message. The cashier primarily works quickly on a landscape tablet, while the owner monitors the business on a phone.

Visual direction: premium warm monochrome minimalism. Use #FAFAFA for the app canvas, #FFFFFF for surfaces, #171717 for primary text and primary actions, #737373 for muted text, and #E5E5E5 for borders. Do not use orange, blue, pastel colors, gradients, glassmorphism, or decorative color. Success green and danger red may appear only for critical success, failure, void, or destructive feedback. Use generous whitespace, subtle borders, restrained shadows, 12–16 px component radii, and a modern sans-serif typeface such as Inter or Geist. Use large tabular numerals for prices, totals, revenue, cash received, and change.

The interface must be touch-first with minimum 48 px targets, no hover-dependent controls, and a clear single primary action per area. Use familiar Indonesian terms such as “Bayar”, “Kembalian”, “Buka Shift”, “Tutup Shift”, “Bawa Pulang”, and “Makan di Tempat”. Status must never depend on color alone.

Create these connected screens:
1. Login and role selection for Owner or Kasir, with cashier name selection and large PIN numpad.
2. Main cashier screen for landscape tablet with category controls, searchable product grid, and a sticky cart panel. Include dine-in/takeaway selection, table selection, quantity controls, discount, tax, large total, and a dominant black “BAYAR” button.
3. Large payment modal with Tunai and QRIS tabs. Tunai uses a large numpad, quick amount buttons, cash received, and automatically calculated change.
4. Payment success screen with a restrained bell animation, “KRING! Pembayaran berhasil”, large change amount, and actions for Transaksi Baru, Cetak Struk, and Kirim Struk via WhatsApp.
5. Product management, transaction history, shift management, stock movement, table management, owner reports, and settings.
6. Offline and synchronization states that clearly state transactions are stored on the device and will sync automatically.

For the main cashier screen, prioritize speed and hierarchy over decoration. For owner reports, use a mobile-first layout with revenue, transaction count, average transaction, a simple grayscale seven-day chart, best-selling products, payment-method summary, and low-stock alerts. Keep all screens visually consistent and production-ready.
```

### Prompt iterasi layar kasir

```text
Refine the KRING! main cashier screen for a 1280 x 800 landscape tablet. Keep the monochrome design system unchanged. Use a compact top header, horizontal category chips, a spacious searchable product grid, and a 380 px sticky cart on the right. Make product cards and quantity controls comfortable for touch. Keep the order total visually dominant and the black BAYAR button fixed at the bottom of the cart. Show realistic interface states for an active shift, online sync status, dine-in at Meja 04, several cart items, and one sold-out product. Do not add new colors or decorative dashboard widgets.
```

### Prompt iterasi laporan owner

```text
Refine the KRING! owner report screen for a modern phone viewport. Keep the monochrome design system unchanged. Make today's revenue the first and strongest metric, followed by transaction count and average transaction. Add a simple grayscale seven-day sales chart, best-selling products, payment-method summary, and low-stock alerts. Use a sticky date filter and a restrained export action. Avoid tiny charts, dense tables, gradients, and decorative colors. The screen must be understandable within a few seconds.
```

### Prompt iterasi keadaan offline

```text
Create the offline and synchronization states for KRING! without changing the monochrome design system. Show a clear header status pill, a thin persistent banner explaining that transactions are stored on the device, labels for unsynced transactions, a synchronization progress state, a successful sync confirmation, and a recoverable sync failure with a Coba lagi action. Do not rely on color alone and do not block cashier transactions while offline.
```

---

## Checklist evaluasi hasil Stitch

### Konsistensi visual

- [ ] Semua layar menggunakan palet monochrome yang sama.
- [ ] Tidak ada oranye, biru korporat, pastel, atau gradient.
- [ ] Border, radius, shadow, ikon, dan tipografi konsisten.
- [ ] Angka finansial menggunakan hierarki dan format yang seragam.

### Alur kasir

- [ ] Produk dapat dipilih tanpa membuka modal tambahan.
- [ ] Keranjang dan total selalu terlihat pada tablet landscape.
- [ ] Tombol **BAYAR** menjadi aksi paling dominan.
- [ ] Metode tunai menampilkan numpad, uang diterima, dan kembalian.
- [ ] Keadaan berhasil, gagal, dan tap ganda ditangani dengan jelas.

### Touch dan responsivitas

- [ ] Target sentuh utama minimum 48 x 48 px.
- [ ] Tidak ada aksi yang hanya tersedia melalui hover.
- [ ] Tampilan kasir bekerja pada tablet landscape.
- [ ] Laporan owner mudah dipindai pada ponsel.
- [ ] Tabel berubah menjadi list atau kartu pada layar sempit.

### Status operasional

- [ ] Shift aktif atau tutup terlihat jelas.
- [ ] Online, offline, menyinkronkan, dan gagal sinkron tidak ambigu.
- [ ] Produk habis dan stok menipis memiliki label teks.
- [ ] Meja kosong dan terisi dapat dibedakan tanpa warna.
- [ ] Pesan error memberi tindakan berikutnya.

### Bahasa

- [ ] Semua teks menggunakan Bahasa Indonesia.
- [ ] Label memakai istilah yang familiar bagi kasir warung.
- [ ] Tombol menggunakan kata kerja yang spesifik.
- [ ] Tidak ada jargon sistem yang terlihat oleh pengguna.

---

## Urutan produksi desain

1. Tetapkan design tokens dan komponen dasar.
2. Buat layar kasir utama pada tablet landscape.
3. Buat pembayaran dan pembayaran berhasil.
4. Validasi alur transaksi tunai dari awal sampai transaksi baru.
5. Buat laporan owner pada ponsel.
6. Turunkan pola yang sama ke produk, transaksi, shift, stok, meja, dan pengaturan.
7. Tambahkan keadaan kosong, loading, offline, gagal, dan sinkronisasi.
8. Uji ulang ukuran sentuh, kontras, hierarki angka, dan konsistensi bahasa.

Dokumen ini menjadi acuan saat memilih atau mengiterasi hasil Google Stitch. Jika sebuah hasil terlihat menarik tetapi melanggar kecepatan transaksi, keterbacaan, atau status operasional, prioritaskan usability dan aturan dalam dokumen ini.
