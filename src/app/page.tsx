"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();
  const [joinCode, setJoinCode] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const handleCreate = () => {
    setIsCreating(true);
    // Navigate to a new room (will be created on the room page)
    router.push("/room/new");
  };

  const handleJoin = () => {
    if (!joinCode.trim()) return;
    router.push(`/room/${joinCode.trim().toUpperCase()}`);
  };

  return (
    <main className="flex flex-col items-center justify-center min-h-screen gap-12 p-8">
      {/* Title */}
      <div className="flex flex-col items-center gap-4">
        <h1 className="text-7xl font-bold text-gray-800 wobble">
          Scribble Fighters
        </h1>
        <p className="text-2xl text-gray-500 max-w-md text-center">
          Draw your champion. Bring it to life. Fight!
        </p>
      </div>

      {/* Decorative scribble divider */}
      <svg width="200" height="20" viewBox="0 0 200 20" className="opacity-30">
        <path
          d="M0,10 Q25,2 50,10 Q75,18 100,10 Q125,2 150,10 Q175,18 200,10"
          fill="none"
          stroke="#1a1a1a"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>

      {/* Actions */}
      <div className="flex flex-col items-center gap-6 w-full max-w-sm">
        {/* Create Room */}
        <button
          onClick={handleCreate}
          disabled={isCreating}
          className="sketchy-button w-full bg-yellow-300 text-gray-800 text-3xl py-5 font-bold hover:bg-yellow-400 transition-colors"
        >
          {isCreating ? "Creating..." : "Create Room"}
        </button>

        {/* Divider */}
        <div className="flex items-center gap-4 w-full">
          <div className="flex-1 h-0.5 bg-gray-300" />
          <span className="text-xl text-gray-400">or</span>
          <div className="flex-1 h-0.5 bg-gray-300" />
        </div>

        {/* Join Room */}
        <div className="flex gap-3 w-full">
          <input
            type="text"
            placeholder="Room code..."
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === "Enter" && handleJoin()}
            maxLength={6}
            className="flex-1 text-center text-2xl tracking-[0.2em] uppercase"
          />
          <button
            onClick={handleJoin}
            disabled={!joinCode.trim()}
            className="sketchy-button bg-blue-400 text-white text-xl px-6 py-3 font-bold disabled:opacity-40"
          >
            Join
          </button>
        </div>
      </div>

      {/* How to play */}
      <div className="flex flex-col items-center gap-3 mt-8 opacity-70 max-w-lg">
        <h2 className="text-2xl font-bold text-gray-700">How to Play</h2>
        <div className="flex flex-col gap-2 text-lg text-gray-500 text-center">
          <p>1. Create or join a room with a friend</p>
          <p>2. Draw your creature—the AI brings it to life with unique abilities</p>
          <p>3. Watch your champions battle in real-time (they fight on their own!)</p>
          <p>4. Summon reinforcements during battle using ink—draw new fighters to turn the tide and win!</p>
        </div>
      </div>

      {/* Footer */}
      <p className="text-sm text-gray-300 mt-8">
        Tip: Spend ink wisely when drawing—you&apos;ll use it to summon reinforcements in battle!
      </p>
    </main>
  );
}
