// Pelacakan & agregasi pemakaian token AI (lampiran AI §8, §11).
//
// MENGAPA modul ini ada: acceptance §11 menuntut angka NYATA, bukan asumsi —
// "Token terukur < Rp5.000/warung/bln selama 2 minggu pilot". §8 sudah memaksa
// kita menyimpan `usage` per call; di sini kita mewujudkannya: `catatUsage`
// menulis satu baris per panggilan LLM, `ringkasUsage` mengagregasinya per
// bulan (WIB) untuk kartu billing & endpoint /api/ai/usage.
//
// PRINSIP KESELAMATAN (mengikat):
//  - `catatUsage` TIDAK PERNAH melempar. Billing itu best-effort — kegagalan
//    pencatatan TIDAK BOLEH merusak respons AI ke owner (prinsip §1: AI bukan
//    jalur kritikal). Semua error → console.error + return.
//  - `warungId` SELALU dari session (aturan §1.4); tak ada query lintas-tenant.

import { prisma } from "@/server/db";
import type { UsageInfo } from "@/server/ai/types";

// ── Jenis panggilan AI (String + const union, konsisten dengan Insight.type) ─
//
// NARRATIVE = narasi harian/shift; ANOMALY = narasi temuan rules §4; CHAT =
// jalur chat owner. Union ini sengaja kaku agar agregasi per-jenis bisa
// diandalkan tanpa tebak-tebakan string bebas.
export type JenisAiUsage = "NARRATIVE" | "ANOMALY" | "CHAT";

// Batas atas defensif per kolom token. Kolom Postgres `INTEGER` = int32 (maks
// ~2,1 miliar). Volume token satu panggilan mustahil mendekati ini, tetapi kita
// cap agar nilai anomali (mis. provider salah lapor) tidak melempar error
// numerik dan membatalkan pencatatan. 2_000_000_000 masih < int32 max.
const TOKEN_MAX = 2_000_000_000;

// Cap nilai token ke rentang aman [0, TOKEN_MAX]; nilai non-finite/negatif → 0.
function capToken(n: number | undefined): number {
  if (typeof n !== "number" || !Number.isFinite(n) || n < 0) return 0;
  return Math.min(Math.floor(n), TOKEN_MAX);
}

// ── Estimasi rupiah (§8) ────────────────────────────────────────────────────
//
// PERINGATAN: ini ESTIMASI untuk memantau acceptance "< Rp5rb/bln", BUKAN
// tagihan sebenarnya. Angka nyata = tagihan provider (Tier 2) — dan selama
// pilot pakai Tier 1 (9router) biaya token = Rp0 (§8). Rate di bawah hanyalah
// plafon kelas model murah (Flash/DeepSeek) yang dipakai untuk memverifikasi
// order of magnitude. Kalau estimasi melebihi target, §8 memutuskan: pangkas
// riwayat chat dulu, bukan naikkan harga ke owner.
const RUPIAH_PER_1K_TOKEN = 25; // ± Rp25 per 1.000 token (batas atas kelas murah §8)

export function estimasiRupiahDariToken(totalTokens: number): number {
  return Math.round((totalTokens / 1000) * RUPIAH_PER_1K_TOKEN);
}

// ── Pencatatan satu panggilan (best-effort, TIDAK PERNAH melempar) ──────────

export type CatatUsageInput = {
  jenis: JenisAiUsage;
  /** Nama model saat panggilan (audit harga). Opsional. */
  model?: string;
  /** `usage` dari provider (llm.ts). Boleh undefined → dicatat 0 token. */
  usage?: UsageInfo;
  /** false = panggilan gagal. Tetap dicatat (0 token) agar call count jujur. */
  ok: boolean;
};

/**
 * `catatUsage(warungId, { jenis, model?, usage?, ok })` (lampiran §8).
 *
 * Menyisipkan satu baris `ai_usage`. Token default 0 bila `usage` tak ada
 * (sebagian provider tidak melaporkan usage; itu tetap dicatat sebagai call).
 *
 * TIDAK PERNAH MELEMPAR — seluruh body dibungkus try/catch, error hanya
 * dicatat ke console. Alasannya: pencatatan billing bersifat OBSERVASIONAL;
 * ia tidak boleh menjatuhkan respons narasi/chat ke owner. Panggilan yang
 * gagal dicatat pun dicatat (ok:false, 0 token) supaya jumlah panggilan
 * mencerminkan kenyataan, bukan hanya yang sukses.
 */
