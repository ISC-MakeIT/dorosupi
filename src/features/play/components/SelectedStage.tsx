import Image from "next/image";
import type {
  ControllerPayload,
  DrawingBlob,
  Position,
} from "@/features/play/types";

interface SelectedStageProps {
  drawings: DrawingBlob[];
  stagePairings: Map<string, { position: Position; controllerId: string }>;
  connected: boolean;
  connecting: boolean;
  lastPayload: ControllerPayload | null;
  onRelease: () => void;
  drawing: DrawingBlob | null; // currently selected, for context
}

export function SelectedStage({
  drawings,
  stagePairings,
  connected,
  connecting,
  lastPayload,
  onRelease,
  drawing, // The one selected in the grid
}: SelectedStageProps) {
  const pairedDrawings = Array.from(stagePairings.entries()).map(
    ([drawingId, { position, controllerId }]) => {
      const drawing = drawings.find((d) => d.id === drawingId);
      return { drawing, position, controllerId };
    },
  );

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">
            {stagePairings.size} 人が参加中
          </p>
          <h2 className="text-2xl font-semibold text-gray-700">
            {drawing
              ? "選択中の絵"
              : stagePairings.size > 0
                ? "コントローラーと連動中"
                : "まだ絵が選ばれていません"}
          </h2>
        </div>
        {drawing ? (
          <div className="flex items-center gap-2 text-sm">
            <button
              onClick={onRelease}
              type="button"
              className="px-3 py-1 rounded-full border border-gray-400 text-gray-700 bg-white hover:bg-gray-100 active:scale-95"
            >
              選択をやめる
            </button>
          </div>
        ) : null}
      </div>

      <div className="relative overflow-hidden rounded-3xl border-8 border-gray-700 bg-gradient-to-br from-indigo-100 via-white to-amber-100 shadow-xl min-h-80">
        {pairedDrawings.length === 0 && !drawing ? (
          <div className="flex h-full flex-col items-center justify-center gap-4 text-center p-8 text-gray-600">
            <p className="text-3xl font-bold">絵を選んでね</p>
            <p className="text-lg">
              下のリストから絵を選んで、M5StickのAボタンでペアリング！
            </p>
          </div>
        ) : (
          <>
            {pairedDrawings.map(({ drawing: pairedDrawing, position, controllerId }) =>
              !pairedDrawing ? null : (
                <div
                  key={pairedDrawing.id}
                  className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
                  style={{
                    transform: `translate(-50%, -50%) translate(${position.x}%, ${position.y}%)`,
                  }}
                >
                  <div className="relative h-48 w-48 md:h-64 md:w-64 transition-transform">
                    <Image
                      src={pairedDrawing.url}
                      alt="paired drawing"
                      fill
                      sizes="256px"
                      className="object-contain drop-shadow-2xl"
                    />
                     <div className="absolute -top-8 left-1/2 -translate-x-1/2 rounded-full bg-black/50 text-white px-2 py-1 text-xs">
                        {controllerId.slice(-5)}
                      </div>
                  </div>
                </div>
              ),
            )}
             {drawing && !stagePairings.has(drawing.id) && (
              <div
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
              >
                <div className="relative h-64 w-64 md:h-80 md:w-80 transition-transform opacity-50 border-4 border-dashed border-gray-500 rounded-3xl">
                  <Image
                    src={drawing.url}
                    alt="selected drawing"
                    fill
                    sizes="320px"
                    className="object-contain drop-shadow-2xl"
                  />
                </div>
              </div>
            )}
            <div className="absolute bottom-4 left-4 right-4 rounded-2xl bg-white/80 border border-gray-300 shadow-md px-4 py-3 flex flex-wrap items-center gap-3">
              <span className="text-sm font-semibold text-gray-700">
                {drawing ? "Aボタンでペアリング！" : "コントローラーで絵を動かそう"}
              </span>
              {lastPayload ? (
                <span className="ml-auto text-xs text-gray-500">
                  last: {lastPayload.raw}
                </span>
              ) : null}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
