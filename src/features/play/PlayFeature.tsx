"use client";

import { Cherry_Bomb_One } from "next/font/google";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchDrawings } from "@/features/play/api/fetchDrawings";
import { DrawingGrid } from "@/features/play/components/DrawingGrid";
import { GameSelection } from "@/features/play/components/GameSelection";
import { RaceGame } from "@/features/play/components/RaceGame";
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

export function PlayFeature() {
  const [drawings, setDrawings] = useState<DrawingBlob[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeDrawing, setActiveDrawing] = useState<DrawingBlob | null>(null);
  const [pairings, setPairings] = useState<Map<string, string>>(new Map()); // controllerId -> drawingId
  const [positions, setPositions] = useState<Map<string, Position>>(new Map()); // drawingId -> Position
  const [showGameSelection, setShowGameSelection] = useState(false);
  const [selectedGame, setSelectedGame] = useState<string | null>(null);

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
      if (payload.event === "connect" && payload.id) {
        const controllerId = payload.id;

        // activeDrawingがあればそれをペアリング、なければスキップ
        if (activeDrawing) {
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
        }
        return;
      }
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

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const key = event.key;

      // デバッグ用: キー1 = プレイヤー1のコントローラーが接続
      if (key === "1") {
        handlePayload({
          raw: '{"id":"m5stick-player1","event":"connect"}',
          event: "connect",
          id: "m5stick-player1",
          playerId: "player1",
        });
        return;
      }

      // デバッグ用: キー2 = プレイヤー2のコントローラーが接続
      if (key === "2") {
        handlePayload({
          raw: '{"id":"m5stick-player2","event":"connect"}',
          event: "connect",
          id: "m5stick-player2",
          playerId: "player2",
        });
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
  };

  const handleRelease = () => {
    setActiveDrawing(null);
  };

  const pairedDrawingIds = useMemo(
    () => new Set(pairings.values()),
    [pairings],
  );

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

  // P1/P2が接続している絵を取得
  const player1Drawing = useMemo(() => {
    for (const [controllerId, drawingId] of pairings.entries()) {
      if (controllerId.includes("player1")) {
        return drawings.find((d) => d.id === drawingId);
      }
    }
    return null;
  }, [pairings, drawings]);

  const player2Drawing = useMemo(() => {
    for (const [controllerId, drawingId] of pairings.entries()) {
      if (controllerId.includes("player2")) {
        return drawings.find((d) => d.id === drawingId);
      }
    }
    return null;
  }, [pairings, drawings]);

  const handleSelectGame = (gameId: string) => {
    setSelectedGame(gameId);
  };

  const handleBackFromGame = () => {
    setShowGameSelection(false);
    setSelectedGame(null);
  };

  // ゲーム選択画面を表示中
  if (showGameSelection && !selectedGame) {
    // pairingsからプレイヤーの選択絵を構築
    const playerSelections: Record<string, DrawingBlob | null> = {
      player1: player1Drawing || null,
      player2: player2Drawing || null,
    };

    return (
      <GameSelection
        playerSelections={playerSelections}
        onSelectGame={handleSelectGame}
      />
    );
  }

  // ゲーム画面を表示中
  if (selectedGame === "race" && player1Drawing && player2Drawing) {
    return (
      <RaceGame
        player1Drawing={player1Drawing}
        player2Drawing={player2Drawing}
        onPayload={handlePayload}
        lastPayload={lastPayload}
        onBack={handleBackFromGame}
      />
    );
  }

  return (
    <main
      className={`relative min-h-screen bg-linear-to-b from-sky-100 via-white to-orange-100 flex flex-col ${cherryBomb.className}`}
    >
      <div className="absolute top-3 right-3 md:top-4 md:right-6 z-10 flex flex-col gap-2">
        <div className="bg-white/90 border-2 border-gray-700 rounded-xl px-3 py-2 shadow-md">
          <div className="text-xs font-black text-gray-700">P1</div>
          {player1Drawing ? (
            <div className="mt-1 h-12 w-12 rounded-lg overflow-hidden border border-gray-300">
              <Image
                src={player1Drawing.url}
                alt="player1 drawing"
                width={48}
                height={48}
                className="h-full w-full object-cover"
              />
            </div>
          ) : (
            <div className="text-[10px] text-gray-400">未接続</div>
          )}
        </div>
        <div className="bg-white/90 border-2 border-gray-700 rounded-xl px-3 py-2 shadow-md">
          <div className="text-xs font-black text-gray-700">P2</div>
          {player2Drawing ? (
            <div className="mt-1 h-12 w-12 rounded-lg overflow-hidden border border-gray-300">
              <Image
                src={player2Drawing.url}
                alt="player2 drawing"
                width={48}
                height={48}
                className="h-full w-full object-cover"
              />
            </div>
          ) : (
            <div className="text-[10px] text-gray-400">未接続</div>
          )}
        </div>
      </div>
      <header className="shrink-0 flex flex-col gap-2 rounded-b-3xl border-b-8 border-gray-700 bg-white/90 p-4 md:p-6 shadow-lg backdrop-blur">
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
          drawings={drawings}
          drawing={activeDrawing}
          stagePairings={stagePairings}
          connected={connected}
          connecting={connecting}
          lastPayload={lastPayload}
          onRelease={handleRelease}
        />

        <div className="shrink-0 border-t-4 border-gray-700 pt-4 flex items-center justify-between">
          <div className="flex-1">
            <DrawingGrid
              items={drawings}
              onSelect={handleSelect}
              isLoading={loading}
              activeDrawingId={activeDrawing?.id}
            />
          </div>
          {pairings.size > 0 && (
            <button
              type="button"
              onClick={() => setShowGameSelection(true)}
              className="ml-4 shrink-0 px-4 py-2 bg-green-500 hover:bg-green-600 active:scale-95 text-white font-bold rounded-xl border-3 border-green-700 transition-all shadow-lg"
            >
              ゲーム
            </button>
          )}
        </div>
      </div>
    </main>
  );
}
