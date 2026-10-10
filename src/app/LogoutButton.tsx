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
      router.replace("/masuk");
      router.refresh();
    }
  }

  return (
    <button
      type="button"
      onClick={keluar}
      disabled={loading}
      className="mt-2 w-full rounded-lg border border-ink-200 bg-surface py-1.5 text-caption font-caption text-ink-950 transition hover:bg-ink-100 disabled:opacity-50"
    >
      {loading ? "Keluar…" : "Keluar"}
    </button>
  );
}
