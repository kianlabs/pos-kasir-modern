import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  BarChart3,
  Bell,
  Check,
  Cloud,
  Coins,
  LayoutGrid,
  Package,
  ReceiptText,
  ShieldCheck,
  Sparkles,
  Tablet,
  TrendingUp,
  UtensilsCrossed,
  WifiOff,
} from "lucide-react";
import { sesiWarungAktif } from "@/server/tenant";
import LandingFX from "./LandingFX";
import LandingFAB from "./LandingFAB";
import DemoButton from "./_components/DemoButton";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "KRING! — Kasir Warung Modern",
  description:
    "Aplikasi kasir untuk warung makan: transaksi cepat, kelola meja, stok, laporan omzet, dan pantau penjualan dari HP. Coba gratis 30 hari.",
};

// Landing page publik (root "/"). Tampil sebelum login → memasarkan produk
// (kesan SaaS). Bila sudah login, langsung diarahkan ke /kasir (pintu kerja).
// Tanpa dependensi data — murni marketing, aman di-cache/di-serve publik.

const FITUR = [
  {
    icon: ReceiptText,
    judul: "Transaksi cepat",
    isi: "Pilih menu, hitung kembalian otomatis, cetak struk. Keyboard-friendly & siap barcode scanner.",
  },
  {
    icon: UtensilsCrossed,
    judul: "Kelola meja",
    isi: "Peta meja kosong/terisi, buka bill, pindah meja, gabung pesanan — cocok warung makan & kafe.",
  },
  {
    icon: Package,
    judul: "Stok & produk",
    isi: "Atur menu, harga, dan stok. Notifikasi stok menipis biar tak kehabisan saat ramai.",
  },
  {
    icon: BarChart3,
    judul: "Laporan & insight",
    isi: "Omzet harian, produk terlaris, jam sibuk, sampai ringkasan otomatis — tanpa hitung manual.",
  },
  {
    icon: Sparkles,
    judul: "Asisten AI",
    isi: "Tanya langsung soal penjualan, dapat ringkasan otomatis & peringatan anomali — seperti punya manajer 24 jam.",
  },
  {
    icon: TrendingUp,
    judul: "Dashboard live",
    isi: "Pantau penjualan real-time dari HP di rumah. Tahu kondisi warung tanpa harus ke lokasi.",
  },
  {
    icon: WifiOff,
    judul: "Tetap jalan saat offline",
    isi: "Internet putus? Kasir tetap bisa jualan. Data tersinkron otomatis begitu online lagi.",
  },
];

const LANGKAH = [
  { n: "1", judul: "Daftar warung", isi: "Isi nama warung & email. Kurang dari 1 menit." },
  { n: "2", judul: "Atur menu", isi: "Tambah produk, harga, stok. Atau mulai dari menu contoh." },
  { n: "3", judul: "Mulai jualan", isi: "Buka shift, layani pelanggan, pantau omzet dari mana saja." },
];

