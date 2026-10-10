import { NextResponse } from "next/server";
import { currentWarungId, currentKasirId, requireOwnerResponse } from "@/server/tenant";
import { catat } from "@/server/audit";
import { handleApiError } from "@/server/api-error";
import { isWaConfigured } from "@/server/wa/config";
import { kirimSemuaPending } from "@/server/wa/send";

export const dynamic = "force-dynamic";

// POST /api/notifikasi/kirim-pending → kirim SEMUA notifikasi PENDING warung
// (owner-only, ter-scope tenant). warungId selalu dari session (aturan #1).
//
// DEGRADASI (§9): sama seperti /kirim — bila WA belum dikonfigurasi, kembalikan
// 200 { ok:false, error:"WhatsApp belum dikonfigurasi" } alih-alih 500.
export async function POST() {
  try {
    const denied = await requireOwnerResponse();
    if (denied) return denied;

    const warungId = await currentWarungId();
    const kasirId = await currentKasirId(warungId);

    if (!isWaConfigured()) {
      return NextResponse.json({ ok: false, error: "WhatsApp belum dikonfigurasi" });
    }

    const hasil = await kirimSemuaPending(warungId);
    // Audit mutasi penting (lampiran skema §2 aturan #10) — hanya bila ada yang terkirim.
    if (hasil.terkirim > 0) {
      await catat({
        warungId,
        userId: kasirId,
        action: "WA_KIRIM",
        meta: { count: hasil.terkirim, status: "TERKIRIM" },
      });
    }
    return NextResponse.json({ ok: true, ...hasil });
  } catch (e) {
    return handleApiError(e);
  }
}
