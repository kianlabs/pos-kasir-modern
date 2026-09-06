"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { rupiah } from "@/lib/rupiah";

type Debt = {
  id: string;
  customer: string;
  total: number;
  paid: number;
  sisa: number;
  status: string;
  createdAt: string;
  items: string[];
};

type Customer = { id: string; name: string; hutang: number; openDebts: number };

export default function KasbonPage() {
  const [debts, setDebts] = useState<Debt[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [showLunas, setShowLunas] = useState(false);
  const [paying, setPaying] = useState<Record<string, string>>({});
  const [error, setError] = useState("");

  async function load() {
    const [d, c] = await Promise.all([
      fetch(`/api/debts?status=${showLunas ? "LUNAS" : "BELUM"}`).then((r) => r.json()),
      fetch("/api/customers").then((r) => r.json()),
    ]);
    setDebts(d);
    setCustomers(c);
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showLunas]);

  const totalPiutang = customers.reduce((n, c) => n + c.hutang, 0);

  async function bayar(id: string) {
    setError("");
    const amount = Number(paying[id] || 0);
    if (!Number.isInteger(amount) || amount <= 0) return setError("Nominal bayar tidak valid.");
    const res = await fetch(`/api/debts/${id}/pay`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return setError(data.error ?? "Gagal catat pembayaran.");
    setPaying((p) => ({ ...p, [id]: "" }));
    load();
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-bold">Kasbon</h1>
        <span className="ml-auto rounded-lg bg-white px-3 py-1.5 text-sm font-bold ring-1 ring-zinc-200">
          Piutang aktif <span className="text-orange-700">{rupiah(totalPiutang)}</span>
        </span>
        <button onClick={() => setShowLunas((v) => !v)}
          className="rounded-lg bg-white px-3 py-1.5 text-sm font-semibold ring-1 ring-zinc-200 hover:ring-zinc-400">
          {showLunas ? "Lihat belum lunas" : "Lihat riwayat lunas"}
        </button>
      </div>

      {error && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">⚠️ {error}</p>}

      <div className="grid items-start gap-5 lg:grid-cols-[1fr_300px]">
        <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-sm">
              <thead>
                <tr className="border-b bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500">
                  <th className="p-3">Pelanggan</th>
                  <th className="p-3">Belanja</th>
                  <th className="p-3 text-right">Sisa</th>
                  <th className="p-3 text-right">Bayar</th>
                </tr>
              </thead>
              <tbody>
                {debts.map((d) => (
                  <tr key={d.id} className="border-b last:border-0 hover:bg-zinc-50">
                    <td className="p-3">
                      <div className="font-semibold">{d.customer}</div>
                      <div className="max-w-[260px] truncate text-xs text-zinc-500">
                        {d.items.join(", ")}
                      </div>
                      <div className="text-xs text-zinc-400">
                        {new Date(d.createdAt).toLocaleString("id-ID", {
                          day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
                        })}
                        {" "}• total {rupiah(d.total)} • masuk {rupiah(d.paid)}
                      </div>
                    </td>
                    <td className="p-3">
                      {d.status === "LUNAS" ? (
                        <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-bold text-green-700">
                          LUNAS
                        </span>
                      ) : (
                        <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-700">
                          BELUM
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-right font-bold">{rupiah(d.sisa)}</td>
                    <td className="p-3">
                      {d.status === "BELUM" ? (
                        <span className="flex justify-end gap-1">
                          <input
                            value={paying[d.id] ?? ""}
                            onChange={(e) =>
                              setPaying((p) => ({ ...p, [d.id]: e.target.value.replace(/\D/g, "") }))
                            }
                            inputMode="numeric"
                            placeholder="Rp"
                            className="w-24 rounded-md border px-2 py-1 text-right text-sm outline-none focus:border-orange-500"
                          />
                          <button onClick={() => bayar(d.id)}
                            className="rounded-md bg-orange-600 px-3 py-1 text-sm font-bold text-white hover:bg-orange-700">
                            OK
                          </button>
                        </span>
                      ) : (
                        <span className="text-xs text-zinc-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
                {debts.length === 0 && (
                  <tr><td colSpan={4} className="p-8 text-center text-zinc-500">
                    {showLunas ? "Belum ada pelunasan." : "Tidak ada kasbon. Catat dari Kasir → Hutang 📒"}
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <h2 className="mb-2 font-bold">👥 Pelanggan ({customers.length})</h2>
          {customers.map((c) => (
            <div key={c.id} className="flex justify-between border-b py-1.5 text-sm last:border-0">
              <span className="font-medium">{c.name}</span>
              <span className={c.hutang > 0 ? "font-bold text-orange-700" : "text-zinc-400"}>
                {c.hutang > 0 ? rupiah(c.hutang) : "lunas"}
              </span>
            </div>
          ))}
          {customers.length === 0 && (
            <p className="text-sm text-zinc-500">Belum ada pelanggan kasbon.</p>
          )}
          <Link href="/" className="mt-3 inline-block text-sm font-semibold text-orange-700 hover:underline">
            + Kasbon baru dari Kasir →
          </Link>
        </div>
      </div>
    </div>
  );
}
