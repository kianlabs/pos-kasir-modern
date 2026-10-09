import Link from "next/link";
import { prisma } from "@/server/db";
import { rupiah } from "@/shared/rupiah";
import { PAYMENT_LABEL, shortId } from "@/shared/category-icon";
import { currentWarungId } from "@/server/tenant";

export const dynamic = "force-dynamic";

export default async function TransaksiPage() {
  const warungId = await currentWarungId();
  const trx = await prisma.transaction.findMany({
    // Aturan #12: hanya LUNAS yang tampil sebagai transaksi. Bill DRAFT
    // (meja terbuka) tidak boleh bocor ke daftar ini.
    where: { warungId, status: "LUNAS" },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { items: true },
  });

  return (
    <div>
      <h1 className="mb-4 text-xl font-bold">Transaksi</h1>
      <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500">
                <th className="p-3">ID</th>
                <th className="p-3">Waktu</th>
                <th className="p-3">Item</th>
                <th className="p-3">Bayar</th>
                <th className="p-3 text-right">Total</th>
                <th className="p-3 text-right">Struk</th>
              </tr>
            </thead>
            <tbody>
              {trx.map((t) => (
                <tr key={t.id} className="border-b last:border-0 hover:bg-zinc-50">
                  <td className="p-3 font-mono font-bold">#{shortId(t.id)}</td>
                  <td className="p-3 text-zinc-600">
                    {t.createdAt.toLocaleString("id-ID", {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </td>
                  <td className="max-w-[280px] truncate p-3 text-zinc-600">
                    {t.items.map((i) => `${i.name} ×${i.qty}`).join(", ")}
                  </td>
                  <td className="p-3">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                      t.payment === "QRIS" ? "bg-violet-100 text-violet-700" : "bg-accent-bg text-primary"
                    }`}>
                      {PAYMENT_LABEL[t.payment] ?? t.payment}
                    </span>
                  </td>
                  <td className="p-3 text-right font-bold">{rupiah(t.total)}</td>
                  <td className="p-3 text-right">
                    <Link href={`/struk/${t.id}`} className="font-semibold text-primary hover:underline">
                      Lihat →
                    </Link>
                  </td>
                </tr>
              ))}
              {trx.length === 0 && (
                <tr><td colSpan={6} className="p-8 text-center text-zinc-500">
                  Belum ada transaksi. Mulai jualan di halaman Kasir 🛒
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
