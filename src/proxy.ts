import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, type SessionPayload } from "@/shared/session-types";

// Gate sesi/role di edge (lampiran skema §2 aturan #1, #8). Next 16: konvensi
// `middleware` diganti `proxy` (default runtime Node.js).
//
// Catatan penting: proxy TIDAK boleh memakai node:crypto atau Prisma. Karena
// itu ia hanya memeriksa *keberadaan* cookie, bukan memverifikasi tanda
// tangannya. Verifikasi tanda tangan yang sebenarnya dilakukan di setiap
// route/halaman lewat lib/warung.getSession() (Node runtime). Proxy di sini
// adalah lapisan UX (redirect cepat) + guard kasar role; guard yang mengikat
// tetap di handler.

const OWNER_ONLY_API = ["/api/settings", "/api/export"];
const OWNER_ONLY_PAGES = ["/produk", "/laporan", "/pengaturan"];

function decodeRoleUnsafe(token: string | undefined): SessionPayload["role"] | null {
  if (!token) return null;
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  try {
    const json = atob(token.slice(0, dot).replace(/-/g, "+").replace(/_/g, "/"));
    const payload = JSON.parse(json) as SessionPayload;
    if (payload.role === "OWNER" || payload.role === "KASIR") return payload.role;
  } catch {
    return null;
  }
  return null;
}

export function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  if (
    pathname.startsWith("/masuk") ||
    pathname.startsWith("/api/auth/login") ||
    pathname.startsWith("/api/auth/logout") ||
    // Daftar kasir per warung untuk tablet login: publik menurut desain
    // (lampiran skema §2 aturan #7). Handler hanya mengembalikan {id, name}.
    pathname.startsWith("/api/auth/kasir") ||
    pathname.startsWith("/_next") ||
    // Aset PWA WAJIB publik tanpa sesi: browser/PWA installer mengambilnya
    // sebelum login (manifest, service worker, ikon). Bila di-gate, install
    // PWA gagal & /sw.js ter-redirect → offline mati (Tahap 4).
    pathname === "/manifest.webmanifest" ||
    pathname === "/sw.js" ||
    pathname === "/favicon.ico" ||
    /^\/icon-\d+\.png$/.test(pathname)
  ) {
    return NextResponse.next();
  }

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const role = decodeRoleUnsafe(token);
  const isApi = pathname.startsWith("/api");

  if (!token) {
    if (isApi) return NextResponse.json({ error: "Belum login." }, { status: 401 });
    const url = req.nextUrl.clone();
    url.pathname = "/masuk/_";
    url.search = `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }

  // Guard kasar role (cermin dari guard sebenarnya di handler).
  if (role === "KASIR") {
    if (isApi && OWNER_ONLY_API.some((p) => pathname.startsWith(p))) {
      return NextResponse.json({ error: "Akses khusus owner." }, { status: 403 });
    }
    if (!isApi && OWNER_ONLY_PAGES.some((p) => pathname.startsWith(p))) {
      const url = req.nextUrl.clone();
      url.pathname = "/";
      url.search = "?denied=1";
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
