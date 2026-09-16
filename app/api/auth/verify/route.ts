import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token");
  if (!token) return new NextResponse("Ссылка подтверждения недействительна.", { status: 400 });

  const db = await getDb();
  const emailVerificationToken = createHash("sha256").update(token).digest("hex");
  const result = await db.collection("users").updateOne(
    { emailVerificationToken, emailVerificationExpires: { $gt: new Date() } },
    { $set: { emailVerified: true, emailVerifiedAt: new Date() }, $unset: { emailVerificationToken: "", emailVerificationExpires: "" } }
  );

  if (!result.matchedCount) return new NextResponse("Ссылка недействительна или уже истекла.", { status: 400 });
  return new NextResponse("<h1>Email подтверждён</h1><p>Теперь можно вернуться в Work Calendar и войти.</p>", { headers: { "Content-Type": "text/html; charset=utf-8" } });
}