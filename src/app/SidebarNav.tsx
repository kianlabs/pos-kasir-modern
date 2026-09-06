"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/", label: "Kasir", icon: "🛒" },
  { href: "/produk", label: "Produk", icon: "📦" },
  { href: "/transaksi", label: "Transaksi", icon: "🧾" },
  { href: "/shift", label: "Shift", icon: "⏰" },
  { href: "/stok", label: "Stok", icon: "📋" },
  { href: "/laporan", label: "Laporan", icon: "📊" },
  { href: "/pengaturan", label: "Pengaturan", icon: "⚙️" },
];

export default function SidebarNav() {
  const path = usePathname();

  return (
    <nav className="flex flex-col gap-1 p-3">
      {NAV.map((n) => {
        const active = n.href === "/" ? path === "/" : path.startsWith(n.href);
        return (
          <Link
            key={n.href}
            href={n.href}
            className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
              active
                ? "bg-orange-500 text-white shadow"
                : "text-zinc-400 hover:bg-stone-800 hover:text-white"
            }`}
          >
            <span className="text-lg">{n.icon}</span>
            {n.label}
          </Link>
        );
      })}
    </nav>
  );
}
