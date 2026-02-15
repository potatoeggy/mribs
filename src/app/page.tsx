"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();
  const [joinCode, setJoinCode] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const handleCreate = () => {
    setIsCreating(true);
    router.push("/room/new");
  };

  const handleJoin = () => {
    if (!joinCode.trim()) return;
    router.push(`/room/${joinCode.trim().toUpperCase()}`);
  };

  return (
    <main className="relative flex flex-col items-center justify-center min-h-screen gap-12 p-8 overflow-hidden">
      {/* Floating decorative scribbles - background */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <svg
          className="absolute top-20 left-[10%] w-16 h-16 text-gray-300/40 animate-float"
          viewBox="0 0 40 40"
          fill="none"
        >
          <path
            d="M5,20 Q15,5 30,20 Q20,35 5,20"
            stroke="currentColor"
            strokeWidth="1.5"
            fill="none"
          />
        </svg>
        <svg
          className="absolute top-40 right-[15%] w-12 h-12 text-amber-300/30 animate-float"
          style={{ animationDelay: "0.5s" }}
          viewBox="0 0 40 40"
          fill="none"
        >
          <circle
            cx="20"
            cy="20"
            r="8"
            stroke="currentColor"
            strokeWidth="1.5"
            fill="none"
          />
        </svg>
        <svg
          className="absolute bottom-32 left-[20%] w-14 h-14 text-blue-300/20 animate-float"
          style={{ animationDelay: "1s" }}
          viewBox="0 0 40 40"
          fill="none"
        >
          <path
            d="M10,30 L20,10 L30,30 L20,25 Z"
            stroke="currentColor"
            strokeWidth="1"
            fill="none"
          />
        </svg>
        <svg
          className="absolute bottom-48 right-[12%] w-20 h-20 text-gray-300/30 animate-float"
          style={{ animationDelay: "1.5s" }}
          viewBox="0 0 200 20"
          fill="none"
        >
          <path
            d="M0,10 Q50,2 100,10 Q150,18 200,10"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      </div>

      {/* Title - staggered entrance */}
      <div className="flex flex-col items-center gap-4 relative z-10">
        <h1
          className="font-hand text-7xl font-bold text-gray-800 animate-fade-in-up opacity-0"
          style={{
            animationDelay: "0ms",
            animationFillMode: "forwards",
            opacity: 0,
          }}
        >
          <span className="inline-block wobble">Scribble Fighters</span>
        </h1>
        <p
          className="font-hand text-2xl text-gray-500 max-w-md text-center animate-fade-in-up opacity-0"
          style={{ animationDelay: "150ms", animationFillMode: "forwards" }}
        >
          Draw your champion. Bring it to life. Fight!
        </p>
      </div>

      {/* Decorative scribble divider - animated */}
      <svg
        width="200"
        height="20"
        viewBox="0 0 200 20"
        className="opacity-40 animate-fade-in-up opacity-0 relative z-10"
        style={{ animationDelay: "250ms", animationFillMode: "forwards" }}
      >
        <path
          d="M0,10 Q25,2 50,10 Q75,18 100,10 Q125,2 150,10 Q175,18 200,10"
          fill="none"
          stroke="#1a1a1a"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>

      {/* Actions - staggered */}
      <div
        className="flex flex-col items-center gap-6 w-full max-w-sm relative z-10 animate-fade-in-up opacity-0"
        style={{ animationDelay: "350ms", animationFillMode: "forwards" }}
      >
        <button
          onClick={handleCreate}
          disabled={isCreating}
          className="sketchy-button w-full bg-yellow-300 text-gray-800 text-3xl py-5 font-bold hover:bg-yellow-400 hover:shadow-[4px_4px_0_#1a1a1a] transition-all duration-200 hover:-translate-y-0.5"
        >
          {isCreating ? "Creating..." : "Create Room"}
        </button>

        <div className="flex items-center gap-4 w-full">
          <div className="flex-1 h-0.5 bg-gradient-to-r from-transparent via-gray-300 to-transparent" />
          <span className="text-xl text-gray-400 font-hand">or</span>
          <div className="flex-1 h-0.5 bg-gradient-to-r from-transparent via-gray-300 to-transparent" />
        </div>

        <div className="flex gap-3 w-full">
          <input
            type="text"
            placeholder="Room code..."
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === "Enter" && handleJoin()}
            maxLength={6}
            className="flex-1 text-center text-2xl tracking-[0.2em] uppercase transition-shadow focus:shadow-[2px_2px_0_#1a1a1a]"
          />
          <button
            onClick={handleJoin}
            disabled={!joinCode.trim()}
            className="sketchy-button bg-blue-400 text-white text-xl px-6 py-3 font-bold disabled:opacity-40 hover:bg-blue-500 hover:shadow-[4px_4px_0_#1a1a1a] transition-all duration-200 enabled:hover:-translate-y-0.5"
          >
            Join
          </button>
        </div>
      </div>

      {/* How to play - fade in */}
      <div
        className="flex flex-col items-center gap-3 mt-8 opacity-80 max-w-lg relative z-10 animate-fade-in-up opacity-0"
        style={{ animationDelay: "500ms", animationFillMode: "forwards" }}
      >
        <h2 className="font-hand text-2xl font-bold text-gray-700">
          How to Play
        </h2>
        <div className="flex flex-col gap-3 text-lg text-gray-500 text-center">
          <p className="font-hand">1. Create or join a room with a friend</p>
          <p className="font-hand">
            2. Draw your creature—the AI brings it to life with unique abilities
          </p>
          <p className="font-hand">
            3. Watch your champions battle in real-time (they fight on their
            own!)
          </p>
          <p className="font-hand">
            4. Summon reinforcements during battle using ink—draw new fighters
            to turn the tide and win!
          </p>
        </div>
      </div>

      <p
        className="font-hand text-sm text-gray-400 mt-8 relative z-10 animate-fade-in-up opacity-0"
        style={{ animationDelay: "600ms", animationFillMode: "forwards" }}
      >
        Tip: Spend ink wisely when drawing—you&apos;ll use it to summon
        reinforcements in battle!
      </p>
    </main>
  );
}
