# Lampiran Teknis PRD KRING! — Skema DB Multi-Tenant

**Versi:** 1.2 — 8 Oktober 2026
**Pasangan dari:** `PRD.md` v1.2 (§6.2 item multi-tenant, §10 arsitektur)
**Changelog v1.1:** kunci konvensi nama Inggris (ikut skema KasirKu) + tabel mapping; kembalikan field yang hilang (icon, subtotal, status, refId); spesifikasi login PIN; hapus `syncedAt` (ganti `dibuatOffline`); tambah checklist migrasi.
**Changelog v1.2 — 6 koreksi + 1 kebutuhan desain auth hasil audit menyeluruh repo KasirKu:**
1. `enum Role`/`StatusMeja` → **String + const union** — Prisma connector SQLite (dev/test) tidak support enum, `prisma validate` akan gagal.
2. **`warungId` ditambahkan ke `TransactionItem`** — tanpa kolom ini, aturan #1 "semua query filter warungId" mustahil ditegakkan tanpa join (satu lupa join = bocor lintas-tenant).
3. **Field langganan di `Warung`** (`status`, `trialEndsAt`) — gating plan (PRD §5b) tanpa migrasi terpisah nanti.
4. **Bill per meja = `Transaction.status` DRAFT, bukan `Meja.status` tersimpan** — menghilangkan race check-then-act (audit menemukan pola sama di buka-shift KasirKu: dua klik = dua state).
5. **Rate-limit login PIN** — PIN 4–6 digit + daftar nama terbuka = brute force; jadi aturan wajib, bukan fitur nanti.
6. **Tabel `AuditLog`** — PRD §11 menuntut "semua aksi tercatat (siapa, kapan)" tapi skema v1.1 tidak punya tempat menyimpannya.
7. **`Warung.slug`** — login kasir tanpa "pilihan warung" di UI (PRD §10): tablet dibuka via `/masuk/<slug>` → daftar nama kasir warung itu → PIN. Slug bukan rahasia (yang rahasia PIN); tanpa ini, daftar nama lintas-warung bocor.

Prinsip: **single database + `warungId` di semua tabel bisnis**. Tenant di-resolve dari user yang login — tidak ada pilihan warung di UI kasir.

**Konvensi nama:** pertahankan nama kolom Inggris dari skema KasirKu yang ada (menghindari rename kolom = migrasi data berisiko). Hanya tabel/fitur baru (Warung, User, Meja, AuditLog) yang memakai nama Indonesia/baru.

**Konsesi tipe (v1.2):** semua status memakai `String` + const union TypeScript — **bukan `enum` Prisma** — karena dev & test tetap di SQLite (enum hanya didukung Postgres/MySQL/MariaDB). Konsisten dengan pola `Shift.status String` yang sudah ada di KasirKu.

```ts
// src/types/index.ts — satu-satunya sumber kebenaran nilai status
export type Role = "OWNER" | "KASIR";
export type StatusWarung = "TRIAL" | "ACTIVE" | "SUSPENDED";
export type StatusMeja = "KOSONG" | "TERISI";   // nilai derive, bukan kolom
export type StatusTransaksi = "DRAFT" | "LUNAS";
export type StatusShift = "BUKA" | "TUTUP";
export type TipeStockMove = "PENJUALAN" | "KULAKAN" | "KOREKSI" | "STOK_AWAL";
```

---

## 1. Model Prisma (sketsa)

