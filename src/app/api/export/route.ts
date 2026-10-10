import { prisma } from "@/server/db";
import { isDateStr } from "@/server/http";
import { currentWarungId, requireOwnerResponse } from "@/server/tenant";
import { handleApiError } from "@/server/api-error";

export const dynamic = "force-dynamic";

// GET /api/export?from=ISO&to=ISO → CSV transaksi periode (owner-only).
export async function GET(req: Request) {
  try {
    const denied = await requireOwnerResponse();
    if (denied) return denied;

    const warungId = await currentWarungId();
    const { searchParams } = new URL(req.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    const dateFilter =
      isDateStr(from) && isDateStr(to)
        ? { gte: new Date(from + "T00:00:00"), lte: new Date(to + "T23:59:59") }
        : undefined;

    const trx = await prisma.transaction.findMany({
      where: {
        warungId,
        status: "LUNAS",
        ...(dateFilter ? { createdAt: dateFilter } : {}),
      },
      orderBy: { createdAt: "asc" },
      include: { items: true },
    });

    // Amankan dari CSV formula injection: sel yang diawali = + - @ TAB atau CR
    // bisa dieksekusi spreadsheet saat dibuka, jadi beri awalan kutip tunggal.
    const esc = (v: string | number) => {
      let s = String(v);
      if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
      return `"${s.replace(/"/g, '""')}"`;
    };
    const rows = [
      "id,waktu,item,subtotal,diskon,pajak,total,cara,bayar,kembali",
      ...trx.map((t) =>
        [
          t.id,
          t.createdAt.toLocaleString("id-ID"),
          t.items.map((i) => `${i.name} x${i.qty}`).join("; "),
          t.subtotal,
          t.discount,
          t.tax,
          t.total,
          t.payment,
          t.cash,
          t.change,
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
  } catch (e) {
    return handleApiError(e);
  }
}
