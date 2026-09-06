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

export const PAYMENT_LABEL: Record<string, string> = {
  CASH: "Tunai",
  QRIS: "QRIS",
  HUTANG: "Hutang",
};

export function shortId(id: string): string {
  return id.slice(0, 8).toUpperCase();
}
