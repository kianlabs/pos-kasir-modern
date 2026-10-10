import Link from "next/link";
import { prisma } from "@/server/db";
import { rupiah } from "@/shared/rupiah";
import { PAYMENT_LABEL, shortId } from "@/shared/category-icon";
import { currentWarungId } from "@/server/tenant";

export const dynamic = "force-dynamic";

// Warm Monochrome POS — Riwayat Transaksi + drawer detail struk.
// Struktur & token mengikuti stitch_custom_design_system/riwayat_transaksi_struk/code.html.
// Query transaksi TIDAK berubah (aturan #12: hanya LUNAS yang tampil).

function formatJam(d: Date): string {
  return d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }) + " WIB";
}

function formatTanggal(d: Date): string {
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

function formatTanggalPanjang(d: Date): string {
  return d.toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// Icon glyph Material Symbols (font dimuat di layout).
function Icon({ name, className = "" }: { name: string; className?: string }) {
  return (
    <span className={`material-symbols-outlined ${className}`} data-icon={name} aria-hidden>
      {name}
    </span>
  );
}

export default async function TransaksiPage() {
  const warungId = await currentWarungId();
  const trx = await prisma.transaction.findMany({
    // Aturan #12: hanya LUNAS yang tampil sebagai transaksi. Bill DRAFT
    // (meja terbuka) tidak boleh bocor ke daftar ini.
    where: { warungId, status: "LUNAS" },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { items: true },
  });

  const totalNilai = trx.reduce((n, t) => n + t.total, 0);
  // Drawer menampilkan transaksi teratas (terbaru) — baris terpilih pada mockup.
  const terpilih = trx[0];

  return (
    <div className="-mx-4 -my-6 flex min-h-[calc(100vh-4rem)] flex-col md:-mx-6 md:flex-row md:overflow-hidden">
      {/* LEFT / CENTER: Transaksi Explorer */}
      <section className="flex flex-1 flex-col overflow-hidden border-ink-200 md:border-r">
        {/* Filter strip + search */}
        <div className="flex flex-col gap-3 border-b border-ink-200 bg-surface p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="relative min-w-[240px] flex-1">
              <Icon
                name="search"
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-500"
              />
              <input
                type="text"
                placeholder="Cari nomor struk atau kasir..."
                className="h-12 w-full rounded-xl border border-ink-200 bg-surface pl-11 pr-4 text-body-md font-body-md text-ink-950 outline-none transition-colors duration-150 placeholder:text-ink-500 focus:border-ink-950 focus:ring-0"
              />
            </div>
            <button
              type="button"
              className="flex h-12 items-center gap-2 rounded-xl border border-ink-200 bg-surface px-4 transition-colors duration-150 hover:bg-ink-100 active:scale-[0.98]"
            >
              <Icon name="calendar_today" className="text-ink-700" />
              <span className="text-label-md font-label-md text-ink-950">
                Hari Ini, {formatTanggalPanjang(new Date())}
              </span>
              <Icon name="expand_more" className="text-ink-500" />
            </button>
          </div>

          {/* Payment + Sync chips */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <div className="flex items-center gap-1.5">
              <span className="mr-1 text-caption font-caption uppercase tracking-wider text-ink-500">
                Metode:
              </span>
              <span className="h-9 rounded-xl border border-ink-950 bg-ink-950 px-3.5 text-label-md font-label-md font-semibold leading-9 text-surface">
                Semua
              </span>
              <span className="h-9 rounded-xl border border-ink-200 bg-surface px-3.5 text-label-md font-label-md leading-9 text-ink-700">
                Tunai
              </span>
              <span className="h-9 rounded-xl border border-ink-200 bg-surface px-3.5 text-label-md font-label-md leading-9 text-ink-700">
                QRIS
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="mr-1 text-caption font-caption uppercase tracking-wider text-ink-500">
                Sinkronisasi:
              </span>
              <span className="h-9 rounded-xl border border-ink-950 bg-ink-950 px-3.5 text-label-md font-label-md font-semibold leading-9 text-surface">
                Semua
              </span>
              <span className="flex h-9 items-center gap-1 rounded-xl border border-ink-200 bg-surface px-3.5 text-label-md font-label-md leading-9 text-ink-700">
                <span className="h-2 w-2 rounded-full bg-success" />
                <span className="leading-9">Tersinkron</span>
              </span>
            </div>
          </div>
        </div>

        {/* Meta header */}
        <div className="flex items-center justify-between border-b border-ink-200 bg-ink-100 px-4 py-2.5 text-caption font-caption text-ink-500">
          <div className="flex items-center gap-4">
            <span>
              Menampilkan <strong className="text-ink-950">{trx.length} Transaksi</strong>
            </span>
            <span>•</span>
            <span>
              Total Nilai:{" "}
              <strong className="tabular-nums text-label-md font-label-md text-ink-950">
                {rupiah(totalNilai)}
              </strong>
            </span>
          </div>
          <div className="hidden items-center gap-1 sm:flex">
            <Icon name="sync" />
            <span>Sinkronisasi otomatis aktif</span>
          </div>
        </div>

        {/* List rows */}
        <div className="flex-1 divide-y divide-ink-200 overflow-y-auto bg-surface">
          {trx.map((t, idx) => {
            const aktif = idx === 0;
            const label = PAYMENT_LABEL[t.payment] ?? t.payment;
            return (
              <Link
                key={t.id}
                href={`/struk/${t.id}`}
                className={`flex min-h-[64px] select-none items-center justify-between gap-4 px-4 py-3 transition-colors duration-150 ${
                  aktif ? "border-l-4 border-l-ink-950 bg-ink-100" : "hover:bg-canvas"
                }`}
              >
                <div className="flex min-w-[200px] items-center gap-4">
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                      aktif
                        ? "bg-ink-950 text-surface"
                        : "border border-ink-200 bg-surface text-ink-700"
                    }`}
                  >
                    <Icon
                      name={t.payment === "CASH" ? "receipt_long" : "qr_code_2"}
                      className="text-[20px]"
                    />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="tabular-nums text-label-lg font-label-lg font-bold text-ink-950">
                        #{shortId(t.id)}
                      </span>
                      {t.mejaId ? (
                        <span className="rounded border border-ink-200 bg-surface px-2 py-0.5 text-caption font-caption font-semibold text-ink-950">
                          Meja
                        </span>
                      ) : (
                        <span className="rounded border border-ink-200 bg-surface px-2 py-0.5 text-caption font-caption font-medium text-ink-700">
                          Bawa Pulang
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-caption font-caption text-ink-500">
                      {formatJam(t.createdAt)} • Kasir {t.cashierId.slice(0, 8).toUpperCase()}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <span className="block tabular-nums text-numeral-md font-numeral-md font-bold text-ink-950">
                      {rupiah(t.total)}
                    </span>
                    <span className="inline-block rounded border border-ink-200 bg-surface px-1.5 py-0.5 text-caption font-caption text-ink-700">
                      {label}
                    </span>
                  </div>
                  <div className="flex w-36 items-center justify-end gap-1.5 text-success">
                    {t.dibuatOffline ? (
                      <span className="inline-flex items-center gap-1 rounded border border-ink-200 bg-surface px-2 py-0.5 text-caption font-caption font-medium text-ink-500">
                        <span className="h-1.5 w-1.5 rounded-full bg-ink-500" />
                        <span>Belum Tersinkron</span>
                      </span>
                    ) : (
                      <>
                        <Icon name="cloud_done" className="text-success" />
                        <span className="text-label-md font-label-md font-semibold">Tersinkron</span>
                      </>
                    )}
                  </div>
                  <Icon name="chevron_right" className={aktif ? "text-ink-950" : "text-ink-300"} />
                </div>
              </Link>
            );
          })}

          {trx.length === 0 && (
            <div className="p-8 text-center text-body-md font-body-md text-ink-500">
              Belum ada transaksi. Mulai jualan di halaman Kasir 🛒
            </div>
          )}
        </div>
      </section>

      {/* RIGHT: Drawer detail struk — fixed ~420px pada desktop */}
      <aside className="flex h-full w-full shrink-0 flex-col border-ink-200 bg-surface md:w-[420px] md:border-l">
        {terpilih ? (
          <>
            {/* Header */}
            <div className="border-b border-ink-200 bg-surface p-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-caption font-caption font-semibold uppercase tracking-wider text-ink-500">
                      Detail Struk
                    </span>
                    {terpilih.dibuatOffline ? (
                      <span className="inline-flex items-center gap-1 rounded border border-ink-200 bg-ink-100 px-2 py-0.5 text-caption font-caption font-semibold text-ink-500">
                        <span className="h-1.5 w-1.5 rounded-full bg-ink-500" />
                        Belum Tersinkron
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded border border-ink-200 bg-ink-100 px-2 py-0.5 text-caption font-caption font-semibold text-success">
                        <Icon name="cloud_done" className="text-[14px]" />
                        Tersinkron
                      </span>
                    )}
                  </div>
                  <h2 className="mt-1 tabular-nums text-headline-sm font-headline-sm font-bold text-ink-950">
                    #{shortId(terpilih.id)}
                  </h2>
                </div>
                <Link
                  href="/transaksi"
                  title="Tutup Panel"
                  className="flex h-10 w-10 items-center justify-center rounded-lg text-ink-500 transition-colors hover:bg-ink-100 hover:text-ink-950"
                >
                  <Icon name="close" />
                </Link>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2 border-t border-ink-200 pt-3 text-caption font-caption">
                <div>
                  <span className="block text-ink-500">Waktu Pesanan</span>
                  <span className="font-semibold text-ink-950">
                    {formatJam(terpilih.createdAt)}, {formatTanggal(terpilih.createdAt)}
                  </span>
                </div>
                <div>
                  <span className="block text-ink-500">Kasir Bertugas</span>
                  <span className="font-semibold text-ink-950">
                    {terpilih.cashierId.slice(0, 8).toUpperCase()}
                  </span>
                </div>
                <div className="mt-1">
                  <span className="block text-ink-500">Tipe Layanan</span>
                  <span className="font-semibold text-ink-950">
                    {terpilih.mejaId ? "Makan di Tempat" : "Bawa Pulang"}
                  </span>
                </div>
                <div className="mt-1">
                  <span className="block text-ink-500">Status Pembayaran</span>
                  <span className="font-semibold text-ink-950">
                    Lunas • {PAYMENT_LABEL[terpilih.payment] ?? terpilih.payment}
                  </span>
                </div>
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 space-y-4 overflow-y-auto p-4">
              <div>
                <div className="flex items-center justify-between border-b border-ink-200 pb-2">
                  <h3 className="text-label-md font-label-md font-bold text-ink-950">
                    Rincian Menu ({terpilih.items.length} Item)
                  </h3>
                  <span className="text-caption font-caption text-ink-500">Jumlah</span>
                </div>
                <div className="divide-y divide-ink-200">
                  {terpilih.items.map((i) => (
                    <div key={i.id} className="flex items-start justify-between gap-3 py-3">
                      <div className="flex flex-1 items-center gap-2">
                        <span className="flex h-6 w-6 items-center justify-center rounded bg-ink-100 text-caption font-caption font-bold tabular-nums text-ink-950">
                          {i.qty}x
                        </span>
                        <span className="text-body-md font-body-md font-semibold text-ink-950">
                          {i.name}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="tabular-nums text-numeral-md font-numeral-md font-bold text-ink-950">
                          {rupiah(i.price * i.qty)}
                        </span>
                        <span className="block tabular-nums text-caption font-caption text-ink-500">
                          @{rupiah(i.price)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Breakdown */}
              <div className="space-y-2 rounded-xl border border-ink-200 bg-canvas p-3.5 text-label-md font-label-md">
                <div className="flex items-center justify-between text-ink-700">
                  <span>Subtotal</span>
                  <span className="tabular-nums font-semibold text-ink-950">
                    {rupiah(terpilih.subtotal)}
                  </span>
                </div>
                {terpilih.discount > 0 && (
                  <div className="flex items-center justify-between text-ink-700">
                    <span>Diskon</span>
                    <span className="tabular-nums font-semibold text-ink-950">
                      −{rupiah(terpilih.discount)}
                    </span>
                  </div>
                )}
                {terpilih.tax > 0 && (
                  <div className="flex items-center justify-between text-ink-700">
                    <span>Pajak</span>
                    <span className="tabular-nums font-semibold text-ink-950">
                      {rupiah(terpilih.tax)}
                    </span>
                  </div>
                )}
                <div className="flex items-baseline justify-between border-t border-ink-200 pt-2">
                  <span className="text-headline-sm font-headline-sm font-bold text-ink-950">
                    Total Bayar
                  </span>
                  <span className="tabular-nums text-numeral-lg font-numeral-lg font-bold text-ink-950">
                    {rupiah(terpilih.total)}
                  </span>
                </div>
                <div className="space-y-1 border-t border-dashed border-ink-200 pt-2 text-caption font-caption">
                  <div className="flex items-center justify-between text-ink-500">
                    <span>Uang Diterima ({PAYMENT_LABEL[terpilih.payment] ?? terpilih.payment})</span>
                    <span className="tabular-nums font-semibold text-ink-950">
                      {rupiah(terpilih.cash)}
                    </span>
                  </div>
                  {terpilih.payment === "CASH" && (
                    <div className="flex items-center justify-between text-ink-500">
                      <span>Kembalian</span>
                      <span className="tabular-nums font-semibold text-success">
                        {rupiah(terpilih.change)}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="py-1 text-center">
                <p className="text-caption font-caption text-ink-500">
                  ID Referensi Sistem POS: POS-{shortId(terpilih.id)}
                </p>
              </div>
            </div>

            {/* Sticky actions */}
            <div className="flex flex-col gap-2.5 border-t border-ink-200 bg-surface p-4">
              <div className="grid grid-cols-2 gap-2">
                <Link
                  href={`/struk/${terpilih.id}`}
                  className="flex h-12 items-center justify-center gap-2 rounded-xl bg-ink-950 text-label-md font-label-md font-semibold text-surface transition-all hover:opacity-90 active:scale-[0.98]"
                >
                  <Icon name="print" className="text-surface" />
                  <span>Cetak Ulang</span>
                </Link>
                <button
                  type="button"
                  className="flex h-12 items-center justify-center gap-2 rounded-xl border border-ink-200 bg-surface text-label-md font-label-md font-semibold text-ink-950 transition-all hover:bg-ink-100 active:scale-[0.98]"
                >
                  <Icon name="send_to_mobile" className="text-ink-700" />
                  <span>Kirim WhatsApp</span>
                </button>
              </div>
              <div className="pt-1 text-center">
                <button
                  type="button"
                  className="inline-flex items-center justify-center gap-1 rounded-lg px-3 py-1.5 text-label-md font-label-md font-semibold text-danger transition-colors duration-150 hover:bg-error-container/30 active:scale-[0.98]"
                >
                  <Icon name="delete" className="text-[16px] text-danger" />
                  <span>Batalkan / Void Transaksi</span>
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex h-full items-center justify-center p-8 text-center text-body-md font-body-md text-ink-500">
            Pilih transaksi untuk melihat detail struk.
          </div>
        )}
      </aside>
    </div>
  );
}
