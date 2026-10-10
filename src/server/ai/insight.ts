// Penulis Insight + gate eligibility untuk "KRING! Insight" (lampiran AI §5, §5b).
//
// Insight = baris tabel `insights` (model Prisma `Insight`). TIDAK ada kolom
// uang di sini (lampiran §5): angka asli hidup di tabel bisnis `Int`; `findings`
// hanya salinan JSON bukti angka untuk audit/verifikasi owner (§1.6).
//
// Modul ini TIDAK memanggil LLM — murni tulis/baca DB. Jalur narasi (LLM)
// memanggil `tulisInsight` SETELAH menghasilkan teks.

import { prisma } from "@/server/db";
import { getAiConfig } from "@/server/ai/config";
import type { InsightType } from "@/server/ai/types";

// ── Zona waktu WIB (lampiran §4: dedup & date-math dipaksa Asia/Jakarta) ────

const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;

// Rentang [mulai, selesai) awal hari WIB untuk instan `d`.
function jendelaHariWib(d: Date): { mulai: Date; selesai: Date } {
  const shifted = new Date(d.getTime() + WIB_OFFSET_MS);
  shifted.setUTCHours(0, 0, 0, 0);
  const mulai = new Date(shifted.getTime() - WIB_OFFSET_MS);
  return { mulai, selesai: new Date(mulai.getTime() + 24 * 60 * 60 * 1000) };
}

export type TulisInsightInput = {
  type: InsightType;
  title: string;
  body: string;
  /** Bukti angka (temuan §4) — diserialisasi ke JSON ringan. Bukan data mentah. */
  findings?: unknown;
  /** Tautan sumber agar owner bisa menelusuri klaim: "/laporan?dari=..&sampai=..". */
  source?: string;
};

/**
 * Tulis satu baris Insight untuk sebuah warung (lampiran §5).
 *
 * Dedup (lampiran §4): aturan `rule + warungId + hari yang sama cukup 1
 * Insight`. Di sini dedup dilakukan per `type + warungId + hari WIB`: bila pada
 * hari yang sama SUDAH ada Insight bertipe sama untuk warung ini, baris itu
 * di-UPDATE (title/body/findings/source/reset readAt) alih-alih membuat
 * duplikat. Ini menjaga cron/tutup-shift yang berjalan dua kali tetap idempoten.
 *
 * Mengembalikan id baris (baru atau yang di-update).
 */
export async function tulisInsight(
  warungId: string,
  input: TulisInsightInput,
): Promise<{ id: string }> {
  const { mulai, selesai } = jendelaHariWib(new Date());

  const data = {
    title: input.title,
    body: input.body,
    findings: input.findings === undefined ? null : JSON.stringify(input.findings),
    source: input.source ?? null,
  };

  // Cari baris hari ini dulu (type + warungId + jendela hari WIB).
  const sudahAda = await prisma.insight.findFirst({
    where: {
      warungId,
      type: input.type,
      createdAt: { gte: mulai, lt: selesai },
    },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });

  if (sudahAda) {
    // Baris dianggap "temuan baru" → tandai belum dibaca lagi agar owner
    // melihat update terbaru pada hari itu.
    const updated = await prisma.insight.update({
      where: { id: sudahAda.id },
      data: { ...data, readAt: null },
      select: { id: true },
    });
    return { id: updated.id };
  }

  const dibuat = await prisma.insight.create({
    data: { warungId, type: input.type, ...data },
    select: { id: true },
  });
  return { id: dibuat.id };
}

/**
 * Cek apakah sebuah warung boleh memakai fitur AI (lampiran §5b + §9).
 *
 * `true` IFF:
 *  - flag global `AI_ENABLED` aktif DAN kredensial provider lengkap
 *    (`isAiConfigured()` → getAiConfig().enabled), DAN
 *  - `Warung.status === "ACTIVE"`.
 *
 * Plan gratis/TRIAL → `false` (endpoint sebaiknya menjawab 403 jelas, §9).
 * Gagal baca DB → `false` (fail-safe: jangan mengaktifkan AI saat ragu).
 */
export async function eligibleUntukAi(warungId: string): Promise<boolean> {
  if (!getAiConfig().enabled) return false;

  try {
    const warung = await prisma.warung.findUnique({
      where: { id: warungId },
      select: { status: true },
    });
    return warung?.status === "ACTIVE";
  } catch (e) {
    // Fail-safe: bila status tidak bisa dipastikan, jangan aktifkan AI.
    console.error("[ai] gagal cek eligibility warung", warungId, e);
    return false;
  }
}
