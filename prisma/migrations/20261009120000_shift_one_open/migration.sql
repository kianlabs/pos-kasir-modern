-- Partial unique index: SATU shift BUKA per warung.
--
-- Invarian "satu shift BUKA per warung" sebelumnya HANYA dijaga app lewat pola
-- check-then-act di dalam $transaction (src/app/api/shifts/route.ts). Di
-- Postgres, dua request "buka shift" yang tiba bersamaan bisa sama-sama lolos
-- pengecekan lalu sama-sama INSERT → dua baris status='BUKA' di DB.
--
-- Partial unique index ini menutup celah tersebut di level DB: baris kedua
-- ditolak dengan unique violation (Prisma P2002), yang ditangkap endpoint dan
-- diterjemahkan menjadi 409 "Masih ada shift terbuka.".
--
-- WHERE "status" = 'BUKA' → hanya baris BUKA yang dibatasi; riwayat shift
-- TUTUP boleh berapa pun per warung.
CREATE UNIQUE INDEX "shifts_one_buka_per_warung"
  ON "shifts" ("warungId")
  WHERE "status" = 'BUKA';
