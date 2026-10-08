import type { Metadata } from "next";
import Link from "next/link";
import SidebarNav from "./SidebarNav";
import LogoutButton from "./LogoutButton";
import "./globals.css";
import { currentWarung, getSession } from "@/lib/warung";

export const metadata: Metadata = {
  title: "KRING! — Kasir Warung",
  description: "Aplikasi kasir modern: kasir, produk, transaksi, laporan.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();

  // Halaman login punya kerangkanya sendiri — jangan bungkus sidebar.
  if (!session) {
    return (
      <html lang="id">
        <body className="bg-neutral text-secondary antialiased">
          <div className="mx-auto max-w-7xl px-4 py-8">{children}</div>
        </body>
      </html>
    );
  }

  const warung = await currentWarung();
  const today = new Date().toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <html lang="id">
      <body className="bg-neutral text-secondary antialiased">
        <div className="flex min-h-screen">
          <aside className="sticky top-0 hidden h-screen w-56 shrink-0 flex-col bg-stone-950 text-white md:flex print:hidden">
            <div className="flex items-center gap-2 px-5 pb-4 pt-6">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-xl">
                🧾
              </span>
              <div className="min-w-0">
                <div className="font-bold leading-tight">KRING!</div>
                <div className="truncate text-[11px] text-zinc-400">{warung.nama}</div>
              </div>
            </div>
            <SidebarNav role={session.role} />
            <div className="mt-auto p-4">
              <div className="rounded-lg bg-stone-900 p-3 text-xs text-zinc-400">
                <div className="truncate font-semibold text-zinc-200">
                  {session.role === "OWNER" ? "🔑" : "👤"} {session.name}
                </div>
                <div className="mt-0.5">{session.role === "OWNER" ? "Owner" : "Kasir"}</div>
                <LogoutButton />
              </div>
            </div>
          </aside>

          <div className="min-w-0 flex-1">
            <header className="sticky top-0 z-10 border-b bg-white/90 backdrop-blur md:hidden print:hidden">
              <div className="flex items-center gap-4 overflow-x-auto px-4 py-3 text-sm font-semibold">
                <span className="mr-auto shrink-0">🧾 KRING!</span>
                <Link href="/">Kasir</Link>
                {session.role === "OWNER" && (
                  <>
                    <Link href="/produk">Produk</Link>
                    <Link href="/laporan">Laporan</Link>
                    <Link href="/pengaturan">⚙️</Link>
                  </>
                )}
                <Link href="/transaksi">Transaksi</Link>
                <Link href="/shift">Shift</Link>
                <Link href="/stok">Stok</Link>
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
