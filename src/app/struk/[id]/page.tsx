import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/server/db";
import { currentWarungId } from "@/server/tenant";
import ReceiptView from "@/shared/ReceiptView";
import PrintButton from "./PrintButton";

export const dynamic = "force-dynamic";

export default async function StrukPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const warungId = await currentWarungId();
  const trx = await prisma.transaction.findFirst({
    where: { id: params.id, warungId },
    include: {
      items: { include: { product: true } },
      warung: { include: { settings: true } },
    },
  });

  // Struk = bukti bayar. Bill DRAFT belum boleh dicetak → tolak (plan §4.5.2).
  if (!trx || trx.status !== "LUNAS") notFound();

  const receiptName =
    trx.warung.settings[0]?.receiptName || trx.warung.nama || "Warung Berkah Jaya";
  const alamat = trx.warung.alamat || "Jl. Merdeka No. 45, Kartasura";

  return (
    <div>
      <ReceiptView
        nama={receiptName}
        alamat={alamat}
        id={trx.id}
        createdAtLabel={trx.createdAt.toLocaleString("id-ID")}
        lines={trx.items.map((i) => ({
          key: i.id,
          name: i.name || i.product.name,
          qty: i.qty,
          price: i.price,
        }))}
        subtotal={trx.subtotal}
        discount={trx.discount}
        tax={trx.tax}
        total={trx.total}
        payment={trx.payment}
        cash={trx.cash}
        change={trx.change}
        footerNote="Barang yang dibeli tidak dapat ditukar"
        actions={
          <div className="mx-auto mt-4 flex max-w-sm gap-2 print:hidden">
            <Link
              href="/"
              className="flex-1 rounded-lg bg-primary py-2.5 text-center text-sm font-bold text-white hover:bg-primary-hover"
            >
              Transaksi baru
            </Link>
            <PrintButton />
          </div>
        }
      />
    </div>
  );
}