```prisma
model Warung {
  id        String   @id @default(uuid())
  nama      String
  slug      String   // unik — URL login kasir /masuk/<slug> (v1.2 koreksi #7); bukan rahasia
  alamat    String?
  telepon   String?

  // --- langganan (v1.2 koreksi #3, gating PRD §5b) ---
  status      String    @default("TRIAL") // TRIAL | ACTIVE | SUSPENDED (const union, bukan enum)
  trialEndsAt DateTime?
  createdAt   DateTime  @default(now())

  users        User[]
  products     Product[]
  transactions Transaction[]
  transactionItems TransactionItem[] // v1.2: back-relation utk kolom warungId
  shifts       Shift[]
  stockMoves   StockMove[]
  settings     Setting[]
  mejas        Meja[]
  insights     Insight[]   // dari lampiran AI (PRD-lampiran-ai.md §5)
  auditLogs    AuditLog[]
}

model User {
  id       String @id @default(uuid())
  warungId String
  warung   Warung @relation(fields: [warungId], references: [id], onDelete: Cascade)

  name     String
  email    String? // owner: wajib & unik per warung; kasir: null
  password String? // hash Argon2/bcrypt — owner saja
  pin      String? // hash PIN 4-6 digit — kasir saja. Login = pilih nama
                   // dari daftar → input PIN → verifikasi hash server-side
                   // (hash+salt tidak bisa di-lookup, jadi wajib alur ini)
  role     String   // OWNER | KASIR (const union — lihat konsesi tipe di atas)
  aktif    Boolean  @default(true) // false = kasir di-PHK-kan, login ditolak
  createdAt DateTime @default(now())

  transactions Transaction[] @relation("TransaksiOleh")
  shifts       Shift[]       @relation("ShiftOleh")
  auditLogs    AuditLog[]

  @@unique([warungId, email]) // NULL tidak dianggap duplikat di Postgres:
                             // kasir tanpa email tetap aman
  @@index([warungId])
}

model Product {
  id       String @id @default(uuid())
  warungId String
  warung   Warung @relation(fields: [warungId], references: [id], onDelete: Cascade)

  name     String
  price    Int    // rupiah, integer — hindari float untuk uang
  category String @default("Umum")
  icon     String @default("") // emoji per produk, fallback ikon kategori
  stock    Int    @default(0)
  createdAt DateTime @default(now())

  items TransactionItem[]
  moves StockMove[]

  @@index([warungId])
}

model Meja {
  id       String @id @default(uuid())
  warungId String
  warung   Warung @relation(fields: [warungId], references: [id], onDelete: Cascade)

  nomor String // "1".."20", unik per warung
  // v1.2 koreksi #4: TIDAK ada kolom `status`. KOSONG/TERISI di-derive dari
  // apakah ada Transaction {status: DRAFT, mejaId} yang terbuka. Menyimpan
  // status = race check-then-act (dua klik "buka meja" → dua kebenaran).
  // Derive untuk 20 meja murah: satu query grouped per render.

  transactions Transaction[]

  @@unique([warungId, nomor])
  @@index([warungId])
}

model Transaction {
  id       String @id @default(uuid()) // UUID client-side saat offline → anti duplikat saat sync
  warungId String
  warung   Warung @relation(fields: [warungId], references: [id], onDelete: Cascade)

  shiftId String?
  shift   Shift?  @relation(fields: [shiftId], references: [id])
  mejaId  String?
  meja    Meja?   @relation(fields: [mejaId], references: [id])

  // v1.2 koreksi #4: DRAFT = bill terbuka per meja (atau "bawa pulang" antrian);
  // LUNAS = sudah dibayar. Rasio/laporan/hitung shift HANYA menghitung LUNAS.
  status   String  @default("LUNAS") // DRAFT | LUNAS (const union)
  subtotal Int    @default(0)
  discount Int    @default(0)
  tax      Int    @default(0)
  total    Int    @default(0) // DRAFT baru dibuka masih 0; dihitung saat bayar
  cash     Int    @default(0) // diisi saat bayar; DRAFT masih 0
  change   Int    @default(0) // diisi saat bayar
  payment  String @default("CASH") // CASH | QRIS — diisi saat bayar
  cashierId String // User.id kasir yang melayani (audit: siapa)
  cashier   User   @relation("TransaksiOleh", fields: [cashierId], references: [id])
  dibuatOffline Boolean @default(false) // true bila dibuat saat offline (transparansi konflik)
  createdAt DateTime @default(now())

  items TransactionItem[]

  @@index([warungId, createdAt])
  @@index([warungId, status]) // derive daftar meja + filter laporan LUNAS
}

model TransactionItem {
  id            String @id @default(uuid())
  // v1.2 koreksi #2: warungId DENORMALISASI — diisi saat checkout dalam tx
  // yang sama. Tanpa ini, aturan #1 hanya bisa lewat join (lupa join = bocor).
  warungId      String
  warung        Warung @relation(fields: [warungId], references: [id], onDelete: Cascade)

  transactionId String
  transaction   Transaction @relation(fields: [transactionId], references: [id], onDelete: Cascade)

  productId String
  product   Product @relation(fields: [productId], references: [id], onDelete: Restrict)
  name      String // snapshot nama saat transaksi (histori tidak boleh berubah)
  price     Int    // snapshot harga saat transaksi
  qty       Int

  @@index([warungId])
}

model Shift {
  id       String @id @default(uuid())
  warungId String
  warung   Warung @relation(fields: [warungId], references: [id], onDelete: Cascade)

  cashierId  String
  modalAwal  Int
  kasFisik   Int?     // diisi saat tutup
  status     String   @default("BUKA") // BUKA | TUTUP (const union)
  openedAt   DateTime @default(now())
  closedAt   DateTime?

  cashier      User          @relation("ShiftOleh", fields: [cashierId], references: [id])
  transactions Transaction[]

  // v1.2: keunikan shift BUKA tidak bisa pakai @@unique biasa (status bukan
  // bagian key & SQLite tanpa partial unique index di Prisma) → keunangan
  // dijaga transaksi aplikasi: BUKA-shift = $transaction { cek → create }
  // + test race (lihat §2 aturan #8). Lihat juga desain.md §5.
  @@index([warungId])
}

model StockMove {
  id       String @id @default(uuid())
  warungId String
  warung   Warung @relation(fields: [warungId], references: [id], onDelete: Cascade)

  productId String
  product   Product @relation(fields: [productId], references: [id], onDelete: Cascade)
  type      String // PENJUALAN | KULAKAN | KOREKSI | STOK_AWAL (const union)
  qty       Int    // negatif = keluar
  refId     String? // id transaksi sumber (kartu stok)
  note      String?
  createdBy String? // User.id pelaku (audit: siapa, kapan via createdAt)
  createdAt DateTime @default(now())

  @@index([warungId, productId, createdAt])
}

model Setting {
  warungId String @id
  warung   Warung @relation(fields: [warungId], references: [id], onDelete: Cascade)

  taxEnabled  Boolean  @default(true)
  taxPct      Int      @default(10) // persen
  receiptName String?  // header struk cetak (v1.2: ganti hardcoded "Warung Berkah Jaya")
  jamBuka     String?  // "07:00" — dipakai rules anomali TRANSAKSI_LUAR_JAM (lampiran AI §4)
  jamTutup    String?  // "21:00"
}

model AuditLog { // v1.2 koreksi #6 — memenuhi PRD §11 "semua aksi tercatat"
  id        String   @id @default(uuid())
  warungId  String
  warung    Warung   @relation(fields: [warungId], references: [id], onDelete: Cascade)

  userId    String?  // null = sistem (cron, sync)
  user      User?    @relation(fields: [userId], references: [id])
  action    String   // LOGIN_OK | LOGIN_FAIL | PRICE_CHANGE | STOCK_KOREKSI |
                     // SHIFT_OPEN | SHIFT_CLOSE | SETTING_CHANGE | DELETE_PRODUCT | ...
  meta      String?  // JSON ringkas: {before, after} angka/id saja — bukan data mentah
  createdAt DateTime @default(now())

  @@index([warungId, createdAt])
}
```

