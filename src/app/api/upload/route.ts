import { put } from "@vercel/blob";
import { type NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const blob = await request.blob();

    if (!blob) {
      return NextResponse.json({ error: "No blob provided" }, { status: 400 });
    }

    const timestamp = Date.now();
    const filename = `drawing-${timestamp}.png`;

    const uploadedBlob = await put(filename, blob, {
      access: "public",
    });

    return NextResponse.json({
      success: true,
      url: uploadedBlob.url,
    });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
