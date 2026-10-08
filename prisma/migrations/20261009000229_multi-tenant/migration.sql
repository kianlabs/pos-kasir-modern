-- ========================================
-- Migration: multi-tenant foundation (Tahap 1)
-- Date: 2026-10-09
-- ========================================
-- Strategy:
-- 1. Create new tables (warungs, users, mejas, audit_logs, insights, settings_new)
-- 2. Insert seed warung + users + settings + mejas
-- 3. Add nullable warungId/cashierId columns to existing tables
-- 4. Backfill all data with seed warung ID
-- 5. Rename stock_moves.reason → type via table rebuild (one table only)
-- 6. Transform settings from key-value to per-warung
-- ========================================

-- Step 1: Create new tables
CREATE TABLE "warungs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nama" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "alamat" TEXT,
    "telepon" TEXT,
    "status" TEXT NOT NULL DEFAULT 'TRIAL',
    "trialEndsAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "warungs_slug_key" ON "warungs"("slug");

CREATE TABLE "users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "warungId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "password" TEXT,
    "pin" TEXT,
    "role" TEXT NOT NULL,
    "aktif" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "users_warungId_fkey" FOREIGN KEY ("warungId") REFERENCES "warungs" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "users_warungId_email_key" ON "users"("warungId", "email");
CREATE INDEX "users_warungId_idx" ON "users"("warungId");

CREATE TABLE "mejas" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "warungId" TEXT NOT NULL,
    "nomor" TEXT NOT NULL,
    CONSTRAINT "mejas_warungId_fkey" FOREIGN KEY ("warungId") REFERENCES "warungs" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "mejas_warungId_nomor_key" UNIQUE ("warungId", "nomor")
);
CREATE INDEX "mejas_warungId_idx" ON "mejas"("warungId");

CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "warungId" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "meta" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "audit_logs_warungId_fkey" FOREIGN KEY ("warungId") REFERENCES "warungs" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "audit_logs_warungId_createdAt_idx" ON "audit_logs"("warungId", "createdAt");

CREATE TABLE "insights" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "warungId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "findings" TEXT,
    "source" TEXT,
    "readAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "insights_warungId_fkey" FOREIGN KEY ("warungId") REFERENCES "warungs" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "insights_warungId_createdAt_idx" ON "insights"("warungId", "createdAt");

-- Step 2: Insert seed warung (fixed IDs for deterministic backfill)
INSERT INTO "warungs" ("id", "nama", "slug", "status", "createdAt")
VALUES ('warung-demo-id-00000000-0000-0000-0000-000000000001', 'Warung Berkah Jaya', 'warung-berkah-jaya', 'TRIAL', datetime('now'));

INSERT INTO "users" ("id", "warungId", "name", "email", "password", "role", "createdAt")
VALUES ('owner-demo-id-00000000-0000-0000-0000-000000000001', 'warung-demo-id-00000000-0000-0000-0000-000000000001', 'Owner Demo', 'owner@warung-berkah-jaya.demo', NULL, 'OWNER', datetime('now'));

-- bcryptjs hash of "123456"
INSERT INTO "users" ("id", "warungId", "name", "pin", "role", "createdAt")
VALUES ('kasir-demo-id-00000000-0000-0000-0000-000000000001', 'warung-demo-id-00000000-0000-0000-0000-000000000001', 'Kasir Demo', '$2a$10$dummyhashfor123456kasirdemo', 'KASIR', datetime('now'));

