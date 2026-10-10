"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { rupiah } from "@/shared/rupiah";
import ReceiptView from "@/shared/ReceiptView";
import { productIcon } from "@/shared/category-icon";
import { hitungUang } from "@/shared/hitung-uang";
import { PaymentMethods, QuickCash, Kembalian } from "./_components/PaymentControls";
import ScanListener from "./ScanListener";
import KiosToggle from "./KiosToggle";
import { getCache, putCache } from "@/client/offline-db";
import { enqueueCheckout } from "@/client/offline-sync";
import type { OutboxPayload } from "@/client/offline-types";
import { OUTBOX_CHANGED_EVENT } from "./ConnectionBanner";

type TaxInfo = { enabled: boolean; pct: number };

type Product = { id: string; name: string; price: number; stock: number; category: string; icon: string };
type Cart = Record<string, number>;

// Struk offline yang ditampilkan inline (tanpa navigasi) agar kasir tidak pindah
// halaman — route /struk/* dinamis TIDAK ter-cache SW, jadi push offline = chrome-error.
type OfflineReceipt = {
  id: string;
  createdAt: number;
  lines: { key: string; name: string; qty: number; price: number }[];
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  cash: number;
  payment: "CASH" | "QRIS";
  change: number;
};

// Badge stok kartu produk pada palet Warm Monochrome (netral + sinyal halus).
function stockBadgeStyle(stock: number): string {
  if (stock <= 0) return "bg-ink-950 text-surface border-ink-950";
  return "bg-ink-100 text-ink-700 border-ink-200";
}

