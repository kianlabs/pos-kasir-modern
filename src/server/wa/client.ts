// Klien pengiriman WhatsApp PROVIDER-AGNOSTIC (Fase 2 §7a).
//
// DESAIN §7a: outbox `notifikasi` menyimpan pesan siap-kirim TANPA menyentuh
// jaringan (lihat src/server/notif.ts). Modul INI adalah satu-satunya adapter
// yang benar-benar memanggil provider WA. Semua pemanggil berkomunikasi lewat
// `kirimPesanWa()` — bentuk netral { tujuan, pesan } — sehingga menambah/mengganti
// provider cukup di sini, tanpa mengubah pemanggil (send.ts / route).
//
// KEPUTUSAN: pakai `fetch` POLOS (TANPA dependency tambahan) — sejalan dengan
// src/server/ai/llm.ts. Kontrol penuh atas timeout/error, minim dependensi.
//
// PRINSIP DEGRADASI (§9, §1.1): fungsi ini TIDAK PERNAH MELEMPAR. Provider down /
// timeout / respons cacat → `{ ok: false, error }`; pemanggil WAJIB menanganinya
// sebagai kegagalan yang terlihat (status GAGAL), BUKAN error 500. WA bukan di
// jalur kasir — kegagalannya tak boleh mematikan transaksi.

import { getWaConfig } from "@/server/wa/config";

// Batas waktu satu panggilan provider (ms). Timeout → AbortController → ok:false.
const TIMEOUT_MS = 15_000;

export type KirimPesanWaInput = {
  /** Nomor tujuan (format bebas; provider yang menormalkan). */
  tujuan: string;
  /** Isi pesan (plain text — hasil renderLaporanShift / struk). */
  pesan: string;
};

// Hasil netral dari semua adapter: sukses + id provider opsional, atau gagal + alasan.
export type KirimPesanWaResult =
  | { ok: true; providerId?: string }
  | { ok: false; error: string };

// ── Adapter Fonnte ──────────────────────────────────────────────────────────
//
// Fonnte: POST {baseUrl}/send, header Authorization: <token> (token polos, BUKAN
// "Bearer"), body JSON { target, message }. Respons sukses: { status: true, ... }.
async function kirimViaFonnte(input: KirimPesanWaInput): Promise<KirimPesanWaResult> {
  const cfg = getWaConfig();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(`${cfg.baseUrl}/send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Fonnte memakai token polos di header Authorization (tanpa "Bearer").
        Authorization: cfg.token,
      },
      body: JSON.stringify({ target: input.tujuan, message: input.pesan }),
      signal: controller.signal,
    });

    if (!res.ok) {
      return { ok: false, error: `Provider WA menolak permintaan (HTTP ${res.status}).` };
    }

    // Fonnte mengembalikan JSON; anggap sukses bila `status` benar-benar true.
    const json = (await res.json()) as {
      status?: boolean;
      id?: string | number | string[];
      detail?: string;
    };
    if (json.status !== true) {
      return { ok: false, error: json.detail ?? "Fonnte menolak pengiriman." };
    }

    const providerId =
      Array.isArray(json.id) ? json.id[0] : json.id !== undefined ? String(json.id) : undefined;
    return { ok: true, providerId };
  } catch (e) {
    // AbortError (timeout) atau kegagalan jaringan — dua-duanya degradasi.
    const pesan =
      e instanceof Error && e.name === "AbortError"
        ? "Waktu tunggu provider WA habis."
        : "Gagal menghubungi provider WA.";
    return { ok: false, error: pesan };
  } finally {
    clearTimeout(timeout);
  }
}

// ── Adapter WhatsApp Cloud API (Meta Graph API) ─────────────────────────────
//
// Generik: POST {baseUrl}/messages, header Authorization: Bearer <token>,
// body { messaging_product, to, type: "text", text: { body } }. Sukses:
// { messages: [{ id }] }. Cocok untuk Meta Cloud API maupun gateway sejenis
// yang mengikuti bentuk Graph API.
async function kirimViaCloudApi(input: KirimPesanWaInput): Promise<KirimPesanWaResult> {
  const cfg = getWaConfig();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(`${cfg.baseUrl}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${cfg.token}`,
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: input.tujuan,
        type: "text",
        text: { body: input.pesan },
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      return { ok: false, error: `Provider WA menolak permintaan (HTTP ${res.status}).` };
    }

    const json = (await res.json()) as {
      messages?: { id?: string }[];
      error?: { message?: string };
    };
    if (json.error) {
      return { ok: false, error: json.error.message ?? "Cloud API menolak pengiriman." };
    }

    return { ok: true, providerId: json.messages?.[0]?.id };
  } catch (e) {
    const pesan =
      e instanceof Error && e.name === "AbortError"
        ? "Waktu tunggu provider WA habis."
        : "Gagal menghubungi provider WA.";
    return { ok: false, error: pesan };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Kirim satu pesan WhatsApp lewat provider yang dikonfigurasi.
 *
 * Tidak pernah melempar (§9). Semua kegagalan → `{ ok: false, error }`:
 *  - WA tidak dikonfigurasi (flag OFF / provider none / token kosong),
 *  - tujuan kosong,
 *  - timeout / jaringan gagal,
 *  - respons non-2xx / respons cacat.
 *
 * Pemanggil (send.ts) WAJIB menangani cabang `ok: false` dengan menandai baris
 * notifikasi GAGAL — bukan error 500.
 */
export async function kirimPesanWa(input: KirimPesanWaInput): Promise<KirimPesanWaResult> {
  const cfg = getWaConfig();
  if (!cfg.enabled) {
    return { ok: false, error: "WhatsApp belum dikonfigurasi." };
  }

  const tujuan = input.tujuan.trim();
  if (tujuan.length === 0) {
    return { ok: false, error: "Nomor tujuan kosong." };
  }

  if (cfg.provider === "fonnte") {
    return kirimViaFonnte({ tujuan, pesan: input.pesan });
  }
  if (cfg.provider === "cloud_api") {
    return kirimViaCloudApi({ tujuan, pesan: input.pesan });
  }

  // Provider tak dikenal seharusnya sudah ter-filter oleh config (→ tidak enabled).
  return { ok: false, error: "Provider WhatsApp tidak didukung." };
}
