// Endpoint chat owner "KRING! Insight" (lampiran AI §6, §7, §9).
//
// POST /api/ai/chat → Server-Sent Events (SSE) berisi jawaban bertoken.
//
// KEAMANAN & GATING (urutan penting, lampiran §1, §6, §9):
//  1. OWNER-ONLY: kasir → 403 (requireOwnerResponse).
//  2. TENANT: warungId + userId HANYA dari session (currentWarungId/currentKasirId).
//     Body user TIDAK pernah menyentuh warungId (prinsip §1.4).
//  3. ELIGIBILITY PLAN: plan bukan ACTIVE → 403 "hanya untuk plan berbayar" (§9).
//     AI belum dikonfigurasi → 403 pesan jelas (keputusan fail-safe OFF, §9).
//  4. RATE LIMIT: 20 req/menit/user (§6), deterministik & fail-open (lihat chat.ts).
//
// ROUTING: tool dipilih DETERMINISTIK dari pertanyaan (pilihToolDari), bukan LLM.
// Hanya agregat angka tool yang dikirim ke model untuk dirangkai (§1.4, §7.1).
//
// DEGRADASI (§9): provider down → SSE tetap HTTP 200 dengan pesan gangguan +
// template angka. Endpoint ini TIDAK PERNAH membalas 500 karena kegagalan AI.

import { NextResponse } from "next/server";
import { readJson } from "@/server/http";
import { catat } from "@/server/audit";
import { str } from "@/server/validate";
import { handleApiError } from "@/server/api-error";
import { getAiConfig } from "@/server/ai/config";
import { eligibleUntukAi } from "@/server/ai/insight";
import { streamNarrative } from "@/server/ai/llm";
import { currentWarungId, currentKasirId, requireOwnerResponse } from "@/server/tenant";
import {
  MAKS_PERTANYAAN,
  PESAN_GANGGUAN,
  checkChatRate,
  pangkasRiwayat,
  pilihToolDari,
  recordChatRequest,
  ringkasPertanyaanUntukAudit,
  siapkanChat,
} from "@/server/ai/chat";

export const dynamic = "force-dynamic";

// Header SSE standar: no-cache + no-transform agar proxy tidak men-buffer stream.
const SSE_HEADERS = {
  "Content-Type": "text/event-stream; charset=utf-8",
  "Cache-Control": "no-cache, no-transform",
  Connection: "keep-alive",
} as const;

// Satu event SSE berformat `data: <json>\n\n` — klien mem-parse per baris.
function eventSSE(payload: Record<string, unknown>): string {
  return `data: ${JSON.stringify(payload)}\n\n`;
}

// Bungkus teks lengkap yang SUDAH ada (degradasi / jawaban deterministik) jadi
// stream SSE satu-pesan, agar klien memakai satu jalur parsing yang sama.
function streamTeks(teks: string, extra: Record<string, unknown> = {}): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(eventSSE({ delta: teks })));
      controller.enqueue(encoder.encode(eventSSE({ done: true, ...extra })));
      controller.close();
    },
  });
  return new Response(stream, { status: 200, headers: SSE_HEADERS });
}

// Pipakan ReadableStream<string> dari LLM ke stream SSE bertoken. Bila stream
// null (provider down) → kirim pesan gangguan + template angka, tetap 200 (§9).
function streamDariLLM(
  streamLLM: ReadableStream<string> | null,
  fallbackTeks: string,
  extra: Record<string, unknown>,
): Response {
  if (!streamLLM) {
    return streamTeks(fallbackTeks, { ...extra, degradasi: true });
  }

  const encoder = new TextEncoder();
  const reader = streamLLM.getReader();
  let adaDelta = false;
  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { done, value } = await reader.read();
        if (done) {
          // Provider menutup tanpa satu pun token → jangan kirim jawaban kosong:
          // pakai template angka (§9) lalu tandai degradasi.
          if (!adaDelta) {
            controller.enqueue(encoder.encode(eventSSE({ delta: fallbackTeks })));
            controller.enqueue(encoder.encode(eventSSE({ done: true, ...extra, degradasi: true })));
          } else {
            controller.enqueue(encoder.encode(eventSSE({ done: true, ...extra })));
          }
          controller.close();
          return;
        }
        if (value) {
          adaDelta = true;
          controller.enqueue(encoder.encode(eventSSE({ delta: value })));
        }
      } catch {
        // Kegagalan baca di tengah stream → tutup bersih dengan pesan gangguan.
        controller.enqueue(encoder.encode(eventSSE({ delta: PESAN_GANGGUAN })));
        controller.enqueue(encoder.encode(eventSSE({ done: true, ...extra, degradasi: true })));
        controller.close();
      }
    },
    cancel() {
      reader.cancel().catch(() => {});
    },
  });
  return new Response(stream, { status: 200, headers: SSE_HEADERS });
}

