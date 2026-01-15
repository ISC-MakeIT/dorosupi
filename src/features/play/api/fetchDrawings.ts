import { DrawingBlob } from "@/features/play/types";

export async function fetchDrawings(
  signal?: AbortSignal
): Promise<DrawingBlob[]> {
  const response = await fetch("/api/blobs", { signal, cache: "no-store" });

  if (!response.ok) {
    throw new Error("イラストの取得に失敗しました");
  }

  const data = (await response.json()) as { items?: DrawingBlob[] };
  return data.items ?? [];
}
