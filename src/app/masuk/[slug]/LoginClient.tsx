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
        <div className="flex items-center justify-center gap-2">
          <span className="text-3xl">🧾</span>
          <h1 className="text-3xl font-extrabold tracking-tight">KRING!</h1>
        </div>
        <p className="text-sm text-text-muted">Kring! Kasir bunyi, cuan masuk.</p>
        <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-primary">
          {namaWarung}
        </p>
      </header>

      <form
        onSubmit={submit}
        className="w-full rounded-[20px] border border-neutral bg-surface p-6 shadow-xs"
      >
        {/* Pilih peran */}
        <section className="mb-6 grid grid-cols-2 gap-2 rounded-xl border border-neutral bg-neutral p-1.5">
          <button
            type="button"
            onClick={() => { setMode("kasir"); setError(""); }}
            aria-pressed={mode === "kasir"}
            className={`h-12 rounded-lg text-sm font-bold transition ${
              mode === "kasir" ? "bg-secondary text-white" : "text-text-muted hover:text-secondary"
            }`}
          >
            👤 Kasir
          </button>
          <button
            type="button"
            onClick={() => { setMode("owner"); setError(""); }}
            aria-pressed={mode === "owner"}
            className={`h-12 rounded-lg text-sm font-bold transition ${
              mode === "owner" ? "bg-secondary text-white" : "text-text-muted hover:text-secondary"
            }`}
          >
            🔑 Owner
          </button>
        </section>

        {mode === "kasir" ? (
          kasir.length === 0 ? (
            <p className="mb-6 rounded-lg bg-warning-bg px-3 py-2 text-sm text-warning">
              Belum ada kasir aktif di warung ini. Minta Owner menambah kasir dulu.
            </p>
          ) : (
            <>
              <label className="mb-2 block text-sm font-semibold text-secondary" htmlFor="kasir">
                Kasir bertugas
              </label>
              <select
                id="kasir"
                value={userId}
                onChange={(e) => { setUserId(e.target.value); setPin(""); setError(""); }}
                className="mb-5 h-12 w-full rounded-xl border border-neutral bg-surface px-3.5 text-sm outline-none focus:border-primary"
              >
                {kasir.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.name}
                  </option>
                ))}
              </select>

              <div className="mb-6 text-center">
                <div className="mb-3 flex items-center justify-between px-1">
                  <span className="text-sm font-semibold text-secondary">
                    Masukkan PIN ({PIN_LEN} digit)
                  </span>
                  <span className="text-xs text-text-muted">🔒 Terenkripsi</span>
                </div>
                <div className="flex items-center justify-center gap-4 py-2" aria-hidden="true">
                  {Array.from({ length: PIN_LEN }).map((_, i) => (
                    <span
                      key={i}
                      className={`h-4 w-4 rounded-full transition-all ${
                        i < pin.length ? "bg-secondary ring-2 ring-secondary" : "border border-neutral bg-neutral"
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
                  className="mx-auto mt-2 w-32 rounded-lg border border-neutral px-3 py-2 text-center text-lg font-bold tracking-[0.5em] outline-none focus:border-primary"
                />
              </div>

              {/* Numpad besar — target sentuh min 60px (DESIGN.md) */}
              <div className="mb-6 grid grid-cols-3 gap-2.5">
                {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => press(d)}
                    className="h-[60px] rounded-xl border border-neutral bg-surface text-lg font-bold transition hover:bg-accent-bg active:scale-[0.98]"
                  >
                    {d}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => { setPin(""); setError(""); }}
                  className="h-[60px] rounded-xl border border-neutral bg-surface text-sm font-bold text-text-muted transition hover:bg-accent-bg active:scale-[0.98]"
                >
                  C
                </button>
                <button
                  type="button"
                  onClick={() => press("0")}
                  className="h-[60px] rounded-xl border border-neutral bg-surface text-lg font-bold transition hover:bg-accent-bg active:scale-[0.98]"
                >
                  0
                </button>
                <button
                  type="button"
                  onClick={backspace}
                  aria-label="Hapus satu digit"
                  className="h-[60px] rounded-xl border border-neutral bg-surface text-lg font-bold text-text-muted transition hover:bg-accent-bg active:scale-[0.98]"
                >
                  ⌫
                </button>
              </div>
            </>
          )
        ) : (
          <>
            <label className="mb-1 block text-xs font-semibold text-text-muted" htmlFor="email">
              Email owner
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="owner@warung.demo"
              autoComplete="username"
              className="mb-2 w-full rounded-lg border border-neutral px-3 py-2 text-sm outline-none focus:border-primary"
            />
            <label className="mb-1 block text-xs font-semibold text-text-muted" htmlFor="password">
              Kata sandi
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              className="mb-4 w-full rounded-lg border border-neutral px-3 py-2 text-sm outline-none focus:border-primary"
            />
            <p className="mb-4 rounded-lg bg-neutral px-3 py-2 text-xs text-text-muted">
              Owner bisa mengelola produk, laporan, dan pengaturan. Kasir hanya untuk jualan.
            </p>
          </>
        )}

        {error && (
          <p className="mb-3 rounded-lg bg-danger-bg px-3 py-2 text-sm font-medium text-danger">
            ⚠️ {error}
          </p>
        )}

        <button
          type="submit"
          disabled={!canSubmit}
          className="h-14 w-full rounded-xl bg-secondary font-bold text-white transition hover:opacity-90 active:scale-[0.98] disabled:opacity-40"
        >
          {loading ? "Memproses…" : mode === "kasir" ? "MASUK SEBAGAI KASIR →" : "MASUK SEBAGAI OWNER →"}
        </button>
      </form>

      <footer className="mt-5 text-center text-xs text-text-muted">
        <p>Lupa PIN kasir? Hubungi Owner atau Supervisor outlet.</p>
      </footer>
    </main>
  );
}
