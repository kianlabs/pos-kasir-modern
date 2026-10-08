import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { rupiah } from "@/lib/rupiah";
import { PAYMENT_LABEL, shortId } from "@/lib/meta";
import { currentWarungId } from "@/lib/warung";
import PrintButton from "./PrintButton";

export const dynamic = "force-dynamic";

export default async function StrukPage({ params }: { params: { id: string } }) {
  const warungId = await currentWarungId();
  const trx = await prisma.transaction.findFirst({
    where: { id: params.id, warungId },
    include: {
      items: { include: { product: true } },
      warung: { include: { settings: true } },
    },
  });

  if (!trx)
    return (
      <div className="mx-auto max-w-sm rounded-xl border bg-white p-8 text-center shadow-sm">
        Transaksi tidak ditemukan.
        <br />
        <Link href="/" className="font-bold text-primary hover:underline">
          Kembali ke kasir
        </Link>
      </div>
    );

  const receiptName =
    trx.warung.settings[0]?.receiptName || trx.warung.nama || "Warung Berkah Jaya";
  const alamat = trx.warung.alamat || "Jl. Merdeka No. 45, Kartasura";

  return (
    <div>
      <div className="print-area mx-auto max-w-sm rounded-xl border bg-white p-6 font-mono text-sm shadow-sm">
        <h1 className="text-center text-lg font-bold">🧾 {receiptName}</h1>
        <p className="text-center text-xs text-zinc-500">
          {alamat}
          <br />
          {trx.createdAt.toLocaleString("id-ID")} • #{shortId(trx.id)}
        </p>
        <div className="my-3 border-t-2 border-dashed" />
        {trx.items.map((i) => (
          <div key={i.id} className="mb-1.5">
            <div className="font-bold">{i.name || i.product.name}</div>
            <div className="flex justify-between text-zinc-700">
              <span>
                {i.qty} × {rupiah(i.price)}
              </span>
              <span>{rupiah(i.price * i.qty)}</span>
            </div>
          </div>
        ))}
        <div className="my-3 border-t-2 border-dashed" />
        <div className="flex justify-between">
          <span>Subtotal</span>
          <span>{rupiah(trx.subtotal)}</span>
        </div>
        {trx.discount > 0 && (
          <div className="flex justify-between">
            <span>Diskon</span>
            <span>−{rupiah(trx.discount)}</span>
          </div>
        )}
        {trx.tax > 0 && (
          <div className="flex justify-between">
            <span>Pajak</span>
            <span>+{rupiah(trx.tax)}</span>
          </div>
        )}
        <div className="flex justify-between text-base font-bold">
          <span>TOTAL</span>
          <span>{rupiah(trx.total)}</span>
        </div>
        <div className="mt-1 flex justify-between">
          <span>{PAYMENT_LABEL[trx.payment] ?? trx.payment}</span>
          <span>{rupiah(trx.cash)}</span>
        </div>
        {trx.payment === "CASH" && (
          <div className="flex justify-between">
            <span>Kembali</span>
            <span>{rupiah(trx.change)}</span>
          </div>
        )}
        <div className="my-3 border-t-2 border-dashed" />
        <p className="text-center text-xs text-zinc-500">
          Terima kasih & sampai jumpa 🙏
          <br />
          Barang yang dibeli tidak dapat ditukar
        </p>
      </div>

      <div className="mx-auto mt-4 flex max-w-sm gap-2 print:hidden">
        <Link
          href="/"
          className="flex-1 rounded-lg bg-primary py-2.5 text-center text-sm font-bold text-white hover:bg-primary-hover"
        >
          Transaksi baru
        </Link>
        <PrintButton />
      </div>
    </div>
  );
}
