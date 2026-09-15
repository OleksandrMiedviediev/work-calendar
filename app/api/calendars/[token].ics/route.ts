import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { toICS } from "@/lib/calendar";

export async function GET(_: Request, { params }: { params: Promise<{}> }) {
  const { token } = await params as { token: string };
  const db = await getDb();
  const calendar = await db.collection("calendars").findOne({ token });
  if (!calendar) return new NextResponse("Not found", { status: 404 });
  const ics = toICS(calendar.events || [], calendar.name || "Work Calendar");
  return new NextResponse(ics, { headers: { "Content-Type": "text/calendar; charset=utf-8", "Cache-Control": "no-store" } });
}
