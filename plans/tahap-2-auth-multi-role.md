# Rencana Tahap 2 — Auth Multi-Role (OWNER/KASIR) + Session Tenant

**Status:** draft, menunggu konfirmasi user sebelum eksekusi
**Prasyarat:** Tahap 1 (multi-tenant skema + scoping `warungId`) sudah commit di `f3a5ef4`
**Dokumen acuan:** `docs/PRD.md` §6.2, §9, §10, §11 · `docs/PRD-lampiran-skema-db.md` §2, §3, §4 · `DESIGN.md` §1, §11

---

## 1. Temuan recon (bukti)

| Cek | Hasil |
|---|---|
| `git status` | Bersih. Hanya untracked: `.omo/`, `prisma/dev.db.before-multi-tenant.bak` |
| Commit terakhir | `f3a5ef4 feat: tahap 1 multi-tenant — …` (46 file, +5386/−485) |
| Unpushed | 5 commit di atas `origin/master` (belum di-push) |
| `prisma validate` | ✅ valid (tanpa enum, sesuai konsesi SQLite) |
| `npm run build` | ✅ 19 route, tanpa error |
| `npm run lint` | ✅ tanpa warning |
| DB dev | 4 warung (Berkah Jaya + Demo 1–3), tiap warung 38 produk; 99 trx semua di Berkah Jaya |
| Backfill | `COUNT(*) WHERE warungId IS NULL` = 0 di semua tabel bisnis ✅ |
| Gap Tahap 1→2 | `src/lib/warung.ts` masih **bridge**: cookie `kring_warung` + **fallback** = warung pertama. Belum ada login, session, atau role check |

**Kesimpulan:** fondasi skema & scoping siap. Yang belum ada adalah **identitas**: tidak ada login, tidak ada session, tidak ada gate role. Semua halaman/api masih "terbuka" dan tenant ditentukan cookie/fallback — bukan session. Itu pekerjaan Tahap 2.

---

## 2. Ruang lingkup Tahap 2 (hanya auth)

**Termasuk (checklist skema §3 yang belum hijau):**
- [ ] Session login (owner email+password, kasir pilih-nama→PIN) — lampiran §2 #6, #7; PRD §10
- [ ] `warungId` dari session, **bukan** cookie/fallback/body/query/header — lampiran §2 #8
- [ ] Gate role: KASIR 403 di halaman/api owner (produk, laporan, pengaturan, dll) — PRD §6.2
- [ ] Rate-limit PIN (5 gagal / user → blok 5 menit) — lampiran §2 #9
- [ ] `AuditLog`: LOGIN_OK, LOGIN_FAIL (+ PRICE_CHANGE, STOCK_KOREKSI, SHIFT_OPEN/CLOSE, SETTING_CHANGE, DELETE_PRODUCT) — lampiran §2 #10, PRD §11
- [ ] Test otomatis: isolasi tenant, rate-limit PIN — lampiran §2 #2, #9 (gerbang CI)

**Tidak termasuk (tahap lain, sesuai PRD §13):**
- Manajemen meja / bill DRAFT §6.2 → Tahap 2b
- Offline-first IndexedDB + sync engine, PWA → Tahap 2c
- Migrasi Postgres + deploy staging → Tahap 2d
- Insight/AI (lampiran AI) — prasyaratnya "Fase 1 auth hijau", jadi setelah ini

---

## 3. Keputusan teknis (perlu konfirmasi)

1. **Mekanisme session = custom HMAC-signed cookie** (`src/lib/session.ts`, pakai `node:crypto`, Web Crypto edge-compatible). Alasan: nol dependency baru, cukup untuk Next 14 App Router, mudah di-test. Tidak pakai NextAuth (berat untuk 1 skema auth kustom PIN).
2. **Lokasi halaman login:** `src/app/masuk/[slug]/page.tsx` (pilih peran → owner email+password / kasir daftar-nama+PIN), sesuai lampiran §1 koreksi #7. Route `/` mem-redirect ke login bila tidak ada session valid.
3. **Token:** payload `{ uid, wid, role, iat, exp }` + HMAC-SHA256 `SESSION_SECRET`, `httpOnly` + `sameSite=lax` + `secure` di produksi, umur 12 jam.
4. **Ganti bridge:** `src/lib/warung.ts` → baca session; fallback cookie/seed **dihapus**. Helper baru: `requireSession()`, `requireRole()`, `currentWarungId()` (turunan session).
5. **Hash PIN** tetap `bcryptjs` (sudah terpasang).
6. **Rate-limit** in-memory `Map<userId,{count,blockedUntil}>` + catat LOGIN_FAIL ke AuditLog. (Prasyarat deploy multi-instance → pindah ke DB/Redis; dicatat sebagai utang teknis.)

