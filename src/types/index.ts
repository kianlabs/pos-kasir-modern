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
  | "SEED_WARUNG";
