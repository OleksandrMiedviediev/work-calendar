import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { getSession, hashPassword, verifyPassword } from "@/lib/auth";

type UserRecord = {
  _id: string;
  email: string;
  passwordHash: string;
  name?: string;
  avatar?: string | null;
  updatedAt?: Date;
};

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = await getDb();
  const user = await db.collection<UserRecord>("users").findOne({ _id: session.userId }, { projection: { passwordHash: 0 } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
  return NextResponse.json({ profile: user });
}

export async function PATCH(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const name = String(body.name || "").trim().slice(0, 80);
  const avatar = typeof body.avatar === "string" && body.avatar.startsWith("data:image/")
    ? body.avatar
    : null;
  if (avatar && avatar.length > 1_500_000) {
    return NextResponse.json({ error: "Аватар слишком большой." }, { status: 400 });
  }

  const db = await getDb();
  const users = db.collection<UserRecord>("users");
  const update: Record<string, unknown> = { name, avatar, updatedAt: new Date() };

  if (body.newPassword) {
    if (String(body.newPassword).length < 8) {
      return NextResponse.json({ error: "Новый пароль должен быть не короче 8 символов." }, { status: 400 });
    }
    const user = await users.findOne({ _id: session.userId });
    if (!user || !(await verifyPassword(String(body.currentPassword || ""), String(user.passwordHash)))) {
      return NextResponse.json({ error: "Текущий пароль указан неверно." }, { status: 400 });
    }
    update.passwordHash = await hashPassword(String(body.newPassword));
  }

  await users.updateOne({ _id: session.userId }, { $set: update });
  return NextResponse.json({ ok: true, profile: { name, avatar } });
}