// Konfigurasi provider WhatsApp untuk pengiriman notifikasi (Fase 2 §7a).
//
// SATU-SATUNYA tempat env WA dibaca (prinsip sama dengan src/server/ai/config.ts:
// "semua env provider — 1 tempat, tanpa hardcode di kode"). Modul lain HANYA
// boleh memanggil `getWaConfig()` / `isWaConfigured()`; jangan baca
// `process.env.WA_*` di tempat lain.
//
// Fail-safe (prinsip §1.1 + §9): bila `WA_ENABLED` bukan "true", ATAU provider
// "none", ATAU token kosong → `enabled: false`. Pengiriman WA boleh mati tanpa
// memengaruhi kasir; modul ini murni baca env (tanpa I/O jaringan/DB), jadi AMAN
// diimpor kapan pun — tidak akan crash saat WA belum dikonfigurasi.

// Provider yang didukung. "none" = tidak ada adapter (pengiriman dilewati).
export type WaProvider = "fonnte" | "cloud_api" | "none";

export type WaConfig = {
  /** Flag global efektif + kelengkapan kredensial. false = jangan kirim apa pun. */
  enabled: boolean;
  /** Adapter yang dipakai ("fonnte" | "cloud_api" | "none"). */
  provider: WaProvider;
  /** Token/API key provider (kosong = belum dikonfigurasi). */
  token: string;
  /** Base URL efektif (default per provider, bisa dioverride `WA_BASE_URL`). */
  baseUrl: string;
};

// Base URL default per provider (bisa dioverride `WA_BASE_URL`).
//  - fonnte    : endpoint kirim global Fonnte.
//  - cloud_api : Graph API WhatsApp Cloud (Meta) — path "/messages" ditambahkan di client.
const DEFAULT_FONNTE_BASE_URL = "https://api.fonnte.com";
const DEFAULT_CLOUD_API_BASE_URL = "https://graph.facebook.com/v21.0";

// Normalisasi nilai provider: hanya "fonnte" | "cloud_api" | "none" yang valid.
// Nilai lain (mis. salah ketik) → "none" agar perilaku deterministik (fail-safe).
function normalisasiProvider(v: string | undefined): WaProvider {
  const s = (v ?? "").trim().toLowerCase();
  if (s === "fonnte") return "fonnte";
  if (s === "cloud_api") return "cloud_api";
  if (s === "none") return "none";
  return "none";
}

// Buang garis miring di ujung base URL agar penggabungan path ("/send") tidak
// menghasilkan "//".
function rapikanBaseUrl(v: string): string {
  return v.replace(/\/+$/, "");
}

// Base URL default sesuai provider terpilih.
function defaultBaseUrl(provider: WaProvider): string {
  if (provider === "fonnte") return DEFAULT_FONNTE_BASE_URL;
  if (provider === "cloud_api") return DEFAULT_CLOUD_API_BASE_URL;
  return "";
}

/**
 * Baca konfigurasi WA dari env dan kembalikan bentuk efektif siap-pakai.
 *
 * Tidak pernah melempar. `enabled` sudah mengevaluasi flag global + provider
 * terpilih + kelengkapan token; pemanggil cukup memeriksa `enabled`.
 */
export function getWaConfig(): WaConfig {
  const provider = normalisasiProvider(process.env.WA_PROVIDER);

  const enabledFlag = (process.env.WA_ENABLED ?? "").trim().toLowerCase() === "true";
  const token = (process.env.WA_API_TOKEN ?? "").trim();
  const baseUrl = rapikanBaseUrl(
    (process.env.WA_BASE_URL ?? defaultBaseUrl(provider)).trim(),
  );

  // Fail-safe OFF: flag tidak aktif, provider "none", token kosong, atau base URL kosong.
  const enabled =
    enabledFlag && provider !== "none" && token.length > 0 && baseUrl.length > 0;

  return { enabled, provider, token, baseUrl };
}

/**
 * Cek ringkas apakah WA siap dipakai (flag global ON + provider terpilih +
 * kredensial lengkap). Dipakai route/gating agar tidak perlu menyentuh detail.
 */
export function isWaConfigured(): boolean {
  return getWaConfig().enabled;
}
