import { NextResponse } from "next/server";
import { createHash, randomBytes, randomUUID } from "crypto";
import { getDb } from "@/lib/mongodb";
import { hashPassword } from "@/lib/auth";
import { sendVerificationEmail } from "@/lib/email";

type UserRecord = {
  _id: string;
  email: string;
  passwordHash: string;
  emailVerified: boolean;
  emailVerificationToken: string;
  emailVerificationExpires: Date;
  createdAt: Date;
};
export async function POST(req: Request) {
  try {
    const { email, password } = await req.json(); const normalized=String(email||"").trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(normalized)) return NextResponse.json({error:"Nieprawidłowy email."},{status:400});
    if (String(password||"").length<8) return NextResponse.json({error:"Hasło musi mieć co najmniej 8 znaków."},{status:400});
    const db=await getDb(); const users=db.collection<UserRecord>("users"); if(await users.findOne({email:normalized})) return NextResponse.json({error:"Konto z tym emailem już istnieje."},{status:409});
    const id=randomUUID();
    const token = randomBytes(32).toString("hex");
    await users.insertOne({
      _id:id,
      email:normalized,
      passwordHash:await hashPassword(password),
      emailVerified: false,
      emailVerificationToken: createHash("sha256").update(token).digest("hex"),
      emailVerificationExpires: new Date(Date.now() + 24 * 60 * 60 * 1000),
      createdAt:new Date()
    });
    try {
      await sendVerificationEmail(normalized, token);
    } catch (error) {
      await users.deleteOne({ _id: id });
      console.error("Verification email delivery failed:", error);
      return NextResponse.json({ error: "Не удалось отправить письмо. Проверь SMTP-настройки Brevo и разрешённый IP." }, { status: 502 });
    }
    return NextResponse.json({ok:true,email:normalized,verificationRequired:true});
  } catch(e){ console.error(e); return NextResponse.json({error:"Ошибка регистрации. Проверь подключение к базе данных."},{status:500}); }
}
