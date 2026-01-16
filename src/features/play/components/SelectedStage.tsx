import Image from "next/image";
import type {
  ControllerPayload,
  DrawingBlob,
  Position,
} from "@/features/play/types";

interface SelectedStageProps {
  drawing: DrawingBlob | null;
  position: Position;
  paired: boolean;
  connected: boolean;
  connecting: boolean;
  lastPayload: ControllerPayload | null;
  onRelease: () => void;
}

export function SelectedStage({
  drawing,
  position,
  paired,
  connected,
  connecting,
  lastPayload,
  onRelease,
}: SelectedStageProps) {
  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">選択中の絵</p>
          <h2 className="text-2xl font-semibold text-gray-700">
            {drawing ? "M5Stickと連動中" : "まだ絵が選ばれていません"}
          </h2>
        </div>
        {drawing ? (
          <div className="flex items-center gap-2 text-sm">
            <StatusPill
              label={connecting ? "接続中" : connected ? "接続済み" : "未接続"}
              tone={connected ? "success" : connecting ? "warn" : "idle"}
            />
            <StatusPill
              label={paired ? "操作OK" : "ボタン待ち"}
              tone={paired ? "success" : "warn"}
            />
            <button
              onClick={onRelease}
              type="button"
              className="px-3 py-1 rounded-full border border-gray-400 text-gray-700 bg-white hover:bg-gray-100 active:scale-95"
            >
              えを戻す
            </button>
          </div>
        ) : null}
      </div>

      <div className="relative overflow-hidden rounded-3xl border-8 border-gray-700 bg-gradient-to-br from-indigo-100 via-white to-amber-100 shadow-xl min-h-80">
        {!drawing ? (
          <div className="flex h-full flex-col items-center justify-center gap-4 text-center p-8 text-gray-600">
            <p className="text-3xl font-bold">絵を選んでね</p>
            <p className="text-lg">選択するとここに大きく表示されます。</p>
          </div>
        ) : (
          <>
            <div className="relative h-115 w-full">
              <div
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
                style={{
                  transform: `translate(-50%, -50%) translate(${position.x}%, ${position.y}%)`,
                }}
              >
                <div className="relative h-64 w-64 md:h-80 md:w-80 transition-transform">
                  <Image
                    src={drawing.url}
                    alt="selected drawing"
                    fill
                    sizes="320px"
                    className="object-contain drop-shadow-2xl"
                  />
                </div>
              </div>
            </div>
            <div className="absolute bottom-4 left-4 right-4 rounded-2xl bg-white/80 border border-gray-300 shadow-md px-4 py-3 flex flex-wrap items-center gap-3">
              <span className="text-sm font-semibold text-gray-700">
                コントローラーのボタンを押してね
              </span>
              <span className="text-xs text-gray-500">
                最初の入力で接続が確定し、矢印ボタンで絵を動かせます。
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

type PillTone = "success" | "warn" | "idle";

function StatusPill({ label, tone }: { label: string; tone: PillTone }) {
  const toneClass = {
    success: "bg-green-100 text-green-700 border-green-400",
    warn: "bg-amber-100 text-amber-700 border-amber-400",
    idle: "bg-gray-100 text-gray-600 border-gray-300",
  }[tone];

  return (
    <span
      className={`px-3 py-1 rounded-full border text-xs font-semibold ${toneClass}`}
    >
      {label}
    </span>
  );
}
