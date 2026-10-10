import { NextResponse } from "next/server";
import { currentWarungId, requireOwnerResponse } from "@/server/tenant";
import { handleApiError } from "@/server/api-error";
import { enqueueInsightKeWa } from "@/server/ai/wa-bridge";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

// POST /api/ai/insights/[id]/kirim → antrekan satu Insight ke outbox WhatsApp
// owner (owner-only, ter-scope tenant). warungId selalu dari session (aturan #1).
//
// DESAIN DUA LANGKAH (lampiran §6): endpoint ini hanya ENQUEUE baris `notifikasi`
// PENDING — TIDAK mengirim WA sekarang. Pengiriman nyata lewat
// POST /api/notifikasi/[id]/kirim yang sudah ada. Ini menegakkan prinsip
// "AI tidak kirim WA langsung": AI menulis Insight, komponen WA Fase 2a yang
// mengirim. Enqueue murni operasi DB (tanpa kredensial WA), jadi tetap bekerja
// walau provider WA belum dikonfigurasi.
//
// 404 bila Insight tidak ada / bukan milik warung ini (isolasi tenant §7.2).
export async function POST(_req: Request, props: Params) {
  try {
    const denied = await requireOwnerResponse();
    if (denied) return denied;

    const { id } = await props.params;
    const warungId = await currentWarungId();

    const hasil = await enqueueInsightKeWa(warungId, id);
    if (!hasil) {
      return NextResponse.json({ error: "Insight tidak ditemukan." }, { status: 404 });
    }

    // Kembalikan id baris notifikasi agar klien bisa (opsional) memicunya kirim.
    return NextResponse.json({ id: hasil.id });
  } catch (e) {
    return handleApiError(e);
  }
}
