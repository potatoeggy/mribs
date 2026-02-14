"use client";

import React, { useRef, useEffect, useCallback } from "react";
import type { Room } from "colyseus.js";
import { mapGestureToAbility, getGestureHelp } from "@/lib/gestures";
import type { GestureType } from "@shared/types";

interface BattleWrapperProps {
  room: Room;
  mySessionId: string;
  playerAbilities: string[]; // available ability types for the local player
  spriteDataMap: Map<string, string>; // playerId -> sprite data URL
}

export default function BattleWrapper({
  room,
  mySessionId: _mySessionId,
  playerAbilities,
  spriteDataMap,
}: BattleWrapperProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<import("phaser").Game | null>(null);
  const sceneRef = useRef<InstanceType<typeof import("@/game/scenes/BattleScene").BattleScene> | null>(null);

  // Handle gesture -> send ability or move to server
  const handleGesture = useCallback(
    (gesture: {
      type: string;
      startX: number;
      startY: number;
      endX: number;
      endY: number;
      velocity: number;
    }) => {
      if (!room) return;

      const mapping = mapGestureToAbility(gesture.type as GestureType, playerAbilities);

      if (mapping) {
        // Send ability command
        room.send("ability", {
          abilityType: mapping.abilityType,
          targetX: gesture.endX,
          targetY: gesture.endY,
        });
      } else {
        // Send move command (drag to move)
        room.send("move", {
          targetX: gesture.endX,
          targetY: gesture.endY,
        });
      }
    },
    [room, playerAbilities]
  );

  useEffect(() => {
    let game: import("phaser").Game | null = null;

    const initPhaser = async () => {
      if (!containerRef.current) return;

      // Dynamic import for client-side only
      const phaserModule = await import("phaser");
      const { BattleScene } = await import("@/game/scenes/BattleScene");
      const { createPhaserConfig } = await import("@/game/config");

      const config = createPhaserConfig(containerRef.current, [BattleScene]);
      game = new phaserModule.default.Game(config);
      gameRef.current = game;

      // Wait for scene to be ready
      game.events.on("ready", () => {
        const scene = game!.scene.getScene("BattleScene") as InstanceType<typeof BattleScene>;
        sceneRef.current = scene;

        // Set up gesture callback
        scene.setGestureCallback(handleGesture);

        // Load fighter sprites
        spriteDataMap.forEach((spriteData, playerId) => {
          if (spriteData) {
            scene.loadFighterSprite(playerId, spriteData);
          }
        });
      });
    };

    initPhaser();

    return () => {
      if (game) {
        game.destroy(true);
        gameRef.current = null;
        sceneRef.current = null;
      }
    };
  }, [handleGesture, spriteDataMap]);

  // Listen for state changes from room and update the scene
  useEffect(() => {
    if (!room) return;

    const onStateChange = () => {
      if (!sceneRef.current) return;

      const state = room.state as Record<string, unknown>;
      const players = new Map<string, {
        x: number;
        y: number;
        hp: number;
        maxHp: number;
        ink: number;
        maxInk: number;
        facingRight: boolean;
        isShielding: boolean;
        fighterName: string;
        abilities: { abilityType: string; cooldownRemaining: number; cooldownMax: number; label: string }[];
      }>();

      const playersMap = state.players as { forEach?: (cb: (p: Record<string, unknown>, id: string) => void) => void } | undefined;
      if (playersMap && typeof playersMap.forEach === "function") {
        playersMap.forEach((p: Record<string, unknown>, id: string) => {
          players.set(id, {
            x: p.x as number,
            y: p.y as number,
            hp: p.hp as number,
            maxHp: p.maxHp as number,
            ink: p.ink as number,
            maxInk: p.maxInk as number,
            facingRight: p.facingRight as boolean,
            isShielding: p.isShielding as boolean,
            fighterName: p.fighterName as string,
            abilities: (p.abilities as Array<Record<string, unknown>> | undefined)?.map((a: Record<string, unknown>) => ({
              abilityType: a.abilityType as string,
              cooldownRemaining: a.cooldownRemaining as number,
              cooldownMax: a.cooldownMax as number,
              label: a.label as string,
            })) || [],
          });
        });
      }

      const projectiles = ((state.projectiles as Array<Record<string, unknown>>) || []).map((p: Record<string, unknown>) => ({
        id: p.id as string,
        x: p.x as number,
        y: p.y as number,
        ownerId: p.ownerId as string,
      }));

      sceneRef.current.updateState({ players, projectiles });
    };

    room.onStateChange(onStateChange);

    // Listen for battle events
    room.onMessage("battleEvents", (events: Array<Record<string, unknown>>) => {
      if (!sceneRef.current) return;
      for (const event of events) {
        if (event.type === "damage" || event.type === "meleeHit") {
          sceneRef.current.showDamageNumber(
            (event.x as number) || 400,
            (event.y as number) || 300,
            (event.amount as number) || 0
          );
        }
        if (event.type === "death") {
          sceneRef.current.showDeathAnimation(event.playerId as string);
        }
      }
    });

    return () => {
      room.removeAllListeners();
    };
  }, [room]);

  const gestureHelp = getGestureHelp(playerAbilities);

  return (
    <div className="flex flex-col items-center gap-2 w-full">
      {/* Battle canvas */}
      <div
        ref={containerRef}
        className="w-full max-w-[800px] aspect-8/5 border-2 border-gray-800 rounded-lg overflow-hidden shadow-lg"
        style={{ touchAction: "none" }}
      />

      {/* Controls help */}
      <div className="flex gap-4 flex-wrap justify-center text-sm font-hand text-gray-600">
        {gestureHelp.map((h, i) => (
          <div key={i} className="flex items-center gap-1">
            <span className="font-bold text-gray-800">{h.gesture}</span>
            <span>→</span>
            <span>{h.action}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
