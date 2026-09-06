import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// GET /api/customers → pelanggan + total hutang belum lunas
export async function GET() {
  const customers = await prisma.customer.findMany({
    orderBy: { name: "asc" },
    include: { debts: { where: { status: "BELUM" } } },
  });
  return NextResponse.json(
    customers.map((c) => ({
      id: c.id,
      name: c.name,
      phone: c.phone,
      hutang: c.debts.reduce((n, d) => n + (d.total - d.paid), 0),
      openDebts: c.debts.length,
    }))
  );
}
