import type { Metadata } from "next";
import Link from "next/link";
import SidebarNav from "./SidebarNav";
import "./globals.css";

export const metadata: Metadata = {
  title: "KasirKu — POS Modern",
  description: "Aplikasi kasir modern: kasir, produk, transaksi, laporan.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const today = new Date().toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <html lang="id">
      <body className="bg-[#faf6f0] text-zinc-900 antialiased">
        <div className="flex min-h-screen">
          {/* Sidebar */}
          <aside className="sticky top-0 hidden h-screen w-56 shrink-0 flex-col bg-stone-950 text-white md:flex print:hidden">
            <div className="flex items-center gap-2 px-5 pb-4 pt-6">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-orange-500 text-xl">
                🧾
              </span>
              <div>
                <div className="font-bold leading-tight">KasirKu</div>
                <div className="text-[11px] text-zinc-400">Warung Berkah Jaya</div>
              </div>
            </div>
            <SidebarNav />
            <div className="mt-auto p-4">
              <div className="rounded-lg bg-stone-900 p-3 text-xs text-zinc-400">
                <div className="font-semibold text-zinc-200">👤 Kasir: Admin</div>
                <div className="mt-0.5">Shift Pagi • v1.0</div>
              </div>
            </div>
          </aside>

          {/* Konten */}
          <div className="min-w-0 flex-1">
            {/* Topbar mobile */}
            <header className="sticky top-0 z-10 border-b bg-white/90 backdrop-blur md:hidden print:hidden">
              <div className="flex items-center gap-4 overflow-x-auto px-4 py-3 text-sm font-semibold">
                <span className="mr-auto">🧾 KasirKu</span>
                <Link href="/">Kasir</Link>
                <Link href="/produk">Produk</Link>
                <Link href="/transaksi">Transaksi</Link>
                <Link href="/shift">Shift</Link>
                <Link href="/stok">Stok</Link>
                <Link href="/laporan">Laporan</Link>
                <Link href="/pengaturan">⚙️</Link>
              </div>
            </header>
            <div className="mx-auto max-w-7xl px-4 py-6 md:px-6">
              <p className="mb-4 text-xs font-medium uppercase tracking-wider text-zinc-400 print:hidden">
                {today}
              </p>
              {children}
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
