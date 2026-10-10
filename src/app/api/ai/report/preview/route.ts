import { NextResponse } from "next/server";
import { isDateStr, readJson } from "@/server/http";
import { str } from "@/server/validate";
import { currentWarungId, requireOwnerResponse } from "@/server/tenant";
import { handleApiError } from "@/server/api-error";
import { isAiConfigured } from "@/server/ai/config";
import { eligibleUntukAi, tulisInsight } from "@/server/ai/insight";
import { ToolError } from "@/server/ai/tools";
import {
  generateNarasiHari,
  generateNarasiShift,
  keputusanGating,
  type HasilNarasi,
} from "@/server/ai/narrative";

export const dynamic = "force-dynamic";

// POST /api/ai/report/preview → generate narasi (lampiran §6, §9).
//
// Body opsional: { shiftId?, tanggal? }.
//  - shiftId  → narasi tutup-shift (getRekapShift); shift warung lain → 404.
//  - tanggal  → narasi harian untuk tanggal "YYYY-MM-DD" (default hari ini WIB).
//
// KEPUTUSAN GATING (§9 — didokumentasikan di sini & di narrative.keputusanGating):
//  1. AI TIDAK dikonfigurasi (AI_ENABLED off / key kosong): BUKAN salah owner →
//     balas 200 dengan TEMPLATE angka deterministik (viaAi=false). Ini fallback
//     resmi §9 ("Provider AI down → fallback template"), bukan 500/403.
//  2. AI dikonfigurasi TAPI warung tidak eligible (status ≠ ACTIVE = plan
//     gratis/TRIAL): ini GATING plan → 403 jelas "Fitur Insight hanya untuk
//     plan berbayar" (§9, bukan silent fail).
//  3. AI dikonfigurasi & warung ACTIVE: jalur LLM normal (degradasi ke template
//     bila provider down, lihat narrative.ts).
//
// Setiap narasi dipersist via tulisInsight (type NARRATIVE) dan dikembalikan.
// Owner-only; warungId selalu dari session (aturan #4).
export async function POST(req: Request) {
  try {
    const denied = await requireOwnerResponse();
    if (denied) return denied;

    const warungId = await currentWarungId();
    const body = (await readJson(req)) ?? {};

    const shiftId = str(body.shiftId, 100);
    const tanggal = isDateStr(body.tanggal) ? body.tanggal : undefined;

    // Keputusan gating: cek konfigurasi global + eligibility warung SEKALI.
    const aiTerkonfigurasi = isAiConfigured();
    // eligibleUntukAi() sudah fail-safe false bila AI off; di sini hanya relevan
    // saat AI terkonfigurasi (membedakan gating plan dari sekadar AI mati).
    const warungEligible = aiTerkonfigurasi ? await eligibleUntukAi(warungId) : false;
    const keputusan = keputusanGating(aiTerkonfigurasi, warungEligible);

    if (keputusan.aksi === "403") {
      return NextResponse.json({ error: keputusan.pesan }, { status: 403 });
    }

    // Bangun narasi: satu jalur kode, beda sumber data (shift vs hari).
    // Baik aksi "template" (AI off) maupun "llm" memakai fungsi narrative yang
    // SAMA — fungsi itu otomatis fallback ke template saat LLM gagal (§9), jadi
    // hasil selalu { ok:true, viaAi }.
    let hasil: HasilNarasi;
    try {
      hasil = shiftId
        ? await generateNarasiShift(warungId, { shiftId })
        : await generateNarasiHari(warungId, { tanggal });
    } catch (e) {
      // Shift bukan milik warung ini → 404 (jangan bocorkan lintas tenant, §7.2).
      if (e instanceof ToolError) {
        return NextResponse.json({ error: e.message }, { status: 404 });
      }
      throw e;
    }

    // Persist sebagai Insight NARRATIVE (dedup per hari/type oleh tulisInsight).
    // Kegagalan LLM TIDAK sampai di sini sebagai error — hasil sudah fallback.
    const { id } = await tulisInsight(warungId, {
      type: "NARRATIVE",
      title: hasil.title,
      body: hasil.body,
      source: hasil.source,
      findings: hasil.findings,
    });

    return NextResponse.json({
      id,
      title: hasil.title,
      body: hasil.body,
      source: hasil.source,
      viaAi: hasil.viaAi,
    });
  } catch (e) {
    return handleApiError(e);
  }
}
