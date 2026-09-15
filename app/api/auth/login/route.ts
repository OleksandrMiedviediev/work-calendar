import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { setSession, verifyPassword } from "@/lib/auth";
export async function POST(req: Request) {
  const {email,password}=await req.json(); const normalized=String(email||"").trim().toLowerCase(); const db=await getDb(); const user=await db.collection("users").findOne({email:normalized});
  if(!user || !(await verifyPassword(String(password||""),user.passwordHash))) return NextResponse.json({error:"Nieprawidłowy email lub hasło."},{status:401});
  await setSession(String(user._id),normalized); return NextResponse.json({ok:true,email:normalized});
}
