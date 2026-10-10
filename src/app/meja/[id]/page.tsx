import Link from "next/link";
import { prisma } from "@/server/db";
import { deriveStatusMeja } from "@/server/meja";
import { rupiah } from "@/shared/rupiah";
import { currentWarungId } from "@/server/tenant";
import BillPanel from "./BillPanel";

export const dynamic = "force-dynamic";

// Detail bill DRAFT satu meja (PRD §6.2). Server component: baca bill + item,
// tampilkan daftar & total; aksi (tambah/bayar/batal/gabung/pisah) di BillPanel.
export default async function MejaDetailPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const warungId = await currentWarungId();
  const meja = await prisma.meja.findFirst({ where: { id: params.id, warungId } });

  if (!meja) {
    return (
      <div className="mx-auto max-w-md rounded-2xl border border-ink-200 bg-surface p-8 text-center text-body-md text-ink-700">
        Meja tidak ditemukan.
        <br />
        <Link href="/meja" className="font-bold text-ink-950 hover:underline">
          ← Kembali ke peta meja
        </Link>
      </div>
    );
  }

  const [bill, products, allMejas, shift] = await Promise.all([
    prisma.transaction.findFirst({
      where: { warungId, mejaId: meja.id, status: "DRAFT" },
      include: { items: true },
    }),
    prisma.product.findMany({
      where: { warungId },
      orderBy: [{ category: "asc" }, { name: "asc" }],
      select: { id: true, name: true, price: true, stock: true, category: true, icon: true },
    }),
    deriveStatusMeja(warungId),
    prisma.shift.findFirst({
      where: { warungId, status: "BUKA" },
      orderBy: { openedAt: "desc" },
      select: { id: true },
    }),
  ]);

  // Gabung: bill tujuan = bill ini, sumber = bill DRAFT meja lain.
  const otherBills = allMejas
    .filter((m) => m.status === "TERISI" && m.billId && m.id !== meja.id)
    .map((m) => ({ billId: m.billId as string, nomor: m.nomor }));

  // Pisah: pindahkan item ke meja lain yang KOSONG.
  const emptyMejas = allMejas
    .filter((m) => m.status === "KOSONG" && m.id !== meja.id)
    .map((m) => ({ id: m.id, nomor: m.nomor }));

  const itemCount = bill?.items.reduce((n, i) => n + i.qty, 0) ?? 0;

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Link href="/meja" className="text-label-md text-ink-500 transition-colors hover:text-ink-950">
          ← Peta meja
        </Link>
        <h1 className="text-headline-md text-ink-950">Meja {meja.nomor}</h1>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-caption font-semibold ${
            bill ? "bg-ink-950 text-surface" : "border border-ink-200 bg-surface text-ink-500"
          }`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${bill ? "bg-success" : "bg-ink-300"}`} />
          {bill ? "Terisi" : "Kosong"}
        </span>
      </div>

      {!bill && (
        <div className="rounded-2xl border border-ink-200 bg-surface p-6">
          {!shift && (
            <p className="mb-4 rounded-xl border border-danger/30 bg-danger-bg px-4 py-2.5 text-body-sm font-semibold text-danger">
              ⚠️ Belum ada shift terbuka — buka shift dulu sebelum membuka bill.{" "}
              <Link href="/shift" className="underline">
                Buka shift →
              </Link>
            </p>
          )}
          <p className="mb-4 text-body-md text-ink-500">
            Meja ini kosong. Buka bill untuk mulai mencatat pesanan tamu.
          </p>
          <BillPanel
            billId={null}
            mejaId={meja.id}
            hasShift={!!shift}
            items={[]}
            subtotal={0}
            discount={0}
            tax={0}
            total={0}
            products={products}
            otherBills={otherBills}
            emptyMejas={emptyMejas}
          />
        </div>
      )}

      {bill && (
        // Layout 2 kolom di layar lebar: kiri daftar item bill (sticky), kanan
        // aksi (tambah/bayar/gabung/pisah). Di mobile tetap 1 kolom bertumpuk.
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="lg:sticky lg:top-4 lg:self-start">
            <div className="overflow-hidden rounded-2xl border border-ink-200 bg-surface">
              <div className="flex items-center justify-between border-b border-ink-200 px-4 py-3">
                <h2 className="text-headline-sm text-ink-950">
                  Bill <span className="text-body-sm font-normal text-ink-500">({itemCount} item)</span>
                </h2>
                <span className="font-receipt text-caption text-ink-500">
                  #{bill.id.slice(0, 8).toUpperCase()}
                </span>
              </div>

              {bill.items.length === 0 ? (
                <p className="px-4 py-8 text-center text-body-sm text-ink-500">
                  Belum ada item. Tambahkan pesanan di bawah 👇
                </p>
              ) : (
                <div className="px-4 py-2">
                  {bill.items.map((i) => (
                    <div
                      key={i.id}
                      className="flex min-h-12 items-center gap-3 border-b border-ink-200 py-2.5 text-body-sm last:border-0"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-semibold text-ink-950">{i.name}</div>
                        <div className="text-caption text-ink-500 tabular-nums">
                          {i.qty} × {rupiah(i.price)}
                        </div>
                      </div>
                      <div className="text-label-lg text-ink-950 tabular-nums">
                        {rupiah(i.price * i.qty)}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="border-t border-ink-200 bg-canvas px-4 py-3 text-body-sm">
                <div className="flex justify-between text-ink-700">
                  <span>Subtotal</span>
                  <span className="tabular-nums">{rupiah(bill.subtotal)}</span>
                </div>
                {bill.discount > 0 && (
                  <div className="flex justify-between text-ink-700">
                    <span>Diskon</span>
                    <span className="tabular-nums">−{rupiah(bill.discount)}</span>
                  </div>
                )}
                {bill.tax > 0 && (
                  <div className="flex justify-between text-ink-700">
                    <span>Pajak</span>
                    <span className="tabular-nums">+{rupiah(bill.tax)}</span>
                  </div>
                )}
                <div className="mt-1.5 flex justify-between text-numeral-lg text-ink-950">
                  <span>Total</span>
                  <span className="tabular-nums">{rupiah(bill.total)}</span>
                </div>
              </div>
            </div>
          </div>

          <div>
            <BillPanel
              billId={bill.id}
              mejaId={meja.id}
              hasShift={!!shift}
              items={bill.items.map((i) => ({
                id: i.id,
                productId: i.productId,
                name: i.name,
                price: i.price,
                qty: i.qty,
              }))}
              subtotal={bill.subtotal}
              discount={bill.discount}
              tax={bill.tax}
              total={bill.total}
              products={products}
              otherBills={otherBills}
              emptyMejas={emptyMejas}
            />
          </div>
        </div>
      )}
    </div>
  );
}
