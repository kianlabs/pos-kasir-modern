"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { rupiah } from "@/lib/rupiah";
import { productIcon } from "@/lib/meta";

// Panel aksi bill DRAFT meja. Endpoint dibuat worker lain (kontrak plan §4.3):
//  - Buka bill   POST   /api/meja/[mejaId]/bill
//  - Tambah item PATCH  /api/bills/[billId] { items:[{productId,qty}], discount? }
//                (qty = DELTA: positif menambah, negatif mengurangi)
//  - Bayar       POST   /api/bills/[billId]/bayar { cash, payment }
//  - Batal       DELETE /api/bills/[billId]
//  - Gabung      POST   /api/bills/[billId]/gabung { sourceBillId }
//  - Pisah       POST   /api/bills/[billId]/pisah  { targetMejaId, items:[{transactionItemId,qty}] }
// Setiap mutasi sukses → router.refresh() agar server component memuat ulang bill.
// Bayar sukses → router.push(`/struk/${id}`).

type Product = { id: string; name: string; price: number; stock: number; category: string; icon: string };
type BillItem = { id: string; productId: string; name: string; price: number; qty: number };
type OtherBill = { billId: string; nomor: string };
type EmptyMeja = { id: string; nomor: string };

type Props = {
  billId: string | null;
  mejaId: string;
  hasShift: boolean;
  items: BillItem[];
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  products: Product[];
  otherBills: OtherBill[];
  emptyMejas: EmptyMeja[];
};

const QUICK_CASH = [10000, 20000, 50000, 100000];

