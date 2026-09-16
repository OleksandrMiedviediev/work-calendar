import { createHash, randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { sendPasswordResetEmail } from "@/lib/email";

export async function POST(req: Request) {
  const { email } = await req.json();
  const normalized = String(email || "").trim().toLowerCase();
  const generic = { message: "Если такой email существует, письмо уже отправлено." };
  if (!/^\S+@\S+\.\S+$/.test(normalized)) return NextResponse.json(generic);

  const db = await getDb();
  const users = db.collection("users");
  const user = await users.findOne({ email: normalized });
  if (!user) return NextResponse.json(generic);

  const token = randomBytes(32).toString("hex");
  await users.updateOne({ _id: user._id }, { $set: { passwordResetToken: createHash("sha256").update(token).digest("hex"), passwordResetExpires: new Date(Date.now() + 60 * 60 * 1000) } });
  await sendPasswordResetEmail(normalized, token);
  return NextResponse.json(generic);
}