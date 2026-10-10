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
        <div className="rounded-2xl border border-ink-200 bg-surface p-4">
          <h3 className="mb-2 text-headline-sm text-ink-950">Gabung Bill</h3>
          <p className="mb-2 text-caption text-ink-500">
            Pindahkan semua item dari meja lain ke bill ini.
          </p>
          <select
            value={gabungSource}
            onChange={(e) => setGabungSource(e.target.value)}
            className="h-12 w-full rounded-xl border border-ink-200 bg-surface px-3 text-body-md text-ink-950 outline-none transition-colors focus:border-ink-950"
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
            className="mt-2 h-12 w-full rounded-xl border border-ink-200 bg-surface text-label-lg text-ink-950 transition-all hover:bg-ink-100 active:scale-[0.98] disabled:opacity-40"
          >
            Gabung ke sini
          </button>
        </div>
      )}

      {emptyMejas.length > 0 && items.length > 0 && (
        <div className="rounded-2xl border border-ink-200 bg-surface p-4">
          <h3 className="mb-2 text-headline-sm text-ink-950">Pisah Bill</h3>
          <p className="mb-2 text-caption text-ink-500">
            Pindahkan sebagian item ke meja kosong lain.
          </p>
          <select
            value={pisahTarget}
            onChange={(e) => setPisahTarget(e.target.value)}
            className="h-12 w-full rounded-xl border border-ink-200 bg-surface px-3 text-body-md text-ink-950 outline-none transition-colors focus:border-ink-950"
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
                <div key={it.id} className="flex items-center gap-2 text-body-sm">
                  {/* Label mencakup kotak + nama → area sentuh besar
                      (min 44px tinggi) agar tidak salah tekan di tablet. */}
                  <label className="flex min-h-11 min-w-0 flex-1 cursor-pointer items-center gap-2.5 py-1">
                    <input
                      type="checkbox"
                      className="h-5 w-5 shrink-0 accent-[var(--color-ink-950)]"
                      checked={!!pick?.on}
                      onChange={(e) => togglePick(it, e.target.checked)}
                    />
                    <span className="truncate text-ink-950">{it.name}</span>
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
                    className="h-12 w-14 rounded-xl border border-ink-200 bg-surface px-2 text-center text-body-md font-bold text-ink-950 tabular-nums outline-none focus:border-ink-950"
                  />
                  <span className="w-10 text-right text-caption text-ink-500 tabular-nums">/ {it.qty}</span>
                </div>
              );
            })}
          </div>
          <button
            type="button"
            onClick={pisah}
            disabled={loading || !pisahTarget}
            className="mt-2 h-12 w-full rounded-xl border border-ink-200 bg-surface text-label-lg text-ink-950 transition-all hover:bg-ink-100 active:scale-[0.98] disabled:opacity-40"
          >
            Pisah ke meja tujuan
          </button>
        </div>
      )}
    </section>
  );
}
