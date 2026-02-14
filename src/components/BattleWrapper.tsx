"use client";

import React, { useRef, useEffect, useCallback } from "react";
import type { Room } from "colyseus.js";
import type { GestureMove } from "@shared/types";
import BattleGestureControls from "./BattleGestureControls";

const TAP_MAX_MS = 250;
const TAP_MAX_DIST = 20;
const SWIPE_MIN_DIST = 40;

const COMMENTARY_LINES = {
  attack: [
    (a: string, t: string, action: string) => `Ohhh! ${a} just hit ${t} with a ${action}!`,
    (a: string, t: string, action: string) => `And ${a} lands a ${action} on ${t}!`,
    (a: string, t: string, action: string) => `Whoa, ${a} with the ${action}—${t} felt that one!`,
  ],
  damage: [
    (name: string, amt: number) => `${name} takes ${amt} damage!`,
    (name: string, amt: number) => `Ouch! ${amt} damage to ${name}!`,
    (name: string, amt: number) => `There it is—${amt} damage on ${name}!`,
  ],
  death: [
    (name: string) => `K.O! ${name} is down!`,
    (name: string) => `And that's the fight! ${name} goes down!`,
    (name: string) => `Game over for ${name}! What a finish!`,
  ],
  lowHp: [
    (name: string) => `${name} is lookin' rough, they're gonna die soon!`,
    (name: string) => `${name} is on their last legs here!`,
    (name: string) => `Uh oh, ${name} is low—one more hit could do it!`,
  ],
};

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

interface BattleWrapperProps {
  room: Room;
  mySessionId: string;
  playerAbilities: string[];
  spriteDataMap: Map<string, string>;
  gestureMoves?: GestureMove[];
  /** Callback to speak commentary lines (e.g. LiveCommentator) */
  onCommentary?: (line: string) => void;
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
  onCommentary,
}: BattleWrapperProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const arenaWrapperRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<import("phaser").Game | null>(null);
  const roomRef = useRef(room);
  const pointerRef = useRef<{ x: number; y: number; t: number } | null>(null);
  const lastCommentaryRef = useRef(0);
  const onCommentaryRef = useRef(onCommentary);
  onCommentaryRef.current = onCommentary;
  const COMMENTARY_COOLDOWN_MS = 2500;
  roomRef.current = room;

  const maybeCommentary = useCallback((line: string) => {
    const cb = onCommentaryRef.current;
    if (!cb) return;
    const now = Date.now();
    if (now - lastCommentaryRef.current < COMMENTARY_COOLDOWN_MS) return;
    lastCommentaryRef.current = now;
    cb(line);
  }, []);

  const getMoveByGesture = useCallback(
    (gesture: "tap" | "swipe" | "draw") => gestureMoves.find((m) => m.gesture === gesture),
    [gestureMoves]
  );

  const onGestureAttack = useCallback(
    (moveId: string, drawingData?: string) => {
      room.send("gestureAttack", { moveId, drawingData });
    },
    [room]
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
          const { players } = parseRoomState(currentRoom);
          const getName = (id: string) => players.get(id)?.fighterName || "Fighter";

          for (const event of events) {
            if (event.type === "damage" || event.type === "meleeHit") {
              scene.showDamageNumber(
                (event.x as number) || 400,
                (event.y as number) || 300,
                (event.amount as number) || 0
              );
              const targetId = event.targetId as string | undefined;
              const amount = (event.amount as number) || 0;
              if (onCommentary && targetId && amount > 0) {
                const name = getName(targetId);
                maybeCommentary(pick(COMMENTARY_LINES.damage)(name, amount));
              }
            }
            if (event.type === "death") {
              scene.showDeathAnimation(event.playerId as string);
              if (onCommentary) {
                const name = getName(event.playerId as string);
                maybeCommentary(pick(COMMENTARY_LINES.death)(name));
              }
            }
          }
        });

        currentRoom.onMessage("gestureAttackVisual", (data: Record<string, unknown>) => {
          if (!scene) return;
          const { players } = parseRoomState(currentRoom);
          const getName = (id: string) => players.get(id)?.fighterName || "Fighter";

          if (onCommentary) {
            const attacker = getName(data.playerId as string);
            const target = getName(data.targetId as string);
            const action = (data.action as string) || "attack";
            maybeCommentary(pick(COMMENTARY_LINES.attack)(attacker, target, action));
          }

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
        <BattleGestureControls gestureMoves={gestureMoves} onGestureAttack={onGestureAttack} />
      )}
    </div>
  );
}
