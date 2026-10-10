import { NextResponse } from "next/server";
import { currentWarungId, currentKasirId, requireOwnerResponse } from "@/server/tenant";
import { catat } from "@/server/audit";
import { handleApiError } from "@/server/api-error";
import { isWaConfigured } from "@/server/wa/config";
import { kirimNotifikasi } from "@/server/wa/send";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

// POST /api/notifikasi/[id]/kirim → kirim SATU notifikasi outbox (owner-only,
// ter-scope tenant). warungId selalu dari session (aturan #1).
//
// DEGRADASI (§9): bila WA belum dikonfigurasi, kembalikan 200 dengan
// { ok:false, error:"WhatsApp belum dikonfigurasi" } — BUKAN 500. Pengiriman WA
// bukan jalur kritis; fitur boleh mati tanpa memengaruhi kasir. Kegagalan provider
// juga tidak melempar: baris ditandai GAGAL dan hasilnya dikembalikan apa adanya.
export async function POST(_req: Request, props: Params) {
  try {
    const denied = await requireOwnerResponse();
    if (denied) return denied;

    const { id } = await props.params;
    const warungId = await currentWarungId();
    const kasirId = await currentKasirId(warungId);

    if (!isWaConfigured()) {
      return NextResponse.json({ ok: false, error: "WhatsApp belum dikonfigurasi" });
    }

    const hasil = await kirimNotifikasi(warungId, id);
    // Audit mutasi penting (lampiran skema §2 aturan #10) — id & status hasil.
    if (hasil.ok) {
      await catat({
        warungId,
        userId: kasirId,
        action: "WA_KIRIM",
        meta: { notifikasiId: id, status: hasil.status },
      });
    }
    return NextResponse.json(hasil);
  } catch (e) {
    return handleApiError(e);
  }
}
