import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { readJson } from "@/server/http";
import { currentWarungId, currentKasirId, requireOwnerResponse } from "@/server/tenant";
import { handleApiError } from "@/server/api-error";
import { str } from "@/server/validate";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const warungId = await currentWarungId();
    const products = await prisma.product.findMany({
      where: { warungId },
      orderBy: [{ category: "asc" }, { name: "asc" }],
    });
    return NextResponse.json(products);
  } catch (e) {
    return handleApiError(e);
  }
}

// POST /api/products → owner-only (kasir tidak boleh mengubah katalog/harga).
export async function POST(req: Request) {
  try {
    const denied = await requireOwnerResponse();
    if (denied) return denied;

    const warungId = await currentWarungId();
    const kasirId = await currentKasirId(warungId);

    const body = await readJson(req);
    if (!body) return NextResponse.json({ error: "Body tidak valid." }, { status: 400 });
    const name = str(body.name, 120);
    const price = Number(body.price);
    const stock = Number(body.stock ?? 0);
    const category = str(body.category, 60) || "Umum";
    const icon = str(body.icon).slice(0, 16);

    if (!name || !Number.isInteger(price) || price <= 0) {
      return NextResponse.json(
        { error: "Nama dan harga (>0) wajib diisi." },
        { status: 400 }
      );
    }
    if (!Number.isInteger(stock) || stock < 0) {
      return NextResponse.json({ error: "Stok harus bilangan >= 0." }, { status: 400 });
    }

    const product = await prisma.product.create({
      data: { warungId, name, price, stock, category, icon },
    });
    if (stock > 0) {
      await prisma.stockMove.create({
        data: {
          warungId,
          productId: product.id,
          qty: stock,
          type: "STOK_AWAL",
          createdBy: kasirId,
        },
      });
    }
    return NextResponse.json(product, { status: 201 });
  } catch (e) {
    return handleApiError(e);
  }
}
