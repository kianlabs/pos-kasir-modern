import type { LucideIcon } from "lucide-react";
import {
  ShoppingCart,
  UtensilsCrossed,
  ReceiptText,
  Clock,
  ClipboardList,
  Package,
  Tag,
  BarChart3,
  Activity,
  Sparkles,
  Bell,
  Settings,
} from "lucide-react";
import type { Role } from "@/types";

// Definisi menu navigasi — SATU sumber kebenaran untuk sidebar desktop,
// top-bar mobile (fallback), dan bottom-nav mobile. PRD §6.2: kasir hanya
// jualan + lihat shift/stok/transaksi; owner dapat semua termasuk produk,
// laporan, pengaturan.
//
// Ikon = komponen Lucide monokrom (bukan emoji) agar konsisten lintas OS
// dan menyatu dengan tema monokrom.
export type NavItem = { href: string; label: string; icon: LucideIcon; roles: Role[] };

export const NAV: NavItem[] = [
  { href: "/kasir", label: "Kasir", icon: ShoppingCart, roles: ["OWNER", "KASIR"] },
  { href: "/meja", label: "Meja", icon: UtensilsCrossed, roles: ["OWNER", "KASIR"] },
  { href: "/transaksi", label: "Transaksi", icon: ReceiptText, roles: ["OWNER", "KASIR"] },
  { href: "/shift", label: "Shift", icon: Clock, roles: ["OWNER", "KASIR"] },
  { href: "/stok", label: "Stok", icon: ClipboardList, roles: ["OWNER", "KASIR"] },
  { href: "/produk", label: "Produk", icon: Package, roles: ["OWNER"] },
  { href: "/promo", label: "Promo", icon: Tag, roles: ["OWNER"] },
  { href: "/laporan", label: "Laporan", icon: BarChart3, roles: ["OWNER"] },
  // Dashboard live owner (Fase 2 §7a) — pantau penjualan realtime dari HP.
  { href: "/dashboard", label: "Live", icon: Activity, roles: ["OWNER"] },
  // Owner-only (lampiran AI §1.3): kasir tak pernah melihat tautan ini;
  // proxy + handler juga menolak aksesnya.
  { href: "/insight", label: "Insight", icon: Sparkles, roles: ["OWNER"] },
  { href: "/notifikasi", label: "Notifikasi", icon: Bell, roles: ["OWNER"] },
  { href: "/pengaturan", label: "Pengaturan", icon: Settings, roles: ["OWNER"] },
];

// Item navigasi yang relevan untuk role tertentu.
export function navForRole(role: Role): NavItem[] {
  return NAV.filter((n) => n.roles.includes(role));
}

// Menu utama yang selalu tampil di bottom-nav mobile. Sisanya (owner-only
// seperti Produk/Laporan/Pengaturan) masuk ke menu "Lainnya" agar tak
// berdesakan di layar sempit — pola standar app mobile.
const BOTTOM_PRIMARY = ["/kasir", "/meja", "/transaksi", "/shift"];

export function bottomPrimary(role: Role): NavItem[] {
  return navForRole(role)
    .filter((n) => BOTTOM_PRIMARY.includes(n.href))
    .sort((a, b) => BOTTOM_PRIMARY.indexOf(a.href) - BOTTOM_PRIMARY.indexOf(b.href));
}

export function bottomOverflow(role: Role): NavItem[] {
  return navForRole(role).filter((n) => !BOTTOM_PRIMARY.includes(n.href));
}

// Apakah href cocok dengan path aktif (untuk highlight nav).
export function isNavActive(href: string, path: string): boolean {
  return href === "/" ? path === "/" : path.startsWith(href);
}
