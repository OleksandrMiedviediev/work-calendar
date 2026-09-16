import { createHash, randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { sendVerificationEmail } from "@/lib/email";

export async function POST(req: Request) {
  const { email } = await req.json();
  const normalized = String(email || "").trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(normalized)) {
    return NextResponse.json({ error: "Укажи корректный email." }, { status: 400 });
  }

  const db = await getDb();
  const users = db.collection("users");
  const user = await users.findOne({ email: normalized });
  if (!user || user.emailVerified !== false) {
    return NextResponse.json({ ok: true });
  }

  const token = randomBytes(32).toString("hex");
  await users.updateOne(
    { _id: user._id },
    { $set: {
      emailVerificationToken: createHash("sha256").update(token).digest("hex"),
      emailVerificationExpires: new Date(Date.now() + 24 * 60 * 60 * 1000)
    } }
  );

  try {
    await sendVerificationEmail(normalized, token);
  } catch (error) {
    console.error("Verification email resend failed:", error);
    return NextResponse.json({ error: "Brevo не доставил письмо. Проверь отправителя и Transactional logs." }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}