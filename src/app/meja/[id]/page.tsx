import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { deriveStatusMeja } from "@/lib/meja";
import { rupiah } from "@/lib/rupiah";
import { currentWarungId } from "@/lib/warung";
import BillPanel from "./BillPanel";

export const dynamic = "force-dynamic";

// Detail bill DRAFT satu meja (PRD §6.2). Server component: baca bill + item,
// tampilkan daftar & total; aksi (tambah/bayar/batal/gabung/pisah) di BillPanel.
export default async function MejaDetailPage({ params }: { params: { id: string } }) {
  const warungId = await currentWarungId();
  const meja = await prisma.meja.findFirst({ where: { id: params.id, warungId } });

  if (!meja) {
    return (
      <div className="mx-auto max-w-md rounded-xl border bg-white p-8 text-center shadow-sm">
        Meja tidak ditemukan.
        <br />
        <Link href="/meja" className="font-bold text-primary hover:underline">
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
        <Link href="/meja" className="text-sm font-semibold text-primary hover:underline">
          ← Peta meja
        </Link>
        <h1 className="text-xl font-bold">🍽️ Meja {meja.nomor}</h1>
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
            bill ? "bg-primary text-white" : "bg-emerald-100 text-emerald-700"
          }`}
        >
          {bill ? "TERISI" : "KOSONG"}
        </span>
      </div>

      {!bill && (
        <div className="rounded-xl border bg-white p-6 shadow-sm">
          {!shift && (
            <p className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm font-semibold text-amber-800">
              ⚠️ Belum ada shift terbuka — buka shift dulu sebelum membuka bill.{" "}
              <Link href="/shift" className="underline">
                Buka shift →
              </Link>
            </p>
          )}
          <p className="mb-4 text-sm text-zinc-500">
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
            <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
              <div className="flex items-center justify-between border-b px-4 py-3">
                <h2 className="font-bold">
                  Bill <span className="text-sm font-normal text-zinc-500">({itemCount} item)</span>
                </h2>
                <span className="font-mono text-xs text-zinc-400">#{bill.id.slice(0, 8).toUpperCase()}</span>
              </div>

              {bill.items.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-zinc-400">
                  Belum ada item. Tambahkan pesanan di bawah 👇
                </p>
              ) : (
                <div className="px-4 py-2">
                  {bill.items.map((i) => (
                    <div
                      key={i.id}
                      className="flex items-center gap-3 border-b py-2.5 text-sm last:border-0"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-semibold">{i.name}</div>
                        <div className="text-xs text-zinc-500">
                          {i.qty} × {rupiah(i.price)}
                        </div>
                      </div>
                      <div className="font-bold">{rupiah(i.price * i.qty)}</div>
                    </div>
                  ))}
                </div>
              )}

              <div className="border-t bg-zinc-50 px-4 py-3 text-sm">
                <div className="flex justify-between text-zinc-600">
                  <span>Subtotal</span>
                  <span>{rupiah(bill.subtotal)}</span>
                </div>
                {bill.discount > 0 && (
                  <div className="flex justify-between text-zinc-600">
                    <span>Diskon</span>
                    <span>−{rupiah(bill.discount)}</span>
                  </div>
                )}
                {bill.tax > 0 && (
                  <div className="flex justify-between text-zinc-600">
                    <span>Pajak</span>
                    <span>+{rupiah(bill.tax)}</span>
                  </div>
                )}
                <div className="mt-1.5 flex justify-between text-xl font-extrabold">
                  <span>Total</span>
                  <span>{rupiah(bill.total)}</span>
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
