"use client";

import React from "react";

interface HealthBarProps {
  hp: number;
  maxHp: number;
  name: string;
  side: "left" | "right";
}

export default function HealthBar({ hp, maxHp, name, side }: HealthBarProps) {
  const fraction = Math.max(0, hp / maxHp);
  const pct = Math.round(fraction * 100);
  const color =
    fraction > 0.5
      ? "bg-green-500"
      : fraction > 0.25
      ? "bg-yellow-500"
      : "bg-red-500";

  return (
    <div
      className={`flex flex-col gap-1 flex-1 ${
        side === "right" ? "items-end" : "items-start"
      }`}
    >
      <span className="font-hand text-lg font-bold text-gray-800 truncate max-w-[150px]">
        {name}
      </span>
      <div className="w-full h-6 bg-gray-200 rounded-full overflow-hidden border-2 border-gray-700 relative">
        <div
          className={`h-full ${color} transition-all duration-300 ease-out ${
            side === "right" ? "ml-auto" : ""
          }`}
          style={{
            width: `${pct}%`,
          }}
        />
        {/* Scribble overlay */}
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none"
          viewBox="0 0 200 24"
          preserveAspectRatio="none"
        >
          <path
            d="M0,12 Q25,8 50,12 Q75,16 100,12 Q125,8 150,12 Q175,16 200,12"
            fill="none"
            stroke="rgba(0,0,0,0.1)"
            strokeWidth="2"
          />
        </svg>
      </div>
      <span className="font-hand text-sm text-gray-500">
        {hp}/{maxHp}
      </span>
    </div>
  );
}
