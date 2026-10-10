-- ============================================================================
-- RLS (Row Level Security) — DEFENSE-IN-DEPTH untuk isolasi tenant (audit S2).
-- ============================================================================
--
-- KONTEKS
-- -------
-- Aplikasi ini mengakses Postgres (Supabase) LANGSUNG via Prisma memakai SATU
-- koneksi (DATABASE_URL pooled / DIRECT_URL) sebagai role OWNER/Superuser
-- (role `postgres` bawaan Supabase). Isolasi tenant saat ini murni dijaga di
-- application code: setiap query memfilter `warungId` dari sesi. Bila suatu
-- saat ada query yang lupa memfilter → data bocor lintas tenant.
--
-- KENYATAAN PENTING (baca sebelum mengubah migrasi ini)
-- -----------------------------------------------------
-- 1. RLS TIDAK berlaku untuk table owner / superuser secara default. Jadi
--    "ENABLE ROW LEVEL SECURITY" + policy di bawah TIDAK melindungi koneksi
--    aplikasi ini sendiri (role owner). Policy ini HANYA membatasi role LAIN
--    yang bukan owner — realistisnya role PostgREST Supabase: `anon`,
--    `authenticated`, `service_role`.
-- 2. Migrasi ini SENGAJA TIDAK memakai `FORCE ROW LEVEL SECURITY`. Kalau
--    dipaksa, SEMUA query aplikasi (role owner) akan di-subjek RLS → tiap
--    query butuh GUC/sesi khusus (mis. `app.warung_id`) yang TIDAK pernah di-set
--    oleh Prisma → hasilnya 0 baris / app rusak total. Karena itu FORCE DIHINDARI.
-- 3. SUPABASE AUTH TIDAK DIPAKAI aplikasi ini. Aplikasi punya auth sendiri
--    (session HMAC cookie) dan tidak memakai PostgREST. Karena itu policy di
--    bawah sifatnya preventif: mengunci jalur anon/authenticated bila kelak
--    ada akses Supabase client-side / PostgREST yang tak terduga, BUKAN
--    pengganti pemeriksaan tenant di app. Pemeriksaan app tetap PRIMARY.
--
-- MODEL POLICY
-- ------------
-- - `anon` (tanpa login / anon key publik): `USING (false)` → TOLAK SEMUA.
--   Tidak ada jalur sah bagi anon untuk membaca/menulis data warung.
-- - `authenticated` (JWT Supabase): hanya boleh mengakses baris yang
--   `warungId`-nya SAMA dengan klaim `warungId` di JWT
--   (`auth.jwt() ->> 'warungId'`). Bila klaim tidak ada → NULL → tidak ada
--   baris yang cocok → akses ditolak secara default.
-- - `service_role` (service key, bypass RLS by-design di Supabase): sengaja
--   tidak diberi policy agar tetap sepenuhnya bypass RLS. HANYA boleh dipakai
--   server-side/tepercaya, jangan di browser.
-- - Role OWNER (aplikasi) tanpa FORCE RLS → tetap bypass RLS sepenuhnya.
--
-- IDEMPOTENSI
-- -----------
-- Ini migrasi baru; policy belum pernah ada, jadi `CREATE POLICY` aman (tidak
-- bentrok). Bila menjalankan ulang manual di DB yang sudah punya policy ini,
-- gunakan `DROP POLICY IF EXISTS` dulu (lihat komentar per-blok).
--
-- Verifikasi cepat:
--   SELECT relname, relrowsecurity, relforcerowsecurity
--     FROM pg_class WHERE relname IN ('transactions','products','users', ...);
--   -- relrowsecurity = true, relforcerowsecurity = FALSE  (owner tetap bypass)
--   SELECT schemaname, tablename, policyname, roles, cmd, qual, with_check
--     FROM pg_policies WHERE schemaname = 'public';
-- ============================================================================


-- ----------------------------------------------------------------------------
-- GRANT: RLS hanya MENYARING baris; ia tidak memberi hak AKSES tabel. Role
-- PostgREST (`anon`/`authenticated`) butuh privilege tabel agar bisa sampai ke
-- tahap evaluasi policy. Di Supabase privilege ini biasanya sudah ada (default
-- grant, dan `service_role` sengaja tak disentuh agar tetap bypass RLS).
-- Kita tegaskan di sini agar migrasi self-sufficient & konsisten di DB mana pun.
-- HANYA SELECT/INSERT/UPDATE/DELETE (bukan DDL/TRUNCATE), lalu RLS yang membatasi.
-- ----------------------------------------------------------------------------
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO anon, authenticated;

