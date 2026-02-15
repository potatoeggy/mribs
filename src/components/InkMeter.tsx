"use client";

import React from "react";

interface InkMeterProps {
  fraction: number; // 0-1
  label?: string; // Optional custom label
  /** Team color for the bar (e.g. from player's team) - matches drawing pen */
  teamColor?: string;
}

export default function InkMeter({ fraction, label, teamColor }: InkMeterProps) {
  const pct = Math.round(fraction * 100);
  const barColor = teamColor
    ? teamColor
    : fraction > 0.5
      ? "#1a1a1a"
      : fraction > 0.2
        ? "#f39c12"
        : "#e74c3c";

  return (
    <div className="flex items-center gap-2 flex-1 max-w-xs mx-4">
      <span className="font-hand text-sm whitespace-nowrap">{label || "Ink"}</span>
      <div className="flex-1 h-5 bg-gray-200 rounded-full overflow-hidden border border-gray-400 relative">
        {/* Scribble-style fill */}
        <div
          className="h-full transition-all duration-200 ease-out relative"
          style={{
            width: `${pct}%`,
            backgroundColor: barColor,
          }}
        >
          {/* Wavy top edge effect */}
          <svg
            className="absolute top-0 right-0 h-full w-3 translate-x-1"
            viewBox="0 0 10 20"
            preserveAspectRatio="none"
          >
            <path
              d="M0,0 Q5,5 0,10 Q5,15 0,20"
              fill={barColor}
              stroke="none"
            />
          </svg>
        </div>
      </div>
      <span className="font-hand text-sm w-10 text-right">{pct}%</span>
    </div>
  );
}
