import { NextResponse } from "next/server";
import { prisma } from "@/server/db";

export const dynamic = "force-dynamic";

// GET /api/auth/kasir?slug=xxx
// Daftar nama kasir untuk tablet warung tertentu — PUBLIK & bukan rahasia
// (lampiran skema §2 aturan #7). Yang rahasia hanya PIN. Tidak ada PIN/email
// yang dikembalikan; tanpa slug, daftar lintas-warung tidak bisa ditarik.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const slug = String(searchParams.get("slug") ?? "").trim();
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
}
