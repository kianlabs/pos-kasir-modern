import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/server/db";
import { getSession } from "@/server/tenant";

export const dynamic = "force-dynamic";

// /masuk/_ — halaman masuk generik ketika tablet diakses tanpa slug.
// Menampilkan daftar warung (nama saja, bukan rahasia) agar kasir bisa memilih
// warungnya lalu diarahkan ke /masuk/<slug>. Tidak ada kredensial di sini.
export default async function MasukGenerikPage() {
  const session = await getSession();
  if (session) redirect("/");

  const warungs = await prisma.warung.findMany({
    where: { status: { not: "SUSPENDED" } },
    orderBy: { createdAt: "asc" },
    select: { nama: true, slug: true },
  });

  return (
    <main className="mx-auto w-full max-w-[520px]">
      <header className="mb-6 text-center">
        <div className="flex items-center justify-center gap-2">
          <span className="text-3xl">🧾</span>
          <h1 className="text-3xl font-extrabold tracking-tight">KRING!</h1>
        </div>
        <p className="text-sm text-text-muted">Pilih warung untuk masuk.</p>
      </header>

      <div className="rounded-[20px] border border-neutral bg-surface p-6 shadow-sm">
        {warungs.length === 0 ? (
          <p className="rounded-lg bg-warning-bg px-3 py-2 text-sm text-warning">
            Belum ada warung terdaftar. Jalankan <code>npx tsx prisma/seed.ts</code> dulu.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {warungs.map((w) => (
              <li key={w.slug}>
                <Link
                  href={`/masuk/${w.slug}`}
                  className="flex items-center justify-between rounded-xl border border-neutral px-4 py-3 text-sm font-semibold transition hover:border-primary hover:bg-accent-bg"
                >
                  {w.nama}
                  <span className="text-text-muted">→</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="mt-4 text-center text-xs text-text-muted">
        Tablet kasir sebaiknya dibuka langsung via <code>/masuk/&lt;slug-warung&gt;</code>.
      </p>
    </main>
  );
}
