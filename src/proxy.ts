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
const OWNER_ONLY_PAGES = ["/produk", "/laporan", "/pengaturan", "/insight", "/dashboard", "/promo"];

// ── Perlindungan CSRF (audit rekomendasi #2) ────────────────────────────────
//
// SameSite=Lax pada cookie sesi sudah menahan CSRF lintas-situs untuk POST
// (cookie tak dikirim), tapi ia bukan jaminan mutlak: browser lama, klien
// non-browser, atau regresi konfigurasi bisa membuka celah. Lapisan tambahan:
// untuk setiap MUTASI (POST/PUT/PATCH/DELETE) ke /api/*, WAJIB header Origin
// cocok dengan host permintaan (same-origin). Ini menolak permintaan lintas
// situs sebelum menyentuh handler.
//
// Prinsip: HANYA menolak bila Origin ADA dan jelas lintas-situs. Bila Origin
// tidak dikirim (klien same-origin lama / non-browser yang sah), kita LOLOSKAN
// agar tidak memutus alur sah — SameSite=Lax tetap menjadi pelindung utama.
const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function asalDiizinkan(req: NextRequest): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true; // tak ada Origin → serahkan ke SameSite=Lax.
  try {
    const asal = new URL(origin);
    // Bandingkan host Origin dengan Host header permintaan (paling andal di
    // Node runtime; `nextUrl.host` bisa ternormalisasi beda). `x-forwarded-host`
    // dipakai bila ada (di belakang proxy/CDN) agar tetap cocok.
    const host =
      req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? req.nextUrl.host;
    return asal.host === host;
  } catch {
    return false; // Origin cacat → tolak.
  }
}

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

  // CSRF (rekomendasi audit #2): tolak MUTASI /api/* yang Origin-nya
  // lintas-situs SEBELUM menyentuh handler. Dicek paling awal agar berlaku juga
  // untuk endpoint publik (login/daftar) — mencegah login-CSRF.
  if (pathname.startsWith("/api") && MUTATING_METHODS.has(req.method) && !asalDiizinkan(req)) {
    return NextResponse.json({ error: "Permintaan lintas-situs ditolak." }, { status: 403 });
  }

  if (
    // Root = landing page SaaS publik (belum login). Setelah login, root
    // redirect ke /kasir (lihat app/page.tsx). Publik karena tanpa sesi pun
    // harus bisa melihat halaman jualan.
    pathname === "/" ||
    // Halaman pendaftaran warung baru (self-serve signup) — publik.
    pathname.startsWith("/daftar") ||
    pathname.startsWith("/masuk") ||
    pathname.startsWith("/api/auth/login") ||
    pathname.startsWith("/api/auth/logout") ||
    // Pendaftaran warung baru (self-serve) — publik, rate-limited di handler.
    pathname.startsWith("/api/auth/daftar") ||
    // Daftar kasir per warung untuk tablet login: publik menurut desain
    // (lampiran skema §2 aturan #7). Handler hanya mengembalikan {id, name}.
    pathname.startsWith("/api/auth/kasir") ||
    // Resolver warung untuk halaman login tunggal `/masuk` (tanpa daftar warung
    // publik): memetakan email owner ATAU slug kasir → {slug,nama}. Wajib publik
    // karena dipanggil SEBELUM sesi ada. Handler tak pernah membocorkan daftar
    // warung lintas-tenant; rate-limit per-IP menahan enumerasi.
    pathname.startsWith("/api/auth/warung") ||
    // 1-Click Demo: membuat sesi demo TANPA kredensial — wajib publik karena
    // justru dipanggil saat pengunjung BELUM punya sesi. Tanpa pengecualian
    // ini, POST /api/auth/demo selalu kena 401 "Belum login." dari gate di
    // bawah dan tombol "Coba Demo" tidak pernah bisa masuk.
    pathname.startsWith("/api/auth/demo") ||
    pathname.startsWith("/_next") ||
    // Aset statis publik (gambar landing, dsb.) — tanpa sesi. File di public/
    // dilayani langsung; tanpa pengecualian ini mereka kena gate sesi → 307 →
    // gambar landing "rusak". Aman: hanya aset non-rahasia.
    /\.(png|jpg|jpeg|webp|svg|gif|ico|txt|webmanifest)$/i.test(pathname) ||
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
    url.pathname = "/masuk";
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
      url.pathname = "/kasir";
      url.search = "?denied=1";
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
