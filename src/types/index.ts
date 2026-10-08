// src/types/index.ts — satu-satunya sumber kebenaran nilai status
export type Role = "OWNER" | "KASIR";
export type StatusWarung = "TRIAL" | "ACTIVE" | "SUSPENDED";
export type StatusMeja = "KOSONG" | "TERISI";   // nilai derive, bukan kolom
export type StatusTransaksi = "DRAFT" | "LUNAS";
export type StatusShift = "BUKA" | "TUTUP";
export type TipeStockMove = "PENJUALAN" | "KULAKAN" | "KOREKSI" | "STOK_AWAL";