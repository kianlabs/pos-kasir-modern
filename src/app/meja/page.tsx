import Link from "next/link";
import { deriveStatusMeja } from "@/lib/meja";
import { currentWarungId } from "@/lib/warung";

export const dynamic = "force-dynamic";

// Peta meja (PRD §6.2 "Manajemen meja"): 10 meja, status KOSONG/TERISI
// di-derive dari bill DRAFT terbuka (bukan kolom tersimpan — koreksi #4).
// Halaman ini untuk KASIR juga; jangan jadikan owner-only (middleware §4.5.5).
export default async function MejaPage() {
  const warungId = await currentWarungId();
  const mejas = await deriveStatusMeja(warungId);
  const terisi = mejas.filter((m) => m.status === "TERISI").length;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-bold">🍽️ Meja</h1>
        <p className="text-sm text-zinc-500">
          {mejas.length} meja • <span className="font-semibold text-primary">{terisi} terisi</span>
        </p>
        <Link
          href="/"
          className="ml-auto rounded-lg bg-accent-bg px-4 py-2 text-sm font-bold text-primary hover:bg-primary/10"
        >
          + Bawa pulang / jual langsung
        </Link>
      </div>

      {mejas.length === 0 ? (
        <p className="rounded-xl border bg-white p-8 text-center text-sm text-zinc-500 shadow-sm">
          Belum ada meja terdaftar.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
          {mejas.map((m) => {
            const isTerisi = m.status === "TERISI";
            return (
              <Link
                key={m.id}
                href={`/meja/${m.id}`}
                className={`rounded-xl border p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
                  isTerisi
                    ? "border-primary/40 bg-accent-bg"
                    : "border-zinc-200 bg-white"
                }`}
              >
                <div className="flex items-start justify-between">
                  <span className="text-2xl">🍽️</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                      isTerisi
                        ? "bg-primary text-white"
                        : "bg-emerald-100 text-emerald-700"
                    }`}
                  >
                    {m.status}
                  </span>
                </div>
                <div className="mt-3 text-lg font-bold">Meja {m.nomor}</div>
                <div className="text-xs text-zinc-500">
                  {isTerisi ? "Bill terbuka — ketuk untuk kelola" : "Kosong — ketuk untuk buka bill"}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