### Tabel mapping skema lama (KasirKu) → baru

| Lama | Baru | Keterangan |
|---|---|---|
| `Product.{id,name,price,stock,category,icon,createdAt}` | sama + `warungId` | tanpa rename |
| `Transaction.{id,subtotal,discount,tax,total,cash,change,payment,shiftId,createdAt}` | sama + `warungId`, `mejaId?`, `cashierId`, `dibuatOffline`, **`status`** | `cash/change/payment` jadi `@default(0)/("CASH")` agar aman saat DRAFT |
| `TransactionItem.{id,transactionId,productId,qty,price}` | sama + **`warungId`** + relasi `product` eksplisit + snapshot `name` | 2 kolom baru |
| `Shift.{id,modalAwal,kasFisik,status,openedAt,closedAt}` | sama + `warungId`, `cashierId` | tanpa rename |
| `StockMove.{id,productId,qty,reason,refId,createdAt}` | `reason`→`type`, + `warungId`, `note`, `createdBy` | 1 rename (`reason`→`type`) |
| `Setting` (global) | per warung (`warungId` = PK), + `receiptName`, `jamBuka/jamTutup` | pecah per tenant |
| — | `Warung` (+ `slug`, `status`, `trialEndsAt`), `User`, `Meja` (tanpa kolom status), **`AuditLog`**, `Insight` (lampiran AI) | tabel baru |

---

## 2. Aturan Wajib (dicek di code review)

