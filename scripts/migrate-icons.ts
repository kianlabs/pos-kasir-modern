// Migrasi sekali-jalan: ubah kolom Product.icon dari emoji (data lama) menjadi
// nama ikon Lucide (sistem ikon baru di src/shared/icons.ts). Idempoten —
// baris yang sudah berupa nama Lucide dilewati.
//
// Jalankan: npx tsx scripts/migrate-icons.ts
import { PrismaClient } from "@prisma/client";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

if (!process.env.DIRECT_URL) {
  const envPath = resolve(process.cwd(), ".env");
  if (existsSync(envPath)) {
    for (const line of readFileSync(envPath, "utf8").split("\n")) {
      const m = line.match(/^([A-Z_]+)="?([^"\n]*)"?$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
    }
  }
}

const prisma = new PrismaClient({
  datasourceUrl: process.env.DIRECT_URL || process.env.DATABASE_URL,
});

const MAP: Record<string, string> = {
  "🥟": "Cookie", "🍡": "Cookie", "🍌": "Cookie", "🧆": "Cookie", "🍘": "Cookie",
  "🍞": "Sandwich", "🍖": "Drumstick", "🌶️": "Drumstick", "🍗": "Drumstick",
  "🐟": "Fish", "🥔": "Cookie", "🍢": "Cookie", "🍅": "EggFried", "🍳": "EggFried",
  "🥜": "Cookie", "🍝": "Soup", "🥚": "EggFried", "🥣": "Soup", "🥘": "Soup",
  "🍜": "Soup", "💧": "GlassWater", "🍊": "CupSoda", "🧋": "Coffee", "🥤": "CupSoda",
  "🫖": "Coffee", "🥛": "Coffee", "☕": "Coffee", "🍵": "Coffee", "🍲": "Soup",
  "🍛": "UtensilsCrossed", "🍽️": "UtensilsCrossed", "🍚": "UtensilsCrossed",
  "🍙": "UtensilsCrossed", "🥗": "Salad", "🌽": "Soup", "🥥": "Soup", "🥬": "Salad",
};

// Nama Lucide valid (harus sinkron dengan PRODUCT_ICON_MAP di src/shared/icons.ts).
const VALID = new Set([
  "UtensilsCrossed", "Soup", "Salad", "Beef", "Fish", "Drumstick", "EggFried",
  "Sandwich", "Cookie", "CakeSlice", "IceCreamCone", "CupSoda", "Coffee", "Milk",
  "GlassWater", "Wine", "Beer", "Package",
]);

async function main() {
  const produk = await prisma.product.findMany({ select: { id: true, icon: true } });
  let ubah = 0;
  let fallback = 0;
  for (const p of produk) {
    if (!p.icon || VALID.has(p.icon)) continue; // kosong / sudah nama Lucide
    const nama = MAP[p.icon] ?? "Package";
    if (!MAP[p.icon]) fallback++;
    await prisma.product.update({ where: { id: p.id }, data: { icon: nama } });
    ubah++;
  }
  console.log(`[MIGRASI IKON] total produk: ${produk.length}, diubah: ${ubah}, fallback Package: ${fallback}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
