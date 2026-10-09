"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Role } from "@/types";
import { isNavActive, navForRole } from "@/lib/nav";

// Sidebar desktop (md+). Definisi menu ada di lib/nav.ts (satu sumber
// kebenaran, dipakai juga oleh bottom-nav mobile).
export default function SidebarNav({ role }: { role: Role }) {
  const path = usePathname();
  const items = navForRole(role);

  return (
    <nav className="flex flex-col gap-1 p-3">
      {items.map((n) => {
        const active = isNavActive(n.href, path);
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
