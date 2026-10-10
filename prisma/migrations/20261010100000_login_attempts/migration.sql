-- Tabel state rate-limit login (lampiran skema §2 aturan #9).
--
-- Rate-limit "5 kegagalan berturut → blok 5 menit" sebelumnya disimpan in-memory
-- (Map per proses) di src/server/rate-limit.ts. Di deploy multi-instance/serverless
-- (Vercel), tiap instance punya Map sendiri → hitungan tidak terbagi → brute-force
-- PIN bisa lolos dengan menyebar request antar-instance.
--
-- State dipindah ke tabel ini agar shared lintas instance (lihat model
-- LoginAttempt di prisma/schema.prisma). "key" = userId kasir ATAU
-- "owner-email:<email>" untuk owner; unik per subjek sehingga isolasi per-key
-- dipertahankan.
CREATE TABLE "login_attempts" (
    "key" TEXT NOT NULL,
    "failures" INTEGER NOT NULL DEFAULT 0,
    "blockedUntil" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "login_attempts_pkey" PRIMARY KEY ("key")
);
