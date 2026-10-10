import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { readJson } from "@/server/http";
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

// POST /api/auth/warung
// Resolver warung untuk HALAMAN LOGIN TUNGGAL di `/masuk` (tanpa daftar warung
// publik — privasi tenant terjaga). Dua mode:
//
//   { mode: "owner", email }  → cari warung yang punya OWNER aktif dengan email
//                               itu. Balikan hanya { slug, nama } (bukan rahasia).
//   { mode: "kasir", slug }   → balikan { warung:{slug,nama}, kasir:[{id,name}] }
//                               untuk tablet kasir yang tahu slug warungnya.
//
// Sengaja TIDAK mengembalikan daftar warung lintas-tenant: satu email hanya
// membuka satu warung, dan kasir wajib tahu slug. Rate-limit per-IP menahan
// enumerasi email/slug.
export async function POST(req: Request) {
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

    const body = await readJson(req);
    if (!body) return NextResponse.json({ error: "Body tidak valid." }, { status: 400 });

    const mode = body.mode === "owner" ? "owner" : body.mode === "kasir" ? "kasir" : null;
    if (!mode) return NextResponse.json({ error: "Mode tidak valid." }, { status: 400 });

    if (mode === "owner") {
      const email = str(body.email, 200).toLowerCase();
      if (!email) return NextResponse.json({ error: "Email wajib diisi." }, { status: 400 });

      // Email owner unik per warung → satu email memetakan ke satu warung.
      const owner = await prisma.user.findFirst({
        where: { role: "OWNER", email, aktif: true },
        select: { warung: { select: { slug: true, nama: true, status: true } } },
      });
      if (!owner) {
        return NextResponse.json({ error: "Email tidak dikenali." }, { status: 404 });
      }
      if (owner.warung.status === "SUSPENDED") {
        return NextResponse.json({ error: "Warung sedang dinonaktifkan." }, { status: 403 });
      }
      return NextResponse.json({
        warung: { slug: owner.warung.slug, nama: owner.warung.nama },
      });
    }

    // mode kasir: user sengaja tahu slug warung (URL tablet). Kembalikan nama
    // kasir warung itu saja — PIN tetap rahasia.
    const slug = str(body.slug, 100);
    if (!slug) return NextResponse.json({ error: "Kode warung wajib diisi." }, { status: 400 });

    const warung = await prisma.warung.findUnique({
      where: { slug },
      select: { id: true, nama: true, slug: true, status: true },
    });
    if (!warung) return NextResponse.json({ error: "Warung tidak ditemukan." }, { status: 404 });
    if (warung.status === "SUSPENDED") {
      return NextResponse.json({ error: "Warung sedang dinonaktifkan." }, { status: 403 });
    }

    const kasir = await prisma.user.findMany({
      where: { warungId: warung.id, role: "KASIR", aktif: true },
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true },
    });

    return NextResponse.json({ warung: { slug: warung.slug, nama: warung.nama }, kasir });
  } catch (e) {
    return handleApiError(e);
  }
}
