"use client";

import React from "react";

interface FighterReveal {
  name: string;
  description: string;
  maxHp: number;
  abilities: string[];
  spriteData?: string;
}

interface RevealScreenProps {
  fighter1: FighterReveal;
  fighter2: FighterReveal;
  timer: number;
}

export default function RevealScreen({ fighter1, fighter2, timer }: RevealScreenProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 px-4">
      <h2 className="font-hand text-3xl text-gray-600 animate-pulse">
        Battle starts in {timer}...
      </h2>

      <div className="flex items-center gap-8 w-full max-w-3xl">
        {/* Fighter 1 */}
        <div className="flex-1 flex flex-col items-center gap-3 p-6 border-2 border-gray-800 rounded-lg bg-white sketchy-border">
          {fighter1.spriteData && (
            <img
              src={fighter1.spriteData}
              alt={fighter1.name}
              className="w-32 h-32 object-contain"
              style={{ imageRendering: "auto" }}
            />
          )}
          <h3 className="font-hand text-2xl font-bold text-gray-800">
            {fighter1.name}
          </h3>
          <p className="font-hand text-sm text-gray-500 text-center">
            {fighter1.description}
          </p>
          <div className="flex items-center gap-2">
            <span className="font-hand text-sm text-red-500">HP: {fighter1.maxHp}</span>
          </div>
          <div className="flex flex-wrap gap-1 justify-center">
            {fighter1.abilities.map((a, i) => (
              <span
                key={i}
                className="px-2 py-0.5 bg-gray-100 border border-gray-300 rounded-full font-hand text-xs text-gray-700"
              >
                {a}
              </span>
            ))}
          </div>
        </div>

        {/* VS */}
        <div className="flex flex-col items-center">
          <span className="font-hand text-5xl font-bold text-red-500 animate-bounce">
            VS
          </span>
        </div>

        {/* Fighter 2 */}
        <div className="flex-1 flex flex-col items-center gap-3 p-6 border-2 border-gray-800 rounded-lg bg-white sketchy-border">
          {fighter2.spriteData && (
            <img
              src={fighter2.spriteData}
              alt={fighter2.name}
              className="w-32 h-32 object-contain"
              style={{ imageRendering: "auto" }}
            />
          )}
          <h3 className="font-hand text-2xl font-bold text-gray-800">
            {fighter2.name}
          </h3>
          <p className="font-hand text-sm text-gray-500 text-center">
            {fighter2.description}
          </p>
          <div className="flex items-center gap-2">
            <span className="font-hand text-sm text-red-500">HP: {fighter2.maxHp}</span>
          </div>
          <div className="flex flex-wrap gap-1 justify-center">
            {fighter2.abilities.map((a, i) => (
              <span
                key={i}
                className="px-2 py-0.5 bg-gray-100 border border-gray-300 rounded-full font-hand text-xs text-gray-700"
              >
                {a}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
