import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { handleApiError } from "@/server/api-error";
import { str } from "@/server/validate";
import { checkSlugRate, recordSlugProbe } from "@/server/rate-limit";

export const dynamic = "force-dynamic";

// Ambil IP klien dari header proxy (x-forwarded-for hop pertama, lalu x-real-ip).
function ambilIpKlien(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim() || "unknown";
  return req.headers.get("x-real-ip")?.trim() || "unknown";
}

// GET /api/auth/kasir?slug=xxx
// Daftar nama kasir untuk tablet warung tertentu — PUBLIK & bukan rahasia
// (lampiran skema §2 aturan #7). Yang rahasia hanya PIN. Tidak ada PIN/email
// yang dikembalikan; tanpa slug, daftar lintas-warung tidak bisa ditarik.
//
// SENGAJA publik (tablet login flow), tapi dibatasi rate-limit per-IP untuk
// menahan enumerasi warung/kasir lintas-slug (S1). Batas: 30 request / 5 menit.
export async function GET(req: Request) {
  try {
    const ip = ambilIpKlien(req);

    const status = await checkSlugRate(ip);
    if (status.blocked) {
      return NextResponse.json(
        { error: "Terlalu banyak permintaan. Coba lagi nanti." },
        { status: 429, headers: { "Retry-After": String(status.retryAfterSeconds) } },
      );
    }
    await recordSlugProbe(ip);

    const { searchParams } = new URL(req.url);
    const slug = str(searchParams.get("slug"), 100);
    if (!slug) return NextResponse.json({ error: "Slug wajib." }, { status: 400 });

    const warung = await prisma.warung.findUnique({
      where: { slug },
      select: { id: true, nama: true, status: true },
    });
    if (!warung) return NextResponse.json({ error: "Warung tidak ditemukan." }, { status: 404 });

    const kasir = await prisma.user.findMany({
      where: { warungId: warung.id, role: "KASIR", aktif: true },
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true },
    });

    return NextResponse.json({ warung: { nama: warung.nama, slug }, kasir });
  } catch (e) {
    return handleApiError(e);
  }
}
