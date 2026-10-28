import { NextResponse } from "next/server";
import { cookies, headers } from "next/headers";
import { prisma } from "@/server/db";
import { catat } from "@/server/audit";
import { issueSession } from "@/server/session";
import { SESSION_COOKIE } from "@/shared/session-types";
import { handleApiError } from "@/server/api-error";

export const dynamic = "force-dynamic";

// Rate limiter sederhana: 3 request per menit per IP
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 menit
const RATE_LIMIT_MAX = 3;
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function getClientIP(headersList: Headers): string {
  const forwarded = headersList.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  const realIP = headersList.get("x-real-ip");
  if (realIP) {
    return realIP.trim();
  }
  return "unknown";
}

function checkRateLimit(ip: string): { allowed: boolean; remaining: number; resetIn: number } {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true, remaining: RATE_LIMIT_MAX - 1, resetIn: RATE_LIMIT_WINDOW_MS };
  }

  if (entry.count >= RATE_LIMIT_MAX) {
    const resetIn = Math.max(0, entry.resetAt - now);
    return { allowed: false, remaining: 0, resetIn };
  }

  entry.count++;
  return { allowed: true, remaining: RATE_LIMIT_MAX - entry.count, resetIn: entry.resetAt - now };
}

// POST /api/auth/demo
// Fitur 1-Click Demo / Tamu untuk memudahkan peninjau, rekruter, dan calon
// pengguna mencoba fitur lengkap KRING! tanpa harus mengisi kredensial manual.
// Rate limit: 3 request per menit per IP. Disable di production via DISABLE_DEMO_LOGIN=true.
export async function POST() {
  try {
    // 0. Cek apakah demo login disabled di production
    if (process.env.DISABLE_DEMO_LOGIN === "true") {
      return NextResponse.json(
        {
          success: false,
          error: "Demo login dinonaktifkan di environment production.",
        },
        { status: 403 }
      );
    }

    // 1. Rate limit check: 3 request per menit per IP
    const headersList = await headers();
    const clientIP = getClientIP(headersList);
    const rateLimitResult = checkRateLimit(clientIP);

    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: `Terlalu banyak permintaan. Coba lagi dalam ${Math.ceil(rateLimitResult.resetIn / 1000)} detik.`,
          retryAfter: Math.ceil(rateLimitResult.resetIn / 1000),
        },
        {
          status: 429,
          headers: {
            "X-RateLimit-Limit": String(RATE_LIMIT_MAX),
            "X-RateLimit-Remaining": String(rateLimitResult.remaining),
            "Retry-After": String(Math.ceil(rateLimitResult.resetIn / 1000)),
          },
        }
      );
    }

    // 2. Cari warung demo (prioritas slug "warung-berkah-jaya", atau warung aktif pertama)
    let warung = await prisma.warung.findUnique({
      where: { slug: "warung-berkah-jaya" },
      select: { id: true, slug: true, status: true, nama: true },
    });

    if (!warung || warung.status === "SUSPENDED") {
      warung = await prisma.warung.findFirst({
        where: { status: { not: "SUSPENDED" } },
        orderBy: { createdAt: "asc" },
        select: { id: true, slug: true, status: true, nama: true },
      });
    }

    if (!warung) {
      return NextResponse.json(
        {
          success: false,
          error: "Warung demo tidak ditemukan. Silakan jalankan seed database terlebih dahulu.",
        },
        { status: 404 }
      );
    }

    // 2. Cari user (prioritas role OWNER untuk akses fitur penuh, fallback KASIR / aktif)
    let user = await prisma.user.findFirst({
      where: { warungId: warung.id, role: "OWNER", aktif: true },
      select: { id: true, warungId: true, role: true, name: true },
    });

    if (!user) {
      user = await prisma.user.findFirst({
        where: { warungId: warung.id, role: "KASIR", aktif: true },
        select: { id: true, warungId: true, role: true, name: true },
      });
    }

    if (!user) {
      user = await prisma.user.findFirst({
        where: { warungId: warung.id, aktif: true },
        select: { id: true, warungId: true, role: true, name: true },
      });
    }

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: "Pengguna demo tidak ditemukan pada warung.",
        },
        { status: 404 }
      );
    }

    // 3. Buat sesi menggunakan issueSession dan set cookie SESSION_COOKIE
    const { token, maxAge } = issueSession(user);
    const cookieOpts = {
      httpOnly: true,
      sameSite: "lax" as const,
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge,
    };

    try {
      (await cookies()).set(SESSION_COOKIE, token, cookieOpts);
    } catch {
      // Fallback bila dijalankan di luar request store Next.js
    }

    // 4. Catat audit log login demo
    await catat({
      warungId: warung.id,
      userId: user.id,
      action: "LOGIN_OK",
      meta: { mode: "demo", warungSlug: warung.slug },
    });

    // 5. Kembalikan response JSON dengan cookie
    const res = NextResponse.json({
      success: true,
      redirect: "/kasir",
      warung: { id: warung.id, nama: warung.nama, slug: warung.slug },
      user: { id: user.id, name: user.name, role: user.role },
    });

    res.cookies.set(SESSION_COOKIE, token, cookieOpts);
    return res;
  } catch (e) {
    console.error("[auth/demo]", e);
    return handleApiError(e, "Gagal memproses sesi demo.");
  }
}
