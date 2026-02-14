"use client";

import React from "react";

interface Ability {
  type: string;
  label: string;
  cooldownRemaining: number;
  cooldownMax: number;
}

interface AbilityHUDProps {
  abilities: Ability[];
  ink: number;
  maxInk: number;
}

const ABILITY_ICONS: Record<string, string> = {
  fireProjectile: "🔥",
  melee: "⚔️",
  shield: "🛡️",
  dash: "💨",
  flying: "🪽",
};

export default function AbilityHUD({ abilities, ink, maxInk }: AbilityHUDProps) {
  const inkFraction = Math.max(0, ink / maxInk);
  const inkPct = Math.round(inkFraction * 100);

  return (
    <div className="flex items-center gap-4">
      {/* Ink bar */}
      <div className="flex items-center gap-2">
        <span className="font-hand text-sm text-gray-600">Ink</span>
        <div className="w-24 h-4 bg-gray-200 rounded-full overflow-hidden border border-gray-400">
          <div
            className="h-full bg-blue-500 transition-all duration-200"
            style={{ width: `${inkPct}%` }}
          />
        </div>
      </div>

      {/* Abilities */}
      <div className="flex gap-2">
        {abilities.map((ability, i) => {
          const isReady = ability.cooldownRemaining <= 0;
          const cdFraction = isReady
            ? 0
            : ability.cooldownRemaining / Math.max(ability.cooldownMax, 0.01);

          return (
            <div
              key={i}
              className={`relative w-12 h-12 flex items-center justify-center border-2 rounded-lg font-hand text-xs ${
                isReady
                  ? "border-gray-800 bg-white"
                  : "border-gray-400 bg-gray-200 opacity-50"
              }`}
            >
              <span className="text-lg">
                {ABILITY_ICONS[ability.type] || "?"}
              </span>
              {!isReady && (
                <div
                  className="absolute inset-0 bg-gray-800 rounded-lg"
                  style={{
                    opacity: 0.3,
                    clipPath: `inset(${(1 - cdFraction) * 100}% 0 0 0)`,
                  }}
                />
              )}
              <span className="absolute -bottom-4 text-[10px] text-gray-500 whitespace-nowrap">
                {ability.label || ability.type}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
