import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTaxSetting } from "@/lib/settings";
import { catat } from "@/lib/audit";
import { readJson } from "@/lib/request";
import { currentWarungId, currentKasirId } from "@/lib/warung";
import { requireBillDraft, BillError } from "@/lib/meja";

export const dynamic = "force-dynamic";

type Params = { params: { id: string } };

// POST /api/bills/[id]/bayar { cash, payment } → transisi DRAFT → LUNAS atomik.
//
// Satu-satunya jalur yang menyentuh stok (plan §7 keputusan 3): validasi stok →
// decrement → tulis StockMove → set cash/change/payment/total → status LUNAS,
// SEMUA dalam satu $transaction. Uang integer rupiah (aturan #3).
export async function POST(req: Request, { params }: Params) {
  const warungId = await currentWarungId();
  const kasirId = await currentKasirId(warungId);

  const body = await readJson(req);
  if (!body) return NextResponse.json({ error: "Body tidak valid." }, { status: 400 });

  const payment = body.payment === "QRIS" ? "QRIS" : "CASH";
  const cash = Number(body.cash);
  if (payment === "CASH" && (!Number.isInteger(cash) || cash < 0)) {
    return NextResponse.json({ error: "Nominal tunai tidak valid." }, { status: 400 });
  }

  try {
    // Guard tenant + DRAFT (lempar BillError 404 bila bukan milik warung ini).
    await requireBillDraft(params.id, warungId);

    const result = await prisma.$transaction(async (tx) => {
      const bill = await tx.transaction.findFirst({
        where: { id: params.id, warungId, status: "DRAFT" },
        include: { items: true },
      });
      if (!bill) throw new BillError("Bill tidak ditemukan.", 404);
      if (bill.items.length === 0) throw new BillError("Bill masih kosong.", 400);

      // Validasi stok nyata terjadi di sini (bukan saat tambah item): dua bill
      // DRAFT boleh sama-sama memuat qty melebihi stok; yang bayar dulu menang.
      const products = await tx.product.findMany({
        where: { id: { in: bill.items.map((i) => i.productId) }, warungId },
        select: { id: true, name: true, price: true, stock: true },
      });
      const byId = new Map(products.map((p) => [p.id, p]));

      let subtotal = 0;
      for (const item of bill.items) {
        const p = byId.get(item.productId);
        if (!p) throw new BillError(`Produk ${item.name} tidak ditemukan.`, 400);
        if (p.stock < item.qty) {
          throw new BillError(`Stok ${p.name} kurang (sisa ${p.stock}).`, 400);
        }
        subtotal += p.price * item.qty;
      }

      // Hitung ulang dari harga produk saat bayar + diskon tersimpan.
      const discount = Math.min(bill.discount, subtotal);
      const taxCfg = await getTaxSetting(tx, warungId);
      const tax = taxCfg.enabled ? Math.round(((subtotal - discount) * taxCfg.pct) / 100) : 0;
      const total = subtotal - discount + tax;

      const paid = payment === "CASH" ? cash : total;
      if (paid < total) throw new BillError(`Uang kurang ${total - paid}.`, 400);

      // Transisi DRAFT → LUNAS + isi field pembayaran (mejaId dipertahankan).
      await tx.transaction.update({
        where: { id: bill.id },
        data: {
          status: "LUNAS",
          subtotal,
          discount,
          tax,
          total,
          cash: paid,
          change: paid - total,
          payment,
        },
      });

      // Decrement stok + StockMove per item — hanya di jalur bayar.
      for (const item of bill.items) {
        const p = byId.get(item.productId)!;
        await tx.product.update({
          where: { id: p.id },
          data: { stock: { decrement: item.qty } },
        });
        await tx.stockMove.create({
          data: {
            warungId,
            productId: p.id,
            qty: -item.qty,
            type: "PENJUALAN",
            refId: bill.id,
            createdBy: kasirId,
          },
        });
      }

      return { id: bill.id, mejaId: bill.mejaId, total, cash: paid, change: paid - total, payment };
    });

    await catat({
      warungId,
      userId: kasirId,
      action: "MEJA_BAYAR",
      meta: { billId: result.id, mejaId: result.mejaId, total: result.total, payment: result.payment },
    });

    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof BillError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    const message = e instanceof Error ? e.message : "Gagal bayar bill.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
