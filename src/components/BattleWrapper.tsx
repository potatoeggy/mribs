"use client";

import React, { useRef, useEffect } from "react";
import type { Room } from "colyseus.js";

interface BattleWrapperProps {
  room: Room;
  mySessionId: string;
  playerAbilities: string[];
  spriteDataMap: Map<string, string>;
}

function parseRoomState(room: Room) {
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

  (state.players as { forEach: (cb: (p: Record<string, unknown>, id: string) => void) => void }).forEach((p: Record<string, unknown>, id: string) => {
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

  const projectiles = ((state.projectiles as Array<Record<string, unknown>>) || []).map((p: Record<string, unknown>) => ({
    id: p.id as string,
    x: p.x as number,
    y: p.y as number,
    ownerId: p.ownerId as string,
  }));

  return { players, projectiles };
}

export default function BattleWrapper({
  room,
  mySessionId: _mySessionId,
  playerAbilities: _playerAbilities,
  spriteDataMap,
}: BattleWrapperProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<import("phaser").Game | null>(null);
  const roomRef = useRef(room);
  roomRef.current = room;

  useEffect(() => {
    let game: import("phaser").Game | null = null;
    let scene: InstanceType<typeof import("@/game/scenes/BattleScene").BattleScene> | null = null;

    const initPhaser = async () => {
      if (!containerRef.current) return;

      const phaserModule = await import("phaser");
      const { BattleScene } = await import("@/game/scenes/BattleScene");
      const { createPhaserConfig } = await import("@/game/config");

      const config = createPhaserConfig(containerRef.current, [BattleScene]);
      game = new phaserModule.default.Game(config);
      gameRef.current = game;

      game.events.on("ready", () => {
        scene = game!.scene.getScene("BattleScene") as InstanceType<typeof BattleScene>;

        spriteDataMap.forEach((spriteData, playerId) => {
          if (spriteData) {
            scene!.loadFighterSprite(playerId, spriteData);
          }
        });

        const currentRoom = roomRef.current;
        if (!currentRoom) return;

        scene.updateState(parseRoomState(currentRoom));

        currentRoom.onStateChange(() => {
          if (!scene) return;
          scene.updateState(parseRoomState(currentRoom));
        });

        currentRoom.onMessage("battleEvents", (events: Array<Record<string, unknown>>) => {
          if (!scene) return;
          for (const event of events) {
            if (event.type === "damage" || event.type === "meleeHit") {
              scene.showDamageNumber(
                (event.x as number) || 400,
                (event.y as number) || 300,
                (event.amount as number) || 0
              );
            }
            if (event.type === "death") {
              scene.showDeathAnimation(event.playerId as string);
            }
          }
        });
      });
    };

    initPhaser();

    return () => {
      scene = null;
      if (game) {
        game.destroy(true);
        gameRef.current = null;
      }
    };
  }, [spriteDataMap]);

  return (
    <div className="flex flex-col items-center gap-2 w-full">
      <div
        ref={containerRef}
        className="w-full max-w-[800px] aspect-[8/5] border-2 border-gray-800 rounded-lg overflow-hidden shadow-lg"
      />
    </div>
  );
}
