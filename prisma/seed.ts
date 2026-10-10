import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

// Muat .env secara eksplisit bila DIRECT_URL belum di-resolve oleh Prisma.
if (!process.env.DIRECT_URL) {
  const envPath = resolve(process.cwd(), ".env");
  if (existsSync(envPath)) {
    for (const line of readFileSync(envPath, "utf8").split("\n")) {
      const m = line.match(/^([A-Z_]+)="?([^"\n]*)"?$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
    }
  }
}

// Seed memakai koneksi DIRECT/SESSION (DIRECT_URL), bukan pooled (DATABASE_URL),
// karena ia memakai interactive transaction ($transaction async) + loop tulis
// panjang — tak didukung transaction pooler (6543). Pola sama dengan migrasi.
const prisma = new PrismaClient({
  datasourceUrl: process.env.DIRECT_URL || process.env.DATABASE_URL,
});



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

  // Kredensial seed dapat dikonfigurasi via env. Default dipertahankan agar
  // dev lokal & test tetap jalan tanpa setup tambahan.
  const ownerPassword = process.env.SEED_OWNER_PASSWORD || "password123";
  const kasirPin = process.env.SEED_KASIR_PIN || "123456";

  const ownerPasswordHash = await bcrypt.hash(ownerPassword, 10);
  const kasirPinHash = await bcrypt.hash(kasirPin, 10);

  // Buat Warung lengkap dalam transaksi.
  // timeout dinaikkan: Supabase (pooler Sydney) berlatensi tinggi, dan satu
  // transaksi ini meng-insert 1 warung + 2 user + setting + 10 meja + 38 produk.
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
  }, { maxWait: 15_000, timeout: 60_000 });

  console.log(`[SEED] Sukses membuat warung: "${nama}" (${slug}) - ID: ${result.id}`);
  return result;
}

// Guard keselamatan: menolak seed ke DB NON-lokal (mis. produksi Supabase).
// Seed membuat warung demo + kredensial lemah (password123 / PIN 123456) — tak
// boleh bocor ke DB nyata. Override sengaja dengan `ALLOW_SEED_NON_LOCAL=1`.
//
// Lapis kedua: meski ALLOW_SEED_NON_LOCAL=1, bila kredensial masih DEFAULT
// (SEED_OWNER_PASSWORD / SEED_KASIR_PIN tidak diubah) seed tetap ditolak kecuali
// operator juga menegaskan `ALLOW_WEAK_SEED_CREDS=1`. Ini mencegah kredensial
// demo lemah ikut ter-seed ke non-lokal tanpa disadari.
function tolakJikaNonLokal(): void {
  const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  const ownerPassword = process.env.SEED_OWNER_PASSWORD || "password123";
  const kasirPin = process.env.SEED_KASIR_PIN || "123456";
  const kredensialDefault = ownerPassword === "password123" && kasirPin === "123456";

  if (!url) return;

  let host: string;
  try {
    host = new URL(url).hostname;
  } catch {
    return;
  }

  const lokal = host === "localhost" || host === "127.0.0.1" || host === "::1";
  if (lokal) return;

  if (process.env.ALLOW_SEED_NON_LOCAL !== "1") {
    console.error(
      [
        `[SEED] DITOLAK: target DB bukan lokal (host: "${host}").`,
        "Seed membuat warung demo + kredensial lemah (password123 / PIN 123456)",
        "yang TIDAK boleh masuk ke database produksi/non-lokal.",
        "Bila memang disengaja (mis. staging), jalankan ulang dengan:",
        "  ALLOW_SEED_NON_LOCAL=1 npm run db:seed",
      ].join("\n"),
    );
    process.exit(1);
  }

  if (kredensialDefault && process.env.ALLOW_WEAK_SEED_CREDS !== "1") {
    console.error(
      [
        `[SEED] DITOLAK: target DB bukan lokal (host: "${host}") dan kredensial`,
        "masih DEFAULT (password123 / PIN 123456). Ubah kredensial terlebih dahulu:",
        "  SEED_OWNER_PASSWORD=<kuat> SEED_KASIR_PIN=<kuat> ALLOW_SEED_NON_LOCAL=1 npm run db:seed",
        "Atau, bila kredensial lemah memang disengaja di non-lokal:",
        "  ALLOW_WEAK_SEED_CREDS=1 ... npm run db:seed",
      ].join("\n"),
    );
    process.exit(1);
  }
}

async function main() {
  tolakJikaNonLokal();

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

// Hanya jalankan seed otomatis bila file ini dieksekusi langsung
// (`npx tsx prisma/seed.ts`). Tanpa guard ini, `import { seedWarung }` dari
// test akan ikut menjalankan main() sebagai efek samping.
const dijalankanLangsung = process.argv[1]?.replace(/\\/g, "/").endsWith("prisma/seed.ts");

if (dijalankanLangsung) {
  main()
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