---

## 4. File yang akan berubah / dibuat

**Baru**
- `src/lib/session.ts` — issue/verify cookie session (HMAC)
- `src/lib/auth.ts` — `getSession()`, `requireSession()`, `requireRole()`, helper login owner/kasir + rate-limit
- `src/lib/audit.ts` — helper tulis AuditLog
- `src/app/masuk/[slug]/page.tsx` + `LoginClient.tsx` — UI login (mengikuti `stitch_custom_design_system/login_pilih_peran/code.html` + `DESIGN.md` §1)
- `src/app/api/auth/login/route.ts` — POST owner & kasir
- `src/app/api/auth/logout/route.ts` — POST logout
- `src/app/api/auth/kasir/route.ts` — GET daftar nama kasir per slug (publik, hanya nama — lampiran §2 #7)
- `src/middleware.ts` — gate: tanpa session → `/masuk/<slug>`; role salah → 403
- Test: `tests/tenant-isolation.test.ts`, `tests/pin-ratelimit.test.ts` (runner menyusul — lihat §7)

**Diubah**
- `src/lib/warung.ts` — session-based, hapus fallback
- `src/lib/settings.ts` — pakai session
- Semua `src/app/api/**/route.ts` — `currentWarungId()` dari session + `requireRole` (owner-only: products POST/PATCH/DELETE, settings PATCH, export; semua-role: checkout, shifts, stats GET, stock-moves GET, products GET)
- `src/app/layout.tsx` — tampilkan warung/kasir/shift dari session, sembunyikan menu owner untuk KASIR, tombol keluar
- `src/app/SidebarNav.tsx` — filter menu per role
- Halaman server (`transaksi`, `struk/[id]`) — gate session
- `prisma/seed.ts` — PIN owner demo? (tidak; owner pakai password) — tambah AuditLog LOGIN saat dev? (tidak, cukup saat login nyata)

---

## 5. Aturan wajib yang ditegakkan (dari lampiran §2)

- #1 semua query filter `warungId` (sudah sebagian) — diaudit ulang
- #2 test isolasi tenant hijau (gerbang CI)
- #6 PIN di-hash, #7 daftar nama boleh publik, yang rahasia PIN
- #8 `warungId` **tidak pernah** dari client — request berisi `warungId` = bug
- #9 rate-limit PIN 5→5 menit + AuditLog
- #10 mutasi penting → AuditLog
- #11 satu shift BUKA per warung (sudah ada di `$transaction`)
- #12 laporan hanya `LUNAS`

---

## 6. Urutan eksekusi (commit kecil, satu concern per commit)

1. `feat(auth): session cookie HMAC + lib auth/audit` — fondasi, belum dipakai
2. `feat(auth): halaman & API login owner+kasir (pilih nama→PIN, rate-limit)`
3. `refactor(tenant): warungId dari session, hapus bridge cookie/fallback` + gate middleware
4. `feat(rbac): gate role OWNER/KASIR di api + UI (menu, 403)` — termasuk tampilkan warung di layout
5. `feat(audit): catat mutasi penting (harga, stok, shift, setting, hapus produk)`
6. `test: isolasi tenant + rate-limit PIN` (runner + 2 test, hijau)
7. `docs: update PRD §6.2 checklist + README alur login`

**Kriteria selesai Tahap 2** (lampiran §3 + PRD §6.2):
- Kasir buka `/produk` → 403; owner bisa semua
- User warung A minta data warung B → 403/kosong
- Login PIN 5× salah → blok 5 menit + tercatat di `audit_logs`
- `npm run build` + `npm run lint` + 2 test hijau

---

## 7. Pertanyaan terbuka (butuh keputusan user)

1. **Test runner:** repo belum punya Jest/Vitest. Oke tambah **Vitest** (ringan, TS native) untuk 2 test wajib? Atau cukup skrip `tsx` manual dulu?
2. **Session store:** cukup HMAC cookie stateless, atau mau session table (bisa revoke paksa)?
3. **Logout & ganti kasir:** cukup tombol keluar → `/masuk/<slug>`?
4. **Route publik:** apakah `/masuk/[slug]` satu-satunya halaman publik (semua lain butuh login)?
5. **Commit/push:** lanjut commit per langkah seperti biasa; **tidak push** sampai kamu minta?

---

## 8. Verifikasi

Setiap langkah: `npx prisma validate`, `npm run build`, `npm run lint`. Di akhir: 2 test + uji manual alur (owner login → jualan → tutup shift → logout; kasir login → 403 di /produk).
