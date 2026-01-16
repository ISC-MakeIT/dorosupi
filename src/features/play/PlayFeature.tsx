"use client";

import { Cherry_Bomb_One } from "next/font/google";
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
        setDrawings((prev) =>
          prev.filter((item) => item.id !== activeDrawing.id),
        );
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
    onPayload: handlePayload,
    multiPlayer: true, // 2-4人対応
  });

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
    setPaired(false);
    setPosition({ x: 0, y: 0 });
  };

  return (
    <main
      className={`min-h-screen bg-gradient-to-b from-sky-100 via-white to-orange-100 p-6 md:p-10 ${cherryBomb.className}`}
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-8">
        <header className="flex flex-col gap-2 rounded-3xl border-8 border-gray-700 bg-white/80 p-6 shadow-xl backdrop-blur">
          <h1 className="text-4xl md:text-5xl font-black text-gray-800 flex items-center gap-3">
            <span role="img" aria-label="gamepad">
              🎮
            </span>
            あそぶ
          </h1>
          <p className="text-lg text-gray-600">
            描いた絵をえらんで、M5Stickでうごかしてみよう。
          </p>
          <div className="text-sm text-gray-500">{headerStatus}</div>
          {loadError ? (
            <div className="text-red-600 text-sm">{loadError}</div>
          ) : null}
        </header>

        <SelectedStage
          drawing={activeDrawing}
          position={position}
          paired={paired}
          connected={connected}
          connecting={connecting}
          lastPayload={lastPayload}
          onRelease={handleRelease}
        />

        <DrawingGrid
          items={drawings}
          onSelect={handleSelect}
          isLoading={loading}
          title={paired ? "ほかの絵" : "絵をえらぶ"}
        />
      </div>
    </main>
  );
}
