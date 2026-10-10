import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/server/db";
import { getSession } from "@/server/tenant";

export const dynamic = "force-dynamic";

// /masuk — landing + pemilih warung generik ketika tablet diakses tanpa slug.
// Menampilkan brand KRING! lalu grid kartu warung (nama saja, bukan rahasia)
// agar kasir memilih warungnya lalu diarahkan ke /masuk/<slug>. Tidak ada
// kredensial di sini.
export default async function MasukGenerikPage() {
  const session = await getSession();
  if (session) redirect("/");

  const warungs = await prisma.warung.findMany({
    where: { status: { not: "SUSPENDED" } },
    orderBy: { createdAt: "asc" },
    select: { nama: true, slug: true },
  });

  return (
    <main className="mx-auto flex w-full max-w-[600px] flex-col items-stretch">
      {/* Hero — brand + tagline + subtitle */}
      <header className="mb-8 text-center">
        <div className="mb-3 inline-flex items-center justify-center gap-2.5">
          <span
            aria-hidden="true"
            className="flex h-12 w-12 items-center justify-center rounded-2xl bg-ink-950 text-[26px] leading-none text-surface"
          >
            🧾
          </span>
          <h1 className="font-display-hero text-display-hero leading-none tracking-tight text-ink-950">
            KRING!
          </h1>
        </div>
        <p className="font-headline-sm text-headline-sm text-ink-950">
          Kring! Kasir bunyi, cuan masuk.
        </p>
        <p className="mx-auto mt-2 max-w-[420px] font-body-md text-body-md text-ink-500">
          Pilih warung Anda untuk masuk ke POS.
        </p>
      </header>

      {/* Pemilih warung */}
      <section
        aria-label="Pilih warung"
        className="w-full rounded-[20px] border border-ink-200 bg-surface p-5 shadow-[0_8px_24px_rgba(0,0,0,0.04)] sm:p-6"
      >
        {warungs.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-ink-200 bg-ink-100 px-4 py-6 text-center">
            <span aria-hidden="true" className="text-2xl leading-none">
              🏪
            </span>
            <p className="font-body-md text-body-md text-ink-700">
              Belum ada warung terdaftar.
            </p>
            <p className="font-caption text-caption text-ink-500">
              Jalankan <code className="font-receipt">npx tsx prisma/seed.ts</code> dulu.
            </p>
          </div>
        ) : (
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {warungs.map((w) => (
              <li key={w.slug}>
                <Link
                  href={`/masuk/${w.slug}`}
                  className="group flex min-h-[64px] items-center justify-between gap-3 rounded-2xl border border-ink-200 bg-surface px-4 py-3 transition-colors hover:border-ink-950 hover:bg-ink-100 focus-visible:border-ink-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-950/20 active:scale-[0.99]"
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <span
                      aria-hidden="true"
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-ink-200 bg-ink-100 text-[18px] leading-none text-ink-700 transition-colors group-hover:border-ink-950 group-hover:bg-ink-950 group-hover:text-surface"
                    >
                      🏪
                    </span>
                    <span className="truncate font-label-lg text-label-lg text-ink-950">
                      {w.nama}
                    </span>
                  </span>
                  <span className="shrink-0 font-label-md text-label-md text-ink-500 transition-colors group-hover:text-ink-950">
                    Masuk →
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Footer — catatan tablet */}
      <p className="mt-5 text-center font-caption text-caption text-ink-500">
        Tablet kasir sebaiknya dibuka langsung via{" "}
        <code className="font-receipt text-ink-700">/masuk/&lt;slug-warung&gt;</code>
      </p>
    </main>
  );
}
