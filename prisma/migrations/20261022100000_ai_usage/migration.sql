-- Pelacakan pemakaian token AI per panggilan LLM (lampiran AI §8, §11).
--
-- Acceptance §11: "Token terukur < Rp5.000/warung/bln selama 2 minggu pilot".
-- Tabel ini membuat angka itu terukur (bukan asumsi): tiap panggilan LLM
-- mencatat usage provider → GET /api/ai/usage mengagregasi per bulan (WIB).
--
-- Model terkait: prisma/schema.prisma (AiUsage). Pola gaya mengikuti migrasi
-- 20261021100000_promo & 20261009100000_init_postgres.
CREATE TABLE "ai_usage" (
    "id" TEXT NOT NULL,
    "warungId" TEXT NOT NULL,
    "jenis" TEXT NOT NULL,
    "model" TEXT,
    "promptTokens" INTEGER NOT NULL DEFAULT 0,
    "completionTokens" INTEGER NOT NULL DEFAULT 0,
    "totalTokens" INTEGER NOT NULL DEFAULT 0,
    "ok" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_usage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ai_usage_warungId_createdAt_idx" ON "ai_usage"("warungId", "createdAt");

-- AddForeignKey
ALTER TABLE "ai_usage" ADD CONSTRAINT "ai_usage_warungId_fkey" FOREIGN KEY ("warungId") REFERENCES "warungs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
