"use client";

import { useState } from "react";
import { Zap, Loader2, ArrowRight } from "lucide-react";

interface DemoButtonProps {
  variant?: "primary" | "hero" | "outline" | "card" | "nav" | "inverted";
  label?: string;
  className?: string;
  subtext?: string;
  onSuccess?: () => void;
}

export default function DemoButton({
  variant = "primary",
  label = "⚡ Coba Demo Langsung (Tanpa Daftar)",
  className = "",
  subtext,
  onSuccess,
}: DemoButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDemo() {
    if (loading) return;
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/demo", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Gagal masuk ke mode demo. Silakan coba lagi.");
      }

      if (onSuccess) {
        onSuccess();
      }

      // Hard navigation ke /kasir untuk memastikan Server Components dan cookies
      // ter-refresh secara sempurna tanpa race condition cache browser.
      window.location.href = data.redirect || "/kasir";
    } catch (err: unknown) {
      console.error("[DemoButton]", err);
      setError(err instanceof Error ? err.message : "Terjadi kesalahan koneksi.");
      setLoading(false);
    }
  }

  // Variant CARD: Box khusus peninjau / rekruter yang mencolok & elegan
  if (variant === "card") {
    return (
      <div className={`w-full rounded-2xl border-2 border-ink-950 bg-gradient-to-br from-ink-950 to-ink-900 p-5 text-surface shadow-[0_8px_30px_rgba(0,0,0,0.12)] transition-all ${className}`}>
        <div className="mb-3 flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-surface/15 px-3 py-1 font-caption text-caption font-semibold tracking-wider text-surface uppercase">
            <Zap className="h-3.5 w-3.5 fill-warning text-warning" /> 1-Click Demo
          </span>
          <span className="font-caption text-caption text-ink-300">
            Akses Rekruter & Peninjau
          </span>
        </div>

        <h3 className="font-headline-sm text-headline-sm font-bold text-surface">
          Ingin mencoba tanpa registrasi?
        </h3>
        <p className="mt-1 font-body-sm text-body-sm text-ink-300 leading-relaxed">
          Eksplorasi POS kasir, meja dinamis, stok produk, dan analitik secara instan menggunakan data simulasi warung.
        </p>

        {error && (
          <div className="mt-3 rounded-xl bg-danger-bg p-2.5 font-caption text-caption font-medium text-danger">
            {error}
          </div>
        )}

        <button
          type="button"
          onClick={handleDemo}
          disabled={loading}
          aria-busy={loading}
          className="mt-4 flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-surface font-headline-sm text-headline-sm text-ink-950 shadow-sm transition-all hover:bg-ink-100 active:scale-[0.98] disabled:opacity-60"
        >
          {loading ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin text-ink-950" />
              <span>Menyiapkan Sesi Demo…</span>
            </>
          ) : (
            <>
              <span>{label}</span>
              <ArrowRight className="h-5 w-5" />
            </>
          )}
        </button>
      </div>
    );
  }

  // Variant HERO: Tombol besar di Landing Page
  if (variant === "hero") {
    return (
      <div className={`flex flex-col ${className}`}>
        <button
          type="button"
          onClick={handleDemo}
          disabled={loading}
          aria-busy={loading}
          className="inline-flex h-14 items-center justify-center gap-2 rounded-xl border-2 border-ink-950 bg-surface px-6 py-3.5 font-label-lg text-label-lg text-ink-950 shadow-sm transition-all hover:bg-ink-950 hover:text-surface active:scale-[0.98] disabled:opacity-60"
        >
          {loading ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>Membuka Demo…</span>
            </>
          ) : (
            <>
              <Zap className="h-5 w-5 fill-warning text-warning" />
              <span>{label}</span>
              <ArrowRight className="h-5 w-5" />
            </>
          )}
        </button>
        {subtext && (
          <span className="mt-1 text-center font-caption text-caption text-ink-500">
            {subtext}
          </span>
        )}
        {error && (
          <span className="mt-1.5 text-center font-caption text-caption text-danger">
            {error}
          </span>
        )}
      </div>
    );
  }

  // Variant NAV: Compact tombol navigasi
  if (variant === "nav") {
    return (
      <div className="relative inline-flex flex-col">
        <button
          type="button"
          onClick={handleDemo}
          disabled={loading}
          aria-busy={loading}
          className={`inline-flex items-center gap-1.5 rounded-xl border border-ink-950/20 bg-ink-100 px-3.5 py-2 font-label-md text-label-md font-semibold text-ink-950 transition-all hover:bg-ink-950 hover:text-surface active:scale-[0.98] disabled:opacity-60 ${className}`}
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Menyiapkan…</span>
            </>
          ) : (
            <>
              <Zap className="h-4 w-4 fill-warning text-warning" />
              <span>{label}</span>
            </>
          )}
        </button>
        {error && (
          <span className="absolute top-full mt-1 whitespace-nowrap rounded bg-danger-bg px-2 py-0.5 font-caption text-caption text-danger">
            {error}
          </span>
        )}
      </div>
    );
  }

  // Variant OUTLINE: Border minimalis
  if (variant === "outline") {
    return (
      <div className={`flex flex-col ${className}`}>
        <button
          type="button"
          onClick={handleDemo}
          disabled={loading}
          aria-busy={loading}
          className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-ink-300 bg-surface px-5 font-label-lg text-label-lg text-ink-950 transition-all hover:border-ink-950 hover:bg-ink-100 active:scale-[0.98] disabled:opacity-60"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Menyiapkan…</span>
            </>
          ) : (
            <>
              <Zap className="h-4 w-4 fill-warning text-warning" />
              <span>{label}</span>
            </>
          )}
        </button>
        {error && (
          <span className="mt-1 text-center font-caption text-caption text-danger">
            {error}
          </span>
        )}
      </div>
    );
  }

  // Variant INVERTED: Untuk latar belakang gelap (dark section)
  if (variant === "inverted") {
    return (
      <div className={`flex flex-col ${className}`}>
        <button
          type="button"
          onClick={handleDemo}
          disabled={loading}
          aria-busy={loading}
          className="inline-flex h-14 items-center justify-center gap-2 rounded-xl border border-ink-700 bg-ink-900 px-6 py-3.5 font-label-lg text-label-lg text-surface shadow-sm transition-all hover:bg-ink-800 active:scale-[0.98] disabled:opacity-60"
        >
          {loading ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin text-surface" />
              <span>Menyiapkan Demo…</span>
            </>
          ) : (
            <>
              <Zap className="h-5 w-5 fill-warning text-warning" />
              <span>{label}</span>
              <ArrowRight className="h-5 w-5" />
            </>
          )}
        </button>
        {error && (
          <span className="mt-1 text-center font-caption text-caption text-danger">
            {error}
          </span>
        )}
      </div>
    );
  }

  // Variant PRIMARY (Default)
  return (
    <div className={`flex flex-col ${className}`}>
      <button
        type="button"
        onClick={handleDemo}
        disabled={loading}
        aria-busy={loading}
        className="flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-ink-950 font-headline-sm text-headline-sm text-surface shadow-sm transition-all hover:bg-black active:scale-[0.98] disabled:opacity-60"
      >
        {loading ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin text-surface" />
            <span>Menyiapkan Sesi Demo…</span>
          </>
        ) : (
          <>
            <span>{label}</span>
            <ArrowRight className="h-5 w-5" />
          </>
        )}
      </button>
      {error && (
        <span className="mt-1.5 text-center font-caption text-caption text-danger">
          {error}
        </span>
      )}
    </div>
  );
}
