// Tipe bersama untuk mode offline-first (Tahap 4).
//
// Prinsip (PRD §10, §12):
// - Transaksi offline dibuat di tablet dengan UUID client-side SEBELUM dikirim
//   → server `upsert` by id → idempotent (retry aman, anti duplikat).
// - warungId TIDAK pernah ikut payload offline: server selalu ambil dari session
//   (aturan #8). Payload hanya berisi apa yang kasir butuhkan untuk jualan.
// - Last-write-wins per transaksi (bukan merge field-level).

import type { AuditAction } from "@/types";

/** Satu item di keranjang checkout offline. */
export type OutboxItemLine = {
  productId: string;
  qty: number;
};

/** Payload checkout yang disimpan di antrean IndexedDB. */
export type OutboxPayload = {
  items: OutboxItemLine[];
  cash: number;
  payment: "CASH" | "QRIS";
  discount: number;
  mejaId?: string | null;
};

/** Status satu entri antrean. */
export type OutboxStatus = "pending" | "syncing" | "conflict" | "error";

/**
 * Satu transaksi offline di antrean (object store `outbox`).
 * `id` = UUID client-side = calon Transaction.id di server.
 */
export type OutboxEntry = {
  id: string;
  payload: OutboxPayload;
  createdAt: number; // epoch ms, kapan dibuat di tablet
  status: OutboxStatus;
  /** Pesan kesalahan terakhir (bila status "error"/"conflict"). */
  lastError?: string;
  /** Berapa kali sudah dicoba sync. */
  attempts: number;
};

/** Hasil satu item dari endpoint /api/sync. */
export type SyncItemResult = {
  id: string;
  status: "ok" | "conflict" | "error";
  serverId?: string;
  message?: string;
};

/** Hasil batch dari endpoint /api/sync. */
export type SyncBatchResponse = {
  results: SyncItemResult[];
  synced: number;
  conflicts: number;
  errors: number;
};

/** Aksi audit yang dipakai modul offline (mempermudah grep & type-safety). */
export const OFFLINE_AUDIT_ACTIONS: AuditAction[] = ["SYNC_BATCH", "SYNC_CONFLICT"];