// POST /api/ai/chat { pertanyaan, riwayat? } → SSE stream jawaban.
export async function POST(req: Request) {
  try {
    // 1. Gate role: kasir / belum login → 401/403 (requireOwnerResponse).
    const denied = await requireOwnerResponse();
    if (denied) return denied;

    // 2. Tenant dari session — SATU-SATUNYA pintu masuk warungId (§1.4).
    const warungId = await currentWarungId();
    const userId = await currentKasirId(warungId);

    // 3. Gate plan/config (§9). Dibedakan agar pesannya jelas.
    if (!getAiConfig().enabled) {
      return NextResponse.json(
        { error: "Fitur Insight belum diaktifkan. Hubungi admin KRING!." },
        { status: 403 },
      );
    }
    if (!(await eligibleUntukAi(warungId))) {
      return NextResponse.json(
        { error: "Fitur Insight hanya untuk plan berbayar." },
        { status: 403 },
      );
    }

    // 4. Rate limit 20/menit/user (§6), fail-open.
    const rate = await checkChatRate(userId);
    if (rate.blocked) {
      return NextResponse.json(
        { error: "Terlalu banyak pertanyaan. Coba lagi sebentar lagi." },
        { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
      );
    }
    await recordChatRequest(userId);

    // 5. Validasi body: pertanyaan wajib, riwayat dipangkas 6 turn (§8).
    const body = await readJson(req);
    if (!body) {
      return NextResponse.json({ error: "Body tidak valid." }, { status: 400 });
    }
    const pertanyaan = str(body.pertanyaan, MAKS_PERTANYAAN);
    if (!pertanyaan) {
      return NextResponse.json({ error: "Pertanyaan wajib diisi." }, { status: 400 });
    }
    const riwayat = pangkasRiwayat(body.riwayat);

    // 6. Audit ringkas (§5): hash + preview ≤120 char, bukan teks penuh.
    const audit = ringkasPertanyaanUntukAudit(pertanyaan);
    void catat({
      warungId,
      userId,
      action: "AI_CHAT",
      meta: {
        hash: audit.hash,
        preview: audit.preview,
        tool: pilihToolDari(pertanyaan)?.tool ?? null,
      },
    });

    // 7. Routing deterministik → tool → siapkan pesan LLM (angka ter-inject
    // warungId dari session; model tak pernah memegangnya).
    const siap = await siapkanChat(warungId, pertanyaan, riwayat);

    if (siap.status === "tak_jelas") {
      // Intent tak jelas → jawab deterministik tanpa LLM (hemat token, §8).
      return streamTeks(siap.text, { tool: null });
    }
    if (siap.status === "tool_gagal") {
      // ToolError (mis. shiftId kosong / beda tenant) → 200 pesan aman, tanpa
      // kebocoran data lintas tenant (§7.2). Bukan 500.
      return streamTeks(siap.text, { tool: siap.tool });
    }

    // 8. STREAM narasi token-per-token (satu kali panggilan LLM — biaya §8).
    // Provider down → template angka + pesan gangguan, tetap 200 (§9).
    const streamLLM = await streamNarrative({
      system: siap.system,
      messages: siap.messages,
      maxTokens: 400,
    });

    return streamDariLLM(streamLLM, siap.fallback, { tool: siap.tool });
  } catch (e) {
    // Error non-AI (mis. DB) tetap dipetakan lewat handleApiError. Kegagalan AI
    // sendiri TIDAK pernah sampai sini (didegradasi di atas, §9).
    return handleApiError(e);
  }
}
