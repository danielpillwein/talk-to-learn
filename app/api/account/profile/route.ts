import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function PUT(request: Request): Promise<NextResponse> {
  try {
    const session = await auth();
    const userId = session?.user?.id;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = (await request.json().catch(() => null)) as { displayName?: unknown } | null;
    const displayName = String(payload?.displayName ?? "").trim();

    if (!displayName) {
      return NextResponse.json({ error: "Bitte einen Anzeigenamen eingeben." }, { status: 400 });
    }
    if (displayName.length > 60) {
      return NextResponse.json({ error: "Der Anzeigename darf maximal 60 Zeichen haben." }, { status: 400 });
    }

    const updated = await db.user.update({
      where: { id: userId },
      data: { name: displayName },
      select: { name: true },
    });

    return NextResponse.json({ ok: true, displayName: updated.name ?? "" });
  } catch (error) {
    console.error("Error updating account profile:", error);
    return NextResponse.json({ error: "Profil konnte nicht gespeichert werden." }, { status: 500 });
  }
}

