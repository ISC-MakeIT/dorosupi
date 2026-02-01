"use client";

import { Cherry_Bomb_One } from "next/font/google";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchDrawings } from "@/features/play/api/fetchDrawings";
import { DrawingGrid } from "@/features/play/components/DrawingGrid";
import { SelectedStage } from "@/features/play/components/SelectedStage";
import { useMqttController } from "@/features/play/hooks/useMqttController";
import type {
  ControllerPayload,
  DrawingBlob,
  Position,
} from "@/features/play/types";

const cherryBomb = Cherry_Bomb_One({
  weight: "400",
  subsets: ["latin"],
  display: "swap",
});

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

function movePosition(current: Position, payload: ControllerPayload): Position {
  const step = payload.step ?? 6;
  const button = payload.button;

  const buttonDx = button === "right" ? step : button === "left" ? -step : 0;
  const buttonDy = button === "down" ? step : button === "up" ? -step : 0;

  const dx = (payload.dx ?? 0) + buttonDx;
  const dy = (payload.dy ?? 0) + buttonDy;

  const nextX = clamp(current.x + dx, -40, 40);
  const nextY = clamp(current.y + dy, -40, 40);

  return { x: nextX, y: nextY };
}

export function PlayFeature() {
  const [drawings, setDrawings] = useState<DrawingBlob[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeDrawing, setActiveDrawing] = useState<DrawingBlob | null>(null);
  const [playerSelections, setPlayerSelections] = useState<
    Record<string, DrawingBlob | null>
  >({ player1: null, player2: null });
  const [paired, setPaired] = useState(false);
  const [position, setPosition] = useState<Position>({ x: 0, y: 0 });

  useEffect(() => {
    const controller = new AbortController();
    fetchDrawings(controller.signal)
      .then((items) => {
        setDrawings(items);
        setLoadError(null);
      })
      .catch((err) => {
        setLoadError(err.message);
      })
      .finally(() => {
        setLoading(false);
      });

    return () => controller.abort();
  }, []);

  const handlePayload = useCallback(
    (payload: ControllerPayload) => {
      if (!activeDrawing) return;
      if (!paired) {
        setPaired(true);
        setPlayerSelections((prev) => ({
          ...prev,
          [payload.playerId ?? "player1"]: activeDrawing,
        }));
        return;
      }

      setPosition((prev) => movePosition(prev, payload));
    },
    [activeDrawing, paired],
  );

  const {
    connected,
    connecting,
    error: mqttError,
    lastPayload,
    enabled,
  } = useMqttController({
    topic: "yokohama/hackathon/running/player1",
    onPayload: handlePayload,
    multiPlayer: true, // 2-4人対応
  });

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const key = event.key;

      if (key === "1") {
        handlePayload({ raw: "run", button: "run", playerId: "player1" });
        return;
      }

      if (key === "2") {
        handlePayload({ raw: "run", button: "run", playerId: "player2" });
        return;
      }

      const arrowMap: Record<string, ControllerPayload> = {
        ArrowUp: { raw: "up", button: "up", playerId: "player1" },
        ArrowDown: { raw: "down", button: "down", playerId: "player1" },
        ArrowLeft: { raw: "left", button: "left", playerId: "player1" },
        ArrowRight: { raw: "right", button: "right", playerId: "player1" },
      };

      const payload = arrowMap[key];
      if (payload) {
        event.preventDefault();
        handlePayload(payload);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handlePayload]);

  const headerStatus = useMemo(() => {
    if (!enabled)
      return "MQTTの接続先を設定してください (NEXT_PUBLIC_MQTT_BROKER_URL)";
    if (mqttError) return mqttError;
    return connected
      ? "M5Stickとつながりました"
      : connecting
        ? "接続中..."
        : "接続待ち";
  }, [connected, connecting, enabled, mqttError]);

  const handleSelect = (item: DrawingBlob) => {
    setDrawings((prev) => {
      if (activeDrawing && activeDrawing.id !== item.id) {
        const exists = prev.some((drawing) => drawing.id === activeDrawing.id);
        return exists ? prev : [activeDrawing, ...prev];
      }
      return prev;
    });
    setActiveDrawing(item);
    setPaired(false);
    setPosition({ x: 0, y: 0 });
  };

  const handleRelease = () => {
    if (activeDrawing) {
      setDrawings((prev) => {
        const exists = prev.some((item) => item.id === activeDrawing.id);
        return exists ? prev : [activeDrawing, ...prev];
      });
    }
    setActiveDrawing(null);
    setPlayerSelections((prev) => ({ ...prev, player1: null, player2: null }));
    setPaired(false);
    setPosition({ x: 0, y: 0 });
  };

  return (
    <main
      className={`relative min-h-screen bg-gradient-to-b from-sky-100 via-white to-orange-100 flex flex-col ${cherryBomb.className}`}
    >
      <div className="absolute top-3 right-3 md:top-4 md:right-6 z-10 flex flex-col gap-2">
        <div className="bg-white/90 border-2 border-gray-700 rounded-xl px-3 py-2 shadow-md">
          <div className="text-xs font-black text-gray-700">P1</div>
          {playerSelections.player1 ? (
            <div className="mt-1 h-10 w-10 rounded-lg overflow-hidden border border-gray-300">
              <Image
                src={playerSelections.player1.url}
                alt="player1 drawing"
                width={40}
                height={40}
                className="h-full w-full object-cover"
              />
            </div>
          ) : (
            <div className="text-[10px] text-gray-400">-</div>
          )}
        </div>
        <div className="bg-white/90 border-2 border-gray-700 rounded-xl px-3 py-2 shadow-md">
          <div className="text-xs font-black text-gray-700">P2</div>
          {playerSelections.player2 ? (
            <div className="mt-1 h-10 w-10 rounded-lg overflow-hidden border border-gray-300">
              <Image
                src={playerSelections.player2.url}
                alt="player2 drawing"
                width={40}
                height={40}
                className="h-full w-full object-cover"
              />
            </div>
          ) : (
            <div className="text-[10px] text-gray-400">-</div>
          )}
        </div>
      </div>
      <header className="flex-shrink-0 flex flex-col gap-2 rounded-b-3xl border-b-8 border-gray-700 bg-white/90 p-4 md:p-6 shadow-lg backdrop-blur">
        <h1 className="text-3xl md:text-4xl font-black text-gray-800 flex items-center gap-3">
          <span role="img" aria-label="gamepad">
            🎮
          </span>
          あそぶ
        </h1>
        <p className="text-sm md:text-base text-gray-600">
          描いた絵をえらんで、M5Stickでうごかしてみよう。
        </p>
        <div className="text-xs md:text-sm text-gray-500">{headerStatus}</div>
        {loadError ? (
          <div className="text-red-600 text-xs md:text-sm">{loadError}</div>
        ) : null}
      </header>

      <div className="flex-1 flex flex-col gap-4 p-4 md:p-6 overflow-hidden">
        <SelectedStage
          drawing={activeDrawing}
          position={position}
          paired={paired}
          connected={connected}
          connecting={connecting}
          lastPayload={lastPayload}
          onRelease={handleRelease}
        />

        <div className="flex-shrink-0 border-t-4 border-gray-700 pt-4">
          <DrawingGrid
            items={drawings}
            onSelect={handleSelect}
            isLoading={loading}
            title={paired ? "ほかの絵" : "絵をえらぶ"}
          />
        </div>
      </div>
    </main>
  );
}
