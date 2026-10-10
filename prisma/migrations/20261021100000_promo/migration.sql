-- Promo engine (Fase 2 §7a) — beli 1 gratis 1, diskon jam sepi (happy hour),
-- voucher. Katalog + kalkulator saja: diskon promo dihitung app-side
-- (src/server/promo.ts) lalu diteruskan ke checkout lewat field `discount`
-- yang sudah ada. TIDAK ada perubahan pada jalur uang di tabel transactions.
--
-- Model terkait: prisma/schema.prisma (Promo). Pola gaya mengikuti migrasi
-- 20261010110000_notifikasi & 20261009100000_init_postgres.
CREATE TABLE "promos" (
    "id" TEXT NOT NULL,
    "warungId" TEXT NOT NULL,
    "kode" TEXT,
    "nama" TEXT NOT NULL,
    "tipe" TEXT NOT NULL,
    "nilai" INTEGER NOT NULL DEFAULT 0,
    "minSubtotal" INTEGER NOT NULL DEFAULT 0,
    "jamMulai" TEXT,
    "jamSelesai" TEXT,
    "aktif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "promos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "promos_warungId_idx" ON "promos"("warungId");

-- AddForeignKey
ALTER TABLE "promos" ADD CONSTRAINT "promos_warungId_fkey" FOREIGN KEY ("warungId") REFERENCES "warungs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
