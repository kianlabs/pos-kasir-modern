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
  CircleDollarSign,
  CreditCard,
  Send,
  TrendingUp,
  TrendingDown,
  MessageSquare,
  TriangleAlert,
  FileText,
  Soup,
  Salad,
  Beef,
  Fish,
  Drumstick,
  EggFried,
  Sandwich,
  Cookie,
  CakeSlice,
  IceCreamCone,
  CupSoda,
  Coffee,
  Milk,
  GlassWater,
  Wine,
  Beer,
} from "lucide-react";

// Ikon navigasi & UI — SATU sumber kebenaran (menggantikan emoji + Material
// Symbols). Semua ikon monokrom (currentColor) via lucide-react: konsisten
// lintas OS DAN offline-safe (SVG inline, bukan font eksternal).
export const UI = {
  kasir: ShoppingCart,
  meja: UtensilsCrossed,
  transaksi: ReceiptText,
  shift: Clock,
  stok: ClipboardList,
  produk: Package,
  promo: Tag,
  laporan: BarChart3,
  live: Activity,
  insight: Sparkles,
  notifikasi: Bell,
  pengaturan: Settings,
} as const;

// Ikon per kategori produk (pengganti emoji kategori). Fallback: Package.
export const CATEGORY_ICON: Record<string, LucideIcon> = {
  Nasi: UtensilsCrossed,
  Mie: Soup,
  Lauk: Drumstick,
  Sayur: Salad,
  Gorengan: Cookie,
  Minuman: CupSoda,
  Jajanan: CakeSlice,
  Umum: Package,
};

export function categoryIcon(cat: string): LucideIcon {
  return CATEGORY_ICON[cat] ?? Package;
}

// Peta nama ikon produk (string tersimpan di DB) → komponen Lucide.
export const PRODUCT_ICON_MAP: Record<string, LucideIcon> = {
  UtensilsCrossed,
  Soup,
  Salad,
  Beef,
  Fish,
  Drumstick,
  EggFried,
  Sandwich,
  Cookie,
  CakeSlice,
  IceCreamCone,
  CupSoda,
  Coffee,
  Milk,
  GlassWater,
  Wine,
  Beer,
  Package,
};

// Pilihan ikon pada form produk (nama Lucide, bukan emoji).
export const PRODUCT_ICON_CHOICES = Object.keys(PRODUCT_ICON_MAP);

// Ikon produk: pakai ikon tersimpan bila valid, jika tidak fallback ke kategori.
export function productIcon(p: { icon?: string | null; category: string }): LucideIcon {
  if (p.icon && PRODUCT_ICON_MAP[p.icon]) return PRODUCT_ICON_MAP[p.icon];
  return categoryIcon(p.category);
}

export const PAYMENT_LABEL: Record<string, string> = {
  CASH: "Tunai",
  QRIS: "QRIS",
};

export const PAYMENT_ICON: Record<string, LucideIcon> = {
  CASH: CircleDollarSign,
  QRIS: CreditCard,
};

export function shortId(id: string): string {
  return id.slice(0, 8).toUpperCase();
}

// Ikon status bersama (dipakai lintas halaman).
export const STATUS = {
  success: TrendingUp,
  danger: TrendingDown,
  warn: TriangleAlert,
  info: MessageSquare,
  send: Send,
  doc: FileText,
} as const;
