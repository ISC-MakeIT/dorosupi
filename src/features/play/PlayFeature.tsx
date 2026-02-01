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
  const [pairings, setPairings] = useState<Map<string, string>>(new Map()); // controllerId -> drawingId
  const [positions, setPositions] = useState<Map<string, Position>>(new Map()); // drawingId -> Position

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
      // 接続イベントの処理
      if (payload.event === "connect" && payload.id && activeDrawing) {
        const controllerId = payload.id;
        const drawingId = activeDrawing.id;

        setPairings((prev) => {
          const newPairings = new Map(prev);

          // このコントローラーIDまたは描画IDに紐づく既存のペアをすべて解除
          for (const [cId, dId] of newPairings.entries()) {
            if (cId === controllerId || dId === drawingId) {
              newPairings.delete(cId);
            }
          }

          newPairings.set(controllerId, drawingId);
          return newPairings;
        });

        // 新しくペアリングされた描画の位置を初期化
        setPositions((prev) => new Map(prev).set(drawingId, { x: 0, y: 0 }));
        // 描画を選択解除
        setActiveDrawing(null);
        return;
      }

      // TODO: `run`イベント(M5Stickを振る)にコントローラーIDが含まれていないため、
      // どのコントローラーがどの描画を動かすべきか判断できない。
      // 現在は`useMqttController`がトピックから`playerId`を抽出しているが、
      // `m5stick.ino`の`run`イベントは一意なトピックで送信していない。
      // この部分を修正するには、`.ino`側で`run`イベントにもコントローラーIDを含める必要がある。
      // 例: `mqtt.publish(TOPIC_RUN, "{\"id\":\"" + macAddress + "\",\"event\":\"run\"}")`
    },
    [activeDrawing],
  );

  const {
    connected,
    connecting,
    error: mqttError,
    lastPayload,
    enabled,
  } = useMqttController({
    topic: "yokohama/hackathon/running/+", // ワイルドカードで複数プレイヤーに対応
    onPayload: handlePayload,
    multiPlayer: true,
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
  };

  const handleRelease = () => {
    // 選択中の描画をペアリング解除するロジックはここには含めない
    setActiveDrawing(null);
  };

  const pairedDrawingIds = useMemo(() => new Set(pairings.values()), [pairings]);

  const isSelectedPaired = useMemo(() => {
    if (!activeDrawing) return false;
    return pairedDrawingIds.has(activeDrawing.id);
  }, [activeDrawing, pairedDrawingIds]);

  const drawingsToShow = useMemo(() => {
    // ペアリングされていない描画、または現在選択中の描画のみ表示
    return drawings.filter(
      (d) => !pairedDrawingIds.has(d.id) || d.id === activeDrawing?.id,
    );
  }, [drawings, pairedDrawingIds, activeDrawing]);

  const gridTitle = useMemo(() => {
    if (!activeDrawing) return "絵をえらぶ";
    return isSelectedPaired
      ? "この絵はペア済みです"
      : "M5StickのAボタンで決定";
  }, [activeDrawing, isSelectedPaired]);

  // 表示する用のペアリング情報（描画が主キー）
  const stagePairings = useMemo(() => {
    const map = new Map<string, { position: Position; controllerId: string }>();
    for (const [controllerId, drawingId] of pairings.entries()) {
      map.set(drawingId, {
        position: positions.get(drawingId) ?? { x: 0, y: 0 },
        controllerId,
      });
    }
    return map;
  }, [pairings, positions]);

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
          drawings={drawings}
          drawing={activeDrawing}
          stagePairings={stagePairings}
          connected={connected}
          connecting={connecting}
          lastPayload={lastPayload}
          onRelease={handleRelease}
        />

        <DrawingGrid
          items={drawingsToShow}
          onSelect={handleSelect}
          isLoading={loading}
          title={gridTitle}
          activeDrawingId={activeDrawing?.id}
        />
      </div>
    </main>
  );
}