export default function KasirPage() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<Cart>({});
  const [cash, setCash] = useState("");
  const [payment, setPayment] = useState<"CASH" | "QRIS">("CASH");
  const [discount, setDiscount] = useState("");
  const [taxInfo, setTaxInfo] = useState({ enabled: true, pct: 10 });
  const [hasShift, setHasShift] = useState<boolean | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("Semua");
  const [offlineReceipt, setOfflineReceipt] = useState<OfflineReceipt | null>(null);

  async function load() {
    try {
      const res = await fetch("/api/products");
      if (!res.ok) throw new Error();
      const data: Product[] = await res.json();
      setProducts(data);
      // Simpan salinan lokal agar kasir tetap bisa jualan saat offline.
      putCache("products", data).catch(() => {});
    } catch {
      // Offline / server tak terjangkau → pakai salinan lokal bila ada.
      const cached = await getCache<Product[]>("products").catch(() => undefined);
      if (cached && cached.length > 0) {
        setProducts(cached);
        setError("");
      } else {
        setError("Gagal memuat produk. Cek koneksi lalu refresh halaman.");
      }
    }
  }
  useEffect(() => {
    load();
    fetch("/api/shifts/active")
      .then((r) => r.json())
      .then((s) => setHasShift(!!s))
      .catch(() => setHasShift(null));
    fetch("/api/settings")
      .then((r) => r.json())
      .then((s) => {
        const info: TaxInfo = { enabled: !!s.taxEnabled, pct: Number(s.taxPct) || 0 };
        setTaxInfo(info);
        putCache("settings", info).catch(() => {});
      })
      .catch(async () => {
        const cached = await getCache<TaxInfo>("settings").catch(() => undefined);
        if (cached) setTaxInfo(cached);
      });
  }, []);

  const categories = useMemo(
    () => ["Semua", ...Array.from(new Set(products.map((p) => p.category)))],
    [products]
  );

  const filtered = products.filter(
    (p) =>
      (category === "Semua" || p.category === category) &&
      p.name.toLowerCase().includes(search.toLowerCase())
  );

  const lines = useMemo(
    () =>
      Object.entries(cart)
        .map(([id, qty]) => ({ product: products.find((p) => p.id === id)!, qty }))
        .filter((l) => l.product && l.qty > 0),
    [cart, products]
  );
  const subtotal = lines.reduce((n, l) => n + l.product.price * l.qty, 0);
  const itemCount = lines.reduce((n, l) => n + l.qty, 0);
  // Rumus uang kanonik (shared/hitung-uang) — satu sumber kebenaran (m5).
  const uang = hitungUang({
    subtotal,
    discount: Number(discount) || 0,
    taxEnabled: taxInfo.enabled,
    taxPct: taxInfo.pct,
  });
  const discNum = uang.discount;
  const taxNum = uang.tax;
  const total = uang.total;
  const cashNum = Number(cash) || 0;
  const kembalian = cashNum - total;
  const canPay =
    lines.length > 0 && !loading && (payment === "QRIS" || cashNum >= total);

  function add(id: string) {
    const p = products.find((x) => x.id === id);
    // <= 0 (bukan == 0): stok bisa MINUS setelah sync offline (PRD §12);
    // Math.min dengan stok negatif akan membuat qty negatif & keranjang rusak.
    if (!p || p.stock <= 0) return;
    setCart((c) => ({ ...c, [id]: Math.min((c[id] ?? 0) + 1, p.stock) }));
    setError("");
  }
  function dec(id: string) {
    setCart((c) => {
      const qty = (c[id] ?? 0) - 1;
      const next = { ...c };
      if (qty <= 0) delete next[id];
      else next[id] = qty;
      return next;
    });
  }

  // Mode barcode scanner (PRD §7a). Skema Product tidak punya kolom barcode,
  // jadi kode dicocokkan: (1) exact id, lalu (2) exact nama (abaikan besar/kecil
  // huruf). Tidak ketemu → abaikan (tanpa error) agar tidak mengganggu alur jual.
  function onScan(code: string) {
    const kode = code.trim();
    const target =
      products.find((p) => p.id === kode) ??
      products.find((p) => p.name.toLowerCase() === kode.toLowerCase());
    if (target) {
      add(target.id);
    } else {
      setError(`Barcode tidak dikenali: ${kode}`);
    }
  }

  // Simpan transaksi ke antrean IndexedDB lalu TAMPILKAN struk inline (tanpa navigasi).
  // PRD §12: offline TIDAK memblokir penjualan — stok boleh minus sementara,
  // server memvalidasi ulang saat sync.
  // Struk dirender dari data di memori (bukan baca IndexedDB / route dinamis) agar
  // tetap aman saat offline & tidak bergantung pada cache service worker.
  async function simpanOffline() {
    const id = crypto.randomUUID();
    const createdAt = Date.now();
    const receipt: OfflineReceipt = {
      id,
      createdAt,
      lines: lines.map((l) => ({
        key: l.product.id,
        name: l.product.name,
        qty: l.qty,
        price: l.product.price,
      })),
      subtotal,
      discount: discNum,
      tax: taxNum,
      total,
      cash: payment === "CASH" ? cashNum : total,
      payment,
      change: payment === "CASH" ? Math.max(0, kembalian) : 0,
    };
    const payload: OutboxPayload = {
      items: lines.map((l) => ({ productId: l.product.id, qty: l.qty })),
      cash: receipt.cash,
      payment,
      discount: discNum,
      // Total otoritatif yang dihitung client (harga cache) — uang sudah diterima
      // saat offline; server memakainya agar sync tak ditolak karena selisih. PRD §12.
      total,
    };
    await enqueueCheckout(payload, { id });
    window.dispatchEvent(new Event(OUTBOX_CHANGED_EVENT));
    setCart({});
    setCash("");
    setDiscount("");
    setOfflineReceipt(receipt);
  }

  async function bayar() {
    setError("");
    if (lines.length === 0) return setError("Keranjang masih kosong.");
    if (payment === "CASH" && cashNum < total)
      return setError(`Uang kurang ${rupiah(total - cashNum)}.`);
    setLoading(true);

    // Offline terdeteksi → langsung ke antrean lokal (jangan blokir).
    const online = !(typeof navigator !== "undefined" && !navigator.onLine);
    // M3: saat ONLINE tanpa shift BUKA, JANGAN jual — kas tak akan masuk rekap
    // shift mana pun & tak bisa direkonsiliasi. Blokir SEBELUM simpan/sync.
    // Jalur OFFLINE (online === false) TIDAK terpengaruh: tetap ke antrean lokal.
    if (online && hasShift === false) {
      setLoading(false);
      return setError("Belum buka shift. Buka shift dulu di menu Shift sebelum menerima pembayaran.");
    }
    if (!online) {
      try {
        await simpanOffline();
      } catch {
        setError("Gagal menyimpan transaksi offline.");
      } finally {
        setLoading(false);
      }
      return;
    }

    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: lines.map((l) => ({ productId: l.product.id, qty: l.qty })),
          cash: payment === "CASH" ? cashNum : total,
          payment,
          discount: discNum,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Gagal checkout.");
        load(); // stok mungkin berubah
        return;
      }
      router.push(`/struk/${data.id}`);
    } catch {
      // Fetch reject = jaringan mati walau navigator.onLine masih true.
      // Jangan tampilkan error blokir — simpan ke antrean offline.
      try {
        await simpanOffline();
      } catch {
        setError("Tidak bisa hubungi server. Coba lagi.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col">
      {offlineReceipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/40 backdrop-blur-[2px] p-4">
          <div className="max-h-[90vh] w-full max-w-sm overflow-y-auto rounded-2xl border border-ink-200 bg-surface p-6 font-mono text-sm shadow-[0_8px_32px_rgba(0,0,0,0.12)]">
            <ReceiptView
              nama="Struk"
              id={offlineReceipt.id}
              createdAtLabel={new Date(offlineReceipt.createdAt).toLocaleString("id-ID")}
              lines={offlineReceipt.lines}
              subtotal={offlineReceipt.subtotal}
              discount={offlineReceipt.discount}
              tax={offlineReceipt.tax}
              total={offlineReceipt.total}
              payment={offlineReceipt.payment}
              cash={offlineReceipt.cash}
              change={offlineReceipt.change}
              badge={
                <span className="rounded-full bg-ink-100 px-2.5 py-0.5 text-[11px] font-bold text-ink-700 border border-ink-200">
                  Belum tersinkron
                </span>
              }
              footerNote="Struk ini tersimpan lokal & akan tersinkron otomatis."
              className=""
              actions={
                <button
                  type="button"
                  onClick={() => setOfflineReceipt(null)}
                  className="mt-4 w-full h-14 rounded-xl bg-ink-950 py-3 font-label-lg text-label-lg text-surface shadow-sm hover:bg-black active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                >
                  <span className="material-symbols-outlined text-[20px]" aria-hidden>
                    arrow_forward
                  </span>
                  Transaksi Baru
                </button>
              }
            />
          </div>
        </div>
      )}

      {/* Header ringkas + kontrol alat (scanner & kios) + pencarian cepat */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
        <div className="flex items-center gap-3">
          <h1 className="text-headline-md font-headline-md font-bold tracking-tight text-ink-950">
            Kasir
          </h1>
          <span className="hidden items-center gap-1.5 rounded-full border border-ink-200 bg-ink-100 px-2.5 py-1 text-caption font-caption text-ink-700 sm:inline-flex">
            <span className="h-1.5 w-1.5 rounded-full bg-ink-950" />
            {itemCount} item
          </span>
        </div>
        <div className="flex items-center gap-2 sm:ml-auto">
          <ScanListener onScan={onScan} />
          <KiosToggle />
        </div>
      </div>

      {hasShift === false && (
        <Link
          href="/shift"
          className="mb-4 flex items-center gap-2 rounded-xl border border-ink-200 bg-ink-100 px-4 py-3 text-label-md font-label-md text-ink-700 hover:bg-ink-200 transition-colors"
        >
          <span className="material-symbols-outlined text-[20px] text-danger" aria-hidden>
            warning
          </span>
          Belum buka shift — pembayaran ONLINE diblokir sampai shift dibuka. Sale offline tetap bisa
          disimpan. Buka shift dulu →
        </Link>
      )}

      <div className="grid items-start gap-5 xl:grid-cols-[1fr_minmax(360px,410px)]">
        {/* ================= ZONE 2: KATALOG ================= */}
        <section className="min-w-0">
          {/* Search bar 48px touch-first */}
          <div className="relative mb-3 w-full">
            <span
              className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-ink-500 material-symbols-outlined text-[20px]"
              aria-hidden
            >
              search
            </span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari menu atau kode barcode…"
              className="h-12 w-full rounded-xl border border-ink-200 bg-surface pl-11 pr-4 text-body-md font-body-md text-ink-950 placeholder-ink-500 outline-none focus:border-ink-950 transition-colors"
            />
          </div>

          {/* Chip kategori horizontal (touch target 48px) */}
          <div className="nice-scroll mb-4 flex items-center gap-2.5 overflow-x-auto pb-1">
            {categories.map((c) => {
              const active = category === c;
              const count =
                c === "Semua"
                  ? products.length
                  : products.filter((p) => p.category === c).length;
              return (
                <button
                  key={c}
                  onClick={() => setCategory(c)}
                  className={`h-12 shrink-0 whitespace-nowrap rounded-xl px-4 text-label-md font-label-md flex items-center gap-2 transition-colors ${
                    active
                      ? "bg-ink-950 border border-ink-950 text-surface shadow-sm"
                      : "border border-ink-200 bg-surface text-ink-500 hover:bg-ink-100 hover:text-ink-950"
                  }`}
                >
                  <span>{c}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-caption font-caption border ${
                      active
                        ? "bg-surface/15 text-surface border-surface/20"
                        : "bg-ink-100 text-ink-500 border-ink-200"
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Grid produk (2/3/4 kolom) */}
          {filtered.length === 0 ? (
            <p className="rounded-2xl border border-ink-200 bg-surface p-8 text-center text-body-md text-ink-500">
              Produk tidak ditemukan.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-4">
              {filtered.map((p) => {
                const soldOut = p.stock <= 0;
                const inCart = cart[p.id] ?? 0;
                return (
                  <button
                    key={p.id}
                    onClick={() => add(p.id)}
                    disabled={soldOut}
                    className={`group relative flex flex-col justify-between rounded-2xl border p-4 text-left transition-all ${
                      soldOut
                        ? "cursor-not-allowed border-ink-200 bg-ink-100 opacity-60"
                        : "border-ink-200 bg-surface hover:border-ink-950 active:scale-[0.98]"
                    }`}
                  >
                    <div className="w-full">
                      <div className="mb-2 flex items-start justify-between gap-2">
                        <span
                          className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                            soldOut ? "bg-ink-200 text-ink-500" : "bg-ink-100 text-ink-700"
                          }`}
                        >
                          {productIcon(p)}
                        </span>
                        <span
                          className={`rounded border px-2 py-0.5 text-caption font-caption tabular-nums ${stockBadgeStyle(
                            p.stock
                          )}`}
                        >
                          {soldOut ? "Habis" : `Stok: ${p.stock}`}
                        </span>
                      </div>
                      <h3
                        className={`line-clamp-2 text-body-md font-body-md font-semibold leading-snug ${
                          soldOut ? "text-ink-700" : "text-ink-950"
                        }`}
                      >
                        {p.name}
                      </h3>
                      <p className="mt-0.5 text-caption font-caption text-ink-500">{p.category}</p>
                    </div>
                    <div className="mt-4 flex w-full items-center justify-between border-t border-ink-200 pt-3">
                      <span
                        className={`text-numeral-md font-numeral-md tabular-nums ${
                          soldOut ? "text-ink-500" : "text-ink-950"
                        }`}
                      >
                        {rupiah(p.price)}
                      </span>
                      {soldOut ? (
                        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-ink-200 text-ink-500">
                          <span className="material-symbols-outlined text-[18px]" aria-hidden>
                            block
                          </span>
                        </span>
                      ) : inCart > 0 ? (
                        <span className="flex h-8 min-w-8 items-center justify-center rounded-lg bg-ink-950 px-1.5 text-label-md font-label-md tabular-nums text-surface">
                          {inCart}
                        </span>
                      ) : (
                        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-ink-100 text-ink-700 transition-colors group-hover:bg-ink-950 group-hover:text-surface">
                          <span className="material-symbols-outlined text-[18px]" aria-hidden>
                            add
                          </span>
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {/* ================= ZONE 3: STICKY ORDER TICKET PANEL ================= */}
        <aside className="overflow-hidden rounded-2xl border border-ink-200 bg-surface shadow-xs xl:sticky xl:top-6">
          {/* Header panel */}
          <div className="flex items-center justify-between border-b border-ink-200 p-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-headline-sm font-headline-sm text-ink-950">Pesanan</h2>
                <span className="rounded border border-ink-200 bg-ink-100 px-2 py-0.5 text-caption font-caption text-ink-700">
                  Dine In
                </span>
              </div>
              <p className="mt-0.5 text-caption font-caption tabular-nums text-ink-500">
                {itemCount} item • Kasir
              </p>
            </div>
            {lines.length > 0 && (
              <button
                onClick={() => setCart({})}
                title="Kosongkan keranjang"
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-ink-200 text-ink-500 transition-colors hover:bg-ink-100 hover:text-danger"
              >
                <span className="material-symbols-outlined text-[20px]" aria-hidden>
                  delete
                </span>
              </button>
            )}
          </div>

          {/* Daftar line item (scrollable, stepper 48px) */}
          <div className="nice-scroll max-h-[38vh] divide-y divide-ink-200 overflow-y-auto px-4 xl:max-h-72">
            {lines.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-12 text-center text-body-md text-ink-500">
                <span className="material-symbols-outlined text-[32px] text-ink-300" aria-hidden>
                  shopping_bag
                </span>
                Klik produk untuk menambah
                <br />
                ke pesanan
              </div>
            ) : (
              lines.map((l) => (
                <div key={l.product.id} className="py-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <span className="text-body-md font-body-md font-semibold text-ink-950">
                        {l.product.name}
                      </span>
                      <div className="mt-1 text-caption font-caption tabular-nums text-ink-500">
                        @ {rupiah(l.product.price)}
                      </div>
                    </div>
                    <span className="text-right text-numeral-md font-numeral-md tabular-nums text-ink-950">
                      {rupiah(l.product.price * l.qty)}
                    </span>
                  </div>
                  <div className="mt-2.5 flex items-center justify-end">
                    <div className="flex items-center rounded-xl border border-ink-200 bg-surface">
                      <button
                        onClick={() => dec(l.product.id)}
                        aria-label="Kurangi jumlah"
                        className="flex h-10 w-12 items-center justify-center rounded-l-xl text-ink-950 transition-colors hover:bg-ink-100 active:bg-ink-200"
                      >
                        <span className="material-symbols-outlined text-[18px]" aria-hidden>
                          remove
                        </span>
                      </button>
                      <span className="w-9 text-center text-numeral-md font-numeral-md tabular-nums text-ink-950">
                        {l.qty}
                      </span>
                      <button
                        onClick={() => add(l.product.id)}
                        aria-label="Tambah jumlah"
                        className="flex h-10 w-12 items-center justify-center rounded-r-xl text-ink-950 transition-colors hover:bg-ink-100 active:bg-ink-200"
                      >
                        <span className="material-symbols-outlined text-[18px]" aria-hidden>
                          add
                        </span>
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Ringkasan & aksi pembayaran */}
          <div className="space-y-1.5 border-t border-ink-200 px-4 pb-3 pt-3">
            <div className="flex items-center justify-between text-body-md font-body-md text-ink-700">
              <span>Subtotal</span>
              <span className="tabular-nums font-medium text-ink-950">{rupiah(subtotal)}</span>
            </div>

            {/* Diskon (input digit mentah — perilaku tidak berubah) */}
            <div className="pt-1">
              <input
                value={discount}
                onChange={(e) => setDiscount(e.target.value.replace(/\D/g, ""))}
                inputMode="numeric"
                placeholder="Diskon Rp (opsional)"
                className="h-10 w-full rounded-lg border border-ink-200 bg-surface px-2.5 text-body-sm text-ink-950 placeholder-ink-500 outline-none focus:border-ink-950 transition-colors tabular-nums"
              />
            </div>
            {(discNum > 0 || taxNum > 0) && (
              <div className="pt-1 text-body-md font-body-md text-ink-700">
                {discNum > 0 && (
                  <div className="flex justify-between">
                    <span>Diskon</span>
                    <span className="tabular-nums font-medium text-ink-950">
                      −{rupiah(discNum)}
                    </span>
                  </div>
                )}
                {taxNum > 0 && (
                  <div className="flex justify-between">
                    <span>Pajak ({taxInfo.pct}%)</span>
                    <span className="tabular-nums font-medium text-ink-950">
                      +{rupiah(taxNum)}
                    </span>
                  </div>
                )}
              </div>
            )}

            <div className="mt-2 flex items-baseline justify-between border-t border-ink-200 pt-2">
              <div className="flex flex-col">
                <span className="text-caption font-caption uppercase tracking-wider text-ink-500">
                  Total Belanja
                </span>
                <span className="text-caption font-caption tabular-nums text-ink-500">
                  {lines.length} Jenis • {itemCount} Porsi
                </span>
              </div>
              <span className="text-numeral-hero font-numeral-hero tabular-nums tracking-tight text-ink-950">
                {rupiah(total)}
              </span>
            </div>

            {/* Metode bayar + kontrol tunai */}
            <div className="pt-2">
              <PaymentMethods payment={payment} onChange={setPayment} />

              {payment === "CASH" ? (
                <>
                  <QuickCash total={total} onPick={setCash} />
                  <input
                    value={cash ? Number(cash).toLocaleString("id-ID") : ""}
                    onChange={(e) => setCash(e.target.value.replace(/\D/g, ""))}
                    inputMode="numeric"
                    aria-label="Nominal tunai diterima"
                    placeholder="Nominal diterima…"
                    className="mt-3 h-16 w-full rounded-xl border-2 border-ink-950 bg-surface px-4 text-right text-display-hero-mobile font-display-hero-mobile tabular-nums tracking-tight text-ink-950 outline-none focus:ring-2 focus:ring-ink-950/20"
                  />
                  <Kembalian cash={cash} kembalian={kembalian} />
                </>
              ) : (
                <div className="mt-3 flex flex-col items-center gap-2 rounded-xl border border-ink-200 bg-ink-950 p-4 text-center">
                  <span className="material-symbols-outlined text-[28px] text-surface" aria-hidden>
                    qr_code_2
                  </span>
                  <p className="text-caption font-caption text-ink-300">
                    Tunjukkan QR toko ke pembeli,
                    <br />
                    tekan Bayar setelah lunas.
                  </p>
                </div>
              )}
            </div>

            {error && (
              <p className="mt-2 flex items-start gap-2 rounded-lg border border-ink-200 bg-danger-bg px-3 py-2 text-body-sm font-medium text-danger">
                <span className="material-symbols-outlined text-[18px]" aria-hidden>
                  error
                </span>
                {error}
              </p>
            )}

            {/* CTA BAYAR 64px */}
            <button
              onClick={bayar}
              disabled={!canPay}
              className="mt-3 flex h-16 w-full items-center justify-between rounded-xl bg-ink-950 px-6 text-surface shadow-md transition-all hover:bg-black active:scale-[0.98] disabled:opacity-40"
            >
              <span className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface/10">
                  <span className="material-symbols-outlined text-[24px]" aria-hidden>
                    payments
                  </span>
                </span>
                <span className="text-headline-sm font-headline-sm font-bold tracking-wide">
                  {loading ? "PROSES…" : "BAYAR"}
                </span>
              </span>
              <span className="flex items-center gap-2">
                <span className="text-numeral-lg font-numeral-lg tabular-nums">{rupiah(total)}</span>
                <span className="material-symbols-outlined text-[22px]" aria-hidden>
                  arrow_forward
                </span>
              </span>
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}
