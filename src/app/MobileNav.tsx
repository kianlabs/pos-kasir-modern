"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Role } from "@/types";
import { bottomOverflow, bottomPrimary, isNavActive } from "@/lib/nav";

// Bottom navigation mobile (< md). Menu utama selalu tampil di bawah
// (jangkauan jempol); menu lain (owner-only) masuk sheet "Lainnya".
// Dipakai berdampingan dengan top-bar mobile yang hanya menampilkan brand.
export default function MobileNav({ role }: { role: Role }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const primary = bottomPrimary(role);
  const overflow = bottomOverflow(role);

  // highlight "Lainnya" bila halaman aktif bukan salah satu menu utama.
  const overflowActive = overflow.some((n) => isNavActive(n.href, path));

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-40 md:hidden print:hidden" role="dialog" aria-modal="true">
          <button
            aria-label="Tutup menu"
            className="absolute inset-0 bg-black/40"
            onClick={() => setOpen(false)}
          />
          <div className="absolute inset-x-0 bottom-0 rounded-t-2xl bg-white p-4 pb-24 shadow-2xl">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-bold">Menu Lainnya</h2>
              <button
                onClick={() => setOpen(false)}
                className="rounded-md px-2 py-1 text-sm font-semibold text-zinc-500"
              >
                Tutup
              </button>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {overflow.map((n) => {
                const active = isNavActive(n.href, path);
                return (
                  <Link
                    key={n.href}
                    href={n.href}
                    onClick={() => setOpen(false)}
                    className={`flex flex-col items-center gap-1.5 rounded-xl border p-4 text-xs font-semibold ${
                      active
                        ? "border-primary bg-accent-bg text-primary"
                        : "border-zinc-200 bg-white text-zinc-600"
                    }`}
                  >
                    <span className="text-2xl">{n.icon}</span>
                    {n.label}
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <nav
        className="fixed inset-x-0 bottom-0 z-30 border-t bg-white/95 backdrop-blur md:hidden print:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="grid grid-cols-5">
          {primary.map((n) => {
            const active = isNavActive(n.href, path);
            return (
              <Link
                key={n.href}
                href={n.href}
                className={`flex flex-col items-center gap-0.5 py-2 text-[11px] font-semibold ${
                  active ? "text-primary" : "text-zinc-500"
                }`}
              >
                <span className={`text-xl ${active ? "" : "opacity-80"}`}>{n.icon}</span>
                {n.label}
              </Link>
            );
          })}
          {overflow.length > 0 && (
            <button
              onClick={() => setOpen(true)}
              aria-expanded={open}
              className={`flex flex-col items-center gap-0.5 py-2 text-[11px] font-semibold ${
                overflowActive ? "text-primary" : "text-zinc-500"
              }`}
            >
              <span className={`text-xl ${overflowActive ? "" : "opacity-80"}`}>☰</span>
              Lainnya
            </button>
          )}
        </div>
      </nav>
    </>
  );
}
