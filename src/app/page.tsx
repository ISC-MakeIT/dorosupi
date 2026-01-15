import { Cherry_Bomb_One } from "next/font/google";
import Image from "next/image";
import Link from "next/link";

const cherryBomb = Cherry_Bomb_One({
  weight: "400",
  subsets: ["latin"],
  display: "swap",
});

export default function HomePage() {
  return (
    <main
      className={`min-h-screen flex items-center justify-center puzzle-bg ${cherryBomb.className}`}
    >
      <div className="flex flex-col md:flex-row gap-4 w-full h-full md:p-12 p-6">
        <Link href="/draw" className="flex-1">
          <Card
            title="おえかき"
            icon="/palette-icon.png"
            iconAlt="パレット"
            stripeClass="stripe-yellow"
            textColors={[
              "text-blue-400",
              "text-yellow-500",
              "text-red-500",
              "text-orange-400",
            ]}
          />
        </Link>
        <Card
          title="あそぶ"
          icon="/gamepad-icon.png"
          iconAlt="ゲームパッド"
          stripeClass="stripe-blue"
          textColors={["text-green-500", "text-blue-400", "text-yellow-400"]}
        />
      </div>
    </main>
  );
}

interface CardProps {
  title: string;
  icon: string;
  iconAlt: string;
  stripeClass: string;
  textColors: string[];
}

function Card({ title, icon, iconAlt, stripeClass, textColors }: CardProps) {
  return (
    <div
      className={`flex-1 rounded-3xl border-8 border-gray-600 shadow-2xl transition-transform hover:scale-105 active:scale-95 flex flex-col items-center justify-center gap-12  ${stripeClass}`}
    >
      <h2 className="text-6xl font-bold flex gap-2">
        {title.split("").map((char, idx) => (
          <span
            key={char}
            className={`${textColors[idx % textColors.length]} drop-shadow-md`}
            style={{
              textShadow:
                "2px 2px 0 #666, -1px -1px 0 #666, 1px -1px 0 #666, -1px 1px 0 #666, 1px 1px 0 #666",
            }}
          >
            {char}
          </span>
        ))}
      </h2>
      <div className="transition-transform hover:rotate-12 duration-300">
        <Image src={icon} alt={iconAlt} width={240} height={240} />
      </div>
    </div>
  );
}
