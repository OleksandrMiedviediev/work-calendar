import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getDb } from "@/lib/mongodb";
import { hashPassword, setSession } from "@/lib/auth";
export async function POST(req: Request) {
  try {
    const { email, password } = await req.json(); const normalized=String(email||"").trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(normalized)) return NextResponse.json({error:"Nieprawidłowy email."},{status:400});
    if (String(password||"").length<8) return NextResponse.json({error:"Hasło musi mieć co najmniej 8 znaków."},{status:400});
    const db=await getDb(); const users=db.collection<{_id:string; email:string; passwordHash:string; createdAt:Date}>("users"); if(await users.findOne({email:normalized})) return NextResponse.json({error:"Konto z tym emailem już istnieje."},{status:409});
    const id=randomUUID(); await users.insertOne({_id:id,email:normalized,passwordHash:await hashPassword(password),createdAt:new Date()}); await setSession(id,normalized);
    return NextResponse.json({ok:true,email:normalized});
  } catch(e){ console.error(e); return NextResponse.json({error:"Błąd rejestracji. Sprawdź konfigurację bazy."},{status:500}); }
}
