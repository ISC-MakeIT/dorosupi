import { list } from "@vercel/blob";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { blobs } = await list({ limit: 100, prefix: "drawing-" });

    const items = blobs.map((blob) => ({
      id: blob.pathname,
      url: blob.url,
      uploadedAt: blob.uploadedAt,
      size: blob.size,
    }));

    return NextResponse.json({ items });
  } catch (error) {
    console.error("Blob list error:", error);
    return NextResponse.json(
      { error: "Failed to load drawings" },
      { status: 500 }
    );
  }
}
