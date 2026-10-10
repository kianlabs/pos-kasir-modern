import Link from "next/link";
import { deriveStatusMeja } from "@/server/meja";
import { rupiah } from "@/shared/rupiah";
import { currentWarungId } from "@/server/tenant";

export const dynamic = "force-dynamic";

type Filter = "semua" | "terisi" | "kosong";

// Peta meja (PRD §6.2 "Manajemen meja"): status KOSONG/TERISI di-derive dari
// bill DRAFT terbuka (bukan kolom tersimpan — koreksi #4). Halaman ini untuk
// KASIR juga; jangan jadikan owner-only (middleware §4.5.5).
//
// Tampilan mengikuti mockup "Daftar Manajemen Meja" (Warm Monochrome POS):
// grid floor-plan kartu meja + bar filter (Semua / Meja Terisi / Meja Kosong)
// + ringkasan live (terisi X/Y & total bill aktif). Filter diterapkan lewat
// query string (?filter=terisi|kosong) agar tetap server component murni —
// tidak menambah state/data fetch baru (visual-only).
export default async function MejaPage(props: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const sp = await props.searchParams;
  const filter: Filter =
    sp.filter === "terisi" ? "terisi" : sp.filter === "kosong" ? "kosong" : "semua";

  const warungId = await currentWarungId();
  const mejas = await deriveStatusMeja(warungId);

  const total = mejas.length;
  const terisi = mejas.filter((m) => m.status === "TERISI").length;
  const kosong = total - terisi;
  const totalBillAktif = mejas.reduce((n, m) => n + (m.status === "TERISI" ? m.total : 0), 0);

  const tampil = mejas.filter((m) =>
    filter === "terisi" ? m.status === "TERISI" : filter === "kosong" ? m.status === "KOSONG" : true
  );

  const chips: { key: Filter; label: string; count: number; dot: string }[] = [
    { key: "semua", label: "Semua Meja", count: total, dot: "" },
    { key: "terisi", label: "Meja Terisi", count: terisi, dot: "bg-ink-950" },
    { key: "kosong", label: "Meja Kosong", count: kosong, dot: "bg-ink-300" },
  ];

  return (
    <div className="min-h-screen bg-canvas text-ink-950">
      {/* ── Sub-header operasional: chips filter + ringkasan live ── */}
      <section className="border-b border-ink-200 bg-surface px-4 py-3 lg:px-6">
        <div className="mx-auto flex max-w-[1440px] flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2 overflow-x-auto py-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {chips.map((c) => {
              const active = filter === c.key;
              return (
                <Link
                  key={c.key}
                  href={c.key === "semua" ? "/meja" : `/meja?filter=${c.key}`}
                  aria-current={active ? "page" : undefined}
                  className={`flex h-12 shrink-0 items-center gap-2 rounded-xl border px-4 text-label-md active:scale-[0.98] transition-all ${
                    active
                      ? "border-ink-950 bg-ink-950 text-surface"
                      : "border-ink-200 bg-surface text-ink-500 hover:border-ink-300 hover:text-ink-950"
                  }`}
                >
                  {c.dot && <span className={`h-2 w-2 rounded-full ${c.dot}`} />}
                  <span>{c.label}</span>
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-caption font-bold ${
                      active ? "bg-surface text-ink-950" : "bg-ink-100 text-ink-700"
                    }`}
                  >
                    {c.count}
                  </span>
                </Link>
              );
            })}
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-3 rounded-xl border border-ink-200 bg-canvas px-4 py-2">
              <span className="flex items-center gap-1.5">
                <span className="text-caption text-ink-500">Terisi:</span>
                <span className="text-label-md text-ink-950">
                  {terisi}/{total} Meja
                </span>
              </span>
              <span className="text-ink-300">•</span>
              <span className="flex items-center gap-1.5">
                <span className="text-caption text-ink-500">Total Bill Aktif:</span>
                <span className="text-numeral-md text-ink-950 tabular-nums">
                  {rupiah(totalBillAktif)}
                </span>
              </span>
            </div>
            <Link
              href="/"
              className="flex h-12 shrink-0 items-center gap-2 rounded-xl border border-ink-200 bg-surface px-4 text-label-md text-ink-950 transition-all hover:bg-ink-100 active:scale-[0.98]"
            >
              <span>+ Bawa pulang / jual langsung</span>
            </Link>
          </div>
        </div>
      </section>

      {/* ── Kanvas floor-plan: grid kartu meja ── */}
      <main className="p-4 lg:p-6">
        <div className="mx-auto max-w-[1440px]">
          {total === 0 ? (
            <p className="rounded-2xl border border-ink-200 bg-surface p-8 text-center text-body-md text-ink-500">
              Belum ada meja terdaftar.
            </p>
          ) : tampil.length === 0 ? (
            <p className="rounded-2xl border border-ink-200 bg-surface p-8 text-center text-body-md text-ink-500">
              Tidak ada meja pada filter ini.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {tampil.map((m) => {
                const isTerisi = m.status === "TERISI";
                return (
                  <Link
                    key={m.id}
                    href={`/meja/${m.id}`}
                    className={`flex min-h-[200px] flex-col justify-between rounded-2xl border p-5 transition-colors ${
                      isTerisi
                        ? "border-ink-950 bg-ink-950 text-surface"
                        : "border-ink-200 bg-surface text-ink-950 hover:border-ink-300"
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-baseline gap-2">
                          <h2 className={`text-headline-md ${isTerisi ? "text-surface" : "text-ink-950"}`}>
                            Meja {m.nomor}
                          </h2>
                        </div>
                        <div
                          className={`mt-2 inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-caption ${
                            isTerisi
                              ? "bg-primary-container text-surface"
                              : "border border-ink-200 bg-canvas text-ink-500"
                          }`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${
                              isTerisi ? "bg-success" : "bg-ink-300"
                            }`}
                          />
                          <span>{isTerisi ? "Terisi" : "Kosong"}</span>
                        </div>
                      </div>
                    </div>

                    <div
                      className={`mt-4 flex items-center justify-between border-t pt-4 ${
                        isTerisi ? "border-ink-700" : "border-ink-200"
                      }`}
                    >
                      {isTerisi ? (
                        <>
                          <div>
                            <span className="block text-caption text-ink-300">Total Sementara</span>
                            <span className="text-numeral-lg text-surface tabular-nums">
                              {rupiah(m.total)}
                            </span>
                            <span className="block text-caption text-ink-300">{m.itemCount} item</span>
                          </div>
                          <span className="flex h-12 items-center rounded-xl bg-surface px-4 text-label-md text-ink-950 transition-all hover:bg-ink-100">
                            Lihat Bill / Tambah
                          </span>
                        </>
                      ) : (
                        <>
                          <span className="text-caption text-ink-500">Siap digunakan</span>
                          <span className="flex h-12 items-center gap-1.5 rounded-xl bg-ink-950 px-4 text-label-md text-surface transition-all hover:opacity-90">
                            Buka Pesanan
                          </span>
                        </>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
