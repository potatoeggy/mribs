"use client";

import React from "react";

interface InkBarProps {
  ink: number;
  maxInk: number;
  name: string;
  side: "left" | "right";
  color: string;
}

export default function InkBar({ ink, maxInk, name, side, color }: InkBarProps) {
  const inkPct = Math.max(0, Math.min(100, (ink / maxInk) * 100));

  return (
    <div className={`flex flex-col ${side === "left" ? "items-start" : "items-end"} gap-1`}>
      <div className="font-hand text-lg font-bold text-gray-800">{name}</div>
      <div className="w-64 bg-gray-200 h-8 rounded-full border-2 border-gray-800 overflow-hidden relative shadow-inner">
        <div
          className="h-full transition-all duration-300 ease-out"
          style={{
            width: `${inkPct}%`,
            backgroundColor: color,
            opacity: 0.9,
          }}
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="font-hand text-sm font-bold text-gray-800 drop-shadow-[0_1px_2px_rgba(255,255,255,0.8)]">
            {ink.toFixed(0)} / {maxInk} ink
          </span>
        </div>
      </div>
    </div>
  );
}
