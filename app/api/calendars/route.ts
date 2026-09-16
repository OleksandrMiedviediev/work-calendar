import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { getDb } from "@/lib/mongodb";
import { getSession } from "@/lib/auth";

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  const db = await getDb();
  const scheduleCode = String(body.scheduleCode || "").trim().toUpperCase() || null;
  const calendars = db.collection("calendars");
  const existing = scheduleCode
    ? await calendars.findOne({ userId: session.userId, scheduleCode })
    : null;
  const token = existing?.token || randomBytes(24).toString("hex");
  const slug = existing?.slug || randomBytes(9).toString("base64url");
  const incomingEvents = Array.isArray(body.events) ? body.events : [];
  const events = [...new Map(
    [...(existing?.events || []), ...incomingEvents]
      .map(event => [`${event.date}|${event.start}|${event.end}`, event])
  ).values()];

  if (existing) {
    await calendars.updateOne(
      { _id: existing._id },
      { $set: { name: body.name || existing.name || "Work Calendar", month: body.month || existing.month || null, year: body.year || existing.year || null, events, updatedAt: new Date() } }
    );
  } else {
    await calendars.insertOne({
      token,
      slug,
      scheduleCode,
      userId: session.userId,
      name: body.name || "Work Calendar",
      month: body.month || null,
      year: body.year || null,
      events,
      createdAt: new Date(),
      updatedAt: new Date()
    });
  }
  const base = process.env.CALENDAR_BASE_URL || new URL(req.url).origin;
  return NextResponse.json({ token, slug, merged: Boolean(existing), webcalUrl: base.replace(/^https?:/, "webcal:") + `/api/calendars/${slug}.ics` });
}

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const db = await getDb();
  const calendars = await db.collection("calendars")
    .find({ userId: session.userId })
    .project({ _id: 0, token: 1, slug: 1, scheduleCode: 1, name: 1, month: 1, year: 1, events: 1, updatedAt: 1 })
    .sort({ updatedAt: -1 })
    .toArray();
  const base = process.env.CALENDAR_BASE_URL || new URL(req.url).origin;
  return NextResponse.json({ calendars: calendars.map(calendar => ({
    ...calendar,
    eventCount: Array.isArray(calendar.events) ? calendar.events.length : 0,
    webcalUrl: base ? base.replace(/^https?:/, "webcal:") + `/api/calendars/${calendar.slug || calendar.token}.ics` : null
  })) });
}
