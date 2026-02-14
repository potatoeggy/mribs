"use client";

import React from "react";

interface ResultScreenProps {
  winnerId: string;
  mySessionId: string;
  playerNames: Map<string, string>;
  onPlayAgain: () => void;
  timer: number;
}

export default function ResultScreen({
  winnerId,
  mySessionId,
  playerNames,
  onPlayAgain,
  timer,
}: ResultScreenProps) {
  const isWinner = winnerId === mySessionId;
  const isDraw = winnerId === "draw";
  const winnerName = playerNames.get(winnerId) || "Unknown";

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-8 px-4">
      {isDraw ? (
        <>
          <h1 className="font-hand text-6xl font-bold text-yellow-600 text-center">
            DRAW!
          </h1>
          <p className="font-hand text-2xl text-gray-600">Both fighters fell!</p>
        </>
      ) : (
        <>
          <h1
            className={`font-hand text-6xl font-bold text-center ${
              isWinner ? "text-green-600" : "text-red-500"
            }`}
          >
            {isWinner ? "YOU WIN!" : "YOU LOSE!"}
          </h1>
          <p className="font-hand text-2xl text-gray-600">
            {isWinner ? "Your scribble reigns supreme!" : `${winnerName} wins!`}
          </p>
        </>
      )}

      <button
        onClick={onPlayAgain}
        className="sketchy-button bg-yellow-300 border-yellow-600 text-yellow-800 font-hand text-2xl px-10 py-4 hover:bg-yellow-400 hover:scale-105 transition-all"
      >
        Play Again!
      </button>

      <p className="font-hand text-sm text-gray-400">
        Returning to lobby in {timer}s...
      </p>
    </div>
  );
}
