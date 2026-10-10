import type { Metadata, Viewport } from "next";
import SidebarNav from "./SidebarNav";
import MobileNav from "./MobileNav";
import LogoutButton from "./LogoutButton";
import ServiceWorkerRegister from "./ServiceWorkerRegister";
import OfflineShell from "./OfflineShell";
import "./globals.css";
import { currentWarung, getSession } from "@/server/tenant";

export const metadata: Metadata = {
  title: "KRING! — Kasir Warung",
  description: "Aplikasi kasir modern: kasir, produk, transaksi, laporan.",
  // PWA: Metadata API merender <link rel="manifest" href="/manifest.webmanifest">.
  manifest: "/manifest.webmanifest",
};

// theme-color lewat Metadata API (Next 14 memindahkannya ke `viewport`).
export const viewport: Viewport = {
  themeColor: "#a0522d",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();

  // Halaman login punya kerangkanya sendiri — jangan bungkus sidebar.
  if (!session) {
    return (
      <html lang="id">
        <body className="bg-neutral text-secondary antialiased">
          <div className="mx-auto max-w-7xl px-4 py-8">{children}</div>
          {/* SW didaftarkan app-wide agar PWA tetap installable dari halaman login. */}
          <ServiceWorkerRegister />
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
            <header className="sticky top-0 z-20 border-b bg-white shadow-xs md:hidden print:hidden">
              <div className="flex items-center gap-3 px-4 py-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-lg">
                  🧾
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-bold leading-tight">KRING!</div>
                  <div className="truncate text-[11px] text-zinc-500">{warung.nama}</div>
                </div>
                <div className="text-right text-xs text-zinc-500">
                  <div className="truncate font-semibold text-secondary">
                    {session.role === "OWNER" ? "🔑" : "👤"} {session.name}
                  </div>
                  <LogoutButton />
                </div>
              </div>
            </header>
            <div className="mx-auto max-w-7xl px-4 py-6 pb-28 md:px-6 md:pb-6">
              <p className="mb-4 text-xs font-medium uppercase tracking-wider text-zinc-400 print:hidden">
                {today}
              </p>
              {/* OfflineShell (worker-2) membungkus banner koneksi + status antrean. */}
              <OfflineShell>{children}</OfflineShell>
            </div>
          </div>
        </div>
        <MobileNav role={session.role} />
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
