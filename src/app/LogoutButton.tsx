"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function keluar() {
    setLoading(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      router.replace("/masuk/_");
      router.refresh();
    }
  }

  return (
    <button
      type="button"
      onClick={keluar}
      disabled={loading}
      className="mt-2 w-full rounded-md bg-stone-800 py-1.5 text-[11px] font-semibold text-zinc-300 transition hover:bg-stone-700 hover:text-white disabled:opacity-50"
    >
      {loading ? "Keluar…" : "Keluar"}
    </button>
  );
}
