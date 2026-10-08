import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

// Helper slugify
function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-") // Replace spaces with -
    .replace(/[^\w-]+/g, "") // Remove all non-word chars
    .replace(/--+/g, "-"); // Replace multiple - with single -
}

// Menu warung makan umum: nasi, mie, lauk, sayur, gorengan, minuman.
// 38 menu realistis untuk warung 2026.
const defaultProducts = [
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
  { name: "Tumis Kangkung", price: 7000, stock: 20, category: "Sayur", icon: "🥬" },
];

export async function seedWarung(nama: string) {
  const slug = slugify(nama);

  // Idempotent: lewati jika warung dengan slug ini sudah ada
  const existing = await prisma.warung.findUnique({ where: { slug } });
  if (existing) {
    console.log(`[SEED] Warung "${nama}" (${slug}) sudah ada — dilewati.`);
    return existing;
  }

  const trialEndsAt = new Date();
  trialEndsAt.setDate(trialEndsAt.getDate() + 30);

  const ownerPasswordHash = await bcrypt.hash("password123", 10);
  const kasirPinHash = await bcrypt.hash("123456", 10);

  // Buat Warung lengkap dalam transaksi
  const result = await prisma.$transaction(async (tx) => {
    const warung = await tx.warung.create({
      data: {
        nama,
        slug,
        status: "TRIAL",
        trialEndsAt,
        alamat: "Jl. Merdeka No. 45, Kartasura",
        telepon: "08123456789",
      },
    });

    // Owner user
    await tx.user.create({
      data: {
        warungId: warung.id,
        name: `Owner ${nama}`,
        email: `owner@${slug}.demo`,
        password: ownerPasswordHash,
        role: "OWNER",
      },
    });

    // Kasir demo
    await tx.user.create({
      data: {
        warungId: warung.id,
        name: "Kasir Demo",
        pin: kasirPinHash,
        role: "KASIR",
      },
    });

    // Setting row
    await tx.setting.create({
      data: {
        warungId: warung.id,
        taxEnabled: true,
        taxPct: 10,
        receiptName: nama,
        jamBuka: "07:00",
        jamTutup: "21:00",
      },
    });

    // 10 Meja
    for (let i = 1; i <= 10; i++) {
      await tx.meja.create({
        data: {
          warungId: warung.id,
          nomor: String(i),
        },
      });
    }

    // 38 Produk
    for (const p of defaultProducts) {
      await tx.product.create({
        data: {
          warungId: warung.id,
          name: p.name,
          price: p.price,
          stock: p.stock,
          category: p.category,
          icon: p.icon,
        },
      });
    }

    // AuditLog
    await tx.auditLog.create({
      data: {
        warungId: warung.id,
        action: "SEED_WARUNG",
        meta: JSON.stringify({ nama, slug, productsCount: defaultProducts.length }),
      },
    });

    return warung;
  });

  console.log(`[SEED] Sukses membuat warung: "${nama}" (${slug}) - ID: ${result.id}`);
  return result;
}

async function main() {
  const args = process.argv.slice(2);
  let warungsCount = 1;

  for (const arg of args) {
    if (arg.startsWith("--warungs=")) {
      const parsed = parseInt(arg.split("=")[1], 10);
      if (!isNaN(parsed) && parsed > 0) warungsCount = parsed;
    }
  }

  if (warungsCount === 1) {
    await seedWarung("Warung Berkah Jaya");
  } else {
    for (let i = 1; i <= warungsCount; i++) {
      await seedWarung(`Warung Demo ${i}`);
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
