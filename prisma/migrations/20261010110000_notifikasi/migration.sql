-- Outbox notifikasi (Fase 2 §7a) — "semi-manual first", provider-agnostic.
--
-- Saat shift ditutup, aplikasi menyusun laporan shift (teks siap-kirim ke WA
-- owner) dan MENYIMPANNYA di tabel ini. Pengiriman nyata (WhatsApp/Fonnte/Cloud
-- API) = adapter terpisah yang menyusul; sekarang owner menyalin `body` dari UI
-- (semi-manual). Kolom `channel`/`status`/`tujuan` sudah disiapkan agar adapter
-- tak perlu migrasi lagi saat transport diaktifkan.
--
-- Model terkait: prisma/schema.prisma (Notifikasi). Pola gaya mengikuti
-- migrasi 20261009100000_init_postgres & 20261010100000_login_attempts.
CREATE TABLE "notifikasi" (
    "id" TEXT NOT NULL,
    "warungId" TEXT NOT NULL,
    "jenis" TEXT NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'WA',
    "tujuan" TEXT,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "refId" TEXT,
    "meta" TEXT,
    "sentAt" TIMESTAMP(3),
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifikasi_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "notifikasi_warungId_createdAt_idx" ON "notifikasi"("warungId", "createdAt");

-- CreateIndex
CREATE INDEX "notifikasi_warungId_jenis_status_idx" ON "notifikasi"("warungId", "jenis", "status");

-- AddForeignKey
ALTER TABLE "notifikasi" ADD CONSTRAINT "notifikasi_warungId_fkey" FOREIGN KEY ("warungId") REFERENCES "warungs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
