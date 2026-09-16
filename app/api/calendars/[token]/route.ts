import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { getSession } from "@/lib/auth";
import { toICS } from "@/lib/calendar";

type Context = { params: Promise<{ token: string }> };

async function getPublicCalendar(rawToken: string) {
  const token = rawToken.replace(/\.ics$/, "");
  const db = await getDb();
  return db.collection("calendars").findOne({ token });
}

function calendarHeaders() {
  return { "Content-Type": "text/calendar; charset=utf-8", "Cache-Control": "no-store" };
}

export async function HEAD(_: Request, { params }: Context) {
  const { token } = await params;
  const calendar = await getPublicCalendar(token);
  if (!calendar) return new NextResponse("Not found", { status: 404 });
  return new NextResponse(null, { headers: calendarHeaders() });
}

export async function GET(_: Request, { params }: Context) {
  const { token } = await params;
  const calendar = await getPublicCalendar(token);
  if (!calendar) return new NextResponse("Not found", { status: 404 });
  return new NextResponse(toICS(calendar.events || [], calendar.name || "Work Calendar"), { headers: calendarHeaders() });
}

export async function PATCH(req: Request, { params }: Context) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { token } = await params;
  const body = await req.json();
  const db = await getDb();
  const result = await db.collection("calendars").updateOne(
    { token, userId: session.userId },
    { $set: { name: body.name || "Work Calendar", events: Array.isArray(body.events) ? body.events : [], updatedAt: new Date() } }
  );
  if (!result.matchedCount) return NextResponse.json({ error: "Calendar not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_: Request, { params }: Context) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { token } = await params;
  const db = await getDb();
  const result = await db.collection("calendars").deleteOne({ token, userId: session.userId });
  if (!result.deletedCount) return NextResponse.json({ error: "Calendar not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}