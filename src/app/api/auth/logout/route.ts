import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { catat } from "@/server/audit";
import { getSession } from "@/server/tenant";
import { SESSION_COOKIE } from "@/shared/session-types";

export const dynamic = "force-dynamic";

// POST /api/auth/logout → hapus cookie session + catat audit.
export async function POST() {
  const session = await getSession();
  if (session) {
    await catat({ warungId: session.wid, userId: session.uid, action: "LOGOUT" });
  }
  (await cookies()).set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  return NextResponse.json({ ok: true });
}
