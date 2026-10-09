export const CATEGORY_ICON: Record<string, string> = {
  Nasi: "🍚",
  Mie: "🍜",
  Lauk: "🍗",
  Sayur: "🥬",
  Gorengan: "🍤",
  Minuman: "🥤",
  Jajanan: "🍰",
  Umum: "📦",
};

export function categoryIcon(cat: string): string {
  return CATEGORY_ICON[cat] ?? "📦";
}

// Ikon per produk; fallback ke ikon kategori bila kosong.
export function productIcon(p: { icon?: string | null; category: string }): string {
  return p.icon || categoryIcon(p.category);
}

// Pilihan emoji untuk form produk
export const ICON_CHOICES = [
  "🍚", "🍛", "🍙", "🍳", "🥚", "🍜", "🍝", "🥣", "🥘", "🍲",
  "🍗", "🍖", "🐟", "🌶️", "🍅", "🥔", "🥜", "🍢",
  "🥬", "🥗", "🌽", "🥥",
  "🥟", "🍌", "🧆", "🍘", "🍡", "🍞", "🍽️",
  "🥤", "🍵", "🍊", "☕", "🥛", "🧋", "💧", "🫖",
  "📦",
];

export const PAYMENT_LABEL: Record<string, string> = {
  CASH: "Tunai",
  QRIS: "QRIS",
};

export function shortId(id: string): string {
  return id.slice(0, 8).toUpperCase();
}
