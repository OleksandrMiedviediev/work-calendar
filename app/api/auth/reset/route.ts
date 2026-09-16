import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { hashPassword } from "@/lib/auth";

export async function POST(req: Request) {
  const { token, password } = await req.json();
  if (String(password || "").length < 8) return NextResponse.json({ error: "Пароль должен быть не короче 8 символов." }, { status: 400 });
  const db = await getDb();
  const passwordResetToken = createHash("sha256").update(String(token || "")).digest("hex");
  const result = await db.collection("users").updateOne(
    { passwordResetToken, passwordResetExpires: { $gt: new Date() } },
    { $set: { passwordHash: await hashPassword(String(password)) }, $unset: { passwordResetToken: "", passwordResetExpires: "" } }
  );
  if (!result.matchedCount) return NextResponse.json({ error: "Ссылка недействительна или истекла." }, { status: 400 });
  return NextResponse.json({ ok: true });
}