# Lampiran Teknis PRD KRING! — Skema DB Multi-Tenant

**Versi:** 1.1 — 26 September 2026
**Pasangan dari:** `prd-pos-kring.md` v1.1 (§6.2 item multi-tenant, §10 arsitektur)
**Changelog v1.1:** kunci konvensi nama Inggris (ikut skema KasirKu) + tabel mapping; kembalikan field yang hilang (icon, subtotal, status, refId); spesifikasi login PIN; hapus `syncedAt` (ganti `dibuatOffline`); tambah checklist migrasi.

Prinsip: **single database + `warungId` di semua tabel bisnis**. Tenant di-resolve dari user yang login — tidak ada pilihan warung di UI kasir.

**Konvensi nama:** pertahankan nama kolom Inggris dari skema KasirKu yang ada (menghindari rename kolom = migrasi data berisiko). Hanya tabel/fitur baru (Warung, User, Meja) yang memakai nama Indonesia/baru.

---

## 1. Model Prisma (sketsa)

```prisma
model Warung {
  id        String   @id @default(uuid())
  nama      String
  alamat    String?
  telepon   String?
  createdAt DateTime @default(now())

  users        User[]
  products     Product[]
  transactions Transaction[]
  shifts       Shift[]
  stockMoves   StockMove[]
  settings     Setting[]
  mejas        Meja[]
}

enum Role {
  OWNER
  KASIR
}

enum StatusMeja {
  KOSONG
  TERISI
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
  role     Role
  createdAt DateTime @default(now())

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

  nomor  String // "1".."20", unik per warung
  status StatusMeja @default(KOSONG)

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

  items    TransactionItem[]
  subtotal Int    @default(0)
  discount Int    @default(0)
  tax      Int    @default(0)
  total    Int
  cash     Int    // dibayar (tunai) atau = total (QRIS)
  change   Int    // kembalian
  payment  String // CASH | QRIS
  cashierId String // User.id kasir yang melayani (audit: siapa)
  dibuatOffline Boolean @default(false) // true bila dibuat saat offline (transparansi konflik)
  createdAt DateTime @default(now())

  @@index([warungId, createdAt])
}

model TransactionItem {
  id            String @id @default(uuid())
  transactionId String
  transaction   Transaction @relation(fields: [transactionId], references: [id], onDelete: Cascade)

  productId String
  product   Product @relation(fields: [productId], references: [id], onDelete: Restrict)
  name      String // snapshot nama saat transaksi (histori tidak boleh berubah)
  price     Int    // snapshot harga saat transaksi
  qty       Int
}

model Shift {
  id       String @id @default(uuid())
  warungId String
  warung   Warung @relation(fields: [warungId], references: [id], onDelete: Cascade)

  cashierId  String
  modalAwal  Int
  kasFisik   Int?     // diisi saat tutup
  status     String   @default("BUKA") // BUKA | TUTUP
  openedAt   DateTime @default(now())
  closedAt   DateTime?

  transactions Transaction[]

  @@index([warungId])
}

model StockMove {
  id       String @id @default(uuid())
  warungId String
  warung   Warung @relation(fields: [warungId], references: [id], onDelete: Cascade)

  productId String
  type      String // PENJUALAN | KULAKAN | KOREKSI
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

  taxEnabled Boolean @default(true)
  taxPct     Int     @default(10) // persen
  receiptName String? // header struk cetak
}
```

### Tabel mapping skema lama (KasirKu) → baru

| Lama | Baru | Keterangan |
|---|---|---|
| `Product.{id,name,price,stock,category,icon,createdAt}` | sama + `warungId` | tanpa rename |
| `Transaction.{id,subtotal,discount,tax,total,cash,change,payment,shiftId,createdAt}` | sama + `warungId`, `mejaId?`, `cashierId`, `dibuatOffline` | tanpa rename |
| `TransactionItem.{id,transactionId,productId,qty,price}` | sama + relasi `product` eksplisit + snapshot `name` | `name` kolom baru |
| `Shift.{id,modalAwal,kasFisik,status,openedAt,closedAt}` | sama + `warungId`, `cashierId` | tanpa rename |
| `StockMove.{id,productId,qty,reason,refId,createdAt}` | `reason`→`type`, + `warungId`, `note`, `createdBy` | 1 rename (`reason`→`type`) |
| `Setting` (global) | per warung (`warungId` = PK) | pecah per tenant |
| — | `Warung`, `User`, `Meja` | tabel baru |

---

## 2. Aturan Wajib (dicek di code review)

1. **Setiap query bisnis WAJIB filter `warungId`** — tanpa kecuali. Helper: `const w = currentWarung(req)` lalu pakai di semua `where`.
2. **Test isolasi tenant** — test otomatis: user warung A request data warung B → harus 403/kosong.
3. **Uang = integer rupiah** — tidak ada float di kolom uang (`price`, `total`, `tax`, `change`).
4. **Snapshot di TransactionItem** — nama & harga disalin saat transaksi, bukan referensi live (histori tidak boleh berubah kalau produk diedit).
5. **UUID client-side untuk Transaction.id** — dibuat di tablet sebelum sync; server `upsert` by id → idempotent, aman dari duplikat saat retry.
6. **PIN kasir di-hash** — PIN bukan plaintext, perlakukan seperti password.
7. **Daftar nama kasir boleh ditampilkan di tablet** (bukan rahasia); yang rahasia hanya PIN. Alur login kasir selalu pilih-nama-dulu (lihat model User).

---

## 3. Catatan Migrasi SQLite → Postgres + Checklist

- `uuid()` default di Prisma: di-generate client-side → aman di SQLite (dev) maupun Postgres (prod).
- `@@unique([warungId, email])` dengan `email` nullable: di Postgres, NULL tidak dianggap duplikat (kasir tanpa email tetap aman); di SQLite juga aman.
- Urutan migrasi: (1) tambah tabel `Warung`/`User`/`Meja` + kolom `warungId` nullable di tabel lama, (2) seed 1 warung "Warung Demo" + backfill `warungId` untuk data lama, (3) jadikan `warungId` NOT NULL + tambah FK & index. Rename `reason`→`type` ikut langkah (1).
- **Checklist verifikasi pasca-migrasi** (migrasi belum selesai sebelum semua hijau):
  - [ ] `SELECT COUNT(*) FROM <tiap tabel bisnis> WHERE warungId IS NULL` = 0
  - [ ] Semua kolom tabel mapping §1 ada (tidak ada yang tercecer)
  - [ ] Test isolasi tenant (§2 aturan #2) hijau
  - [ ] 1 transaksi end-to-end (kasir PIN → jual → struk → tutup shift) jalan di staging

---

## 4. Seed per Warung

`prisma/seed.ts` di-refactor: fungsi `seedWarung(nama)` yang membuat 1 warung + 38 menu + user owner demo + 1 kasir demo (PIN demo: `123456`, khusus dev). Dev bisa seed N warung untuk uji isolasi tenant:

```
npx tsx prisma/seed.ts --warungs=3
```
