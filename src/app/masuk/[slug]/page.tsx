import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/server/db";
import { getSession } from "@/server/tenant";
import LoginClient from "./LoginClient";

export const dynamic = "force-dynamic";

// /masuk/<slug> — satu-satunya halaman publik (lampiran skema §1 koreksi #7).
// Tablet dibuka via URL ini → daftar nama kasir warung itu → PIN.
export default async function MasukPage(props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  const session = await getSession();
  if (session) redirect("/");

  const warung = await prisma.warung.findUnique({
    where: { slug: params.slug },
    select: { id: true, nama: true, slug: true, status: true },
  });

  if (!warung) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center p-6 text-center">
        <div className="text-4xl">🧾</div>
        <h1 className="mt-2 font-display-hero-mobile text-display-hero-mobile tracking-tight text-ink-950">
          KRING!
        </h1>
        <p className="mt-3 rounded-xl border border-danger bg-surface px-4 py-3 font-body-md text-body-md text-danger">
          Warung <b>{params.slug}</b> tidak ditemukan. Cek kembali tautan tablet ini.
        </p>
        <p className="mt-4 font-caption text-caption text-ink-500">
          Minta tautan yang benar ke Owner warung Anda.
        </p>
      </main>
    );
  }

  if (warung.status === "SUSPENDED") {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center p-6 text-center">
        <div className="text-4xl">🧾</div>
        <h1 className="mt-2 font-display-hero-mobile text-display-hero-mobile tracking-tight text-ink-950">
          KRING!
        </h1>
        <p className="mt-3 rounded-xl border border-ink-200 bg-ink-100 px-4 py-3 font-body-md text-body-md text-ink-700">
          Warung <b>{warung.nama}</b> sedang dinonaktifkan. Hubungi admin KRING!.
        </p>
      </main>
    );
  }

  const kasir = await prisma.user.findMany({
    where: { warungId: warung.id, role: "KASIR", aktif: true },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true },
  });

  return (
    <div className="min-h-[calc(100vh-3rem)]">
      <LoginClient slug={warung.slug} namaWarung={warung.nama} kasir={kasir} />
      <p className="mt-4 text-center font-caption text-caption text-ink-500 print:hidden">
        Salah warung? Hubungi Owner. ·{" "}
        <Link href="/" className="font-semibold text-ink-950 hover:underline">
          Kembali
        </Link>
      </p>
    </div>
  );
}
