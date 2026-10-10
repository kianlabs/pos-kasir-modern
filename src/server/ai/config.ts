// Konfigurasi provider LLM untuk "KRING! Insight" (lampiran AI §2).
//
// SATU-SATUNYA tempat env provider dibaca (lampiran §2 aturan 3: "semua env
// provider — 1 tempat, tanpa hardcode di kode"). Modul lain HANYA boleh
// memanggil `getAiConfig()` / `isAiConfigured()`; jangan baca `process.env.AI_*`
// di tempat lain.
//
// Fail-safe (lampiran §9 + prinsip §1.1): bila `AI_ENABLED` bukan "true", ATAU
// API key kosong, ATAU base URL kosong → `enabled: false`. Fitur AI boleh mati
// tanpa memengaruhi kasir; modul ini murni baca env (tanpa I/O DB), jadi AMAN
// diimpor kapan pun — tidak akan crash saat AI tidak dikonfigurasi.

import type { AiConfig, AiProvider } from "@/server/ai/types";

// Default base URL Tier 1 (gateway pribadi pilot). Tetap bisa dioverride env;
// URL dev lokal (Tailscale/LAN) tidak di-hardcode — set via AI_BASE_URL.
const DEFAULT_BASE_URL = "https://llm.kianlabs.my.id/v1";

// Provider default = Tier 1 (pilot). Lihat lampiran §2 tabel keputusan.
const DEFAULT_PROVIDER: AiProvider = "9router";

// Model default kelas kecil-murah (narasi & chat ringan). Nama model dipilih
// dari katalog allowlist; JANGAN masukkan nama model ke prompt user (§2.3).
const DEFAULT_MODEL = "gemini-2.0-flash";

// Normalisasi nilai provider: hanya "9router" | "managed" yang valid. Nilai
// lain (mis. salah ketik) → fallback ke default agar perilaku deterministik.
function normalisasiProvider(v: string | undefined): AiProvider {
  const s = (v ?? "").trim().toLowerCase();
  if (s === "managed") return "managed";
  if (s === "9router") return "9router";
  return DEFAULT_PROVIDER;
}

// Buang garis miring di ujung base URL agar penggabungan path ("/chat/completions")
// tidak menghasilkan "//". Base URL diharapkan TANPA suffix chat/completions.
function rapikanBaseUrl(v: string): string {
  return v.replace(/\/+$/, "");
}

/**
 * Baca konfigurasi AI dari env dan kembalikan bentuk efektif siap-pakai.
 *
 * Tidak pernah melempar. `enabled` sudah mengevaluasi flag global + kelengkapan
 * kredensial; pemanggil cukup memeriksa `enabled` sebelum melakukan apa pun.
 */
export function getAiConfig(): AiConfig {
  const provider = normalisasiProvider(process.env.AI_PROVIDER);

  const enabledFlag = (process.env.AI_ENABLED ?? "").trim().toLowerCase() === "true";
  const apiKey = (process.env.AI_API_KEY ?? "").trim();
  const baseUrl = rapikanBaseUrl((process.env.AI_BASE_URL ?? DEFAULT_BASE_URL).trim());
  const model = (process.env.AI_MODEL ?? DEFAULT_MODEL).trim() || DEFAULT_MODEL;

  // Fail-safe OFF: flag tidak aktif, key kosong, atau base URL kosong.
  const enabled = enabledFlag && apiKey.length > 0 && baseUrl.length > 0;

  return { enabled, provider, baseUrl, apiKey, model };
}

/**
 * Cek ringkas apakah AI siap dipakai (flag global ON + kredensial lengkap).
 * Dipakai endpoint/gating agar tidak perlu menyentuh detail config.
 */
export function isAiConfigured(): boolean {
  return getAiConfig().enabled;
}
