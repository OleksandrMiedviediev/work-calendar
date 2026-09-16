import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { getSession } from "@/lib/auth";

type Context = { params: Promise<{ token: string }> };

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