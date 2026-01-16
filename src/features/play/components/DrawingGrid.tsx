import Image from "next/image";
import type { DrawingBlob } from "@/features/play/types";

interface DrawingGridProps {
  items: DrawingBlob[];
  onSelect: (item: DrawingBlob) => void;
  isLoading: boolean;
  title: string;
}

export function DrawingGrid({
  items,
  onSelect,
  isLoading,
  title,
}: DrawingGridProps) {
  if (isLoading) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-gray-700">{title}</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 6 }, (_, idx) => `skeleton-${idx}`).map(
            (id) => (
              <div
                key={id}
                className="aspect-square rounded-2xl bg-gradient-to-br from-gray-200 to-gray-300 animate-pulse"
              />
            ),
          )}
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-semibold text-gray-700">{title}</h2>
      {items.length === 0 ? (
        <p className="text-gray-500">
          表示できる絵がありません。アップロードしてね。
        </p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelect(item)}
              className="group aspect-square rounded-2xl overflow-hidden border-4 border-gray-700 bg-white shadow-lg transition-transform hover:scale-105 active:scale-95"
            >
              <div className="relative h-full w-full">
                <Image
                  src={item.url}
                  alt="drawing"
                  fill
                  sizes="(min-width: 1024px) 25vw, 50vw"
                  className="object-cover"
                  priority={false}
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
              </div>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