1. **Setiap query bisnis WAJIB filter `warungId`** — tanpa kecuali, termasuk `TransactionItem` (kolomnya sudah ada sejak v1.2). Helper: `const w = currentWarung(req)` lalu pakai di semua `where`. Backstop: Prisma client extension auto-inject (desain.md §4).
2. **Test isolasi tenant** — test otomatis: user warung A request data warung B → harus 403/kosong. Gerbang CI, bukan test manual.
3. **Uang = integer rupiah** — tidak ada float di kolom uang (`price`, `total`, `tax`, `change`).
4. **Snapshot di TransactionItem** — nama & harga disalin saat transaksi, bukan referensi live (histori tidak boleh berubah kalau produk diedit).
5. **UUID client-side untuk Transaction.id** — dibuat di tablet sebelum sync; server `upsert` by id → idempotent, aman dari duplikat saat retry.
6. **PIN kasir di-hash** — PIN bukan plaintext, perlakukan seperti password.
7. **Daftar nama kasir boleh ditampilkan di tablet** (bukan rahasia); yang rahasia hanya PIN. Alur login kasir selalu pilih-nama-dulu (lihat model User).
8. **`warungId` TIDAK PERNAH diterima dari client** — bukan dari body, query param, atau header. Hanya dari session. Request berisi `warungId` = bug otomatis.
9. **Rate-limit login PIN (v1.2 koreksi #5):** 5 kegagalan berturut per User → tolak 5 menit (catat `LOGIN_FAIL` ke AuditLog + kunci sementara di memori/counter per user+IP). Daftar nama boleh publik; PIN harus terasa seperti password.
10. **Aksi mutasi penting → AuditLog (v1.2 koreksi #6):** login (ok/fail), ubah harga, koreksi stok manual, buka/tutup shift, ganti setting, hapus produk. Bukan untuk membaca (GET tidak perlu).
11. **Satu shift `BUKA` per warung** — keunikan dijaga dalam `prisma.$transaction` (cek-then-create atomik) + test dua request paralel → hanya 1 yang sukses.
12. **Rasio & laporan hanya `status = "LUNAS"`** — DRAFT tidak dihitung omzet, tidak masuk export CSV, tidak jadi produk terlaris (sampai dibayar).

---

## 3. Migrasi SQLite → Postgres + Checklist

- `uuid()` default di Prisma: di-generate client-side → aman di SQLite (dev) maupun Postgres (prod).
- `@@unique([warungId, email])` dengan `email` nullable: di Postgres, NULL tidak dianggap duplikat (kasir tanpa email tetap aman); di SQLite juga aman.
- **Enum tidak dipakai sama sekali (v1.2)** → skema identik valid di SQLite dev & Postgres prod — tidak ada perbedaan DDL antar connector.
- Urutan migrasi: (1) tambah tabel `Warung`/`User`/`Meja`/`AuditLog` + kolom `warungId` nullable di tabel lama + `Transaction.status`, (2) seed 1 warung "Warung Demo" + backfill `warungId` untuk data lama, (3) jadikan `warungId` NOT NULL + tambah FK & index. Rename `reason`→`type` ikut langkah (1).
- **Checklist verifikasi pasca-migrasi** (migrasi belum selesai sebelum semua hijau):
  - [ ] `SELECT COUNT(*) FROM <tiap tabel bisnis termasuk transaction_items> WHERE warungId IS NULL` = 0
  - [ ] Semua kolom tabel mapping §1 ada (tidak ada yang tercecer: `Transaction.status`, `Warung.status/trialEndsAt`, `Setting.receiptName/jam*`)
  - [ ] `prisma validate` hijau **di SQLite** (bukti tanpa enum) dan `migrate diff` bersih vs Postgres
  - [ ] Test isolasi tenant (§2 aturan #2) hijau
  - [ ] Test race buka-shift (aturan #11) hijau
  - [ ] Test rate-limit PIN (aturan #9) hijau
  - [ ] 1 transaksi end-to-end (kasir PIN → buka bill DRAFT → bayar LUNAS → struk → tutup shift) jalan di staging

---

## 4. Seed per Warung

`prisma/seed.ts` di-refactor: fungsi `seedWarung(nama)` yang membuat 1 warung (slug = slugify(nama), unik) + 38 menu + user owner demo + 1 kasir demo (PIN demo: `123456`, khusus dev) + `Setting` default (tax 10% on, `receiptName` = nama warung) + `AuditLog` pembuatan + 10 meja. Dev bisa seed N warung untuk uji isolasi tenant:

```
npx tsx prisma/seed.ts --warungs=3
```

Owner demo `status = "TRIAL"` + `trialEndsAt = +30 hari` — supaya jalur gating plan ikut teruji sejak awal.
