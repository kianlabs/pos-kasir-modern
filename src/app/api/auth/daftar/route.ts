import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { prisma, transaksi } from "@/server/db";
import { readJson } from "@/server/http";
import { catat } from "@/server/audit";
import { issueSession } from "@/server/session";
import { SESSION_COOKIE } from "@/shared/session-types";
import { checkSlugRate, recordSlugProbe } from "@/server/rate-limit";
import { handleApiError } from "@/server/api-error";
import { str } from "@/server/validate";

export const dynamic = "force-dynamic";

// POST /api/auth/daftar — pendaftaran warung baru (self-serve signup).
//
// Alur: buat Warung (status TRIAL 30 hari) + akun OWNER + Setting + 10 meja
// dalam SATU transaksi, lalu langsung auto-login (set cookie sesi) supaya
// owner dibawa ke /kasir tanpa login ulang.
//
// KEAMANAN:
//  - Email owner WAJIB unik GLOBAL (bukan hanya per-warung). Alasan: halaman
//    login tunggal me-resolve warung dari email (findFirst), jadi dua owner
//    dengan email sama = ambigu/salah warung. Dicek eksplisit + dijaga index.
//  - Rate-limit per-IP (pakai jalur slug-probe) untuk menahan spam pendaftaran.
//  - Slug dibuat unik otomatis (nama → slug, tambah sufiks angka bila bentrok).
//  - Password di-hash bcrypt; tak pernah dikembalikan.

function ambilIpKlien(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim() || "unknown";
  return req.headers.get("x-real-ip")?.trim() || "unknown";
}

function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^\w-]+/g, "")
    .replace(/--+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

// Slug unik: dasar dari nama; bila sudah dipakai, tambah -2, -3, dst.
async function slugUnik(dasar: string): Promise<string> {
  const base = dasar || "warung";
  let kandidat = base;
  let i = 2;
  // Batasi percobaan agar tidak loop tak terbatas.
  while (i < 200) {
    const ada = await prisma.warung.findUnique({ where: { slug: kandidat }, select: { id: true } });
    if (!ada) return kandidat;
    kandidat = `${base}-${i}`;
    i++;
  }
  // Fallback: sufiks acak pendek.
  return `${base}-${Math.random().toString(36).slice(2, 7)}`;
}

export async function POST(req: Request) {
  try {
    const ip = ambilIpKlien(req);
    const rl = await checkSlugRate(ip);
    if (rl.blocked) {
      return NextResponse.json(
        { error: "Terlalu banyak percobaan. Coba lagi nanti." },
        { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } },
      );
    }
    await recordSlugProbe(ip);

    const body = await readJson(req);
    if (!body) return NextResponse.json({ error: "Body tidak valid." }, { status: 400 });

    const nama = str(body.nama, 80);
    const email = str(body.email, 200).toLowerCase();
    const password = str(body.password, 200);

    if (nama.length < 2) {
      return NextResponse.json({ error: "Nama warung minimal 2 karakter." }, { status: 400 });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Email tidak valid." }, { status: 400 });
    }
    if (password.length < 6) {
      return NextResponse.json({ error: "Kata sandi minimal 6 karakter." }, { status: 400 });
    }

    // Email owner unik GLOBAL (login tunggal me-resolve warung dari email).
    const emailDipakai = await prisma.user.findFirst({
      where: { role: "OWNER", email },
      select: { id: true },
    });
    if (emailDipakai) {
      return NextResponse.json(
        { error: "Email ini sudah terdaftar. Coba masuk atau pakai email lain." },
        { status: 409 },
      );
    }

    const slug = await slugUnik(slugify(nama));
    const passwordHash = await bcrypt.hash(password, 10);

    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + 30);

    const { warung, owner } = await transaksi(async (tx) => {
      const w = await tx.warung.create({
        data: { nama, slug, status: "TRIAL", trialEndsAt },
      });
      const o = await tx.user.create({
        data: {
          warungId: w.id,
          name: `Owner ${nama}`,
          email,
          password: passwordHash,
          role: "OWNER",
        },
      });
      await tx.setting.create({
        data: { warungId: w.id, taxEnabled: false, taxPct: 0, receiptName: nama },
      });
      for (let i = 1; i <= 10; i++) {
        await tx.meja.create({ data: { warungId: w.id, nomor: String(i) } });
      }
      await tx.auditLog.create({
        data: {
          warungId: w.id,
          userId: o.id,
          action: "DAFTAR_WARUNG",
          meta: JSON.stringify({ nama, slug }),
        },
      });
      return { warung: w, owner: o };
    });

    await catat({
      warungId: warung.id,
      userId: owner.id,
      action: "LOGIN_OK",
      meta: { mode: "daftar" },
    });

    // Auto-login: set cookie sesi langsung.
    const { token, maxAge } = issueSession(owner);
    (await cookies()).set(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge,
    });

    return NextResponse.json({
      ok: true,
      warung: { slug: warung.slug, nama: warung.nama },
      user: { name: owner.name, role: owner.role },
    });
  } catch (e) {
    return handleApiError(e, "Gagal mendaftar. Coba lagi.");
  }
}