// Fitur UNGGULAN (highlights) — empat hal paling sering dipakai warung.
// Ditampilkan sebagai baris bergantian (teks ⇄ tangkapan layar) supaya
// penjelasannya lebih dalam dari sekadar kartu ikon.
const HIGHLIGHTS = [
  {
    eyebrow: "Transaksi",
    tab: "KRING! · Kasir",
    judul: "Bayar cepat, antrian lancar",
    isi: "Pilih menu, kembalian dihitung otomatis, struk langsung jadi. Siap keyboard & barcode scanner — kasir baru pun hafal rutenya dalam sehari.",
    poin: ["Hitung kembalian otomatis", "Siap barcode scanner", "Struk 58 & 80mm"],
    gambar: "/preview-kasir.png",
    alt: "Halaman kasir KRING!",
  },
  {
    eyebrow: "Asisten AI",
    tab: "KRING! · Insight",
    judul: "Tanya warungmu, dijawab AI",
    isi: "Ketik pertanyaan biasa — “produk apa yang paling laku minggu ini?” — dan AI membaca angka penjualanmu lalu menjawabnya. Ringkasan harian & peringatan anomali tersusun sendiri, tinggal dibaca.",
    poin: ["Tanya-jawab soal penjualan", "Ringkasan harian otomatis", "Deteksi kejanggalan & stok menipis"],
    gambar: "/preview-ai.png",
    alt: "Asisten AI KRING! Insight",
  },
  {
    eyebrow: "Pantau dari mana saja",
    tab: "KRING! · Dashboard",
    judul: "Semua angka penting, dalam satu layar",
    isi: "Buka dashboard kapan pun untuk lihat omzet hari ini, jumlah transaksi, sampai jam paling ramai — diperbarui otomatis, tanpa perlu telepon kasir.",
    poin: ["Omzet real-time", "Transaksi terbaru langsung masuk", "Bisa dibuka dari mana saja"],
    gambar: "/preview-dashboard.png",
    alt: "Dashboard live KRING!",
  },
  {
    eyebrow: "Untung tanpa hitung manual",
    tab: "KRING! · Laporan",
    judul: "Tahu produk terlaris & stok yang menipis",
    isi: "Laporan harian sampai bulanan tersusun sendiri. Lihat produk paling laku, jam sibuk, dan stok yang perlu segera ditambah.",
    poin: ["Laporan otomatis", "Produk & jam terlaris", "Peringatan stok menipis"],
    gambar: "/preview-laporan.png",
    alt: "Laporan penjualan KRING!",
  },
];

