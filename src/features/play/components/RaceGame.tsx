"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ControllerPayload, DrawingBlob } from "@/features/play/types";
import { RaceTrack } from "./RaceTrack";

type GamePhase = "ready" | "race" | "finish";

const PLAYER1_COLOR = "#FF6B6B";
const PLAYER2_COLOR = "#4A90D9";
const WINNING_POSITION = 100;
const MOVE_AMOUNT = 2;

interface RaceGameProps {
  player1Drawing: DrawingBlob | null;
  player2Drawing: DrawingBlob | null;
  onPayload: (payload: ControllerPayload) => void;
  lastPayload: ControllerPayload | null;
  onBack: () => void;
}

export function RaceGame({
  player1Drawing,
  player2Drawing,
  onPayload: _onPayload,
  lastPayload,
  onBack,
}: RaceGameProps) {
  const [gamePhase, setGamePhase] = useState<GamePhase>("ready");
  const [player1Position, setPlayer1Position] = useState(0);
  const [player2Position, setPlayer2Position] = useState(0);
  const [player1Wobble, setPlayer1Wobble] = useState(0);
  const [player2Wobble, setPlayer2Wobble] = useState(0);
  const [winner, setWinner] = useState<number | null>(null);
  const [countdown, setCountdown] = useState(3);

  const keyStateRef = useRef<{ [key: string]: boolean }>({});
  const lastKeyRef = useRef<{ player1: string; player2: string }>({
    player1: "",
    player2: "",
  });

  // ゲーム開始前のカウントダウン
  useEffect(() => {
    if (gamePhase !== "ready") return;

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setGamePhase("race");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [gamePhase]);

  const resolvePlayerFromPayload = useCallback(
    (payload: ControllerPayload): 1 | 2 | null => {
      const playerId = payload.playerId?.toLowerCase();
      const controllerId = payload.id?.toLowerCase();

      if (playerId?.includes("player1") || controllerId?.includes("player1")) {
        return 1;
      }
      if (playerId?.includes("player2") || controllerId?.includes("player2")) {
        return 2;
      }
      return null;
    },
    [],
  );

  const advancePlayer = useCallback(
    (player: 1 | 2) => {
      if (gamePhase !== "race" || winner) return;

      if (player === 1) {
        setPlayer1Position((prev) => {
          const newPos = Math.min(prev + MOVE_AMOUNT, WINNING_POSITION);
          if (newPos >= WINNING_POSITION && !winner) {
            setWinner(1);
            setGamePhase("finish");
          }
          return newPos;
        });
        setPlayer1Wobble((prev) => prev + 1);
        return;
      }

      setPlayer2Position((prev) => {
        const newPos = Math.min(prev + MOVE_AMOUNT, WINNING_POSITION);
        if (newPos >= WINNING_POSITION && !winner) {
          setWinner(2);
          setGamePhase("finish");
        }
        return newPos;
      });
      setPlayer2Wobble((prev) => prev + 1);
    },
    [gamePhase, winner],
  );

  // キーボードイベントでゲーム操作
  useEffect(() => {
    if (gamePhase !== "race" || winner) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key;

      // Player 1: "1" key
      if (key === "1" && !keyStateRef.current["1"]) {
        if (lastKeyRef.current.player1 !== "1") {
          advancePlayer(1);
          lastKeyRef.current.player1 = "1";
        }
        keyStateRef.current["1"] = true;
      }

      // Player 2: "2" key
      if (key === "2" && !keyStateRef.current["2"]) {
        if (lastKeyRef.current.player2 !== "2") {
          advancePlayer(2);
          lastKeyRef.current.player2 = "2";
        }
        keyStateRef.current["2"] = true;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key;
      if (key === "1") {
        keyStateRef.current["1"] = false;
        lastKeyRef.current.player1 = "";
      }
      if (key === "2") {
        keyStateRef.current["2"] = false;
        lastKeyRef.current.player2 = "";
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [advancePlayer, gamePhase, winner]);

  // M5Stickのrunメッセージで走る
  useEffect(() => {
    if (!lastPayload || gamePhase !== "race" || winner) return;

    const isRun = lastPayload.event === "run" || lastPayload.button === "run";
    if (!isRun) return;

    const player = resolvePlayerFromPayload(lastPayload);
    if (!player) return;

    advancePlayer(player);
  }, [advancePlayer, gamePhase, lastPayload, resolvePlayerFromPayload, winner]);

  const playAgain = () => {
    setPlayer1Position(0);
    setPlayer2Position(0);
    setPlayer1Wobble(0);
    setPlayer2Wobble(0);
    setWinner(null);
    setCountdown(3);
    keyStateRef.current = {};
    lastKeyRef.current = { player1: "", player2: "" };
    setGamePhase("ready");
  };

  if (!player1Drawing || !player2Drawing) {
    return (
      <main className="min-h-screen bg-linear-to-b from-sky-100 via-white to-orange-100 flex items-center justify-center">
        <p className="text-2xl text-gray-700">準備中...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-sky-100 flex flex-col items-center justify-center p-4 gap-6">
      {/* Title */}
      <h1 className="text-4xl md:text-6xl font-bold text-gray-800 drop-shadow-lg">
        🏃 かけっこ 🏃
      </h1>

      {/* Ready Phase */}
      {gamePhase === "ready" && (
        <div className="flex flex-col items-center gap-6 w-full max-w-6xl">
          <RaceTrack
            player1Image={player1Drawing.url}
            player2Image={player2Drawing.url}
            player1Position={0}
            player2Position={0}
            player1Wobble={0}
            player2Wobble={0}
            winner={null}
          />
          <div className="text-8xl font-bold text-red-500 animate-pulse">
            {countdown}
          </div>
        </div>
      )}

      {/* Race Phase */}
      {(gamePhase === "race" || gamePhase === "finish") && (
        <div className="flex flex-col items-center gap-6 w-full max-w-6xl">
          <RaceTrack
            player1Image={player1Drawing.url}
            player2Image={player2Drawing.url}
            player1Position={player1Position}
            player2Position={player2Position}
            player1Wobble={player1Wobble}
            player2Wobble={player2Wobble}
            winner={winner}
          />

          {gamePhase === "race" && (
            <div className="flex gap-12 items-center">
              <div className="flex flex-col items-center gap-2">
                <div
                  className="w-24 h-24 rounded-2xl flex items-center justify-center text-5xl font-bold text-white shadow-lg animate-pulse"
                  style={{ backgroundColor: PLAYER1_COLOR }}
                >
                  1
                </div>
                <span className="text-2xl font-bold text-gray-600">
                  ふって!
                </span>
              </div>
              <div className="flex flex-col items-center gap-2">
                <div
                  className="w-24 h-24 rounded-2xl flex items-center justify-center text-5xl font-bold text-white shadow-lg animate-pulse"
                  style={{ backgroundColor: PLAYER2_COLOR }}
                >
                  2
                </div>
                <span className="text-2xl font-bold text-gray-600">
                  ふって!
                </span>
              </div>
            </div>
          )}

          {gamePhase === "finish" && (
            <div className="flex flex-col gap-6 items-center">
              <div className="text-5xl md:text-6xl font-bold text-gray-800 text-center">
                {winner === 1
                  ? "🎉 プレイヤー1のかち! 🎉"
                  : "🎉 プレイヤー2のかち! 🎉"}
              </div>
              <div className="flex gap-4">
                <button
                  onClick={playAgain}
                  className="px-8 py-4 text-2xl font-bold rounded-full bg-green-500 hover:bg-green-600 active:scale-95 text-white shadow-lg transition-transform"
                >
                  もういっかい！
                </button>
                <button
                  onClick={onBack}
                  className="px-8 py-4 text-2xl font-bold rounded-full bg-gray-500 hover:bg-gray-600 active:scale-95 text-white shadow-lg transition-transform"
                >
                  もどる
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </main>
  );
}
