import { prisma } from "@/lib/prisma";

// Menu warung makan umum: nasi, mie, lauk, sayur, gorengan, minuman.
// Harga dalam rupiah, realistis untuk warung 2026.
const products = [
  { name: "Bakwan", price: 2000, stock: 49, category: "Gorengan", icon: "🥟" },
  { name: "Cireng", price: 2000, stock: 40, category: "Gorengan", icon: "🍡" },
  { name: "Pisang Goreng", price: 9000, stock: 18, category: "Gorengan", icon: "🍌" },
  { name: "Tahu Isi", price: 2000, stock: 50, category: "Gorengan", icon: "🧆" },
  { name: "Tempe Mendoan", price: 2500, stock: 37, category: "Gorengan", icon: "🍘" },
  { name: "Roti Bakar", price: 10000, stock: 19, category: "Jajanan", icon: "🍞" },
  { name: "Ayam Bakar", price: 12000, stock: 24, category: "Lauk", icon: "🍖" },
  { name: "Ayam Geprek", price: 13000, stock: 23, category: "Lauk", icon: "🌶️" },
  { name: "Ayam Goreng", price: 10000, stock: 30, category: "Lauk", icon: "🍗" },
  { name: "Lele Goreng", price: 8000, stock: 25, category: "Lauk", icon: "🐟" },
  { name: "Perkedel", price: 3000, stock: 30, category: "Lauk", icon: "🥔" },
  { name: "Tahu Bacem", price: 3000, stock: 40, category: "Lauk", icon: "🍢" },
  { name: "Telur Balado", price: 7000, stock: 25, category: "Lauk", icon: "🍅" },
  { name: "Telur Dadar", price: 6000, stock: 30, category: "Lauk", icon: "🍳" },
  { name: "Tempe Orek", price: 5000, stock: 30, category: "Lauk", icon: "🥜" },
  { name: "Indomie Goreng", price: 12000, stock: 40, category: "Mie", icon: "🍝" },
  { name: "Indomie Goreng + Telur", price: 15000, stock: 30, category: "Mie", icon: "🥚" },
  { name: "Indomie Rebus", price: 12000, stock: 40, category: "Mie", icon: "🥣" },
  { name: "Kwetiau Goreng", price: 15000, stock: 20, category: "Mie", icon: "🥘" },
  { name: "Mie Ayam", price: 13000, stock: 25, category: "Mie", icon: "🍜" },
  { name: "Air Mineral", price: 4000, stock: 59, category: "Minuman", icon: "💧" },
  { name: "Es Jeruk", price: 6000, stock: 39, category: "Minuman", icon: "🍊" },
  { name: "Es Kopi Susu", price: 12000, stock: 30, category: "Minuman", icon: "🧋" },
  { name: "Es Teh Manis", price: 5000, stock: 49, category: "Minuman", icon: "🥤" },
  { name: "Jahe Hangat", price: 6000, stock: 25, category: "Minuman", icon: "🫖" },
  { name: "Kopi Susu", price: 10000, stock: 30, category: "Minuman", icon: "🥛" },
  { name: "Kopi Tubruk", price: 8000, stock: 50, category: "Minuman", icon: "☕" },
  { name: "Teh Hangat", price: 4000, stock: 60, category: "Minuman", icon: "🍵" },
  { name: "Lontong Sayur", price: 12000, stock: 20, category: "Nasi", icon: "🍲" },
  { name: "Nasi Campur", price: 13000, stock: 25, category: "Nasi", icon: "🥘" },
  { name: "Nasi Goreng", price: 15000, stock: 30, category: "Nasi", icon: "🍛" },
  { name: "Nasi Goreng Spesial", price: 20000, stock: 20, category: "Nasi", icon: "🍽️" },
  { name: "Nasi Putih", price: 5000, stock: 100, category: "Nasi", icon: "🍚" },
  { name: "Nasi Uduk", price: 10000, stock: 25, category: "Nasi", icon: "🍙" },
  { name: "Capcay", price: 8000, stock: 15, category: "Sayur", icon: "🥗" },
  { name: "Sayur Asem", price: 6000, stock: 20, category: "Sayur", icon: "🌽" },
  { name: "Sayur Lodeh", price: 7000, stock: 20, category: "Sayur", icon: "🥥" },
  { name: "Tumis Kangkung", price: 7000, stock: 20, category: "Sayur", icon: "🥬" }
];

async function main() {
  const trxCount = await prisma.transaction.count();
  if (trxCount > 0) {
    console.log("Seed dilewati: sudah ada transaksi, menu tidak direset.");
    return;
  }
  // Reset menu (aman karena belum ada transaksi)
  await prisma.product.deleteMany();
  await prisma.product.createMany({ data: products });
  console.log(`Seed OK: ${products.length} menu warung.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