export default function BillPanel({
  billId,
  mejaId,
  hasShift,
  items,
  subtotal,
  discount,
  tax,
  total,
  products,
  otherBills,
  emptyMejas,
}: Props) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Tambah item
  const [productId, setProductId] = useState("");
  const [qty, setQty] = useState("1");

  // Diskon
  const [discountInput, setDiscountInput] = useState(discount > 0 ? String(discount) : "");

  // Bayar
  const [payment, setPayment] = useState<"CASH" | "QRIS">("CASH");
  const [cash, setCash] = useState("");

  // Gabung / pisah
  const [gabungSource, setGabungSource] = useState("");
  const [pisahTarget, setPisahTarget] = useState("");
  const [pisahPick, setPisahPick] = useState<Record<string, { on: boolean; qty: string }>>({});

  // Sinkronkan input diskon dengan nilai server (setelah refresh/clamp).
  useEffect(() => {
    setDiscountInput(discount > 0 ? String(discount) : "");
  }, [discount]);

  const categories = useMemo(
    () => Array.from(new Set(products.map((p) => p.category))),
    [products]
  );

  const discNum = Math.min(Number(discountInput) || 0, subtotal);
  const cashNum = Number(cash) || 0;
  const kembalian = cashNum - total;
  const canPay = items.length > 0 && !loading && (payment === "QRIS" || cashNum >= total);

  // Sisa stok "efektif" = stok produk − qty yang sudah ada di bill INI.
  // Sebelum bayar stok belum berkurang (§7), jadi tanpa ini dropdown
  // menampilkan stok lama dan menyesatkan kasir.
  const qtyDiBill = useMemo(() => {
    const m = new Map<string, number>();
    for (const it of items) m.set(it.productId, (m.get(it.productId) ?? 0) + it.qty);
    return m;
  }, [items]);
  const sisaStok = (p: Product) => p.stock - (qtyDiBill.get(p.id) ?? 0);

  // Item bill yang qty-nya melebihi stok tersedia → bayar pasti gagal (stok
  // dicek saat bayar). Beri peringatan proaktif agar kasir tidak kaget.
  const kurangStok = useMemo(() => {
    const out: { name: string; butuh: number; ada: number }[] = [];
    for (const [pid, qty] of Array.from(qtyDiBill.entries())) {
      const p = products.find((x) => x.id === pid);
      if (p && qty > p.stock) out.push({ name: p.name, butuh: qty, ada: p.stock });
    }
    return out;
  }, [qtyDiBill, products]);

  async function mutate(url: string, method: string, body?: unknown): Promise<{ ok: boolean; data: { error?: string; id?: string } }> {
    setError("");
    setLoading(true);
    try {
      const res = await fetch(url, {
        method,
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; id?: string };
      if (!res.ok) {
        setError(data.error ?? "Terjadi kesalahan.");
        return { ok: false, data };
      }
      return { ok: true, data };
    } catch {
      setError("Tidak bisa hubungi server. Coba lagi.");
      return { ok: false, data: {} };
    } finally {
      setLoading(false);
    }
  }

  async function bukaBill() {
    const r = await mutate(`/api/meja/${mejaId}/bill`, "POST");
    if (r.ok) router.refresh();
  }

  async function tambahItem() {
    if (!billId) return;
    const p = products.find((x) => x.id === productId);
    if (!p) return setError("Pilih produk dulu.");
    const q = Number(qty);
    if (!Number.isInteger(q) || q <= 0) return setError("Qty harus bilangan > 0.");
    const r = await mutate(`/api/bills/${billId}`, "PATCH", {
      items: [{ productId: p.id, qty: q }],
      discount: discNum,
    });
    if (r.ok) {
      setProductId("");
      setQty("1");
      router.refresh();
    }
  }

  // Terapkan diskon tanpa mengubah item. Endpoint PATCH menerima `discount`
  // tanpa `items` (items opsional) → cukup kirim diskon saja.
  async function terapkanDiskon() {
    if (!billId) return;
    const r = await mutate(`/api/bills/${billId}`, "PATCH", {
      discount: Math.max(0, Math.floor(Number(discountInput) || 0)),
    });
    if (r.ok) router.refresh();
  }

  async function bayar() {
    if (!billId) return;
    if (items.length === 0) return setError("Bill masih kosong.");
    if (payment === "CASH" && cashNum < total)
      return setError(`Uang kurang ${rupiah(total - cashNum)}.`);
    const r = await mutate(`/api/bills/${billId}/bayar`, "POST", {
      cash: payment === "CASH" ? cashNum : total,
      payment,
    });
    if (r.ok && r.data.id) {
      router.push(`/struk/${r.data.id}`);
    }
  }

  async function batal() {
    if (!billId) return;
    if (!window.confirm("Batalkan bill ini? Semua item di meja akan dihapus.")) return;
    const r = await mutate(`/api/bills/${billId}`, "DELETE");
    if (r.ok) router.refresh();
  }

  async function gabung() {
    if (!billId || !gabungSource) return setError("Pilih bill sumber dulu.");
    if (!window.confirm("Gabungkan bill sumber ke bill meja ini?")) return;
    const r = await mutate(`/api/bills/${billId}/gabung`, "POST", { sourceBillId: gabungSource });
    if (r.ok) {
      setGabungSource("");
      router.refresh();
    }
  }

  async function pisah() {
    if (!billId) return;
    if (!pisahTarget) return setError("Pilih meja tujuan dulu.");
    const picked = items
      .filter((it) => pisahPick[it.id]?.on)
      .map((it) => ({ transactionItemId: it.id, qty: Number(pisahPick[it.id]?.qty) || 0 }))
      .filter((p) => p.qty > 0);
    if (picked.length === 0) return setError("Pilih minimal satu item untuk dipisah.");
    for (const p of picked) {
      const src = items.find((it) => it.id === p.transactionItemId);
      if (src && p.qty > src.qty) return setError(`Qty ${src.name} melebihi jumlah di bill.`);
    }
    const r = await mutate(`/api/bills/${billId}/pisah`, "POST", {
      targetMejaId: pisahTarget,
      items: picked,
    });
    if (r.ok) {
      setPisahPick({});
      setPisahTarget("");
      router.refresh();
    }
  }

  function togglePick(it: BillItem, on: boolean) {
    setPisahPick((s) => ({ ...s, [it.id]: { on, qty: s[it.id]?.qty ?? String(it.qty) } }));
  }

  const err = error && (
    <p role="alert" aria-live="assertive" className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
      ⚠️ {error}
    </p>
  );

  // ── Meja KOSONG: tombol buka bill ─────────────────────────────
  if (!billId) {
    return (
      <div className="mt-4 space-y-3">
        {err}
        <button
          onClick={bukaBill}
          disabled={!hasShift || loading}
          className="w-full rounded-lg bg-primary py-3 font-bold text-white shadow hover:bg-primary-hover disabled:opacity-40"
        >
          {loading ? "Memproses…" : "Buka Bill Meja Ini"}
        </button>
        {!hasShift && (
          <p className="text-center text-xs text-amber-700">
            Buka shift dulu sebelum membuka bill.
          </p>
        )}
      </div>
    );
  }

  // ── Meja TERISI: aksi bill ────────────────────────────────────
  return (
    <div className="mt-4 space-y-4">
      {err}

      {/* Tambah item */}
      <section className="rounded-xl border bg-white p-4 shadow-sm">
        <h3 className="mb-2 font-bold">Tambah Item</h3>
        <div className="flex flex-col gap-2 sm:flex-row">
          <select
            value={productId}
            onChange={(e) => setProductId(e.target.value)}
            className="min-w-0 flex-1 rounded-lg border bg-white px-3 py-2 text-sm outline-none focus:border-primary"
          >
            <option value="">— Pilih produk —</option>
            {categories.map((c) => (
              <optgroup key={c} label={c}>
                {products
                  .filter((p) => p.category === c)
                  .map((p) => {
                    const sisa = Math.max(0, sisaStok(p));
                    return (
                      <option key={p.id} value={p.id}>
                        {productIcon(p)} {p.name} — {rupiah(p.price)} (sisa {sisa})
                      </option>
                    );
                  })}
              </optgroup>
            ))}
          </select>
          <div className="flex items-center gap-2">
            <input
              value={qty}
              onChange={(e) => setQty(e.target.value.replace(/\D/g, ""))}
              inputMode="numeric"
              className="w-20 rounded-lg border bg-white px-3 py-2 text-center text-sm font-bold outline-none focus:border-primary"
              placeholder="Qty"
            />
            <button
              onClick={tambahItem}
              disabled={loading}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white hover:bg-primary-hover disabled:opacity-40"
            >
              Tambah
            </button>
          </div>
        </div>
        <p className="mt-2 text-xs text-zinc-500">
          Stok baru berkurang saat bill dibayar, bukan saat item ditambahkan.
        </p>
      </section>

      {/* Diskon */}
      <section className="rounded-xl border bg-white p-4 shadow-sm">
        <h3 className="mb-2 font-bold">Diskon</h3>
        <div className="flex gap-2">
          <input
            value={discountInput}
            onChange={(e) => setDiscountInput(e.target.value.replace(/\D/g, ""))}
            inputMode="numeric"
            placeholder="Diskon Rp (opsional)"
            className="min-w-0 flex-1 rounded-lg border bg-white px-3 py-2 text-sm outline-none focus:border-primary"
          />
          <button
            onClick={terapkanDiskon}
            disabled={loading}
            className="rounded-lg border border-primary/30 bg-accent-bg px-4 py-2 text-sm font-bold text-primary hover:bg-primary/10 disabled:opacity-40"
          >
            Terapkan
          </button>
        </div>
        {discNum > 0 && (
          <p className="mt-1.5 text-xs text-zinc-500">Diskon aktif: {rupiah(discNum)}</p>
        )}
      </section>

      {/* Bayar */}
      <section className="rounded-xl border bg-white p-4 shadow-sm">
        <h3 className="mb-2 font-bold">Bayar</h3>
        <div className="mb-3 flex justify-between text-sm text-zinc-600">
          <span>Subtotal</span>
          <span>{rupiah(subtotal)}</span>
        </div>
        {discount > 0 && (
          <div className="flex justify-between text-sm text-zinc-600">
            <span>Diskon</span>
            <span>−{rupiah(discount)}</span>
          </div>
        )}
        {tax > 0 && (
          <div className="flex justify-between text-sm text-zinc-600">
            <span>Pajak</span>
            <span>+{rupiah(tax)}</span>
          </div>
        )}
        <div className="mt-1 flex justify-between text-lg font-extrabold">
          <span>Total</span>
          <span>{rupiah(total)}</span>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 text-sm font-bold">
          <button
            onClick={() => setPayment("CASH")}
            className={`rounded-lg border py-2 ${
              payment === "CASH" ? "border-primary bg-primary text-white" : "bg-white"
            }`}
          >
            💵 Tunai
          </button>
          <button
            onClick={() => setPayment("QRIS")}
            className={`rounded-lg border py-2 ${
              payment === "QRIS" ? "border-primary bg-primary text-white" : "bg-white"
            }`}
          >
            📱 QRIS
          </button>
        </div>

        {payment === "CASH" && (
          <>
            <div className="mt-3 grid grid-cols-4 gap-1.5">
              <button
                onClick={() => setCash(String(total))}
                className="rounded-md bg-accent-bg py-1.5 text-xs font-bold text-primary hover:bg-primary/10"
              >
                Uang pas
              </button>
              {QUICK_CASH.map((v) => (
                <button
                  key={v}
                  onClick={() => setCash(String(v))}
                  className="rounded-md bg-zinc-100 py-1.5 text-xs font-bold hover:bg-zinc-200"
                >
                  {v / 1000}rb
                </button>
              ))}
            </div>
            <input
              value={cash ? Number(cash).toLocaleString("id-ID") : ""}
              onChange={(e) => setCash(e.target.value.replace(/\D/g, ""))}
              inputMode="numeric"
              placeholder="Nominal diterima…"
              className="mt-2 w-full rounded-lg border bg-white px-3 py-2 text-right text-lg font-bold outline-none focus:border-primary"
            />
            <div className="mt-1.5 flex justify-between text-sm font-semibold">
              <span className="text-zinc-500">Kembalian</span>
              <span className={kembalian < 0 ? "text-danger" : "text-secondary"}>
                {cash ? rupiah(Math.max(0, kembalian)) : "—"}
              </span>
            </div>
          </>
        )}

        <button
          onClick={bayar}
          disabled={!canPay}
          className="mt-3 w-full rounded-lg bg-primary py-3 font-bold text-white shadow hover:bg-primary-hover disabled:opacity-40"
        >
          {loading ? "Memproses…" : `Bayar ${rupiah(total)}`}
        </button>

        {kurangStok.length > 0 && (
          <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
            ⚠️ Stok kurang untuk:{" "}
            {kurangStok.map((k) => `${k.name} (butuh ${k.butuh}, ada ${k.ada})`).join(", ")}. Kurangi
            qty atau kulakan dulu sebelum bayar.
          </p>
        )}
      </section>

      {/* Gabung & pisah */}
      {(otherBills.length > 0 || emptyMejas.length > 0) && (
        <section className="grid gap-4 sm:grid-cols-2">
          {otherBills.length > 0 && (
            <div className="rounded-xl border bg-white p-4 shadow-sm">
              <h3 className="mb-2 font-bold">Gabung Bill</h3>
              <p className="mb-2 text-xs text-zinc-500">
                Pindahkan semua item dari meja lain ke bill ini.
              </p>
              <select
                value={gabungSource}
                onChange={(e) => setGabungSource(e.target.value)}
                className="w-full rounded-lg border bg-white px-3 py-2 text-sm outline-none focus:border-primary"
              >
                <option value="">— Pilih bill sumber —</option>
                {otherBills.map((b) => (
                  <option key={b.billId} value={b.billId}>
                    Meja {b.nomor}
                  </option>
                ))}
              </select>
              <button
                onClick={gabung}
                disabled={loading || !gabungSource}
                className="mt-2 w-full rounded-lg border border-primary/30 bg-accent-bg py-2 text-sm font-bold text-primary hover:bg-primary/10 disabled:opacity-40"
              >
                Gabung ke sini
              </button>
            </div>
          )}

          {emptyMejas.length > 0 && items.length > 0 && (
            <div className="rounded-xl border bg-white p-4 shadow-sm">
              <h3 className="mb-2 font-bold">Pisah Bill</h3>
              <p className="mb-2 text-xs text-zinc-500">
                Pindahkan sebagian item ke meja kosong lain.
              </p>
              <select
                value={pisahTarget}
                onChange={(e) => setPisahTarget(e.target.value)}
                className="w-full rounded-lg border bg-white px-3 py-2 text-sm outline-none focus:border-primary"
              >
                <option value="">— Pilih meja tujuan —</option>
                {emptyMejas.map((m) => (
                  <option key={m.id} value={m.id}>
                    Meja {m.nomor}
                  </option>
                ))}
              </select>
              <div className="mt-2 space-y-1">
                {items.map((it) => {
                  const pick = pisahPick[it.id];
                  return (
                    <div key={it.id} className="flex items-center gap-2 text-sm">
                      {/* Label mencakup kotak + nama → area sentuh besar
                          (min 44px tinggi) agar tidak salah tekan di tablet. */}
                      <label className="flex min-h-11 min-w-0 flex-1 cursor-pointer items-center gap-2.5 py-1">
                        <input
                          type="checkbox"
                          className="h-5 w-5 shrink-0 accent-[var(--color-primary)]"
                          checked={!!pick?.on}
                          onChange={(e) => togglePick(it, e.target.checked)}
                        />
                        <span className="truncate">{it.name}</span>
                      </label>
                      <input
                        value={pick?.qty ?? String(it.qty)}
                        onChange={(e) =>
                          setPisahPick((s) => ({
                            ...s,
                            [it.id]: { on: s[it.id]?.on ?? false, qty: e.target.value.replace(/\D/g, "") },
                          }))
                        }
                        inputMode="numeric"
                        className="h-9 w-14 rounded-md border px-2 text-center text-sm font-bold outline-none focus:border-primary"
                      />
                      <span className="w-10 text-right text-xs text-zinc-500">/ {it.qty}</span>
                    </div>
                  );
                })}
              </div>
              <button
                onClick={pisah}
                disabled={loading || !pisahTarget}
                className="mt-2 w-full rounded-lg border border-primary/30 bg-accent-bg py-2 text-sm font-bold text-primary hover:bg-primary/10 disabled:opacity-40"
              >
                Pisah ke meja tujuan
              </button>
            </div>
          )}
        </section>
      )}

      {/* Batal */}
      <button
        onClick={batal}
        disabled={loading}
        className="w-full rounded-lg border border-danger/40 bg-white py-2.5 text-sm font-bold text-danger hover:bg-red-50 disabled:opacity-40"
      >
        Batalkan Bill (kosongkan meja)
      </button>
    </div>
  );
}
