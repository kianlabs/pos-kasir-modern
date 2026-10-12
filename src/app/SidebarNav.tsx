"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Role } from "@/types";
import { isNavActive, navForRole } from "@/shared/nav";

export default function SidebarNav({ role }: { role: Role }) {
  const path = usePathname();
  const items = navForRole(role);

  return (
    <nav className="flex flex-col gap-0.5 p-3">
      {items.map((n) => {
        const active = isNavActive(n.href, path);
        const Icon = n.icon;
        return (
          <Link
            key={n.href}
            href={n.href}
            className={`group flex items-center gap-3 rounded-lg px-3 py-2.5 text-body-md font-body-md transition ${
              active
                ? "bg-ink-950 text-surface font-semibold"
                : "text-ink-700 hover:bg-ink-100 hover:text-ink-950"
            }`}
          >
            <Icon
              className={`h-[18px] w-[18px] shrink-0 ${
                active ? "text-surface" : "text-ink-500 group-hover:text-ink-950"
              }`}
              strokeWidth={2}
            />
            <span>{n.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
