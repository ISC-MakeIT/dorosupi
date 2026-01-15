"use client";

import { Cherry_Bomb_One } from "next/font/google";
import { useEffect, useRef, useState } from "react";

const cherryBomb = Cherry_Bomb_One({
  weight: "400",
  subsets: ["latin"],
  display: "swap",
});

const COLORS = [
  { name: "赤", hex: "#FF0000", label: "あか" },
  { name: "青", hex: "#0000FF", label: "あお" },
  { name: "黄", hex: "#FFFF00", label: "きいろ" },
  { name: "緑", hex: "#00CC00", label: "みどり" },
  { name: "黒", hex: "#000000", label: "くろ" },
  { name: "白", hex: "#FFFFFF", label: "しろ" },
];

export default function DrawPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentColor, setCurrentColor] = useState(COLORS[0].hex);
  const [brushSize, setBrushSize] = useState(8);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      const context = canvas.getContext("2d");
      if (context) {
        context.fillStyle = "white";
        context.fillRect(0, 0, canvas.width, canvas.height);
      }
    }
  }, []);

  const startDrawing = (
    e:
      | React.MouseEvent<HTMLCanvasElement>
      | React.TouchEvent<HTMLCanvasElement>,
  ) => {
    setIsDrawing(true);
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    let x, y;

    if ("touches" in e) {
      x = e.touches[0].clientX - rect.left;
      y = e.touches[0].clientY - rect.top;
    } else {
      x = e.clientX - rect.left;
      y = e.clientY - rect.top;
    }

    const context = canvas.getContext("2d");
    if (context) {
      context.beginPath();
      context.moveTo(x, y);
    }
  };

  const draw = (
    e:
      | React.MouseEvent<HTMLCanvasElement>
      | React.TouchEvent<HTMLCanvasElement>,
  ) => {
    if (!isDrawing) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    let x, y;

    if ("touches" in e) {
      x = e.touches[0].clientX - rect.left;
      y = e.touches[0].clientY - rect.top;
    } else {
      x = e.clientX - rect.left;
      y = e.clientY - rect.top;
    }

    const context = canvas.getContext("2d");
    if (context) {
      context.lineWidth = brushSize;
      context.lineCap = "round";
      context.lineJoin = "round";
      context.strokeStyle = currentColor;
      context.lineTo(x, y);
      context.stroke();
    }
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    const canvas = canvasRef.current;
    if (canvas) {
      const context = canvas.getContext("2d");
      if (context) {
        context.closePath();
      }
    }
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const context = canvas.getContext("2d");
      if (context) {
        context.fillStyle = "white";
        context.fillRect(0, 0, canvas.width, canvas.height);
      }
    }
  };

  const saveDrawing = async () => {
    setIsSaving(true);
    try {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const blob = await new Promise<Blob>((resolve) => {
        canvas.toBlob((blob) => {
          resolve(blob!);
        }, "image/png");
      });

      const response = await fetch("/api/upload", {
        method: "POST",
        body: blob,
        headers: {
          "Content-Type": "image/png",
        },
      });

      if (response.ok) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 2000);
        clearCanvas();
      }
    } catch (error) {
      console.error("保存に失敗しました:", error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <main
      className={`min-h-screen bg-gradient-to-b from-pink-200 to-blue-200 p-6 flex flex-col items-center justify-center ${cherryBomb.className}`}
    >
      <div className="bg-white rounded-3xl shadow-xl p-8 w-full max-w-4xl">
        <h1 className="text-5xl font-bold text-center mb-8 text-purple-600 drop-shadow-md">
          おえかき
        </h1>

        {/* キャンバス */}
        <div className="mb-8 border-8 border-gray-600 rounded-2xl overflow-hidden bg-white shadow-lg">
          <canvas
            ref={canvasRef}
            width={800}
            height={500}
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            onTouchStart={startDrawing}
            onTouchMove={draw}
            onTouchEnd={stopDrawing}
            className="w-full bg-white cursor-crosshair"
          />
        </div>

        {/* 色パレット */}
        <div className="mb-8">
          <p className="text-2xl font-bold mb-4 text-gray-700">いろ</p>
          <div className="flex flex-wrap gap-3 mb-6">
            {COLORS.map((color) => (
              <button
                key={color.hex}
                onClick={() => setCurrentColor(color.hex)}
                className={`w-20 h-20 rounded-2xl border-4 transition-transform hover:scale-110 active:scale-95 flex flex-col items-center justify-center gap-1 ${
                  currentColor === color.hex
                    ? "border-gray-800 shadow-lg scale-110"
                    : "border-gray-400"
                }`}
                style={{ backgroundColor: color.hex }}
                title={color.name}
              >
                <span
                  className="text-xs font-bold drop-shadow-sm"
                  style={{
                    color: color.hex === "#FFFF00" ? "#000" : "#fff",
                  }}
                >
                  {color.label}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* ブラシサイズ */}
        <div className="mb-8">
          <p className="text-2xl font-bold mb-4 text-gray-700">
            ふでのおおきさ
          </p>
          <div className="flex items-center gap-4">
            <input
              type="range"
              min="2"
              max="30"
              value={brushSize}
              onChange={(e) => setBrushSize(Number(e.target.value))}
              className="flex-1 h-3 bg-gray-300 rounded-lg appearance-none cursor-pointer"
            />
            <div className="text-3xl">{brushSize}px</div>
            <div
              className="w-12 h-12 rounded-full"
              style={{ backgroundColor: currentColor }}
            />
          </div>
        </div>

        {/* ボタン */}
        <div className="flex gap-4 justify-center">
          <button
            onClick={clearCanvas}
            className="px-8 py-4 bg-red-500 hover:bg-red-600 active:scale-95 text-white text-2xl font-bold rounded-2xl border-4 border-red-700 transition-all shadow-lg"
          >
            リセット
          </button>
          <button
            onClick={saveDrawing}
            disabled={isSaving}
            className="px-8 py-4 bg-green-500 hover:bg-green-600 active:scale-95 disabled:bg-gray-400 text-white text-2xl font-bold rounded-2xl border-4 border-green-700 transition-all shadow-lg"
          >
            {isSaving ? "ほぞんちゅう..." : "ほぞん"}
          </button>
        </div>

        {/* 保存完了メッセージ */}
        {saveSuccess && (
          <div className="mt-8 p-4 bg-green-200 border-4 border-green-500 rounded-2xl text-center text-2xl font-bold text-green-700">
            ✓ ほぞんされました！
          </div>
        )}
      </div>
    </main>
  );
}
