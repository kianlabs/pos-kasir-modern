import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "KasirKu — POS Modern",
  description: "Aplikasi kasir modern: kasir, produk, struk, laporan.",
};

const NAV = [
  { href: "/", label: "Kasir" },
  { href: "/produk", label: "Produk" },
  { href: "/laporan", label: "Laporan" },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body className="min-h-screen bg-zinc-100 text-zinc-900 antialiased">
        <header className="sticky top-0 z-10 border-b bg-white">
          <div className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-3">
            <Link href="/" className="text-lg font-bold">
              🧾 KasirKu
            </Link>
            <nav className="flex gap-1">
              {NAV.map((n) => (
                <Link
                  key={n.href}
                  href={n.href}
                  className="rounded px-3 py-1.5 text-sm font-medium hover:bg-zinc-100"
                >
                  {n.label}
                </Link>
              ))}
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
