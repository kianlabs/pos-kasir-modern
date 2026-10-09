import { prisma } from "@/server/db";
import bcrypt from "bcryptjs";

// Perbaikan sekali-jalan untuk baris user lama pra-refactor multi-tenant.
//
// Latar: warung pertama (`warung-berkah-jaya`) dibuat sebelum `seedWarung()`
// menulis kredensial yang benar, sehingga barisnya tidak pernah diperbaiki —
// `seedWarung()` idempoten (`if (existing) return existing;`), jadi menjalankan
// ulang seed TIDAK akan memperbaikinya. Akibatnya owner tidak punya password
// dan kasir menyimpan string placeholder, bukan hash bcrypt asli.
//
// Deteksi memakai PANJANG hash, bukan hanya NULL: hash bcrypt selalu 60
// karakter, sedangkan baris rusak bisa berisi string dummy (mis. 34 char).
//
// Idempoten & aman dijalankan berulang: hanya menyentuh baris yang hash-nya
// tidak valid, dan tidak menyentuh user yang sudah benar.

const BCRYPT_HASH_LENGTH = 60;
const DEFAULT_OWNER_PASSWORD = "password123";
const DEFAULT_KASIR_PIN = "123456";

function isValidBcryptHash(value: string | null): boolean {
  return typeof value === "string" && value.length === BCRYPT_HASH_LENGTH;
}

async function main() {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      password: true,
      pin: true,
      warungId: true,
    },
    orderBy: { createdAt: "asc" },
  });

  const warungIdSet = new Set<string>();
  for (const u of users) warungIdSet.add(u.warungId);
  const warungs = await prisma.warung.findMany({
    where: { id: { in: Array.from(warungIdSet) } },
    select: { id: true, slug: true },
  });
  const slugById = new Map(warungs.map((w) => [w.id, w.slug]));

  // Hash dihitung sekali, dipakai ulang untuk semua baris yang perlu diperbaiki.
  let ownerHash: string | null = null;
  let kasirHash: string | null = null;

  let repairedOwners = 0;
  let repairedKasir = 0;

  for (const user of users) {
    const label = `${slugById.get(user.warungId) ?? user.warungId}/${user.role}/${user.name}`;

    if (user.role === "OWNER" && !isValidBcryptHash(user.password)) {
      ownerHash ??= await bcrypt.hash(DEFAULT_OWNER_PASSWORD, 10);
      await prisma.user.update({ where: { id: user.id }, data: { password: ownerHash } });
      repairedOwners++;
      console.log(`[FIX] ${label}: password -> hash bcrypt (kredensial standar demo)`);
      continue;
    }

    if (user.role === "KASIR" && !isValidBcryptHash(user.pin)) {
      kasirHash ??= await bcrypt.hash(DEFAULT_KASIR_PIN, 10);
      await prisma.user.update({ where: { id: user.id }, data: { pin: kasirHash } });
      repairedKasir++;
      console.log(`[FIX] ${label}: pin -> hash bcrypt (kredensial standar demo)`);
    }
  }

  if (repairedOwners === 0 && repairedKasir === 0) {
    console.log("[FIX] Tidak ada baris rusak — semua hash user sudah valid.");
  } else {
    console.log(
      `[FIX] Selesai: ${repairedOwners} owner + ${repairedKasir} kasir diperbaiki. ` +
        `Owner memakai password "${DEFAULT_OWNER_PASSWORD}", kasir memakai PIN "${DEFAULT_KASIR_PIN}".`
    );
    console.log("[FIX] Ganti kredensial ini sebelum dipakai di luar lingkungan demo.");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
