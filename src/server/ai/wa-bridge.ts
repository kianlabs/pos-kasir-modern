// Jembatan Insight → outbox WhatsApp (lampiran AI §6, §12-D).
//
// PRINSIP (§6 last bullet): "AI tidak mengirim WhatsApp langsung — menulis
// Insight, komponen WA Fase 2a yang mengirim". Modul ini hanya MENYIMPAN satu
// baris outbox `notifikasi` (status PENDING) dari sebuah Insight; pengiriman
// nyata dilakukan lapisan WA yang sudah ada (src/server/wa/send.ts) lewat
// /api/notifikasi/[id]/kirim atau /api/notifikasi/kirim-pending.
//
// Pola ini MENIRU `buatLaporanShift` (src/server/notif.ts): susun baris, dedup
// lewat (warungId + jenis + refId), tujuan dari nomor owner (atau null =
// semi-manual). Modul ini TIDAK menyentuh jaringan/HTTP sama sekali.
//
// Aturan tenant #1: SEMUA query difilter `warungId` — id Insight dari warung
// lain TIDAK PERNAH bisa di-enqueue.

import { prisma } from "@/server/db";
import type { InsightType } from "@/server/ai/types";

// Pemetaan tipe Insight → `jenis` baris notifikasi (lampiran §5 → §7a).
// NARRATIVE/CHAT_SUMMARY = "INSIGHT" (pesan info owner); ANOMALY = "ANOMALI"
// (butuh perhatian). Nilai `jenis` sengaja string bebas (bukan enum) agar
// konsisten dengan kolom Notifikasi.jenis yang sudah ada.
const JENIS_PER_TIPE: Record<InsightType, string> = {
  NARRATIVE: "INSIGHT",
  CHAT_SUMMARY: "INSIGHT",
  ANOMALY: "ANOMALI",
};

// Jenis fallback bila tipe Insight tak dikenal (String, bukan union — defensif).
const JENIS_DEFAULT = "INSIGHT";

function jenisUntukType(type: string): string {
  return JENIS_PER_TIPE[type as InsightType] ?? JENIS_DEFAULT;
}

/**
 * Enqueue SATU Insight ke outbox WhatsApp owner (lampiran §6, §12-D).
 *
 * Tahapan:
 *  1. Load Insight by id + warungId (tenant-safe). Tidak ada → return null
 *     (pemanggil memetakan ke 404).
 *  2. Load `Warung.telepon` sebagai `tujuan` owner; kosong → null (semi-manual,
 *     konsisten dengan notif.ts).
 *  3. IDEMPOTEN: bila sudah ada baris notifikasi (warungId + jenis + refId =
 *     insightId), kembalikan baris itu tanpa membuat duplikat (mirror dedup
 *     buatLaporanShift). Jadi klik "Kirim ke WA" dua kali tidak menggandakan.
 *
 * Mengembalikan id baris notifikasi, atau null bila Insight tak ditemukan.
 * Fungsi ini TIDAK mengirim WA — hanya menulis baris PENDING ke outbox.
 */
export async function enqueueInsightKeWa(
  warungId: string,
  insightId: string,
): Promise<{ id: string } | null> {
  // 1. Insight harus milik warung ini (tenant #1).
  const insight = await prisma.insight.findFirst({
    where: { id: insightId, warungId },
    select: { id: true, type: true, title: true, body: true, source: true },
  });
  if (!insight) return null;

  const jenis = jenisUntukType(insight.type);

  // 3. Idempotensi: satu baris outbox per (jenis, refId) — kembalikan bila ada.
  const sudah = await prisma.notifikasi.findFirst({
    where: { warungId, jenis, refId: insightId },
    select: { id: true },
  });
  if (sudah) return { id: sudah.id };

  // 2. Nomor owner (Warung.telepon). Kosong → null = semi-manual (notif.ts).
  const warung = await prisma.warung.findUnique({
    where: { id: warungId },
    select: { telepon: true },
  });
  const tujuan = (warung?.telepon ?? "").trim() || null;

  const dibuat = await prisma.notifikasi.create({
    data: {
      warungId,
      jenis,
      channel: "WA",
      tujuan,
      subject: insight.title,
      body: insight.body,
      status: "PENDING",
      refId: insightId,
      // Meta ringkas untuk audit/verifikasi (§1.6) — bukan data mentah pelanggan.
      meta: JSON.stringify({
        insightType: insight.type,
        source: insight.source ?? null,
      }),
    },
    select: { id: true },
  });

  return { id: dibuat.id };
}
