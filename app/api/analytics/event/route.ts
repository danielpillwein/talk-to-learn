import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const body = await request.json();
    const event = String(body.event ?? "").trim();
    const payload = body.payload ?? {};
    if (!event) {
      return NextResponse.json({ error: "event is required" }, { status: 400 });
    }

    const session = await auth();
    console.info("[analytics]", {
      event,
      payload,
      userId: session?.user?.id ?? null,
      at: new Date().toISOString(),
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "invalid event payload" }, { status: 400 });
  }
}
