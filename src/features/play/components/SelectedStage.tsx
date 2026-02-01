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
    <section className="flex-1 flex flex-col gap-2">
      {drawing && (
        <div className="flex items-center gap-2 px-2 h-8">
          <StatusPill
            label={connecting ? "接続中" : connected ? "接続済み" : "未接続"}
            tone={connected ? "success" : connecting ? "warn" : "idle"}
          />
          <StatusPill
            label={paired ? "OK" : "待機"}
            tone={paired ? "success" : "warn"}
          />
          <button
            onClick={onRelease}
            type="button"
            className="ml-auto px-2 py-0 text-xs rounded-full border border-gray-400 text-gray-700 bg-white hover:bg-gray-100 active:scale-95 font-bold"
          >
            戻す
          </button>
        </div>
      )}

      <div className="relative flex-1 overflow-hidden rounded-2xl border-6 border-gray-700 bg-gradient-to-br from-indigo-100 via-white to-amber-100 shadow-lg flex items-center justify-center">
        {!drawing ? (
          <div className="text-center text-gray-400">
            <p className="text-sm">タップして選択</p>
          </div>
        ) : (
          <>
            <div className="relative h-full w-full flex items-center justify-center p-4">
              <div
                className="absolute max-h-full max-w-full"
                style={{
                  transform: `translate(${position.x}%, ${position.y}%)`,
                  transition: "transform 0.1s ease-out",
                }}
              >
                <div className="relative h-40 w-40 md:h-48 md:w-48">
                  <Image
                    src={drawing.url}
                    alt="selected drawing"
                    fill
                    sizes="192px"
                    className="object-contain drop-shadow-2xl"
                  />
                </div>
              </div>
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
      className={`px-2 py-1 rounded-full border text-xs font-bold ${toneClass}`}
    >
      {label}
    </span>
  );
}
