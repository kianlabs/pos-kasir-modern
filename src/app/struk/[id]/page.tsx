import { prisma } from "@/lib/prisma";
import { rupiah } from "@/lib/rupiah";
import Link from "next/link";
import PrintButton from "./PrintButton";

export default async function StrukPage({ params }: { params: { id: string } }) {
  const trx = await prisma.transaction.findUnique({
    where: { id: params.id },
    include: { items: { include: { product: true } } },
  });

  if (!trx) return <p>Transaksi tidak ditemukan.</p>;

  return (
    <div className="mx-auto max-w-sm rounded border bg-white p-6 font-mono text-sm">
      <h1 className="text-center text-lg font-bold">KasirKu</h1>
      <p className="text-center text-zinc-500">
        {trx.createdAt.toLocaleString("id-ID")} • {trx.payment}
      </p>
      <hr className="my-3" />
      {trx.items.map((i) => (
        <div key={i.id} className="flex justify-between">
          <span>
            {i.product.name} × {i.qty}
          </span>
          <span>{rupiah(i.price * i.qty)}</span>
        </div>
      ))}
      <hr className="my-3" />
      <div className="flex justify-between font-bold">
        <span>Total</span>
        <span>{rupiah(trx.total)}</span>
      </div>
      <div className="flex justify-between">
        <span>Bayar</span>
        <span>{rupiah(trx.cash)}</span>
      </div>
      <div className="flex justify-between">
        <span>Kembali</span>
        <span>{rupiah(trx.change)}</span>
      </div>
      <div className="mt-4 flex gap-2 print:hidden">
        <Link href="/" className="flex-1 rounded bg-black py-2 text-center font-sans font-bold text-white">
          Transaksi baru
        </Link>
        <PrintButton />
      </div>
    </div>
  );
}
