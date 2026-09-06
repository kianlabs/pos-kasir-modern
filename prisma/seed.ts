import { prisma } from "@/lib/prisma";

// Menu warung makan umum: nasi, mie, lauk, sayur, gorengan, minuman.
// Harga dalam rupiah, realistis untuk warung 2026.
const products = [
  // Nasi
  { name: "Nasi Putih", price: 5000, stock: 100, category: "Nasi" },
  { name: "Nasi Goreng", price: 15000, stock: 30, category: "Nasi" },
  { name: "Nasi Goreng Spesial", price: 20000, stock: 20, category: "Nasi" },
  { name: "Nasi Campur", price: 13000, stock: 25, category: "Nasi" },
  { name: "Nasi Uduk", price: 10000, stock: 25, category: "Nasi" },
  { name: "Lontong Sayur", price: 12000, stock: 20, category: "Nasi" },
  // Mie
  { name: "Indomie Goreng", price: 12000, stock: 40, category: "Mie" },
  { name: "Indomie Rebus", price: 12000, stock: 40, category: "Mie" },
  { name: "Indomie Goreng + Telur", price: 15000, stock: 30, category: "Mie" },
  { name: "Mie Ayam", price: 13000, stock: 25, category: "Mie" },
  { name: "Kwetiau Goreng", price: 15000, stock: 20, category: "Mie" },
  // Lauk
  { name: "Ayam Goreng", price: 10000, stock: 30, category: "Lauk" },
  { name: "Ayam Bakar", price: 12000, stock: 25, category: "Lauk" },
  { name: "Lele Goreng", price: 8000, stock: 25, category: "Lauk" },
  { name: "Telur Dadar", price: 6000, stock: 30, category: "Lauk" },
  { name: "Telur Balado", price: 7000, stock: 25, category: "Lauk" },
  { name: "Tempe Orek", price: 5000, stock: 30, category: "Lauk" },
  { name: "Tahu Bacem", price: 3000, stock: 40, category: "Lauk" },
  { name: "Perkedel", price: 3000, stock: 30, category: "Lauk" },
  // Sayur
  { name: "Sayur Asem", price: 6000, stock: 20, category: "Sayur" },
  { name: "Sayur Lodeh", price: 7000, stock: 20, category: "Sayur" },
  { name: "Capcay", price: 8000, stock: 15, category: "Sayur" },
  { name: "Tumis Kangkung", price: 7000, stock: 20, category: "Sayur" },
  // Gorengan
  { name: "Bakwan", price: 2000, stock: 50, category: "Gorengan" },
  { name: "Pisang Goreng", price: 2500, stock: 40, category: "Gorengan" },
  { name: "Tahu Isi", price: 2000, stock: 50, category: "Gorengan" },
  { name: "Tempe Mendoan", price: 2500, stock: 40, category: "Gorengan" },
  { name: "Cireng", price: 2000, stock: 40, category: "Gorengan" },
  // Minuman
  { name: "Es Teh Manis", price: 5000, stock: 60, category: "Minuman" },
  { name: "Teh Hangat", price: 4000, stock: 60, category: "Minuman" },
  { name: "Es Jeruk", price: 6000, stock: 40, category: "Minuman" },
  { name: "Kopi Tubruk", price: 7000, stock: 40, category: "Minuman" },
  { name: "Kopi Susu", price: 10000, stock: 30, category: "Minuman" },
  { name: "Es Kopi Susu", price: 12000, stock: 30, category: "Minuman" },
  { name: "Air Mineral", price: 4000, stock: 60, category: "Minuman" },
  { name: "Jahe Hangat", price: 6000, stock: 25, category: "Minuman" },
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
