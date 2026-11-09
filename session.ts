import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

const cookieName = "cbe_pms_session";
function secret() {
  const value = process.env.SESSION_SECRET;
  if (!value || value.length < 32) throw new Error("SESSION_SECRET must contain at least 32 characters.");
  return new TextEncoder().encode(value);
}
export type SessionUser = { id: number; username: string; role: "Administrator" | "Teacher" };

export async function createSession(user: SessionUser) {
  const token = await new SignJWT(user).setProtectedHeader({ alg: "HS256" })
    .setIssuedAt().setExpirationTime("12h").sign(secret());
  const jar = await cookies();
  jar.set(cookieName, token, { httpOnly: true, secure: process.env.NODE_ENV === "production",
    sameSite: "lax", path: "/", maxAge: 60 * 60 * 12 });
}
export async function getSession(): Promise<SessionUser | null> {
  const jar = await cookies();
  const token = jar.get(cookieName)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    if (typeof payload.id !== "number" || typeof payload.username !== "string") return null;
    // Re-read the account on each request so a deleted, renamed, or demoted
    // account cannot keep stale privileges until the JWT expires.
    const user = await prisma.user.findUnique({
      where: { id: payload.id },
      select: { id: true, username: true, role: true },
    });
    if (!user || user.username !== payload.username ||
        (user.role !== "Administrator" && user.role !== "Teacher")) return null;
    return { id: user.id, username: user.username, role: user.role };
  } catch { return null; }
}
export async function clearSession() {
  const jar = await cookies();
  jar.set(cookieName, "", { httpOnly: true, path: "/", maxAge: 0 });
}
