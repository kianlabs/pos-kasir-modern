import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/server/db";
import { getSession } from "@/server/tenant";

export const dynamic = "force-dynamic";

// /masuk — halaman masuk generik ketika tablet diakses tanpa slug.
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
    <main className="mx-auto flex w-full max-w-[520px] flex-col items-center">
      <header className="mb-6 text-center">
        <div className="mb-1.5 inline-flex items-center justify-center gap-2">
          <span className="text-[32px] leading-none">🧾</span>
          <h1 className="font-display-hero text-display-hero leading-none tracking-tight text-ink-950">
            KRING!
          </h1>
        </div>
        <p className="font-body-md text-body-md text-ink-500">Pilih warung untuk masuk.</p>
      </header>

      <div className="w-full rounded-[20px] border border-ink-200 bg-surface p-6 shadow-[0_8px_24px_rgba(0,0,0,0.04)]">
        {warungs.length === 0 ? (
          <p className="rounded-xl border border-ink-200 bg-ink-100 px-3 py-2 font-body-md text-body-md text-ink-700">
            Belum ada warung terdaftar. Jalankan <code>npx tsx prisma/seed.ts</code> dulu.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {warungs.map((w) => (
              <li key={w.slug}>
                <Link
                  href={`/masuk/${w.slug}`}
                  className="flex h-12 items-center justify-between rounded-xl border border-ink-200 bg-surface px-4 font-label-lg text-label-lg text-ink-950 transition-colors hover:bg-ink-100"
                >
                  {w.nama}
                  <span className="text-ink-500">→</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="mt-4 text-center font-caption text-caption text-ink-500">
        Tablet kasir sebaiknya dibuka langsung via <code>/masuk/&lt;slug-warung&gt;</code>.
      </p>
    </main>
  );
}
