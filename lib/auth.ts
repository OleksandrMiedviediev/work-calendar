import "server-only";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { getDb } from "./mongodb";

const secret = new TextEncoder().encode(process.env.AUTH_SECRET || "dev-only-change-me");
const COOKIE = "work_calendar_session";

type Session = { userId: string; email: string };

export async function hashPassword(password: string) {
  const bcrypt = await import("bcryptjs");
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string) {
  const bcrypt = await import("bcryptjs");
  return bcrypt.compare(password, hash);
}

export async function setSession(userId: string, email: string) {
  const token = await new SignJWT({ userId, email })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secret);
  const store = await cookies();
  store.set(COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30 });
}

export async function clearSession() {
  const store = await cookies();
  store.delete(COOKIE);
}

export async function getSession(): Promise<Session | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret);
    if (typeof payload.userId !== "string" || typeof payload.email !== "string") return null;
    return { userId: payload.userId, email: payload.email };
  } catch {
    return null;
  }
}

export async function getCurrentUser() {
  const session = await getSession();
  if (!session) return null;
  const db = await getDb();
  const users = db.collection<{ _id: string; email: string; passwordHash: string; createdAt: Date }>("users");
  return users.findOne({ _id: session.userId }, { projection: { passwordHash: 0 } });
}
