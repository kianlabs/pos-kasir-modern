"use client";

// Section "Gabung & pisah" bill meja. Diekstrak dari BillPanel (murni
// struktural — state & handler tetap di BillPanel, dioper lewat props).

type BillItem = { id: string; productId: string; name: string; price: number; qty: number };
type OtherBill = { billId: string; nomor: string };
type EmptyMeja = { id: string; nomor: string };

type Props = {
  otherBills: OtherBill[];
  emptyMejas: EmptyMeja[];
  items: BillItem[];
  loading: boolean;
  gabungSource: string;
  setGabungSource: (v: string) => void;
  gabung: () => void;
  pisahTarget: string;
  setPisahTarget: (v: string) => void;
  pisahPick: Record<string, { on: boolean; qty: string }>;
  setPisahPick: (updater: (s: Record<string, { on: boolean; qty: string }>) => Record<string, { on: boolean; qty: string }>) => void;
  togglePick: (it: BillItem, on: boolean) => void;
  pisah: () => void;
};

export default function GabungPisahSection({
  otherBills,
  emptyMejas,
  items,
  loading,
  gabungSource,
  setGabungSource,
  gabung,
  pisahTarget,
  setPisahTarget,
  pisahPick,
  setPisahPick,
  togglePick,
  pisah,
}: Props) {
  return (
    <section className="grid gap-4 sm:grid-cols-2">
      {otherBills.length > 0 && (
        <div className="rounded-xl border bg-white p-4 shadow-xs">
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
            type="button"
            onClick={gabung}
            disabled={loading || !gabungSource}
            className="mt-2 w-full rounded-lg border border-primary/30 bg-accent-bg py-2 text-sm font-bold text-primary hover:bg-primary/10 disabled:opacity-40"
          >
            Gabung ke sini
          </button>
        </div>
      )}

      {emptyMejas.length > 0 && items.length > 0 && (
        <div className="rounded-xl border bg-white p-4 shadow-xs">
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
                    aria-label={`Qty ${it.name}`}
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
            type="button"
            onClick={pisah}
            disabled={loading || !pisahTarget}
            className="mt-2 w-full rounded-lg border border-primary/30 bg-accent-bg py-2 text-sm font-bold text-primary hover:bg-primary/10 disabled:opacity-40"
          >
            Pisah ke meja tujuan
          </button>
        </div>
      )}
    </section>
  );
}