export async function catatUsage(warungId: string, input: CatatUsageInput): Promise<void> {
  try {
    const total = capToken(input.usage?.totalTokens);
    const prompt = capToken(input.usage?.promptTokens);
    const completion = capToken(input.usage?.completionTokens);

    await prisma.aiUsage.create({
      data: {
        warungId,
        jenis: input.jenis,
        model: input.model ?? null,
        // Bila provider tak melaporkan total tapi memberi prompt+completion,
        // pakai penjumlahannya — tetap jujur terhadap apa yang dilaporkan.
        totalTokens: total || prompt + completion,
        promptTokens: prompt,
        completionTokens: completion,
        ok: input.ok,
      },
    });
  } catch (e) {
    // Best-effort: jangan pernah biarkan kegagalan billing merusak respons AI.
    console.error("[ai-usage] catatUsage gagal (diabaikan):", e);
  }
}

// ── Ringkasan agregat per bulan (WIB) ───────────────────────────────────────

export type RingkasanJenis = {
  jenis: JenisAiUsage;
  tokens: number;
  calls: number;
};

export type RingkasanUsage = {
  /** Bulan dalam format "YYYY-MM" (zona WIB). */
  bulan: string;
  totalTokens: number;
  promptTokens: number;
  completionTokens: number;
  /** Jumlah panggilan (termasuk yang gagal — ok:false). */
  calls: number;
  perJenis: RingkasanJenis[];
  /** ESTIMASI (bukan tagihan nyata — lihat catatan RUPIAH_PER_1K_TOKEN). */
  estimasiRupiah: number;
};

// Offset WIB tetap UTC+7 (tanpa DST), konsisten dengan tools.ts & chat.ts.
const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;

// Rentang [awal, akhir) bulan berjalan dalam WIB, dikembalikan sebagai Date UTC
// untuk query Prisma. `bulanParam` opsional "YYYY-MM"; default = bulan ini (WIB).
function rentangBulanWib(bulanParam?: string): { bulan: string; mulai: Date; selesai: Date } {
  // Tolak format tak valid → fallback ke bulan berjalan.
  const valid = bulanParam && /^\d{4}-\d{2}$/.test(bulanParam);

  // "Sekarang" digeser ke WIB agar tahun/bulan mengikuti kalender WIB, bukan UTC.
  const sekarangWib = new Date(Date.now() + WIB_OFFSET_MS);
  const tahun = valid ? Number(bulanParam!.slice(0, 4)) : sekarangWib.getUTCFullYear();
  const bulanNum = valid ? Number(bulanParam!.slice(5, 7)) : sekarangWib.getUTCMonth() + 1; // 1-12

  // Awal bulan WIB → ubah ke UTC dengan menggeser balik offset.
  const mulai = new Date(Date.UTC(tahun, bulanNum - 1, 1) - WIB_OFFSET_MS);
  const selesai = new Date(Date.UTC(tahun, bulanNum, 1) - WIB_OFFSET_MS);

  const label = `${tahun}-${String(bulanNum).padStart(2, "0")}`;
  return { bulan: label, mulai, selesai };
}

/**
 * `ringkasUsage(warungId, { bulan? })` (lampiran §8, §11).
 *
 * Mengagregasi pemakaian token warung untuk bulan berjalan (WIB) — dasar kartu
 * "Pemakaian AI" & endpoint GET /api/ai/usage. `estimasiRupiah` adalah ESTIMASI
 * (lihat RUPIAH_PER_1K_TOKEN); angka tagihan sebenarnya ada di sisi provider.
 *
 * Scope WAJIB: seluruh query ter-filter `warungId` (tenant dari session).
 */
export async function ringkasUsage(
  warungId: string,
  input: { bulan?: string } = {},
): Promise<RingkasanUsage> {
  const { bulan, mulai, selesai } = rentangBulanWib(input.bulan);

  const rows = await prisma.aiUsage.groupBy({
    by: ["jenis"],
    where: { warungId, createdAt: { gte: mulai, lt: selesai } },
    _sum: { totalTokens: true, promptTokens: true, completionTokens: true },
    _count: { _all: true },
  });

  let totalTokens = 0;
  let promptTokens = 0;
  let completionTokens = 0;
  let calls = 0;
  const perJenis: RingkasanJenis[] = [];

  for (const r of rows) {
    const tokens = r._sum.totalTokens ?? 0;
    const prompt = r._sum.promptTokens ?? 0;
    const completion = r._sum.completionTokens ?? 0;
    const jumlah = r._count._all;

    totalTokens += tokens;
    promptTokens += prompt;
    completionTokens += completion;
    calls += jumlah;

    perJenis.push({ jenis: r.jenis as JenisAiUsage, tokens, calls: jumlah });
  }

  // Urut stabil untuk tampilan (token terbanyak dulu).
  perJenis.sort((a, b) => b.tokens - a.tokens);

  return {
    bulan,
    totalTokens,
    promptTokens,
    completionTokens,
    calls,
    perJenis,
    estimasiRupiah: estimasiRupiahDariToken(totalTokens),
  };
}
