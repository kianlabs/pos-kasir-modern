"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Role } from "@/types";
import { isNavActive, navForRole } from "@/shared/nav";

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
            className={`flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-body-md font-body-md transition ${
              active
                ? "bg-ink-950 text-surface font-semibold shadow-sm"
                : "text-ink-700 hover:bg-ink-100 hover:text-ink-950"
            }`}
          >
            <span className="text-lg">{n.icon}</span>
            <span>{n.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
