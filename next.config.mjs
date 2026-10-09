/** @type {import('next').NextConfig} */
const nextConfig = {
  // Header keamanan dasar (audit LOW-4). Sengaja TIDAK memakai CSP ketat karena
  // Next.js menyuntikkan inline script (hydration) yang butuh nonce/hash —
  // memasang `script-src 'self'` tanpa itu akan memecah aplikasi. Header di bawah
  // tidak mengubah perilaku aplikasi, hanya menutup vektor umum.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
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
