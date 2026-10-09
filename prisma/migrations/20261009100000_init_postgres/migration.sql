-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "warungs" (
    "id" TEXT NOT NULL,
    "nama" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "alamat" TEXT,
    "telepon" TEXT,
    "status" TEXT NOT NULL DEFAULT 'TRIAL',
    "trialEndsAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "warungs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "warungId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "password" TEXT,
    "pin" TEXT,
    "role" TEXT NOT NULL,
    "aktif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "warungId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'Umum',
    "icon" TEXT NOT NULL DEFAULT '',
    "stock" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mejas" (
    "id" TEXT NOT NULL,
    "warungId" TEXT NOT NULL,
    "nomor" TEXT NOT NULL,

    CONSTRAINT "mejas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transactions" (
    "id" TEXT NOT NULL,
    "warungId" TEXT NOT NULL,
    "shiftId" TEXT,
    "mejaId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'LUNAS',
    "subtotal" INTEGER NOT NULL DEFAULT 0,
    "discount" INTEGER NOT NULL DEFAULT 0,
    "tax" INTEGER NOT NULL DEFAULT 0,
    "total" INTEGER NOT NULL DEFAULT 0,
    "cash" INTEGER NOT NULL DEFAULT 0,
    "change" INTEGER NOT NULL DEFAULT 0,
    "payment" TEXT NOT NULL DEFAULT 'CASH',
    "cashierId" TEXT NOT NULL,
    "dibuatOffline" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transaction_items" (
    "id" TEXT NOT NULL,
    "warungId" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "qty" INTEGER NOT NULL,

    CONSTRAINT "transaction_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shifts" (
    "id" TEXT NOT NULL,
    "warungId" TEXT NOT NULL,
    "cashierId" TEXT NOT NULL,
    "modalAwal" INTEGER NOT NULL,
    "kasFisik" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'BUKA',
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "shifts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_moves" (
    "id" TEXT NOT NULL,
    "warungId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "qty" INTEGER NOT NULL,
    "refId" TEXT,
    "note" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_moves_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settings" (
    "warungId" TEXT NOT NULL,
    "taxEnabled" BOOLEAN NOT NULL DEFAULT true,
    "taxPct" INTEGER NOT NULL DEFAULT 10,
    "receiptName" TEXT,
    "jamBuka" TEXT,
    "jamTutup" TEXT,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("warungId")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "warungId" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "meta" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "insights" (
    "id" TEXT NOT NULL,
    "warungId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "findings" TEXT,
    "source" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "insights_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "warungs_slug_key" ON "warungs"("slug");

-- CreateIndex
CREATE INDEX "users_warungId_idx" ON "users"("warungId");

-- CreateIndex
CREATE UNIQUE INDEX "users_warungId_email_key" ON "users"("warungId", "email");

-- CreateIndex
CREATE INDEX "products_warungId_idx" ON "products"("warungId");

-- CreateIndex
CREATE INDEX "mejas_warungId_idx" ON "mejas"("warungId");

-- CreateIndex
CREATE UNIQUE INDEX "mejas_warungId_nomor_key" ON "mejas"("warungId", "nomor");

-- CreateIndex
CREATE INDEX "transactions_warungId_createdAt_idx" ON "transactions"("warungId", "createdAt");

-- CreateIndex
CREATE INDEX "transactions_warungId_status_idx" ON "transactions"("warungId", "status");

-- CreateIndex
CREATE INDEX "transaction_items_warungId_idx" ON "transaction_items"("warungId");

-- CreateIndex
CREATE INDEX "shifts_warungId_idx" ON "shifts"("warungId");

-- CreateIndex
CREATE INDEX "stock_moves_warungId_productId_createdAt_idx" ON "stock_moves"("warungId", "productId", "createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_warungId_createdAt_idx" ON "audit_logs"("warungId", "createdAt");

-- CreateIndex
CREATE INDEX "insights_warungId_createdAt_idx" ON "insights"("warungId", "createdAt");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_warungId_fkey" FOREIGN KEY ("warungId") REFERENCES "warungs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_warungId_fkey" FOREIGN KEY ("warungId") REFERENCES "warungs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mejas" ADD CONSTRAINT "mejas_warungId_fkey" FOREIGN KEY ("warungId") REFERENCES "warungs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_warungId_fkey" FOREIGN KEY ("warungId") REFERENCES "warungs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "shifts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_mejaId_fkey" FOREIGN KEY ("mejaId") REFERENCES "mejas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_cashierId_fkey" FOREIGN KEY ("cashierId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaction_items" ADD CONSTRAINT "transaction_items_warungId_fkey" FOREIGN KEY ("warungId") REFERENCES "warungs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaction_items" ADD CONSTRAINT "transaction_items_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaction_items" ADD CONSTRAINT "transaction_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_warungId_fkey" FOREIGN KEY ("warungId") REFERENCES "warungs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_cashierId_fkey" FOREIGN KEY ("cashierId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_moves" ADD CONSTRAINT "stock_moves_warungId_fkey" FOREIGN KEY ("warungId") REFERENCES "warungs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_moves" ADD CONSTRAINT "stock_moves_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "settings" ADD CONSTRAINT "settings_warungId_fkey" FOREIGN KEY ("warungId") REFERENCES "warungs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_warungId_fkey" FOREIGN KEY ("warungId") REFERENCES "warungs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "insights" ADD CONSTRAINT "insights_warungId_fkey" FOREIGN KEY ("warungId") REFERENCES "warungs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================================
-- Partial unique index: SATU bill DRAFT per meja (per warung).
-- Catatan migrasi Postgres dari prisma/schema.prisma (model Transaction).
-- Di SQLite invarian ini hanya dijaga app (serialisasi transaksi Prisma);
-- di Postgres kita tegakkan di level DB supaya race check-then-act tidak
-- bisa menghasilkan dua bill terbuka untuk meja yang sama.
-- WHERE mejaId IS NOT NULL: transaksi "bawa pulang" (mejaId null) tidak dibatasi.
-- ============================================================
CREATE UNIQUE INDEX "tx_one_draft_per_meja"
  ON "transactions" ("warungId", "mejaId")
  WHERE "status" = 'DRAFT' AND "mejaId" IS NOT NULL;

