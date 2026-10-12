"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Bell, Check, Eye, EyeOff, TriangleAlert } from "lucide-react";
import {
  emailError,
  namaWarungError,
  passwordError,
  konfirmasiError,
  skorSandi,
} from "@/shared/validasi";

// Form pendaftaran warung baru (self-serve signup). Kirim ke /api/auth/daftar;
// bila sukses, cookie sesi sudah ter-set → langsung ke /kasir.
//
// Validasi dua lapis: di sini (instan, per-field, biar user tahu salahnya di
// mana) + di server (otoritatif). Aturan & pesan sama → lihat shared/validasi.ts.
export default function DaftarClient() {
  const router = useRouter();
  const [nama, setNama] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [lihatSandi, setLihatSandi] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Field yang sudah pernah disentuh → baru tampilkan error merah di bawahnya.
  const [sentuh, setSentuh] = useState<{ [k: string]: boolean }>({});
  const tandai = (k: string) => setSentuh((s) => (s[k] ? s : { ...s, [k]: true }));

  const errNama = namaWarungError(nama);
  const errEmail = emailError(email);
  const errSandi = passwordError(password);
  const errKonfirmasi = konfirmasiError(password, password2);

  const canSubmit = useMemo(
    () => !loading && !errNama && !errEmail && !errSandi && !errKonfirmasi,
    [loading, errNama, errEmail, errSandi, errKonfirmasi],
  );

  const skor = skorSandi(password);
  const labelSkor = ["", "Lemah", "Sedang", "Kuat", "Sangat kuat"][skor];

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    // Tandai semua field agar error yang tersembunyi ikut tampil.
    setSentuh({ nama: true, email: true, password: true, password2: true });
    if (!canSubmit) return;
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/daftar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nama: nama.trim(), email: email.trim(), password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Gagal mendaftar. Coba lagi.");
        return;
      }
      // Auto-login sudah dilakukan server → masuk ke kasir.
      router.replace("/kasir");
      router.refresh();
    } catch {
      setError("Tidak bisa menghubungi server. Coba lagi.");
    } finally {
      setLoading(false);
    }
  }

  // Kelas input: border merah bila invalid & sudah disentuh.
  function inputCls(invalid: boolean, extra = "") {
    return `h-12 w-full rounded-xl border px-3.5 font-body-md text-body-md text-ink-950 outline-none transition-colors ${
      invalid
        ? "border-danger bg-danger-bg/40 focus:border-danger"
        : "border-ink-200 focus:border-ink-950"
    } ${extra}`;
  }

  return (
    <main className="mx-auto flex w-full max-w-[520px] flex-col items-center">
      <header className="mb-6 text-center">
        <div className="mb-1.5 inline-flex items-center justify-center gap-2">
          <Bell className="h-8 w-8 text-ink-950" aria-hidden />
          <h1 className="font-display-hero text-display-hero leading-none tracking-tight text-ink-950">
            KRING!
          </h1>
        </div>
        <p className="font-body-md text-body-md text-ink-500">
          Daftar warung kamu — gratis 30 hari.
        </p>
      </header>

      <form
        onSubmit={submit}
        noValidate
        className="w-full rounded-[20px] border border-ink-200 bg-surface p-6 shadow-[0_8px_24px_rgba(0,0,0,0.04)]"
      >
        <h2 className="mb-5 font-headline-sm text-headline-sm text-ink-950">Buat akun warung</h2>

        {/* Nama warung */}
        <label className="mb-1 block font-label-md text-label-md text-ink-700" htmlFor="nama">
          Nama warung
        </label>
        <input
          id="nama"
          value={nama}
          onChange={(e) => setNama(e.target.value)}
          onBlur={() => tandai("nama")}
          placeholder="mis. Warung Berkah Jaya"
          autoComplete="organization"
          aria-invalid={sentuh.nama && !!errNama}
          className={inputCls(sentuh.nama && !!errNama, "mb-1")}
        />
        {sentuh.nama && errNama && (
          <p className="mb-3 flex items-center gap-1.5 font-caption text-caption text-danger">
            <TriangleAlert className="h-3.5 w-3.5 shrink-0" /> {errNama}
          </p>
        )}
        {!(sentuh.nama && errNama) && <div className="mb-3" />}

        {/* Email */}
        <label className="mb-1 block font-label-md text-label-md text-ink-700" htmlFor="email">
          Email owner
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onBlur={() => tandai("email")}
          placeholder="owner@warung.com"
          autoComplete="username"
          aria-invalid={sentuh.email && !!errEmail}
          className={inputCls(sentuh.email && !!errEmail, "mb-1")}
        />
        {sentuh.email && errEmail && (
          <p className="mb-3 flex items-center gap-1.5 font-caption text-caption text-danger">
            <TriangleAlert className="h-3.5 w-3.5 shrink-0" /> {errEmail}
          </p>
        )}
        {!(sentuh.email && errEmail) && <div className="mb-3" />}

        {/* Kata sandi */}
        <label className="mb-1 block font-label-md text-label-md text-ink-700" htmlFor="password">
          Kata sandi
        </label>
        <div className="relative mb-1">
          <input
            id="password"
            type={lihatSandi ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onBlur={() => tandai("password")}
            placeholder="Minimal 8 karakter"
            autoComplete="new-password"
            aria-invalid={sentuh.password && !!errSandi}
            className={inputCls(sentuh.password && !!errSandi, "pr-11")}
          />
          <button
            type="button"
            onClick={() => setLihatSandi((v) => !v)}
            aria-label={lihatSandi ? "Sembunyikan kata sandi" : "Lihat kata sandi"}
            className="absolute inset-y-0 right-0 flex items-center px-3 text-ink-500 hover:text-ink-950"
          >
            {lihatSandi ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
          </button>
        </div>

        {/* Indikator kekuatan (muncul begitu mulai mengetik) */}
        {password.length > 0 && (
          <div className="mb-1">
            <div className="flex items-center gap-2">
              <div className="flex flex-1 gap-1">
                {[1, 2, 3, 4].map((i) => (
                  <span
                    key={i}
                    className={`h-1.5 flex-1 rounded-full ${
                      i <= skor
                        ? skor <= 1
                          ? "bg-danger"
                          : skor === 2
                            ? "bg-warning"
                            : "bg-success"
                        : "bg-ink-200"
                    }`}
                  />
                ))}
              </div>
              <span
                className={`font-caption text-caption ${
                  skor <= 1 ? "text-danger" : skor === 2 ? "text-warning" : "text-success"
                }`}
              >
                {labelSkor}
              </span>
            </div>
          </div>
        )}

        {sentuh.password && errSandi && (
          <p className="mb-3 flex items-center gap-1.5 font-caption text-caption text-danger">
            <TriangleAlert className="h-3.5 w-3.5 shrink-0" /> {errSandi}
          </p>
        )}
        {!(sentuh.password && errSandi) && <div className="mb-3" />}

        {/* Konfirmasi kata sandi (ketik ulang) */}
        <label className="mb-1 block font-label-md text-label-md text-ink-700" htmlFor="password2">
          Ulangi kata sandi
        </label>
        <div className="relative mb-1">
          <input
            id="password2"
            type={lihatSandi ? "text" : "password"}
            value={password2}
            onChange={(e) => setPassword2(e.target.value)}
            onBlur={() => tandai("password2")}
            placeholder="Ketik ulang kata sandi"
            autoComplete="new-password"
            aria-invalid={sentuh.password2 && !!errKonfirmasi}
            className={inputCls(sentuh.password2 && !!errKonfirmasi, "pr-11")}
          />
          {password2.length > 0 && !errKonfirmasi && (
            <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-success">
              <Check className="h-5 w-5" />
            </span>
          )}
        </div>
        {sentuh.password2 && errKonfirmasi && (
          <p className="mb-3 flex items-center gap-1.5 font-caption text-caption text-danger">
            <TriangleAlert className="h-3.5 w-3.5 shrink-0" /> {errKonfirmasi}
          </p>
        )}
        {!(sentuh.password2 && errKonfirmasi) && <div className="mb-3" />}

        <div className="mb-5 rounded-xl border border-ink-200 bg-ink-100 px-3 py-2.5 font-caption text-caption text-ink-500">
          <ul className="grid gap-1.5">
            {[
              "Gratis 30 hari, tanpa kartu kredit",
              "Akun ini jadi Owner warung kamu",
              "Bisa tambah kasir setelah masuk",
            ].map((t) => (
              <li key={t} className="flex items-center gap-2">
                <Check className="h-3.5 w-3.5 shrink-0 text-success" /> {t}
              </li>
            ))}
          </ul>
        </div>

        {error && (
          <p className="mb-3 flex items-center gap-2 rounded-xl bg-danger-bg px-3 py-2 font-body-md font-medium text-danger">
            <TriangleAlert className="h-4 w-4 shrink-0" /> {error}
          </p>
        )}

        <button
          type="submit"
          disabled={!canSubmit}
          className="flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-ink-950 font-headline-sm text-headline-sm text-surface transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-40"
        >
          {loading ? (
            "Membuat warung…"
          ) : (
            <span className="inline-flex items-center gap-2">
              BUAT WARUNG <ArrowRight className="h-5 w-5" />
            </span>
          )}
        </button>
      </form>

      <p className="mt-5 text-center font-caption text-caption text-ink-500">
        Sudah punya akun?{" "}
        <Link href="/masuk" className="font-semibold text-ink-950 hover:underline">
          Masuk di sini
        </Link>
      </p>
    </main>
  );
}
