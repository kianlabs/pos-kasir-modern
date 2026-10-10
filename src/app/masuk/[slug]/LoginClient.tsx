"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Kasir = { id: string; name: string };

const PIN_LEN = 4;

export default function LoginClient({
  slug,
  namaWarung,
  kasir,
}: {
  slug: string;
  namaWarung: string;
  kasir: Kasir[];
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"kasir" | "owner">("kasir");
  const [userId, setUserId] = useState(kasir[0]?.id ?? "");
  const [pin, setPin] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const canSubmit = useMemo(() => {
    if (loading) return false;
    if (mode === "owner") return email.trim().length > 0 && password.length > 0;
    return !!userId && pin.length === PIN_LEN;
  }, [mode, userId, pin, email, password, loading]);

  function press(d: string) {
    setError("");
    setPin((p) => (p.length >= PIN_LEN ? p : p + d));
  }
  function backspace() {
    setPin((p) => p.slice(0, -1));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setError("");
    setLoading(true);
    try {
      const payload =
        mode === "owner"
          ? { slug, mode, email: email.trim(), password }
          : { slug, mode, userId, pin };
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Gagal masuk.");
        setPin("");
        return;
      }
      router.replace("/");
      router.refresh();
    } catch {
      setError("Tidak bisa menghubungi server. Coba lagi.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-[520px] flex-col items-center">
      <header className="mb-6 text-center">
        <div className="mb-1.5 inline-flex items-center justify-center gap-2">
          <span className="text-3xl leading-none">🧾</span>
          <h1 className="font-display-hero text-display-hero leading-none tracking-tight text-ink-950">
            KRING!
          </h1>
        </div>
        <p className="font-body-md text-body-md text-ink-500">Kring! Kasir bunyi, cuan masuk.</p>
        <p className="mt-1 font-label-md text-label-md uppercase tracking-wider text-ink-700">
          {namaWarung}
        </p>
      </header>

      <form
        onSubmit={submit}
        className="w-full rounded-[20px] border border-ink-200 bg-surface p-6 shadow-[0_8px_24px_rgba(0,0,0,0.04)]"
      >
        {/* Pilih peran — segmented control */}
        <section
          aria-label="Pilih Peran"
          className="mb-6 grid grid-cols-2 gap-2 rounded-xl border border-ink-200 bg-ink-100 p-1.5"
        >
          <button
            type="button"
            onClick={() => { setMode("kasir"); setError(""); }}
            aria-pressed={mode === "kasir"}
            className={`flex h-12 items-center justify-center gap-2 rounded-lg font-label-lg text-label-lg transition-all active:scale-[0.98] ${
              mode === "kasir"
                ? "bg-ink-950 text-surface"
                : "bg-transparent text-ink-500 transition-colors hover:text-ink-950"
            }`}
          >
            👤 Kasir
          </button>
          <button
            type="button"
            onClick={() => { setMode("owner"); setError(""); }}
            aria-pressed={mode === "owner"}
            className={`flex h-12 items-center justify-center gap-2 rounded-lg font-label-lg text-label-lg transition-all active:scale-[0.98] ${
              mode === "owner"
                ? "bg-ink-950 text-surface"
                : "bg-transparent text-ink-500 transition-colors hover:text-ink-950"
            }`}
          >
            🔑 Owner
          </button>
        </section>

        {mode === "kasir" ? (
          kasir.length === 0 ? (
            <p className="mb-6 rounded-xl border border-ink-200 bg-ink-100 px-3 py-2 font-body-md text-body-md text-ink-700">
              Belum ada kasir aktif di warung ini. Minta Owner menambah kasir dulu.
            </p>
          ) : (
            <>
              <div className="mb-5">
                <label
                  className="mb-2 block font-label-md text-label-md text-ink-700"
                  htmlFor="kasir"
                >
                  Kasir bertugas
                </label>
                <div className="relative">
                  <select
                    id="kasir"
                    value={userId}
                    onChange={(e) => { setUserId(e.target.value); setPin(""); setError(""); }}
                    className="h-12 w-full cursor-pointer appearance-none rounded-xl border border-ink-200 bg-surface px-3.5 pr-10 font-body-md text-body-md text-ink-950 outline-none focus:border-ink-950"
                  >
                    {kasir.map((k) => (
                      <option key={k.id} value={k.id}>
                        {k.name}
                      </option>
                    ))}
                  </select>
                  <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-ink-700">
                    ▾
                  </span>
                </div>
              </div>

              <div className="mb-6 text-center">
                <div className="mb-3 flex items-center justify-between px-1">
                  <span className="font-label-md text-label-md text-ink-700">
                    Masukkan PIN Kasir ({PIN_LEN} digit)
                  </span>
                  <span className="flex items-center gap-1 font-caption text-caption text-ink-500">
                    🔒 Terenkripsi
                  </span>
                </div>
                <div className="flex items-center justify-center gap-4 py-2" aria-hidden="true">
                  {Array.from({ length: PIN_LEN }).map((_, i) => (
                    <span
                      key={i}
                      className={`h-4 w-4 rounded-full transition-all duration-150 ${
                        i < pin.length
                          ? "bg-ink-950 ring-2 ring-ink-950"
                          : "border border-ink-300 bg-ink-100"
                      }`}
                    />
                  ))}
                </div>
                <input
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, PIN_LEN))}
                  inputMode="numeric"
                  autoComplete="off"
                  aria-label={`PIN ${PIN_LEN} digit`}
                  autoFocus
                  className="mx-auto mt-2 w-32 rounded-lg border border-ink-200 px-3 py-2 text-center font-body-lg text-body-lg font-bold tracking-[0.5em] outline-none focus:border-ink-950"
                />
              </div>

              {/* Numpad besar — target sentuh min 60px (DESIGN.md) */}
              <div className="mb-6 grid grid-cols-3 gap-2.5">
                {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => press(d)}
                    className="flex h-[60px] touch-manipulation select-none items-center justify-center rounded-xl border border-ink-200 bg-surface font-numeral-lg text-numeral-lg text-ink-950 transition-all duration-100 hover:bg-ink-100 active:scale-[0.98] active:bg-ink-200"
                  >
                    {d}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => { setPin(""); setError(""); }}
                  className="flex h-[60px] touch-manipulation select-none items-center justify-center rounded-xl border border-ink-200 bg-surface font-label-lg text-label-lg text-ink-700 transition-all duration-100 hover:bg-ink-100 active:scale-[0.98] active:bg-ink-200"
                >
                  C
                </button>
                <button
                  type="button"
                  onClick={() => press("0")}
                  className="flex h-[60px] touch-manipulation select-none items-center justify-center rounded-xl border border-ink-200 bg-surface font-numeral-lg text-numeral-lg text-ink-950 transition-all duration-100 hover:bg-ink-100 active:scale-[0.98] active:bg-ink-200"
                >
                  0
                </button>
                <button
                  type="button"
                  onClick={backspace}
                  aria-label="Hapus satu digit"
                  className="flex h-[60px] touch-manipulation select-none items-center justify-center rounded-xl border border-ink-200 bg-surface text-[24px] text-ink-700 transition-all duration-100 hover:bg-ink-100 active:scale-[0.98] active:bg-ink-200"
                >
                  ⌫
                </button>
              </div>
            </>
          )
        ) : (
          <>
            <label className="mb-1 block font-label-md text-label-md text-ink-700" htmlFor="email">
              Email owner
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="owner@warung.demo"
              autoComplete="username"
              className="mb-3 h-12 w-full rounded-xl border border-ink-200 px-3.5 font-body-md text-body-md text-ink-950 outline-none focus:border-ink-950"
            />
            <label className="mb-1 block font-label-md text-label-md text-ink-700" htmlFor="password">
              Kata sandi
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              className="mb-4 h-12 w-full rounded-xl border border-ink-200 px-3.5 font-body-md text-body-md text-ink-950 outline-none focus:border-ink-950"
            />
            <p className="mb-4 rounded-xl border border-ink-200 bg-ink-100 px-3 py-2 font-caption text-caption text-ink-500">
              Owner bisa mengelola produk, laporan, dan pengaturan. Kasir hanya untuk jualan.
            </p>
          </>
        )}

        {error && (
          <p className="mb-3 rounded-xl bg-danger-bg px-3 py-2 font-body-md font-medium text-danger">
            ⚠️ {error}
          </p>
        )}

        <button
          type="submit"
          disabled={!canSubmit}
          className="flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-ink-950 font-headline-sm text-headline-sm text-surface transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-40"
        >
          {loading
            ? "Memproses…"
            : mode === "kasir"
              ? "MASUK SEBAGAI KASIR →"
              : "MASUK SEBAGAI OWNER →"}
        </button>
      </form>

      <footer className="mt-5 text-center font-caption text-caption text-ink-500">
        <p>Lupa PIN kasir? Hubungi Owner atau Supervisor outlet.</p>
      </footer>
    </main>
  );
}
