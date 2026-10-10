// Tipe bersama untuk fitur "KRING! Insight" (lampiran AI §2–§5).
//
// File ini TIDAK menyentuh DB/jaringan — murni tipe agar aman diimpor dari
// mana pun di `src/server/ai/*` (dan dari endpoint yang menyusul). Sumber
// kebenaran bentuk konfigurasi provider, hasil narasi, dan kontrak tool ada
// di sini supaya antarmuka antar-modul stabil untuk pekerjaan paralel.

// ── Kontrak tool (allowlist tertutup, lampiran §3) ──────────────────────────
//
// Nama tool HARUS persis salah satu dari union ini. Menambah tool = lewat
// review lampiran (§3: "tidak ada tool baru tanpa lewat review lampiran ini"),
// jadi union ini sengaja kaku dan dijadikan satu-satunya referensi nama.
export type ToolName =
  | "getRingkasanHari"
  | "getRekapShift"
  | "getStokMenipis"
  | "getPenjualanProduk"
  | "getPenjualanKasir"
  | "getTren"
  | "getAnomaliAktif";

// ── Jenis Insight (lampiran §5) ─────────────────────────────────────────────
//
// Kolom `Insight.type` = String + const union (bukan enum Prisma) karena dev
// dulu SQLite. NARRATIVE = narasi tutup-shift; ANOMALY = temuan rules §4;
// CHAT_SUMMARY = ringkasan dari jalur chat owner.
export type InsightType = "NARRATIVE" | "ANOMALY" | "CHAT_SUMMARY";

// ── Provider LLM (lampiran §2, keputusan 2-tier) ────────────────────────────
//
// Tier 1 = `9router` (gateway pribadi, OpenAI-compatible, biaya Rp0, pilot).
// Tier 2 = `managed` (provider berbayar per token, go-public). Nilai apa pun
// selain kedua ini diperlakukan sebagai tidak valid → fitur fail-safe OFF.
export type AiProvider = "9router" | "managed";

// Konfigurasi efektif setelah dibaca dari env (src/server/ai/config.ts).
// `enabled` sudah merupakan hasil evaluasi fail-safe: false bila AI_ENABLED
// bukan "true" ATAU API key kosong ATAU base URL kosong.
export type AiConfig = {
  enabled: boolean;
  provider: AiProvider;
  /** Base URL OpenAI-compatible, mis. https://llm.kianlabs.my.id/v1 — TANPA /chat/completions. */
  baseUrl: string;
  /** API key provider. Kosong = fitur OFF (fail-safe). */
  apiKey: string;
  /** Nama model yang dipilih dari katalog allowlist (§2 aturan 3). */
  model: string;
};

// ── Hasil pemanggilan narasi LLM (lampiran §9: degradasi) ───────────────────
//
// FUNGSI LLM TIDAK PERNAH MELEMPAR. Provider down / timeout / respons cacat →
// `{ ok: false, error }`, dan pemanggil WAJIB memakai fallback template angka
// (§2, §9) — bukan error 500. Bentuk discriminated union memaksa pemanggil
// menangani kedua cabang.
export type UsageInfo = {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
};

export type NarrativeResult =
  | { ok: true; text: string; usage?: UsageInfo }
  | { ok: false; error: string };

// Satu pesan dalam percakapan yang dikirim ke endpoint chat/completions.
export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

// ── Temuan rules anomali (lampiran §4) ──────────────────────────────────────
//
// Dihitung MURNI oleh kode deterministik (bukan model); AI hanya merangkai
// kalimat. `bukti` = angka yang bisa diverifikasi owner (lampiran §1.6).
export type AnomaliRule =
  | "DISKON_BESAR"
  | "SELISIH_KAS_NEGATIF"
  | "TRANSAKSI_LUAR_JAM"
  | "OMZET_ANJLOK"
  | "TRX_TANPA_SHIFT"
  | "CHECKOUT_ANEH";

export type AnomaliSeverity = "tinggi" | "sedang" | "rendah";

export type TemuanAnomali = {
  rule: AnomaliRule;
  severity: AnomaliSeverity;
  bukti: string;
  angka: Record<string, number>;
};
