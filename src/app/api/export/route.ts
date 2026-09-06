import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// GET /api/export?from=ISO&to=ISO → CSV transaksi periode
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const where =
    from && to
      ? { createdAt: { gte: new Date(from + "T00:00:00"), lte: new Date(to + "T23:59:59") } }
      : undefined;

  const trx = await prisma.transaction.findMany({
    where,
    orderBy: { createdAt: "asc" },
    include: { items: { include: { product: true } }, customer: true },
  });

  const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const rows = [
    "id,waktu,item,subtotal,diskon,pajak,total,cara,bayar,kembali,pelanggan",
    ...trx.map((t) =>
      [
        t.id,
        t.createdAt.toLocaleString("id-ID"),
        t.items.map((i) => `${i.product.name} x${i.qty}`).join("; "),
        t.subtotal,
        t.discount,
        t.tax,
        t.total,
        t.payment,
        t.cash,
        t.change,
        t.customer?.name ?? "",
      ]
        .map(esc)
        .join(",")
    ),
  ];

  const stamp = new Date().toISOString().slice(0, 10);
  return new Response("\uFEFF" + rows.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="laporan-${stamp}.csv"`,
    },
  });
}