-- ----------------------------------------------------------------------------
-- HELPER: klaim tenant dari JWT Supabase.
-- Mengembalikan `warungId` dari claim JWT (`auth.jwt() ->> 'warungId'`),
-- atau NULL bila klaim tidak ada (→ policy menolak baris). Dibungkus SECURITY
-- INVOKER + STABLE agar tidak bocor hak istimewa dan bisa dipakai di policy.
-- Diletakkan di schema `public` mengikuti konvensi migrasi lain (tanpa schema
-- khusus). CATATAN: definisi idempoten via CREATE OR REPLACE.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.current_warung_id()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  -- auth.jwt() hanya ada di Supabase; di Postgres polos ia NULL/error saat
  -- dipanggil. COALESCE + NULLIF menjaga query tetap valid dan menolak akses.
  SELECT NULLIF(current_setting('request.jwt.claims', true)::jsonb ->> 'warungId', '')
$$;

-- ----------------------------------------------------------------------------
-- Tabel TENANT dengan kolom "warungId" → ENABLE RLS (tanpa FORCE).
-- RLS diaktifkan per tabel, lalu policy anon/authenticated ditambahkan.
-- ----------------------------------------------------------------------------

-- users
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_tenant_select" ON "users" AS PERMISSIVE FOR SELECT TO authenticated
  USING ("warungId" = public.current_warung_id());
CREATE POLICY "users_tenant_modify" ON "users" AS PERMISSIVE FOR ALL TO authenticated
  USING ("warungId" = public.current_warung_id())
  WITH CHECK ("warungId" = public.current_warung_id());
CREATE POLICY "users_deny_anon" ON "users" AS PERMISSIVE FOR ALL TO anon
  USING (false) WITH CHECK (false);

-- products
ALTER TABLE "products" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "products_tenant_select" ON "products" AS PERMISSIVE FOR SELECT TO authenticated
  USING ("warungId" = public.current_warung_id());
CREATE POLICY "products_tenant_modify" ON "products" AS PERMISSIVE FOR ALL TO authenticated
  USING ("warungId" = public.current_warung_id())
  WITH CHECK ("warungId" = public.current_warung_id());
CREATE POLICY "products_deny_anon" ON "products" AS PERMISSIVE FOR ALL TO anon
  USING (false) WITH CHECK (false);

-- mejas
ALTER TABLE "mejas" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mejas_tenant_select" ON "mejas" AS PERMISSIVE FOR SELECT TO authenticated
  USING ("warungId" = public.current_warung_id());
CREATE POLICY "mejas_tenant_modify" ON "mejas" AS PERMISSIVE FOR ALL TO authenticated
  USING ("warungId" = public.current_warung_id())
  WITH CHECK ("warungId" = public.current_warung_id());
CREATE POLICY "mejas_deny_anon" ON "mejas" AS PERMISSIVE FOR ALL TO anon
  USING (false) WITH CHECK (false);

-- transactions
ALTER TABLE "transactions" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "transactions_tenant_select" ON "transactions" AS PERMISSIVE FOR SELECT TO authenticated
  USING ("warungId" = public.current_warung_id());
CREATE POLICY "transactions_tenant_modify" ON "transactions" AS PERMISSIVE FOR ALL TO authenticated
  USING ("warungId" = public.current_warung_id())
  WITH CHECK ("warungId" = public.current_warung_id());
CREATE POLICY "transactions_deny_anon" ON "transactions" AS PERMISSIVE FOR ALL TO anon
  USING (false) WITH CHECK (false);

-- transaction_items
ALTER TABLE "transaction_items" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "transaction_items_tenant_select" ON "transaction_items" AS PERMISSIVE FOR SELECT TO authenticated
  USING ("warungId" = public.current_warung_id());
CREATE POLICY "transaction_items_tenant_modify" ON "transaction_items" AS PERMISSIVE FOR ALL TO authenticated
  USING ("warungId" = public.current_warung_id())
  WITH CHECK ("warungId" = public.current_warung_id());
CREATE POLICY "transaction_items_deny_anon" ON "transaction_items" AS PERMISSIVE FOR ALL TO anon
  USING (false) WITH CHECK (false);

-- shifts
ALTER TABLE "shifts" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "shifts_tenant_select" ON "shifts" AS PERMISSIVE FOR SELECT TO authenticated
  USING ("warungId" = public.current_warung_id());
CREATE POLICY "shifts_tenant_modify" ON "shifts" AS PERMISSIVE FOR ALL TO authenticated
  USING ("warungId" = public.current_warung_id())
  WITH CHECK ("warungId" = public.current_warung_id());
CREATE POLICY "shifts_deny_anon" ON "shifts" AS PERMISSIVE FOR ALL TO anon
  USING (false) WITH CHECK (false);

-- stock_moves
ALTER TABLE "stock_moves" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "stock_moves_tenant_select" ON "stock_moves" AS PERMISSIVE FOR SELECT TO authenticated
  USING ("warungId" = public.current_warung_id());
CREATE POLICY "stock_moves_tenant_modify" ON "stock_moves" AS PERMISSIVE FOR ALL TO authenticated
  USING ("warungId" = public.current_warung_id())
  WITH CHECK ("warungId" = public.current_warung_id());
