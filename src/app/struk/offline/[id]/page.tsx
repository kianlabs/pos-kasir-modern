"use client";

// Struk transaksi offline yang BELUM tersync ke server.
// Data dibaca dari antrean IndexedDB (outbox) + cache produk lokal.
//
// SSR-safe: render awal menampilkan "memuat"; IndexedDB hanya dibaca di useEffect.

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { shortId } from "@/shared/category-icon";
import ReceiptView from "@/shared/ReceiptView";
import { hitungUang } from "@/shared/hitung-uang";
import { getCache, getOutbox } from "@/client/offline-db";
import type { OutboxEntry } from "@/client/offline-types";

type CachedProduct = { id: string; name: string; price: number };
type CachedSettings = { enabled: boolean; pct: number };

type Line = { key: string; name: string; qty: number; price: number };

type Receipt = {
  id: string;
  createdAt: number;
  lines: Line[];
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  cash: number;
  payment: "CASH" | "QRIS";
  change: number;
};

export default function StrukOfflinePage(props: { params: Promise<{ id: string }> }) {
  const params = use(props.params);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [receipt, setReceipt] = useState<Receipt | null>(null);

  useEffect(() => {
    let alive = true;

    async function muat(id: string) {
      let entry: OutboxEntry | undefined;
      try {
        entry = await getOutbox(id);
      } catch {
        entry = undefined;
      }
      if (!alive) return;
      if (!entry) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      const [products, settings] = await Promise.all([
        getCache<CachedProduct[]>("products").catch(() => undefined),
        getCache<CachedSettings>("settings").catch(() => undefined),
      ]);
      if (!alive) return;

      const lines: Line[] = entry.payload.items.map((it) => {
        const p = products?.find((x) => x.id === it.productId);
        return {
          key: it.productId,
          name: p?.name ?? `Produk ${shortId(it.productId)}`,
          qty: it.qty,
          price: p?.price ?? 0,
        };
      });

      const subtotal = lines.reduce((n, l) => n + l.price * l.qty, 0);
      // Rumus uang kanonik (shared/hitung-uang) — satu sumber kebenaran (m5).
      const uang = hitungUang({
        subtotal,
        discount: entry.payload.discount,
        taxEnabled: settings?.enabled === true,
        taxPct: settings?.pct || 0,
      });
      const discount = uang.discount;
      const tax = uang.tax;
      const total = uang.total;
      const cash = entry.payload.cash;
      const change = entry.payload.payment === "CASH" ? Math.max(0, cash - total) : 0;

      setReceipt({
        id: entry.id,
        createdAt: entry.createdAt,
        lines,
        subtotal,
        discount,
        tax,
        total,
        cash,
        payment: entry.payload.payment,
        change,
      });
      setLoading(false);
    }

    muat(params.id);
    return () => {
      alive = false;
    };
  }, [params.id]);

  if (loading) {
    return (
      <p className="mx-auto max-w-sm rounded-xl border bg-white p-8 text-center text-sm text-zinc-500">
        Memuat struk…
      </p>
    );
  }

  if (notFound || !receipt) {
    return (
      <div className="mx-auto max-w-sm rounded-xl border bg-white p-8 text-center shadow-xs">
        <p className="text-sm font-semibold text-zinc-700">Struk tidak ditemukan.</p>
        <p className="mt-1 text-xs text-zinc-500">
          Transaksi ini mungkin sudah tersinkron ke server.
        </p>
        <Link
          href="/"
          className="mt-4 inline-block rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white hover:bg-primary-hover"
        >
          Transaksi baru
        </Link>
      </div>
    );
  }

  return (
    <div>
      <ReceiptView
        nama="Struk"
        id={receipt.id}
        createdAtLabel={new Date(receipt.createdAt).toLocaleString("id-ID")}
        lines={receipt.lines}
        subtotal={receipt.subtotal}
        discount={receipt.discount}
        tax={receipt.tax}
        total={receipt.total}
        payment={receipt.payment}
        cash={receipt.cash}
        change={receipt.change}
        badge={
          <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-bold text-amber-800">
            ⏳ Belum tersinkron
          </span>
        }
        footerNote="Struk ini tersimpan lokal & akan tersinkron otomatis."
        actions={
          <div className="mx-auto mt-4 flex max-w-sm gap-2 print:hidden">
            <Link
              href="/"
              className="flex-1 rounded-lg bg-primary py-2.5 text-center text-sm font-bold text-white hover:bg-primary-hover"
            >
              Transaksi baru
            </Link>
            <button
              type="button"
              onClick={() => window.print()}
              className="flex-1 rounded-lg border bg-white py-2.5 text-center text-sm font-bold hover:bg-zinc-50"
            >
              Cetak
            </button>
          </div>
        }
      />
    </div>
  );
}
