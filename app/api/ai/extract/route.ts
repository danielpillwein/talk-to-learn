import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import pdfParse from "pdf-parse";

export async function POST(request: Request): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const filename = file.name.toLowerCase();

  if (filename.endsWith(".pdf")) {
    const data = await pdfParse(buffer);
    return NextResponse.json({ text: data.text });
  }

  const text = buffer.toString("utf-8");
  return NextResponse.json({ text });
}
