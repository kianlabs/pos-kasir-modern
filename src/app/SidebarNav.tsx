"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Role } from "@/types";

// Menu per role (PRD §6.2): kasir hanya jualan + lihat shift/stok/transaksi;
// owner dapat semua termasuk produk, laporan, pengaturan.
const NAV: { href: string; label: string; icon: string; roles: Role[] }[] = [
  { href: "/", label: "Kasir", icon: "🛒", roles: ["OWNER", "KASIR"] },
  { href: "/transaksi", label: "Transaksi", icon: "🧾", roles: ["OWNER", "KASIR"] },
  { href: "/shift", label: "Shift", icon: "⏰", roles: ["OWNER", "KASIR"] },
  { href: "/stok", label: "Stok", icon: "📋", roles: ["OWNER", "KASIR"] },
  { href: "/produk", label: "Produk", icon: "📦", roles: ["OWNER"] },
  { href: "/laporan", label: "Laporan", icon: "📊", roles: ["OWNER"] },
  { href: "/pengaturan", label: "Pengaturan", icon: "⚙️", roles: ["OWNER"] },
];

export default function SidebarNav({ role }: { role: Role }) {
  const path = usePathname();
  const items = NAV.filter((n) => n.roles.includes(role));

  return (
    <nav className="flex flex-col gap-1 p-3">
      {items.map((n) => {
        const active = n.href === "/" ? path === "/" : path.startsWith(n.href);
        return (
          <Link
            key={n.href}
            href={n.href}
            className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
              active
                ? "bg-primary text-white shadow"
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
