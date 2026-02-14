"use client";

import React, { useRef, useEffect, useCallback, useState } from "react";
import type { Room } from "colyseus.js";
import type { GestureMove } from "@shared/types";
import BattleGestureControls from "./BattleGestureControls";

const TAP_MAX_MS = 250;
const TAP_MAX_DIST = 20;
const SWIPE_MIN_DIST = 40;
const GESTURE_COOLDOWN_MS = 1200;

interface BattleWrapperProps {
  room: Room;
  mySessionId: string;
  playerAbilities: string[];
  spriteDataMap: Map<string, string>;
  gestureMoves?: GestureMove[];
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
  gestureMoves = [],
}: BattleWrapperProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const arenaWrapperRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<import("phaser").Game | null>(null);
  const roomRef = useRef(room);
  const pointerRef = useRef<{ x: number; y: number; t: number } | null>(null);
  roomRef.current = room;

  const cooldownEndsRef = useRef<Record<string, number>>({});
  const [cooldownProgress, setCooldownProgress] = useState<Record<string, number>>({});
  const rafRef = useRef<number>(0);
  const loopRunningRef = useRef(false);

  const ensureCooldownLoop = useCallback(() => {
    if (loopRunningRef.current) return;
    loopRunningRef.current = true;
    const tick = () => {
      const now = Date.now();
      const ends = cooldownEndsRef.current;
      let hasActive = false;
      const next: Record<string, number> = {};
      for (const id in ends) {
        const remaining = ends[id] - now;
        if (remaining > 0) {
          next[id] = remaining / GESTURE_COOLDOWN_MS;
          hasActive = true;
        }
      }
      setCooldownProgress(next);
      if (hasActive) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        loopRunningRef.current = false;
      }
    };
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  useEffect(() => {
    return () => {
      cancelAnimationFrame(rafRef.current);
      loopRunningRef.current = false;
    };
  }, []);

  const getMoveByGesture = useCallback(
    (gesture: "tap" | "swipe" | "draw") => gestureMoves.find((m) => m.gesture === gesture),
    [gestureMoves]
  );

  const onGestureAttack = useCallback(
    (moveId: string, drawingData?: string) => {
      room.send("gestureAttack", { moveId, drawingData });
      const now = Date.now();
      if (now >= (cooldownEndsRef.current[moveId] ?? 0)) {
        cooldownEndsRef.current[moveId] = now + GESTURE_COOLDOWN_MS;
      }
      ensureCooldownLoop();
    },
    [room, ensureCooldownLoop]
  );

  const handleOverlayPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!gestureMoves.length) return;
      const rect = arenaWrapperRef.current?.getBoundingClientRect();
      if (!rect) return;
      pointerRef.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
        t: Date.now(),
      };
    },
    [gestureMoves.length]
  );

  const handleOverlayPointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (!pointerRef.current || !gestureMoves.length) return;
      const rect = arenaWrapperRef.current?.getBoundingClientRect();
      if (!rect) return;
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const dx = x - pointerRef.current.x;
      const dy = y - pointerRef.current.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const duration = Date.now() - pointerRef.current.t;
      pointerRef.current = null;

      if (duration <= TAP_MAX_MS && dist <= TAP_MAX_DIST) {
        const move = getMoveByGesture("tap");
        if (move) onGestureAttack(move.id);
      } else if (dist >= SWIPE_MIN_DIST) {
        const move = getMoveByGesture("swipe");
        if (move) onGestureAttack(move.id);
      }
    },
    [gestureMoves.length, getMoveByGesture, onGestureAttack]
  );

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

        currentRoom.onMessage("gestureAttackVisual", (data: Record<string, unknown>) => {
          if (!scene) return;
          scene.playGestureAttackVisual({
            playerId: data.playerId as string,
            targetId: data.targetId as string,
            gesture: data.gesture as string,
            action: data.action as string,
            power: data.power as number,
            drawingData: data.drawingData as string | undefined,
          });
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
        ref={arenaWrapperRef}
        className="relative w-full max-w-[800px] aspect-[8/5] border-2 border-gray-800 rounded-lg overflow-hidden shadow-lg"
      >
        <div ref={containerRef} className="absolute inset-0" />
        {gestureMoves.length > 0 && (
          <div
            className="absolute inset-0 touch-none cursor-crosshair"
            onPointerDown={handleOverlayPointerDown}
            onPointerUp={handleOverlayPointerUp}
            onPointerLeave={() => { pointerRef.current = null; }}
            onPointerCancel={() => { pointerRef.current = null; }}
          />
        )}
      </div>
      {gestureMoves.length > 0 && (
        <BattleGestureControls gestureMoves={gestureMoves} onGestureAttack={onGestureAttack} cooldownProgress={cooldownProgress} />
      )}
    </div>
  );
}
