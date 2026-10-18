// Content-Security-Policy (audit rekomendasi #1). Next menyuntikkan inline
// script (hydration/bootstrap) TANPA nonce → WAJIB 'unsafe-inline' di
// script-src; tanpa itu seluruh app pecah. Nonce per-request butuh plumbing
// middleware yang rapuh + berisiko. 'unsafe-inline' tetap menutup vektor
// injeksi skrip EKSTERNAL, object/embed, serta pembajakan base-uri/form-action.
// Di mode dev, Next butuh 'unsafe-eval' + websocket HMR → longgarkan.
const isDev = process.env.NODE_ENV !== "production";
const csp = [
  "default-src 'self'",
  isDev ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'" : "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' data: blob:",
  isDev ? "connect-src 'self' ws: wss:" : "connect-src 'self'",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
].join("; ");

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Hanya gunakan standalone output jika bukan di Vercel (misal: Docker / local)
  ...(process.env.VERCEL ? {} : { output: "standalone" }),
  // Jangan bocorkan header X-Powered-By (info teknologi ke penyerang) — audit LOW.
  poweredByHeader: false,
  // Next 16 memblokir resource dev (/_next/hmr) dari origin selain localhost →
  // akses via 127.0.0.1 dianggap cross-origin, HMR mati, dan hidrasi React GAGAL
  // di dev (gejala: halaman render SSR tapi semua useEffect/data client tak jalan).
  // Izinkan host yang kita pakai untuk development. Tidak berdampak di produksi.
  allowedDevOrigins: ["127.0.0.1", "localhost", "192.168.1.9"],
  // Header keamanan dasar (audit LOW-4) + CSP (rekomendasi audit #1). CSP
  // memakai 'unsafe-inline' di script-src karena Next menyuntik inline script
  // tanpa nonce — lihat catatan di atas. Header lain tidak mengubah perilaku
  // aplikasi, hanya menutup vektor umum.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // CSP: batasi asal resource (benteng utama XSS/clickjacking/injeksi).
          { key: "Content-Security-Policy", value: csp },
          // Cegah clickjacking (halaman login/struk tak boleh di-iframe).
          { key: "X-Frame-Options", value: "DENY" },
          // Cegah MIME sniffing.
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Batasi kebocoran referrer.
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Matikan fitur browser yang tak dipakai.
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=()",
          },
          // Paksa HTTPS (hanya efektif di produksi; Vercel sudah HTTPS).
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
        ],
      },
      {
        // Service worker & manifest PWA: tak perlu di-frame, tapi tetap aman.
        source: "/sw.js",
        headers: [{ key: "Cache-Control", value: "no-cache" }],
      },
    ];
  },
};

export default nextConfig;
