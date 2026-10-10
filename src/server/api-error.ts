import { NextResponse } from "next/server";

// Helper error terpusat untuk route API (temuan Q1: panggilan Prisma yang
// membiarkan exception bocor → respons 500 mentah tanpa pesan terformat).
//
// Tanpa dependensi. Pesan selalu berbahasa Indonesia dan konsisten dengan
// bentuk respons lain di aplikasi: { error: string }.

/**
 * Error dengan status HTTP eksplisit. Lempar ini dari dalam handler agar
 * `handleApiError` mengembalikan status/pesan yang terkontrol (bukan 500).
 */
export class ApiError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

/**
 * Respons JSON error dengan status tertentu — pembungkus tipis NextResponse.json.
 */
export function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function isApiError(e: unknown): e is ApiError {
  return (
    e instanceof Error &&
    typeof (e as { status?: unknown }).status === "number"
  );
}

/**
 * Ubah exception tak terduga menjadi respons 500 terkontrol, sekaligus
 * mencatatnya ke console. Bila `e` adalah `ApiError` (punya properti `.status`
 * numerik), status/pesannya dipakai apa adanya.
 */
export function handleApiError(e: unknown, fallback = "Terjadi kesalahan server.") {
  if (isApiError(e)) {
    return jsonError(e.message, e.status);
  }
  console.error("[api]", e);
  return jsonError(fallback, 500);
}
