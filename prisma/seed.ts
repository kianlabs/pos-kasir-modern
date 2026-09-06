import { prisma } from "@/lib/prisma";

const products = [
  { name: "Kopi Tubruk", price: 8000, stock: 50, category: "Minuman" },
  { name: "Es Teh Manis", price: 5000, stock: 50, category: "Minuman" },
  { name: "Indomie Goreng", price: 12000, stock: 40, category: "Makanan" },
  { name: "Nasi Goreng", price: 15000, stock: 30, category: "Makanan" },
  { name: "Ayam Geprek", price: 13000, stock: 25, category: "Makanan" },
  { name: "Roti Bakar", price: 10000, stock: 20, category: "Snack" },
  { name: "Pisang Goreng", price: 9000, stock: 20, category: "Snack" },
  { name: "Air Mineral", price: 4000, stock: 60, category: "Minuman" },
];

async function main() {
  const count = await prisma.product.count();
  if (count > 0) {
    console.log(`Seed dilewati: sudah ada ${count} produk.`);
    return;
  }
  await prisma.product.createMany({ data: products });
  console.log(`Seed OK: ${products.length} produk.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