export default async function LandingPage() {
  // Redirect ke /kasir HANYA bila warung masih ada. Sesi yatim (warung
  // terhapus) → tetap tampilkan landing agar tak crash / loop.
  if (await sesiWarungAktif()) redirect("/kasir");

  return (
    <div className="min-h-screen bg-canvas">
      {/* Efek gerak (GSAP ScrollTrigger + progress bar) — client component.
          Hero dianimasikan CSS murni; sisanya reveal saat menggulir. */}
      <LandingFX />
      {/* Menu interaksi melayang: WhatsApp, lompat antar-seksi, ke atas. */}
      <LandingFAB />

      {/* ── Nav atas ── */}
      <header className="sticky top-0 z-30 border-b border-ink-200 bg-canvas/85 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-ink-950 text-surface">
              <Bell className="h-[18px] w-[18px]" />
            </span>
            <span className="font-display-hero text-headline-sm font-bold tracking-tight text-ink-950">
              KRING!
            </span>
          </div>
          <nav className="flex items-center gap-2">
            <DemoButton
              variant="nav"
              label="Coba Demo"
              className="hidden sm:inline-flex"
            />
            <Link
              href="/masuk"
              className="rounded-xl px-4 py-2.5 text-label-lg font-label-lg text-ink-700 transition-colors hover:bg-ink-100 hover:text-ink-950"
            >
              Masuk
            </Link>
            <Link
              href="/daftar"
              className="rounded-xl bg-ink-950 px-4 py-2.5 text-label-lg font-label-lg text-surface transition-all hover:opacity-90 active:scale-[0.98]"
            >
              Coba Gratis
            </Link>
          </nav>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="mx-auto max-w-6xl px-5 pb-12 pt-12 md:pb-16 md:pt-20">
        <div className="grid items-center gap-12 md:grid-cols-2">
          <div data-fx-hero-copy>
            <span className="inline-flex items-center gap-2 rounded-full border border-ink-200 bg-surface px-3 py-1.5 text-caption font-caption uppercase tracking-wider text-ink-700">
              <Sparkles className="h-3.5 w-3.5" /> Kasir untuk warung & kafe
            </span>
            <h1 className="mt-5 font-display-hero text-display-hero-mobile leading-[1.1] tracking-tight text-ink-950 sm:text-display-hero sm:leading-[1.05]">
              Kasir bunyi,
              <br />
              cuan masuk.
            </h1>
            <p className="mt-5 max-w-lg font-body-lg text-body-lg leading-relaxed text-ink-700">
              KRING! bantu warung kamu jualan lebih rapi: transaksi cepat, stok
              terjaga, laporan omzet otomatis. Pantau penjualan dari HP, kapan pun.
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              <DemoButton
                variant="hero"
                label="⚡ Coba Demo Langsung"
                className="order-first sm:order-none"
              />
              <Link
                href="/daftar"
                className="inline-flex h-14 items-center justify-center gap-2 rounded-xl bg-ink-950 px-6 py-3.5 text-label-lg font-label-lg text-surface transition-all hover:opacity-90 active:scale-[0.98]"
              >
                Mulai Gratis 30 Hari <ArrowRight className="h-5 w-5" />
              </Link>
              <Link
                href="/masuk"
                className="inline-flex h-14 items-center justify-center gap-2 rounded-xl border border-ink-200 bg-surface px-6 py-3.5 text-label-lg font-label-lg text-ink-950 transition-colors hover:bg-ink-100 active:scale-[0.98]"
              >
                Sudah punya akun
              </Link>
            </div>
            <p className="mt-4 flex items-center gap-1.5 font-caption text-caption text-ink-500">
              <Check className="h-3.5 w-3.5 text-success" /> 1-Klik Demo tanpa daftar · Akses penuh simulasi kasir & produk
            </p>
          </div>

          {/* Mockup produk */}
          <div className="relative" data-fx-hero-side>
            <div className="overflow-hidden rounded-2xl border border-ink-200 bg-surface shadow-[0_18px_50px_rgba(0,0,0,0.10)]">
              <div className="flex items-center gap-1.5 border-b border-ink-200 bg-ink-100 px-4 py-2.5">
                <span className="h-2.5 w-2.5 rounded-full bg-ink-300" />
                <span className="h-2.5 w-2.5 rounded-full bg-ink-300" />
                <span className="h-2.5 w-2.5 rounded-full bg-ink-300" />
                <span className="ml-2 font-caption text-caption text-ink-500">KRING! · Kasir</span>
              </div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/preview-kasir.png"
                alt="Tampilan halaman kasir KRING!"
                className="w-full"
                width={1440}
                height={900}
              />
            </div>
            <div className="absolute -bottom-5 -left-5 hidden items-center gap-2 rounded-xl border border-ink-200 bg-surface px-3.5 py-2.5 shadow-lg sm:flex">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-success-bg text-success">
                <Coins className="h-4 w-4" />
              </span>
              <span className="flex flex-col">
                <span className="font-caption text-caption text-ink-500">Omzet hari ini</span>
                <span className="font-numeral-md text-numeral-md tabular-nums text-ink-950" data-fx-count="1248000" data-fx-count-prefix="Rp">Rp1.248.000</span>
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ── Fitur ── */}
      <section id="fitur" className="scroll-mt-20 border-t border-ink-200 bg-surface">
        <div className="mx-auto max-w-6xl px-5 py-16">
          <div className="mx-auto max-w-2xl text-center" data-fx="rise">
            <h2 className="font-headline-lg text-headline-lg tracking-tight text-ink-950">
              Semua yang warung butuh
            </h2>
            <p className="mt-3 font-body-md text-body-md text-ink-700">
              Dibuat khusus untuk warung makan Indonesia — sederhana, cepat, dan
              tetap jalan walau internet mati.
            </p>
          </div>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3" data-fx-stagger data-fx-child="scale-in" data-fx-step="0.06">
            {FITUR.map((f) => (
              <div
                key={f.judul}
                className="rounded-2xl border border-ink-200 bg-canvas p-5 transition-shadow hover:shadow-sm"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-ink-950 text-surface">
                  <f.icon className="h-5 w-5" />
                </span>
                <h3 className="mt-4 font-headline-sm text-headline-sm text-ink-950">{f.judul}</h3>
                <p className="mt-1.5 font-body-md text-body-md leading-relaxed text-ink-700">{f.isi}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Highlights (fitur unggulan) ── */}
      <section id="highlights" className="scroll-mt-20 border-t border-ink-200 bg-canvas">
        <div className="mx-auto max-w-6xl px-5 py-16 md:py-20">
          <div className="mx-auto max-w-2xl text-center" data-fx="rise">
            <span className="font-caption text-caption uppercase tracking-[0.2em] text-ink-500">
              Yang paling sering dipakai
            </span>
            <h2 className="mt-3 font-headline-lg text-headline-lg tracking-tight text-ink-950">
              Empat hal yang bikin warung lebih ringan
            </h2>
          </div>

          <div className="mt-14 flex flex-col gap-16 md:mt-20 md:gap-24">
            {HIGHLIGHTS.map((h, i) => (
              <div
                key={h.judul}
                className="grid items-center gap-8 md:grid-cols-2 md:gap-14"
                data-fx="rise"
              >
                <div className={i % 2 === 1 ? "md:order-2" : ""}>
                  <span className="font-caption text-caption uppercase tracking-[0.2em] text-ink-500">
                    {h.eyebrow}
                  </span>
                  <h3 className="mt-3 font-headline-md text-headline-md tracking-tight text-ink-950">
                    {h.judul}
                  </h3>
                  <p className="mt-3 font-body-md text-body-md leading-relaxed text-ink-700">
                    {h.isi}
                  </p>
                  <ul className="mt-5 flex flex-col gap-2.5">
                    {h.poin.map((p) => (
                      <li
                        key={p}
                        className="flex items-center gap-2.5 font-body-md text-body-md text-ink-950"
                      >
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-success-bg text-success">
                          <Check className="h-3 w-3" />
                        </span>
                        {p}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className={i % 2 === 1 ? "md:order-1" : ""}>
                  <figure className="overflow-hidden rounded-2xl border border-ink-200 bg-surface">
                    <div className="flex items-center gap-1.5 border-b border-ink-200 bg-ink-100 px-4 py-2.5">
                      <span className="h-2.5 w-2.5 rounded-full bg-ink-300" />
                      <span className="h-2.5 w-2.5 rounded-full bg-ink-300" />
                      <span className="h-2.5 w-2.5 rounded-full bg-ink-300" />
                      <span className="ml-2 font-caption text-caption text-ink-500">{h.tab}</span>
                    </div>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={h.gambar} alt={h.alt} className="w-full" />
                  </figure>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Cara mulai ── */}
      <section id="cara" className="scroll-mt-20 border-t border-ink-200 bg-surface">
        <div className="mx-auto max-w-6xl px-5 py-16">
          <h2 className="text-center font-headline-lg text-headline-lg tracking-tight text-ink-950" data-fx="rise">
            Mulai dalam 3 langkah
          </h2>
          <div className="mt-12 grid gap-6 md:grid-cols-3" data-fx-stagger data-fx-child="rise" data-fx-step="0.08">
            {LANGKAH.map((l) => (
              <div key={l.n} className="text-center">
                <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-ink-950 font-numeral-lg text-numeral-lg text-surface">
                  {l.n}
                </span>
                <h3 className="mt-4 font-headline-sm text-headline-sm text-ink-950">{l.judul}</h3>
                <p className="mt-1.5 font-body-md text-body-md text-ink-700">{l.isi}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Harga ── */}
      <section id="harga" className="scroll-mt-20 border-t border-ink-200 bg-canvas">
        <div className="mx-auto max-w-3xl px-5 py-16">
          <div className="text-center" data-fx="rise">
            <h2 className="font-headline-lg text-headline-lg tracking-tight text-ink-950">
              Harga jujur, tanpa kejutan
            </h2>
            <p className="mt-3 font-body-md text-body-md text-ink-700">
              Semua fitur sudah termasuk. Tanpa biaya tersembunyi.
            </p>
          </div>
          <div className="mt-10 overflow-hidden rounded-3xl border-2 border-ink-950 bg-surface" data-fx="scale-in">
            <div className="flex flex-col items-center gap-1 border-b border-ink-200 bg-ink-950 px-6 py-4 text-center">
              <span className="font-label-lg text-label-lg uppercase tracking-wider text-ink-300">
                Paket Warung
              </span>
            </div>
            <div className="p-8 text-center">
              <div className="flex items-baseline justify-center gap-2">
                <span className="font-display-hero text-display-hero tracking-tight text-ink-950">
                  Rp99rb
                </span>
                <span className="font-body-md text-body-md text-ink-500">/warung/bulan</span>
              </div>
              <p className="mt-3 font-body-md text-body-md text-ink-700">
                Gratis <b>30 hari</b> pertama. Setelah itu lanjut seharga segelas kopi per hari.
              </p>
              <ul className="mx-auto mt-7 grid max-w-md gap-3 text-left">
                {[
                  { icon: ReceiptText, t: "Transaksi & struk tanpa batas" },
                  { icon: LayoutGrid, t: "Kelola meja & pesanan" },
                  { icon: Package, t: "Produk, harga & stok" },
                  { icon: BarChart3, t: "Laporan omzet & produk terlaris" },
                  { icon: TrendingUp, t: "Dashboard live dari HP" },
                  { icon: WifiOff, t: "Mode offline (tetap jualan tanpa internet)" },
                  { icon: ShieldCheck, t: "Multi-kasir dengan PIN" },
                ].map((b) => (
                  <li key={b.t} className="flex items-center gap-3 font-body-md text-body-md text-ink-950">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-success-bg text-success">
                      <Check className="h-3.5 w-3.5" />
                    </span>
                    {b.t}
                  </li>
                ))}
              </ul>
              <Link
                href="/daftar"
                className="mt-8 inline-flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-ink-950 px-6 py-3.5 text-label-lg font-label-lg text-surface transition-all hover:opacity-90 active:scale-[0.98]"
              >
                Mulai Gratis Sekarang <ArrowRight className="h-5 w-5" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA akhir ── */}
      <section className="border-t border-ink-200 bg-ink-950">
        <div className="mx-auto max-w-3xl px-5 py-16 text-center" data-fx-stagger data-fx-child="rise" data-fx-step="0.08">
          <Tablet className="mx-auto h-10 w-10 text-ink-300" />
          <h2 className="mt-5 font-headline-lg text-headline-lg tracking-tight text-surface">
            Siap bikin warung kamu lebih rapi?
          </h2>
          <p className="mt-3 font-body-md text-body-md text-ink-300">
            Daftar hari ini, mulai jualan dalam 1 menit. Gratis 30 hari.
          </p>
          <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <DemoButton
              variant="inverted"
              label="⚡ Coba Demo Langsung"
              className="w-full sm:w-auto"
            />
            <Link
              href="/daftar"
              className="inline-flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-surface px-7 py-3.5 text-label-lg font-label-lg text-ink-950 transition-all hover:opacity-90 active:scale-[0.98] sm:w-auto"
            >
              Daftar Warung <ArrowRight className="h-5 w-5" />
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-ink-200 bg-canvas">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-5 pb-24 pt-8 sm:flex-row sm:pb-8" data-fx="fade">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-ink-950 text-surface">
              <Bell className="h-4 w-4" />
            </span>
            <span className="font-label-lg font-label-lg font-bold text-ink-950">KRING!</span>
          </div>
          <div className="flex items-center gap-5 font-caption text-caption text-ink-500">
            <Link href="/masuk" className="hover:text-ink-950">Masuk</Link>
            <Link href="/daftar" className="hover:text-ink-950">Daftar</Link>
            <span className="flex items-center gap-1.5">
              <Cloud className="h-3.5 w-3.5" /> © 2026 KRING!
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
