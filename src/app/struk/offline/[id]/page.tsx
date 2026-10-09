"use client";

// Struk transaksi offline yang BELUM tersync ke server.
// Data dibaca dari antrean IndexedDB (outbox) + cache produk lokal.
//
// SSR-safe: render awal menampilkan "memuat"; IndexedDB hanya dibaca di useEffect.

import { useEffect, useState } from "react";
import Link from "next/link";
import { rupiah } from "@/shared/rupiah";
import { PAYMENT_LABEL, shortId } from "@/shared/category-icon";
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

export default function StrukOfflinePage({ params }: { params: { id: string } }) {
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
      const discount = Math.min(entry.payload.discount, subtotal);
      const tax =
        settings?.enabled === true
          ? Math.round(((subtotal - discount) * (settings.pct || 0)) / 100)
          : 0;
      const total = subtotal - discount + tax;
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
      <div className="mx-auto max-w-sm rounded-xl border bg-white p-8 text-center shadow-sm">
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
      <div className="print-area mx-auto max-w-sm rounded-xl border bg-white p-6 font-mono text-sm shadow-sm">
        <h1 className="text-center text-lg font-bold">🧾 Struk</h1>
        <p className="text-center text-xs text-zinc-500">
          {new Date(receipt.createdAt).toLocaleString("id-ID")} • #{shortId(receipt.id)}
        </p>
        <div className="mt-2 flex justify-center">
          <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-bold text-amber-800">
            ⏳ Belum tersinkron
          </span>
        </div>
        <div className="my-3 border-t-2 border-dashed" />
        {receipt.lines.map((l) => (
          <div key={l.key} className="mb-1.5">
            <div className="font-bold">{l.name}</div>
            <div className="flex justify-between text-zinc-700">
              <span>
                {l.qty} × {rupiah(l.price)}
              </span>
              <span>{rupiah(l.price * l.qty)}</span>
            </div>
          </div>
        ))}
        <div className="my-3 border-t-2 border-dashed" />
        <div className="flex justify-between">
          <span>Subtotal</span>
          <span>{rupiah(receipt.subtotal)}</span>
        </div>
        {receipt.discount > 0 && (
          <div className="flex justify-between">
            <span>Diskon</span>
            <span>−{rupiah(receipt.discount)}</span>
          </div>
        )}
        {receipt.tax > 0 && (
          <div className="flex justify-between">
            <span>Pajak</span>
            <span>+{rupiah(receipt.tax)}</span>
          </div>
        )}
        <div className="flex justify-between text-base font-bold">
          <span>TOTAL</span>
          <span>{rupiah(receipt.total)}</span>
        </div>
        <div className="mt-1 flex justify-between">
          <span>{PAYMENT_LABEL[receipt.payment] ?? receipt.payment}</span>
          <span>{rupiah(receipt.cash)}</span>
        </div>
        {receipt.payment === "CASH" && (
          <div className="flex justify-between">
            <span>Kembali</span>
            <span>{rupiah(receipt.change)}</span>
          </div>
        )}
        <div className="my-3 border-t-2 border-dashed" />
        <p className="text-center text-xs text-zinc-500">
          Terima kasih & sampai jumpa 🙏
          <br />
          Struk ini tersimpan lokal & akan tersinkron otomatis.
        </p>
      </div>

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
    </div>
  );
}