CREATE POLICY "stock_moves_deny_anon" ON "stock_moves" AS PERMISSIVE FOR ALL TO anon
  USING (false) WITH CHECK (false);

-- settings (PK = warungId) → kolom tenant adalah PK itu sendiri
ALTER TABLE "settings" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "settings_tenant_select" ON "settings" AS PERMISSIVE FOR SELECT TO authenticated
  USING ("warungId" = public.current_warung_id());
CREATE POLICY "settings_tenant_modify" ON "settings" AS PERMISSIVE FOR ALL TO authenticated
  USING ("warungId" = public.current_warung_id())
  WITH CHECK ("warungId" = public.current_warung_id());
CREATE POLICY "settings_deny_anon" ON "settings" AS PERMISSIVE FOR ALL TO anon
  USING (false) WITH CHECK (false);

-- audit_logs
ALTER TABLE "audit_logs" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit_logs_tenant_select" ON "audit_logs" AS PERMISSIVE FOR SELECT TO authenticated
  USING ("warungId" = public.current_warung_id());
CREATE POLICY "audit_logs_tenant_modify" ON "audit_logs" AS PERMISSIVE FOR ALL TO authenticated
  USING ("warungId" = public.current_warung_id())
  WITH CHECK ("warungId" = public.current_warung_id());
CREATE POLICY "audit_logs_deny_anon" ON "audit_logs" AS PERMISSIVE FOR ALL TO anon
  USING (false) WITH CHECK (false);

-- notifikasi
ALTER TABLE "notifikasi" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notifikasi_tenant_select" ON "notifikasi" AS PERMISSIVE FOR SELECT TO authenticated
  USING ("warungId" = public.current_warung_id());
CREATE POLICY "notifikasi_tenant_modify" ON "notifikasi" AS PERMISSIVE FOR ALL TO authenticated
  USING ("warungId" = public.current_warung_id())
  WITH CHECK ("warungId" = public.current_warung_id());
CREATE POLICY "notifikasi_deny_anon" ON "notifikasi" AS PERMISSIVE FOR ALL TO anon
  USING (false) WITH CHECK (false);

-- insights
ALTER TABLE "insights" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "insights_tenant_select" ON "insights" AS PERMISSIVE FOR SELECT TO authenticated
  USING ("warungId" = public.current_warung_id());
CREATE POLICY "insights_tenant_modify" ON "insights" AS PERMISSIVE FOR ALL TO authenticated
  USING ("warungId" = public.current_warung_id())
  WITH CHECK ("warungId" = public.current_warung_id());
CREATE POLICY "insights_deny_anon" ON "insights" AS PERMISSIVE FOR ALL TO anon
  USING (false) WITH CHECK (false);


-- ----------------------------------------------------------------------------
-- TABEL ROOT TENANT: "warungs" — kolom tenant adalah PK "id".
-- authenticated hanya boleh melihat warung yang `id`-nya = klaim JWT.
-- anon TOLAK SEMUA.
-- ----------------------------------------------------------------------------
ALTER TABLE "warungs" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "warungs_tenant_select" ON "warungs" AS PERMISSIVE FOR SELECT TO authenticated
  USING ("id" = public.current_warung_id());
CREATE POLICY "warungs_tenant_modify" ON "warungs" AS PERMISSIVE FOR ALL TO authenticated
  USING ("id" = public.current_warung_id())
  WITH CHECK ("id" = public.current_warung_id());
CREATE POLICY "warungs_deny_anon" ON "warungs" AS PERMISSIVE FOR ALL TO anon
  USING (false) WITH CHECK (false);


-- ----------------------------------------------------------------------------
-- "login_attempts": TIDAK tenant-scoped (di-key oleh userId / "owner-email:<x>",
-- bukan warungId). Tidak ada kolom tenant → tidak bisa di-scope per-warung.
-- Tetap ENABLE RLS + tolak anon, dan batasi authenticated (bila kelak dipakai)
-- ke jalur service saja. Karena bukan data tenant, cukup deny anon + deny
-- authenticated (state rate-limit hanya untuk server app/owner).
-- ----------------------------------------------------------------------------
ALTER TABLE "login_attempts" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "login_attempts_deny_anon" ON "login_attempts" AS PERMISSIVE FOR ALL TO anon
  USING (false) WITH CHECK (false);
CREATE POLICY "login_attempts_deny_authenticated" ON "login_attempts" AS PERMISSIVE FOR ALL TO authenticated
  USING (false) WITH CHECK (false);


-- ============================================================================
-- CATATAN AKHIR
-- ------------
-- * Role `service_role` sengaja TIDAK diberi policy → tetap bypass RLS
--   (by-design Supabase). Pastikan service key tidak pernah bocor ke client.
-- * Role owner (koneksi app) tidak terpengaruh karena tanpa FORCE RLS.
-- * Ini lapisan tambahan (defense-in-depth). Pemeriksaan `warungId` di app
--   tetap kontrol utama. Lihat docs/RLS.md.
-- ============================================================================
