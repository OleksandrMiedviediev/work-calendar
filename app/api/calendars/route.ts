import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { getDb } from "@/lib/mongodb";
import { getSession } from "@/lib/auth";

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  const token = randomBytes(24).toString("hex");
  const db = await getDb();
  await db.collection("calendars").insertOne({ token, userId: session.userId, name: body.name || "Work Calendar", events: body.events || [], createdAt: new Date(), updatedAt: new Date() });
  const base = process.env.CALENDAR_BASE_URL || new URL(req.url).origin;
  return NextResponse.json({ token, webcalUrl: base.replace(/^https?:/, "webcal:") + `/api/calendars/${token}.ics` });
}
