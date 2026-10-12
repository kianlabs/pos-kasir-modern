"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Plus,
  ShoppingCart,
  Clock,
  Package,
  ReceiptText,
  X,
  Zap,
} from "lucide-react";
import type { Role } from "@/types";

// Menu aksi cepat (quick actions) untuk halaman DALAM app (setelah login).
// Satu tombol melayang yang mengembang jadi pintasan kerja paling sering:
//   • Transaksi baru (kasir)
//   • Buka/tutup shift
//   • Tambah produk (owner)
//   • Lihat transaksi terakhir
//
// Muncul di atas bottom-nav mobile (tak menutupinya) & di kanan-bawah desktop.
// Ringan, aksesibel (Esc / klik luar menutup), hormati reduced-motion.

type Aksi = { href: string; label: string; icon: React.ReactNode; ownerOnly?: boolean };

const AKSI: Aksi[] = [
  { href: "/kasir", label: "Transaksi baru", icon: <ShoppingCart className="h-[18px] w-[18px]" /> },
  { href: "/shift", label: "Buka / tutup shift", icon: <Clock className="h-[18px] w-[18px]" /> },
  { href: "/transaksi", label: "Transaksi terakhir", icon: <ReceiptText className="h-[18px] w-[18px]" /> },
  { href: "/produk", label: "Tambah produk", icon: <Package className="h-[18px] w-[18px]" />, ownerOnly: true },
];

export default function QuickActions({ role }: { role: Role }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [open]);

  const items = AKSI.filter((a) => !a.ownerOnly || role === "OWNER");

  return (
    <div
      ref={wrapRef}
      className="fixed right-4 z-40 flex flex-col items-end gap-2.5 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] md:bottom-7 md:right-7 print:hidden"
    >
      {open && (
        <div role="menu" aria-label="Aksi cepat" className="flex flex-col items-end gap-2.5">
          {items.map((a) => (
            <button
              key={a.href}
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                router.push(a.href);
              }}
              className="group flex items-center gap-2.5 rounded-full border border-ink-200 bg-surface py-2 pl-4 pr-2 shadow-lg transition-all hover:border-ink-950 active:scale-[0.97]"
            >
              <span className="font-label-md text-label-md text-ink-950">{a.label}</span>
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-ink-100 text-ink-700 transition-colors group-hover:bg-ink-950 group-hover:text-surface">
                {a.icon}
              </span>
            </button>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={open ? "Tutup aksi cepat" : "Buka aksi cepat"}
        className={`flex h-14 w-14 items-center justify-center rounded-full bg-ink-950 text-surface shadow-[0_8px_24px_rgba(0,0,0,0.28)] transition-all hover:bg-black active:scale-[0.95] ${
          open ? "rotate-45" : "rotate-0"
        }`}
      >
        {open ? <X className="h-6 w-6" /> : <Zap className="h-6 w-6" />}
      </button>
    </div>
  );
}
