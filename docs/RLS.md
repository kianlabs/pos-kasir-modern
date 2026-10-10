# Row Level Security (RLS) — Pertahanan Berlapis Isolasi Tenant

> Ringkas: migrasi `prisma/migrations/20261020000000_rls_policies/` menambahkan
> **kebijakan RLS** untuk role `anon`/`authenticated` (jalur PostgREST Supabase).
> Ini **pertahanan tambahan (defense-in-depth)**, **BUKAN pengganti** pemeriksaan
> tenant di aplikasi. Baca bagian "Mengapa tidak menggantikan app" sebelum
> mengandalkannya.

## Konteks (audit S2)

Aplikasi mengakses Postgres (Supabase) **langsung via Prisma** memakai satu
koneksi (`DATABASE_URL` pooled / `DIRECT_URL`) sebagai role **owner** (`postgres`
bawaan Supabase). Isolasi antar warung (tenant) saat ini **murni dijaga di
application code**: setiap query memfilter `warungId` yang diambil dari sesi.

Risiko: bila suatu saat ada query yang **lupa** memfilter `warungId`, data
warung lain bisa bocor. RLS ditambahkan sebagai lapisan tambahan supaya
kebocoran semacam itu tidak otomatis terjadi lewat jalur akses lain.

## Apa yang dilakukan migrasi ini

1. **Mengaktifkan RLS** (`ENABLE ROW LEVEL SECURITY`) pada semua tabel data:
   `warungs`, `users`, `products`, `mejas`, `transactions`,
   `transaction_items`, `shifts`, `stock_moves`, `settings`, `audit_logs`,
   `notifikasi`, `insights`, dan `login_attempts`.
2. **Kebijakan tenant** untuk role `authenticated`:
   - `SELECT`: baris hanya terlihat bila kolom tenant (`warungId`, atau `id`
     untuk tabel `warungs`) **sama dengan klaim `warungId` di JWT**.
   - `INSERT/UPDATE/DELETE` (`FOR ALL`): sama, plus `WITH CHECK` agar tidak bisa
     **menulis** baris milik warung lain.
3. **`anon` ditolak total** (`USING (false)` / `WITH CHECK (false)`) untuk semua
   tabel — tidak ada jalur sah bagi pengunjung tanpa login.
4. `login_attempts` **bukan data tenant** (di-key oleh `userId`/`"owner-email:<x>"`,
   bukan `warungId`) → `anon` **dan** `authenticated` sama-sama ditolak; state
   rate-limit hanya untuk server aplikasi/owner.
5. **GRANT** `SELECT/INSERT/UPDATE/DELETE` ke `anon`/`authenticated` (RLS hanya
   menyaring baris, tidak memberi hak akses tabel). `service_role` **sengaja tidak
   disentuh** agar tetap bypass RLS sesuai desain Supabase.

Klaim tenant diambil lewat fungsi helper `public.current_warung_id()`:

```sql
-- membaca 'warungId' dari GUC klaim JWT yang di-set PostgREST
SELECT NULLIF(current_setting('request.jwt.claims', true)::jsonb ->> 'warungId', '')
```

Bila klaim tidak ada → `NULL` → tidak ada baris yang cocok → akses ditolak
secara default (fail-closed). Di Postgres biasa (tanpa PostgREST) GUC ini
kosong sehingga helper selalu `NULL` — tetap aman.

## ⚠️ Mengapa ini TIDAK menggantikan pemeriksaan tenant di aplikasi

Dua kenyataan yang wajib dipahami:

1. **RLS tidak berlaku untuk table owner / superuser.** Koneksi aplikasi ini
   memakai role **owner** (`postgres`). Maka semua query aplikasi **tetap
   bypass** RLS sepenuhnya — policy di atas **tidak** menyentuh koneksi
   aplikasi. Inilah sebabnya isi kode aplikasi masih **kontrol utama**.
2. **Migrasi ini sengaja TIDAK memakai `FORCE ROW LEVEL SECURITY`.** Kalau
   dipaksa, SELURUH query aplikasi (role owner) akan tunduk pada RLS → setiap
   query butuh GUC/sesi khusus (mis. `app.warung_id`) yang **tidak pernah
   di-set** oleh Prisma → hasilnya **0 baris / aplikasi rusak total**. Karena
   itu `FORCE` dihindari.

Tambahan: **aplikasi ini tidak memakai Supabase Auth maupun PostgREST.** Ia
punya autentikasi sendiri (session HMAC cookie). Jadi policy di sini praktis
**preventif**: mengunci jalur `anon`/`authenticated` bila kelak muncul akses
Supabase client-side / PostgREST yang tak terduga.

**Kesimpulan jujur:** RLS di sini = kunci cadangan pada pintu yang saat ini tidak
dipakai. Pintu yang benar-benar dipakai (koneksi owner Prisma) **tetap harus**
dijaga oleh filter `warungId` di application code.

## Kapan RLS ini membantu

- Bila kelak ada klien yang mengakses Supabase **langsung** (PostgREST,
  `supabase-js`, dashboard, integrasi pihak ketiga) dengan anon/authenticated
  key → data tetap ter-scope per warung, dan tanpa klaim `warungId` → kosong.
- Mencegah **kebocoran tak sengaja** bila suatu API/PostgREST diaktifkan.
- Operator/analis yang memakai koneksi ber-privilege terbatas (bukan owner)
  otomatis ter-scope.

## Cara memverifikasi

Setelah `npm run db:deploy` (memakai `DIRECT_URL`), jalankan pada DB:

```sql
-- 1. RLS aktif, tapi TIDAK dipaksa (owner tetap bypass) →
--    relrowsecurity = true dan relforcerowsecurity HARUS false.
SELECT relname, relrowsecurity, relforcerowsecurity
  FROM pg_class
 WHERE relname IN ('warungs','users','products','transactions','settings')
 ORDER BY relname;

-- 2. Daftar policy yang terpasang.
SELECT tablename, policyname, roles, cmd
  FROM pg_policies
 WHERE schemaname = 'public'
 ORDER BY tablename, policyname;
```

Uji perilaku (jalankan sebagai role terbatas, bukan owner):

```sql
-- Owner (koneksi aplikasi): tetap melihat SEMUA baris (app tidak boleh rusak).
SELECT count(*) FROM "products";

-- anon: harus 0 baris.
SET ROLE anon;
SELECT count(*) FROM "products";
RESET ROLE;

-- authenticated tanpa klaim warungId: harus 0 baris.
SET ROLE authenticated;
SET request.jwt.claims = '{"sub":"u1"}';
SELECT count(*) FROM "products";
RESET ROLE;

-- authenticated dengan klaim warungId tertentu: hanya baris warung itu.
SET ROLE authenticated;
SET request.jwt.claims = '{"warungId":"<ID_WARUNG>"}';
SELECT "warungId", count(*) FROM "products" GROUP BY 1;  -- hanya satu warungId
RESET ROLE;
```

Ekspektasi: query owner mengembalikan **semua** baris; `anon` dan
`authenticated` tanpa klaim mengembalikan **0**; `authenticated` dengan klaim
hanya melihat warung tersebut; dan penulisan lintas-tenant **ditolak** oleh RLS.

## Idempotensi & operasi

- Ini migrasi **baru**; policy belum pernah ada → `CREATE POLICY` aman.
- Menjalankan ulang manual pada DB yang sudah punya policy akan gagal
  (`already exists`). Untuk perbaikan manual, `DROP POLICY IF EXISTS ...` dulu.
- `service_role` tetap bypass RLS (by-design). **Jangan pernah** membocorkan
  service key ke browser/klien.
