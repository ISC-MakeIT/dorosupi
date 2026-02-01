import { Cherry_Bomb_One } from "next/font/google";
import Image from "next/image";
import type { DrawingBlob } from "@/features/play/types";

const cherryBomb = Cherry_Bomb_One({
  weight: "400",
  subsets: ["latin"],
  display: "swap",
});

interface Game {
  id: string;
  name: string;
  label: string;
  icon: string;
}

const GAMES: Game[] = [
  { id: "race", name: "かけっこ", label: "レース", icon: "🏃" },
];

interface GameSelectionProps {
  playerSelections: Record<string, DrawingBlob | null>;
  onSelectGame: (gameId: string) => void;
}

export function GameSelection({
  playerSelections,
  onSelectGame,
}: GameSelectionProps) {
  return (
    <main
      className={`min-h-screen bg-gradient-to-b from-sky-100 via-white to-orange-100 flex flex-col items-center justify-center p-4 ${cherryBomb.className}`}
    >
      <div className="absolute top-3 right-3 md:top-4 md:right-6 z-10 flex flex-col gap-2">
        {playerSelections.player1 && (
          <div className="bg-white/90 border-2 border-gray-700 rounded-xl px-3 py-2 shadow-md">
            <div className="text-xs font-black text-gray-700">P1</div>
            <div className="mt-1 h-10 w-10 rounded-lg overflow-hidden border border-gray-300">
              <Image
                src={playerSelections.player1.url}
                alt="player1 drawing"
                width={40}
                height={40}
                className="h-full w-full object-cover"
              />
            </div>
          </div>
        )}
        {playerSelections.player2 && (
          <div className="bg-white/90 border-2 border-gray-700 rounded-xl px-3 py-2 shadow-md">
            <div className="text-xs font-black text-gray-700">P2</div>
            <div className="mt-1 h-10 w-10 rounded-lg overflow-hidden border border-gray-300">
              <Image
                src={playerSelections.player2.url}
                alt="player2 drawing"
                width={40}
                height={40}
                className="h-full w-full object-cover"
              />
            </div>
          </div>
        )}
      </div>

      <div className="w-full max-w-4xl">
        <h1 className="text-4xl md:text-5xl font-black text-center text-gray-800 mb-12">
          ゲームをえらぶ
        </h1>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {GAMES.map((game) => (
            <button
              key={game.id}
              type="button"
              onClick={() => onSelectGame(game.id)}
              className="group flex flex-col items-center justify-center p-6 bg-white border-4 border-gray-700 rounded-2xl shadow-lg transition-transform hover:scale-105 active:scale-95"
            >
              <div className="text-6xl mb-3 group-hover:scale-110 transition-transform">
                {game.icon}
              </div>
              <div className="text-lg font-bold text-gray-700">{game.name}</div>
              <div className="text-sm text-gray-500">{game.label}</div>
            </button>
          ))}
        </div>
      </div>
    </main>
  );
}
