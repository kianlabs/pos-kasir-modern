"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { rupiah } from "@/shared/rupiah";
import AddItemSection from "./_sections/AddItemSection";
import DiskonSection from "./_sections/DiskonSection";
import BayarSection from "./_sections/BayarSection";
import GabungPisahSection from "./_sections/GabungPisahSection";
import BatalSection from "./_sections/BatalSection";

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
//
// BillPanel kini bertindak sebagai ORKESTRATOR: state bersama + mutate()/fetch
// tetap di sini, sedangkan markup tiap section dipecah ke ./_sections/*.

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
  const [cari, setCari] = useState("");
  const [kategori, setKategori] = useState<string>("");

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

  // Produk yang ditampilkan di grid cepat: filter kategori + pencarian nama.
  const produkTampil = useMemo(() => {
    const q = cari.trim().toLowerCase();
    return products.filter(
      (p) =>
        (!kategori || p.category === kategori) &&
        (!q || p.name.toLowerCase().includes(q))
    );
  }, [products, kategori, cari]);

  const produkTerpilih = useMemo(
    () => products.find((p) => p.id === productId) ?? null,
    [products, productId]
  );

  const discNum = Math.min(Number(discountInput) || 0, subtotal);
  // Diskon tersimpan bisa sengaja MELEBIHI subtotal (DRAFT menyimpan nilai
  // "niat" mentah; tax/total memakai versi ter-clamp). Tampilkan diskon yang
  // benar-benar mengurangi, plus catatan bila ada kelebihan yang tak terpakai.
  const discEffective = Math.min(discount, subtotal);
  const discLebih = discount > subtotal;
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
    // Hanya kirim `items` — JANGAN ikutkan `discount` di sini, agar diskon
    // yang sudah diterapkan tidak ikut tertimpa nilai kotak input (fix A1).
    const r = await mutate(`/api/bills/${billId}`, "PATCH", {
      items: [{ productId: p.id, qty: q }],
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
      setCash(""); // hindari nominal tunai basi saat bill berikutnya
      router.push(`/struk/${r.data.id}`);
    } else if (r.ok) {
      // Bayar sukses di server tapi id struk tak terkirim → jangan diam.
      setCash("");
      setError("Pembayaran berhasil tapi struk gagal dibuka.");
      router.refresh();
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
    const dipilih = items.filter((it) => pisahPick[it.id]?.on);
    if (dipilih.length === 0) return setError("Pilih minimal satu item untuk dipisah.");
    // Baris tercentang WAJIB punya qty valid; input kosong TIDAK boleh diam-diam
    // dianggap qty penuh (fix N3). Nomor kosong = 0 → tolak dengan pesan jelas.
    for (const it of dipilih) {
      const n = Number(pisahPick[it.id]?.qty);
      if (!Number.isInteger(n) || n <= 0) {
        return setError(`Qty ${it.name} harus diisi dan > 0.`);
      }
    }
    const picked = dipilih.map((it) => ({
      transactionItemId: it.id,
      qty: Number(pisahPick[it.id]?.qty),
    }));
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
    <p role="alert" aria-live="assertive" className="rounded-xl border border-danger/30 bg-danger-bg px-3 py-2 text-body-sm font-medium text-danger">
      ⚠️ {error}
    </p>
  );

  // ── Meja KOSONG: tombol buka bill ─────────────────────────────
  if (!billId) {
    return (
      <div className="mt-4 space-y-3">
        {err}
        <button
          type="button"
          onClick={bukaBill}
          disabled={!hasShift || loading}
          className="min-h-12 w-full rounded-xl bg-ink-950 py-3 text-label-lg text-surface transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-40"
        >
          {loading ? "Memproses…" : "Buka Bill Meja Ini"}
        </button>
        {!hasShift && (
          <p className="text-center text-caption text-danger">
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

      <AddItemSection
        categories={categories}
        kategori={kategori}
        setKategori={setKategori}
        cari={cari}
        setCari={setCari}
        produkTampil={produkTampil}
        productId={productId}
        setProductId={setProductId}
        produkTerpilih={produkTerpilih}
        sisaStok={sisaStok}
        qtyDiBill={qtyDiBill}
        qty={qty}
        setQty={setQty}
        loading={loading}
        tambahItem={tambahItem}
      />

      <DiskonSection
        discountInput={discountInput}
        setDiscountInput={setDiscountInput}
        loading={loading}
        terapkanDiskon={terapkanDiskon}
        discNum={discNum}
        discEffective={discEffective}
        discLebih={discLebih}
        discount={discount}
      />

      <BayarSection
        subtotal={subtotal}
        discount={discount}
        tax={tax}
        total={total}
        discEffective={discEffective}
        discLebih={discLebih}
        payment={payment}
        setPayment={setPayment}
        cash={cash}
        setCash={setCash}
        cashNum={cashNum}
        kembalian={kembalian}
        canPay={canPay}
        loading={loading}
        bayar={bayar}
        kurangStok={kurangStok}
      />

      {(otherBills.length > 0 || emptyMejas.length > 0) && (
        <GabungPisahSection
          otherBills={otherBills}
          emptyMejas={emptyMejas}
          items={items}
          loading={loading}
          gabungSource={gabungSource}
          setGabungSource={setGabungSource}
          gabung={gabung}
          pisahTarget={pisahTarget}
          setPisahTarget={setPisahTarget}
          pisahPick={pisahPick}
          setPisahPick={setPisahPick}
          togglePick={togglePick}
          pisah={pisah}
        />
      )}

      <BatalSection loading={loading} batal={batal} />
    </div>
  );
}
