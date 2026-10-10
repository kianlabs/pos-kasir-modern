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
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#171717",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();

  if (!session) {
    return (
      <html lang="id">
        <head>
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
          <link
            href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&display=swap"
            rel="stylesheet"
          />
          <link
            href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
            rel="stylesheet"
          />
        </head>
        <body className="bg-canvas text-ink-950 font-body-md antialiased">
          <div className="mx-auto max-w-7xl px-4 py-8">{children}</div>
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
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-canvas text-ink-950 font-body-md antialiased">
        <div className="flex min-h-screen">
          <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-ink-200 bg-surface text-ink-950 md:flex print:hidden">
            <div className="flex items-center gap-3 px-5 pb-4 pt-5 border-b border-ink-200">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-ink-950 text-surface">
                <span className="material-symbols-outlined text-[20px]" data-icon="notifications">
                  notifications
                </span>
              </span>
              <div className="min-w-0">
                <div className="text-headline-sm font-headline-sm font-bold tracking-tight text-ink-950 leading-tight">
                  KRING!
                </div>
                <div className="truncate text-caption font-caption text-ink-500">
                  {warung.nama}
                </div>
              </div>
            </div>
            <SidebarNav role={session.role} />
            <div className="mt-auto border-t border-ink-200 p-4">
              <div className="rounded-xl border border-ink-200 bg-ink-100 p-3 text-xs text-ink-700">
                <div className="truncate font-semibold text-ink-950 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[16px]">
                    {session.role === "OWNER" ? "key" : "person"}
                  </span>
                  <span>{session.name}</span>
                </div>
                <div className="mt-0.5 text-caption font-caption text-ink-500">
                  {session.role === "OWNER" ? "Owner" : "Kasir"}
                </div>
                <LogoutButton />
              </div>
            </div>
          </aside>

          <div className="min-w-0 flex-1 flex flex-col">
            <header className="sticky top-0 z-20 flex h-16 w-full items-center justify-between border-b border-ink-200 bg-surface px-4 shrink-0 shadow-xs md:hidden print:hidden">
              <div className="flex items-center gap-3 min-w-0">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-ink-950 text-surface">
                  <span className="material-symbols-outlined text-[18px]" data-icon="notifications">
                    notifications
                  </span>
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-body-md font-bold leading-tight text-ink-950">
                    KRING!
                  </div>
                  <div className="truncate text-caption font-caption text-ink-500">
                    {warung.nama}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 pl-2 shrink-0">
                <div className="text-right text-xs">
                  <div className="truncate font-semibold text-ink-950 max-w-[120px]">
                    {session.name}
                  </div>
                  <div className="text-caption font-caption text-ink-500">
                    {session.role === "OWNER" ? "Owner" : "Kasir"}
                  </div>
                </div>
                <div className="scale-90">
                  <LogoutButton />
                </div>
              </div>
            </header>
            <div className="mx-auto w-full max-w-7xl px-4 py-6 pb-28 md:px-6 md:pb-6 flex-1">
              <p className="mb-4 text-xs font-medium uppercase tracking-wider text-ink-500 print:hidden">
                {today}
              </p>
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