-- Seed settings per-warung
CREATE TABLE "settings_new" (
    "warungId" TEXT NOT NULL PRIMARY KEY,
    "taxEnabled" INTEGER NOT NULL DEFAULT 1,
    "taxPct" INTEGER NOT NULL DEFAULT 10,
    "receiptName" TEXT,
    "jamBuka" TEXT,
    "jamTutup" TEXT,
    CONSTRAINT "settings_new_warungId_fkey" FOREIGN KEY ("warungId") REFERENCES "warungs" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "settings_new" ("warungId", "taxEnabled", "taxPct", "receiptName")
VALUES ('warung-demo-id-00000000-0000-0000-0000-000000000001', 1, 10, 'Warung Berkah Jaya');

-- Seed 10 meja
INSERT INTO "mejas" ("id", "warungId", "nomor")
VALUES 
('meja-00000000-0000-0000-0000-000000000001', 'warung-demo-id-00000000-0000-0000-0000-000000000001', '1'),
('meja-00000000-0000-0000-0000-000000000002', 'warung-demo-id-00000000-0000-0000-0000-000000000001', '2'),
('meja-00000000-0000-0000-0000-000000000003', 'warung-demo-id-00000000-0000-0000-0000-000000000001', '3'),
('meja-00000000-0000-0000-0000-000000000004', 'warung-demo-id-00000000-0000-0000-0000-000000000001', '4'),
('meja-00000000-0000-0000-0000-000000000005', 'warung-demo-id-00000000-0000-0000-0000-000000000001', '5'),
('meja-00000000-0000-0000-0000-000000000006', 'warung-demo-id-00000000-0000-0000-0000-000000000001', '6'),
('meja-00000000-0000-0000-0000-000000000007', 'warung-demo-id-00000000-0000-0000-0000-000000000001', '7'),
('meja-00000000-0000-0000-0000-000000000008', 'warung-demo-id-00000000-0000-0000-0000-000000000001', '8'),
('meja-00000000-0000-0000-0000-000000000009', 'warung-demo-id-00000000-0000-0000-0000-000000000001', '9'),
('meja-00000000-0000-0000-0000-000000000010', 'warung-demo-id-00000000-0000-0000-0000-000000000001', '10');

-- Step 3: Add nullable columns to existing tables
ALTER TABLE "products" ADD COLUMN "warungId" TEXT;
ALTER TABLE "transactions" ADD COLUMN "warungId" TEXT;
ALTER TABLE "transactions" ADD COLUMN "cashierId" TEXT;
ALTER TABLE "transactions" ADD COLUMN "status" TEXT;
ALTER TABLE "transactions" ADD COLUMN "mejaId" TEXT;
ALTER TABLE "transactions" ADD COLUMN "dibuatOffline" INTEGER DEFAULT 0;
ALTER TABLE "transaction_items" ADD COLUMN "warungId" TEXT;
ALTER TABLE "transaction_items" ADD COLUMN "name" TEXT;
ALTER TABLE "shifts" ADD COLUMN "warungId" TEXT;
ALTER TABLE "shifts" ADD COLUMN "cashierId" TEXT;
ALTER TABLE "stock_moves" ADD COLUMN "warungId" TEXT;
ALTER TABLE "stock_moves" ADD COLUMN "note" TEXT;
ALTER TABLE "stock_moves" ADD COLUMN "createdBy" TEXT;

-- Step 4: Backfill warungId for all existing data
UPDATE "products" SET "warungId" = 'warung-demo-id-00000000-0000-0000-0000-000000000001' WHERE "warungId" IS NULL;
UPDATE "transactions" SET "warungId" = 'warung-demo-id-00000000-0000-0000-0000-000000000001' WHERE "warungId" IS NULL;
UPDATE "transaction_items" SET "warungId" = 'warung-demo-id-00000000-0000-0000-0000-000000000001' WHERE "warungId" IS NULL;
UPDATE "shifts" SET "warungId" = 'warung-demo-id-00000000-0000-0000-0000-000000000001' WHERE "warungId" IS NULL;
UPDATE "stock_moves" SET "warungId" = 'warung-demo-id-00000000-0000-0000-0000-000000000001' WHERE "warungId" IS NULL;

-- Step 5: Backfill cashierId, status, and transaction_items name
UPDATE "transactions" SET "cashierId" = 'kasir-demo-id-00000000-0000-0000-0000-000000000001' WHERE "cashierId" IS NULL;
UPDATE "transactions" SET "status" = 'LUNAS' WHERE "status" IS NULL;
UPDATE "shifts" SET "cashierId" = 'kasir-demo-id-00000000-0000-0000-0000-000000000001' WHERE "cashierId" IS NULL;
UPDATE "transaction_items" SET "name" = COALESCE((SELECT "name" FROM "products" WHERE "products"."id" = "transaction_items"."productId"), 'Menu') WHERE "name" IS NULL;

-- Step 6: Transform settings from key-value to per-warung
INSERT OR REPLACE INTO "settings_new" ("warungId", "taxEnabled", "taxPct", "receiptName")
SELECT 
    'warung-demo-id-00000000-0000-0000-0000-000000000001',
    CASE WHEN (SELECT value FROM settings WHERE key = 'taxEnabled') = '1' THEN 1 ELSE 1 END,
    COALESCE((SELECT CAST(value AS INTEGER) FROM settings WHERE key = 'taxPct'), 10),
    'Warung Berkah Jaya';

DROP TABLE "settings";
ALTER TABLE "settings_new" RENAME TO "settings";

-- Step 7: Rename stock_moves.reason → type via table rebuild
CREATE TABLE "stock_moves_new" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "warungId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "qty" INTEGER NOT NULL,
    "refId" TEXT,
    "note" TEXT,
    "createdBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "stock_moves_new_warungId_fkey" FOREIGN KEY ("warungId") REFERENCES "warungs" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "stock_moves_new_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "stock_moves_new_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "stock_moves_new" 
SELECT id, warungId, productId, COALESCE(reason, 'PENJUALAN'), qty, refId, note, createdBy, createdAt
FROM "stock_moves";
DROP TABLE "stock_moves";
ALTER TABLE "stock_moves_new" RENAME TO "stock_moves";
CREATE INDEX "stock_moves_warungId_productId_createdAt_idx" ON "stock_moves"("warungId", "productId", "createdAt");

-- Step 8: Add indexes on existing tables for warungId
CREATE INDEX "products_warungId_idx" ON "products"("warungId");
CREATE INDEX "transactions_warungId_createdAt_idx" ON "transactions"("warungId", "createdAt");
CREATE INDEX "transactions_warungId_status_idx" ON "transactions"("warungId", "status");
CREATE INDEX "transaction_items_warungId_idx" ON "transaction_items"("warungId");
CREATE INDEX "shifts_warungId_idx" ON "shifts"("warungId");

-- Step 9: Add initial audit log for migration
INSERT INTO "audit_logs" ("id", "warungId", "userId", "action", "meta", "createdAt")
VALUES ('audit-migration-001', 'warung-demo-id-00000000-0000-0000-0000-000000000001', NULL, 'SEED_WARUNG', '{"description": "Multi-tenant migration with seed warung"}', datetime('now'));

-- Step 10: Verify
SELECT 'Verification counts after migration:' as comment;
SELECT 'products: ' || COUNT(*) || ' rows' FROM products;
SELECT 'transactions: ' || COUNT(*) || ' rows' FROM transactions;
SELECT 'transaction_items: ' || COUNT(*) || ' rows' FROM transaction_items;
SELECT 'shifts: ' || COUNT(*) || ' rows' FROM shifts;
SELECT 'stock_moves: ' || COUNT(*) || ' rows' FROM stock_moves;
SELECT 'settings: ' || COUNT(*) || ' rows' FROM settings;
SELECT 'warungs: ' || COUNT(*) || ' rows' FROM warungs;
SELECT 'users: ' || COUNT(*) || ' rows' FROM users;
SELECT 'mejas: ' || COUNT(*) || ' rows' FROM mejas;
SELECT 'audit_logs: ' || COUNT(*) || ' rows' FROM audit_logs;