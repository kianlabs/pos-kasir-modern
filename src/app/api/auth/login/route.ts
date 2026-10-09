import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { prisma } from "@/server/db";
import { readJson } from "@/server/http";
import { catat } from "@/server/audit";
import { issueSession } from "@/server/session";
import { SESSION_COOKIE } from "@/shared/session-types";
import { checkLoginRate, recordLoginFailure, recordLoginSuccess } from "@/server/rate-limit";

export const dynamic = "force-dynamic";

// POST /api/auth/login
// - mode "owner": { slug, mode:"owner", email, password }
// - mode "kasir": { slug, mode:"kasir", userId, pin }
// warungId selalu dari slug + user record di server — TIDAK dari client (aturan #8).
export async function POST(req: Request) {
  const body = await readJson(req);
  if (!body) return NextResponse.json({ error: "Body tidak valid." }, { status: 400 });

  const slug = String(body.slug ?? "").trim();
  const mode = body.mode === "owner" ? "owner" : body.mode === "kasir" ? "kasir" : null;
  if (!slug || !mode) {
    return NextResponse.json({ error: "Warung / peran tidak valid." }, { status: 400 });
  }

  const warung = await prisma.warung.findUnique({
    where: { slug },
    select: { id: true, slug: true, status: true },
  });
  if (!warung) {
    return NextResponse.json({ error: "Warung tidak ditemukan." }, { status: 404 });
  }
  if (warung.status === "SUSPENDED") {
    return NextResponse.json({ error: "Warung sedang dinonaktifkan." }, { status: 403 });
  }

  try {
    if (mode === "owner") {
      const email = String(body.email ?? "").trim().toLowerCase();
      const password = String(body.password ?? "");
      if (!email || !password) {
        return NextResponse.json({ error: "Email dan kata sandi wajib diisi." }, { status: 400 });
      }

      // Email unik per warung → cari di warung ini saja.
      const owner = await prisma.user.findFirst({
        where: { warungId: warung.id, role: "OWNER", email, aktif: true },
      });

      // Key rate-limit: id owner bila ada, else email yang dikirim — agar
      // percobaan dengan email tak dikenal pun terhitung (batasi enumerasi/tebak).
      const ownerKey = owner ? owner.id : `owner-email:${email}`;
      const rl = checkLoginRate(ownerKey);
      if (rl.blocked) {
        return NextResponse.json(
          { error: `Terlalu banyak percobaan. Coba lagi dalam ${rl.retryAfterSeconds} detik.` },
          { status: 429 }
        );
      }

      const ok = owner && owner.password ? await bcrypt.compare(password, owner.password) : false;
      if (!owner || !ok) {
        const after = recordLoginFailure(ownerKey);
        await catat({ warungId: warung.id, userId: owner?.id ?? null, action: "LOGIN_FAIL", meta: { mode } });
        if (after.blocked) {
          return NextResponse.json(
            { error: `Terlalu banyak percobaan. Diblokir ${Math.ceil(after.retryAfterSeconds / 60)} menit.` },
            { status: 429 }
          );
        }
        return NextResponse.json({ error: "Email atau kata sandi salah." }, { status: 401 });
      }

      recordLoginSuccess(ownerKey);
      await catat({ warungId: warung.id, userId: owner.id, action: "LOGIN_OK", meta: { mode } });
      return finish(owner);
    }

    // mode kasir: pilih nama dulu, lalu PIN (lampiran §2 aturan #7)
    const userId = String(body.userId ?? "");
    const pin = String(body.pin ?? "");
    if (!userId || !pin) {
      return NextResponse.json({ error: "Kasir dan PIN wajib diisi." }, { status: 400 });
    }

    // Rate-limit di-key pada userId YANG DIKIRIM (bukan hanya kasir valid), dan
    // dicek SEBELUM lookup. Tanpa ini, penyerang yang mengirim userId acak tak
    // pernah tercatat (bash userId valid tak pernah kena blok). Kegagalan apa pun
    // — termasuk "kasir tidak ditemukan" — dihitung.
    const rl = checkLoginRate(userId);
    if (rl.blocked) {
      return NextResponse.json(
        { error: `PIN diblokir sementara. Coba lagi dalam ${rl.retryAfterSeconds} detik.` },
        { status: 429 }
      );
    }

    // userId harus milik warung ini, role KASIR, dan aktif.
    const kasir = await prisma.user.findFirst({
      where: { id: userId, warungId: warung.id, role: "KASIR", aktif: true },
    });
    if (!kasir) {
      const after = recordLoginFailure(userId);
      await catat({ warungId: warung.id, userId: null, action: "LOGIN_FAIL", meta: { mode, alasan: "kasir_tidak_ditemukan" } });
      if (after.blocked) {
        return NextResponse.json(
          { error: `Percobaan berlebih. Diblokir ${Math.ceil(after.retryAfterSeconds / 60)} menit.` },
          { status: 429 }
        );
      }
      return NextResponse.json({ error: "Kasir tidak ditemukan." }, { status: 401 });
    }

    const ok = kasir.pin ? await bcrypt.compare(pin, kasir.pin) : false;
    if (!ok) {
      const after = recordLoginFailure(userId);
      await catat({ warungId: warung.id, userId: kasir.id, action: "LOGIN_FAIL", meta: { mode } });
      if (after.blocked) {
        return NextResponse.json(
          { error: `PIN salah 5×. Diblokir ${Math.ceil(after.retryAfterSeconds / 60)} menit.` },
          { status: 429 }
        );
      }
      return NextResponse.json(
        { error: `PIN salah. Sisa ${after.remaining} percobaan.` },
        { status: 401 }
      );
    }

    recordLoginSuccess(userId);
    await catat({ warungId: warung.id, userId: kasir.id, action: "LOGIN_OK", meta: { mode } });
    return finish(kasir);
  } catch (e) {
    console.error("[auth/login]", e);
    return NextResponse.json({ error: "Gagal memproses login." }, { status: 500 });
  }
}

function finish(user: { id: string; warungId: string; role: string; name: string }) {
  const { token, maxAge } = issueSession(user);
  cookies().set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  });
  return NextResponse.json({
    ok: true,
    user: { id: user.id, name: user.name, role: user.role },
  });
}
