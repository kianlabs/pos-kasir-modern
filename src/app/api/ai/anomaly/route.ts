import { NextResponse } from "next/server";
import { isDateStr, readJson } from "@/server/http";
import { currentWarungId, requireOwnerResponse } from "@/server/tenant";
import { handleApiError } from "@/server/api-error";
import { jalankanAnomali, simpanAnomali } from "@/server/ai/anomaly";

export const dynamic = "force-dynamic";

// POST /api/ai/anomaly → jalankan scan anomali §4 untuk warung sesi (lampiran §6).
//
// Owner-only (fitur AI tidak untuk kasir, §1.3). Body opsional `{ hari? }`
// ("YYYY-MM-DD", default hari ini WIB). Dipakai juga sebagai CRON MANUAL
// (cron harian 01.00 WIB, §4) — cukup panggil endpoint ini.
//
// KEPUTUSAN: scan DETERMINISTIK murni (§4) — TIDAK butuh LLM. Karena itu TIDAK
// di-gate `isAiConfigured()`: temuan tetap dihitung & disimpan walau provider AI
// mati (§9). Yang membatasi hanya role (owner) + tenant dari session (aturan #4).
export async function POST(req: Request) {
  try {
    const denied = await requireOwnerResponse();
    if (denied) return denied;

    const warungId = await currentWarungId();
    const body = (await readJson(req)) ?? {};
    const hari = isDateStr(body.hari) ? body.hari : undefined;

    // Hitung semua temuan yang berlaku (warungId dari session; model tak pegang).
    const temuan = await jalankanAnomali(warungId, { hari });

    // Simpan sebagai Insight ANOMALY (body deterministik; dedup per hari oleh
    // tulisInsight). Tidak ada temuan → tidak menulis apa pun.
    await simpanAnomali(warungId, temuan, { hari });

    return NextResponse.json({ temuan });
  } catch (e) {
    return handleApiError(e);
  }
}
