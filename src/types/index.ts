// src/types/index.ts — satu-satunya sumber kebenaran nilai status
export type Role = "OWNER" | "KASIR";
export type StatusWarung = "TRIAL" | "ACTIVE" | "SUSPENDED";
export type StatusMeja = "KOSONG" | "TERISI";   // nilai derive, bukan kolom
export type StatusTransaksi = "DRAFT" | "LUNAS";
export type StatusShift = "BUKA" | "TUTUP";
export type TipeStockMove = "PENJUALAN" | "KULAKAN" | "KOREKSI" | "STOK_AWAL";

// Nilai AuditLog.action yang dipakai aplikasi (lampiran skema §2 aturan #10).
export type AuditAction =
  | "LOGIN_OK"
  | "LOGIN_FAIL"
  | "LOGOUT"
  | "PRICE_CHANGE"
  | "STOCK_KOREKSI"
  | "SHIFT_OPEN"
  | "SHIFT_CLOSE"
  | "SETTING_CHANGE"
  | "DELETE_PRODUCT"
  | "SEED_WARUNG"
  // Manajemen meja / bill DRAFT (Tahap 3)
  | "MEJA_BUKA"
  | "MEJA_BAYAR"
  | "MEJA_BATAL"
  | "MEJA_GABUNG"
  | "MEJA_PISAH"
  // Sinkronisasi offline (Tahap 4)
  | "SYNC_BATCH" // batch transaksi offline diterima server
  | "SYNC_CONFLICT" // transaksi offline diterima tapi stok kurang saat sync
  | "SYNC_MONEY_RECOMPUTED" // total client diterima → diskon/pajak tersimpan beda dari formula normal
  | "SYNC_ORPHAN_SHIFT" // transaksi offline tanpa shift / di luar jendela shift yang dipilih
  // Checkout ONLINE tanpa shift BUKA (M3) — dijual saat tak ada shift terbuka,
  // jadi kasnya tak bisa direkonsiliasi. "Tandai, jangan blokir" (offline-safe).
  | "CHECKOUT_TANPA_SHIFT"
  // Fitur AI "KRING! Insight" (lampiran AI §5): chat owner. Teks chat TIDAK
  // disimpan penuh — hanya hash + preview ≤120 char di meta (privasi & biaya log).
  | "AI_CHAT";
