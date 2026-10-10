import { NextResponse } from "next/server";
import { transaksi } from "@/server/db";
import { catat } from "@/server/audit";
import { readJson } from "@/server/http";
import { currentWarungId, currentKasirId } from "@/server/tenant";
import { requireBillDraft, hitungUlangBill, BillError } from "@/server/meja";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

// POST /api/bills/[id]/bayar { cash, payment } → transisi DRAFT → LUNAS atomik.
//
// Satu-satunya jalur yang menyentuh stok (plan §7 keputusan 3): validasi stok →
// decrement → tulis StockMove → set cash/change/payment/total → status LUNAS,
// SEMUA dalam satu $transaction. Uang integer rupiah (aturan #3).
export async function POST(req: Request, props: Params) {
  const params = await props.params;
  const warungId = await currentWarungId();
  const kasirId = await currentKasirId(warungId);

  const body = await readJson(req);
  if (!body) return NextResponse.json({ error: "Body tidak valid." }, { status: 400 });

  const payment = body.payment === "QRIS" ? "QRIS" : "CASH";
  const cash = Number(body.cash);
  if (payment === "CASH" && (!Number.isInteger(cash) || cash < 0)) {
    return NextResponse.json({ error: "Nominal tunai tidak valid." }, { status: 400 });
  }
  if (payment === "CASH" && cash > 1000000000) {
    return NextResponse.json({ error: "Nominal tunai di luar batas wajar." }, { status: 400 });
  }

  try {
    // Guard tenant + DRAFT (lempar BillError 404 bila bukan milik warung ini).
    await requireBillDraft(params.id, warungId);

    const result = await transaksi(async (tx) => {
      const bill = await tx.transaction.findFirst({
        where: { id: params.id, warungId, status: "DRAFT" },
        include: { items: true },
      });
      if (!bill) throw new BillError("Bill tidak ditemukan.", 404);
      if (bill.items.length === 0) throw new BillError("Bill masih kosong.", 400);

      // Validasi stok nyata terjadi di sini (bukan saat tambah item): dua bill
      // DRAFT boleh sama-sama memuat qty melebihi stok; yang bayar dulu menang.
      //
      // PENTING (fix K1): agregasi qty per productId DULU. Satu bill bisa punya
      // >1 baris produk yang sama (mis. hasil gabung memindah baris tanpa merge).
      // Bila validasi per-baris terhadap stok yang di-cache, dua baris bisa
      // sama-sama lolos lalu decrement kumulatif → stok minus.
      const qtyByProduct = new Map<string, { qty: number; name: string }>();
      for (const item of bill.items) {
        const cur = qtyByProduct.get(item.productId);
        if (cur) cur.qty += item.qty;
        else qtyByProduct.set(item.productId, { qty: item.qty, name: item.name });
      }

      const products = await tx.product.findMany({
        where: { id: { in: Array.from(qtyByProduct.keys()) }, warungId },
        select: { id: true, name: true, price: true, stock: true },
      });
      const byId = new Map(products.map((p) => [p.id, p]));

      // Subtotal dari SNAPSHOT harga item (bukan harga produk live) agar tagihan
      // konsisten dengan baris struk & nilai DRAFT yang dilihat kasir (fix P1).
      let subtotal = 0;
      for (const item of bill.items) subtotal += item.price * item.qty;

      // Validasi stok terhadap qty TERAGREGASI per produk.
      for (const [productId, agg] of Array.from(qtyByProduct.entries())) {
        const p = byId.get(productId);
        if (!p) throw new BillError(`Produk ${agg.name} tidak ditemukan.`, 400);
        if (p.stock < agg.qty) {
          throw new BillError(`Stok ${p.name} kurang (sisa ${p.stock}).`, 400);
        }
      }

      // Hitung ulang diskon/pajak/total lewat helper bersama (hitungUlangBill)
      // agar TIDAK ada duplikasi rumus yang bisa divergen (fix A9). `subtotal`
      // manual di atas tetap dipakai untuk pesan/urutan validasi stok.
      const totals = await hitungUlangBill(bill.id, warungId, tx);
      // Fix A13: pada LUNAS simpan diskon TER-CLAMP (min(raw, subtotal)), bukan
      // rawDiscount — struk dibayar tak boleh punya diskon > subtotal (inkonsisten).
      const discount = totals.discount;
      const tax = totals.tax;
      const total = totals.total;

      const paid = payment === "CASH" ? cash : total;
      if (paid < total) throw new BillError(`Uang kurang ${total - paid}.`, 400);

      // Transisi DRAFT → LUNAS + isi field pembayaran (mejaId dipertahankan).
      const paidRes = await tx.transaction.updateMany({
        where: { id: bill.id, warungId },
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
      if (paidRes.count !== 1) throw new BillError("Bill tidak ditemukan.", 404);

      // Decrement stok + StockMove per PRODUK (qty teragregasi) — hanya di
      // jalur bayar. Satu StockMove per produk, konsisten dengan kartu stok.
      for (const [productId, agg] of Array.from(qtyByProduct.entries())) {
        const dec = await tx.product.updateMany({
          where: { id: productId, warungId },
          data: { stock: { decrement: agg.qty } },
        });
        if (dec.count !== 1) throw new BillError(`Produk ${agg.name} tidak ditemukan.`, 400);
        await tx.stockMove.create({
          data: {
            warungId,
            productId,
            qty: -agg.qty,
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
