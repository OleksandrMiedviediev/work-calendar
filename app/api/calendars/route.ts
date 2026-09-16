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
  await db.collection("calendars").insertOne({
    token,
    userId: session.userId,
    name: body.name || "Work Calendar",
    month: body.month || null,
    year: body.year || null,
    events: body.events || [],
    createdAt: new Date(),
    updatedAt: new Date()
  });
  const base = process.env.CALENDAR_BASE_URL || new URL(req.url).origin;
  return NextResponse.json({ token, webcalUrl: base.replace(/^https?:/, "webcal:") + `/api/calendars/${token}.ics` });
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const db = await getDb();
  const calendars = await db.collection("calendars")
    .find({ userId: session.userId })
    .project({ _id: 0, token: 1, name: 1, month: 1, year: 1, events: 1, updatedAt: 1 })
    .sort({ updatedAt: -1 })
    .toArray();
  const base = process.env.CALENDAR_BASE_URL || "";
  return NextResponse.json({ calendars: calendars.map(calendar => ({
    ...calendar,
    eventCount: Array.isArray(calendar.events) ? calendar.events.length : 0,
    webcalUrl: base ? base.replace(/^https?:/, "webcal:") + `/api/calendars/${calendar.token}.ics` : null
  })) });
}
