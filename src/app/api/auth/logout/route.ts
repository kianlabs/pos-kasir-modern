import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { catat } from "@/lib/audit";
import { getSession } from "@/lib/warung";
import { SESSION_COOKIE } from "@/lib/auth-session";

export const dynamic = "force-dynamic";

// POST /api/auth/logout → hapus cookie session + catat audit.
export async function POST() {
  const session = await getSession();
  if (session) {
    await catat({ warungId: session.wid, userId: session.uid, action: "LOGOUT" });
  }
  cookies().set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  return NextResponse.json({ ok: true });
}
