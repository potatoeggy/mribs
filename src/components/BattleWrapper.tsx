"use client";

import React, { useRef, useEffect, useCallback, useState } from "react";
import type { Room } from "colyseus.js";
import type { GestureMove } from "@shared/types";
import BattleGestureControls from "./BattleGestureControls";
import SummonDrawingModal from "./SummonDrawingModal";

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
  /** Seconds remaining until attacks enabled (Ready... START countdown) */
  battleCountdownRemaining?: number;
}

const SUMMON_INK_COST = 50;

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
  mySessionId,
  playerAbilities: _playerAbilities,
  spriteDataMap,
  gestureMoves = [],
  onCommentary,
  battleCountdownRemaining = 0,
}: BattleWrapperProps) {
  const battleReady = battleCountdownRemaining <= 0;
  const containerRef = useRef<HTMLDivElement>(null);
  const arenaWrapperRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<import("phaser").Game | null>(null);
  const roomRef = useRef(room);
  const pointerRef = useRef<{ x: number; y: number; t: number } | null>(null);
  const lastCommentaryRef = useRef(0);
  const onCommentaryRef = useRef(onCommentary);
  onCommentaryRef.current = onCommentary;
  const COMMENTARY_COOLDOWN_MS = 900;
  /** Set false for instant commentary (preset only); true for AI-generated variety (adds ~300-600ms). */
  const USE_AI_COMMENTARY = false;
  roomRef.current = room;

  // Summon modal state
  const [isSummonModalOpen, setIsSummonModalOpen] = useState(false);
  const [isSummoning, setIsSummoning] = useState(false);
  const [myInk, setMyInk] = useState(0);

  const maybeCommentary = useCallback(async (context: {
    eventType: "attack" | "damage" | "death";
    attackerName?: string;
    targetName?: string;
    action?: string;
    amount?: number;
  }, presetLine: string) => {
    const cb = onCommentaryRef.current;
    if (!cb) return;
    const now = Date.now();
    if (now - lastCommentaryRef.current < COMMENTARY_COOLDOWN_MS) return;
    lastCommentaryRef.current = now;

    let line = presetLine;
    if (USE_AI_COMMENTARY) {
      try {
        const res = await Promise.race([
          fetch("/api/commentary", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(context),
          }),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error("timeout")), 300)
          ),
        ]);
        if (res.ok) {
          const data = await (res as Response).json();
          if (data?.line) line = data.line;
        }
      } catch {
        /* use preset */
      }
    }
    cb(line);
  }, []);

  const ATTACK_COOLDOWN_MS = 2000;
  const [attackCooldownUntil, setAttackCooldownUntil] = useState(0);
  const attackCooldownUntilRef = useRef(0);
  attackCooldownUntilRef.current = attackCooldownUntil;

  const isOnAttackCooldown = useCallback(() => Date.now() < attackCooldownUntilRef.current, []);

  const getMoveByGesture = useCallback(
    (gesture: "tap" | "swipe" | "draw") => gestureMoves.find((m) => m.gesture === gesture),
    [gestureMoves]
  );

  const onGestureAttack = useCallback(
    (moveId: string, drawingData?: string) => {
      if (!battleReady) return;
      const now = Date.now();
      if (now < attackCooldownUntilRef.current) return;
      const until = now + ATTACK_COOLDOWN_MS;
      attackCooldownUntilRef.current = until;
      setAttackCooldownUntil(until);
      room.send("gestureAttack", { moveId, drawingData });
    },
    [room, attackCooldownUntil, battleReady]
  );

  const handleOverlayPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!gestureMoves.length || !battleReady || isOnAttackCooldown()) return;
      const rect = arenaWrapperRef.current?.getBoundingClientRect();
      if (!rect) return;
      pointerRef.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
        t: Date.now(),
      };
    },
    [gestureMoves.length, battleReady]
  );

  const handleOverlayPointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (!pointerRef.current || !gestureMoves.length || !battleReady || isOnAttackCooldown()) return;
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
    [gestureMoves.length, getMoveByGesture, onGestureAttack, isOnAttackCooldown, battleReady]
  );

  const handleSummonSubmit = useCallback(async (imageData: string) => {
    setIsSummoning(true);

    try {
      // Analyze the drawing with AI
      const response = await fetch("/api/analyzeSummon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageData }),
      });

      if (!response.ok) {
        throw new Error("Failed to analyze drawing");
      }

      const { config } = await response.json();

      // Extract sprite from the drawing
      const spriteData = extractSprite(imageData, config.spriteBounds);

      // Send to server
      room.send("summonFighter", { config, spriteData });

      setIsSummonModalOpen(false);
    } catch (error) {
      console.error("Failed to summon fighter:", error);
      alert("Failed to summon fighter. Please try again.");
    } finally {
      setIsSummoning(false);
    }
  }, [room]);

  const extractSprite = (imageData: string, bounds: { x: number; y: number; width: number; height: number }): string => {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return imageData;

    const img = new Image();
    img.src = imageData;

    // Wait for image to load synchronously (for demo purposes)
    // In production, you'd want to handle this async
    canvas.width = bounds.width;
    canvas.height = bounds.height;

    try {
      ctx.drawImage(
        img,
        bounds.x,
        bounds.y,
        bounds.width,
        bounds.height,
        0,
        0,
        bounds.width,
        bounds.height
      );
      return canvas.toDataURL("image/png");
    } catch {
      return imageData;
    }
  };

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
            if (event.type === "meleeHit") {
              // Play autoattack melee visual effect
              const attackerId = event.playerId as string;
              const targetId = event.targetId as string;
              if (attackerId && targetId) {
                scene.playAutoMeleeEffect(attackerId, targetId);
              }

              const targetPlayer = players.get(targetId);
              if (targetPlayer) {
                scene.showDamageNumber(
                  targetPlayer.x,
                  targetPlayer.y - 20,
                  (event.amount as number) || 0
                );
              }

              const amount = (event.amount as number) || 0;
              if (onCommentaryRef.current && targetId && amount > 0) {
                const attackerName = getName(attackerId);
                const targetName = getName(targetId);
                maybeCommentary(
                  { eventType: "attack", attackerName, targetName, action: "strike", amount },
                  pick(COMMENTARY_LINES.attack)(attackerName, targetName, "strike")
                );
              }
            }
            if (event.type === "damage") {
              scene.showDamageNumber(
                (event.x as number) || 400,
                (event.y as number) || 300,
                (event.amount as number) || 0
              );
              const targetId = event.targetId as string | undefined;
              const amount = (event.amount as number) || 0;
              if (onCommentaryRef.current && targetId && amount > 0) {
                const name = getName(targetId);
                maybeCommentary(
                  { eventType: "damage", targetName: name, amount },
                  pick(COMMENTARY_LINES.damage)(name, amount)
                );
              }
            }
            if (event.type === "projectileSpawn") {
              // Play autoattack projectile visual effect
              const attackerId = event.playerId as string;
              if (attackerId) {
                scene.playAutoProjectileEffect(attackerId);
              }
            }
            if (event.type === "death") {
              scene.showDeathAnimation(event.playerId as string);
              if (onCommentaryRef.current) {
                const name = getName(event.playerId as string);
                maybeCommentary(
                  { eventType: "death", targetName: name },
                  pick(COMMENTARY_LINES.death)(name)
                );
              }
            }
          }
        });

        currentRoom.onMessage("gestureAttackVisual", (data: Record<string, unknown>) => {
          if (!scene) return;
          const { players } = parseRoomState(currentRoom);
          const getName = (id: string) => players.get(id)?.fighterName || "Fighter";

          if (onCommentaryRef.current) {
            const attacker = getName(data.playerId as string);
            const target = getName(data.targetId as string);
            const action = (data.action as string) || "attack";
            maybeCommentary(
              { eventType: "attack", attackerName: attacker, targetName: target, action },
              pick(COMMENTARY_LINES.attack)(attacker, target, action)
            );
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

        currentRoom.onMessage("fighterSummoned", (data: Record<string, unknown>) => {
          if (!scene) return;

          const fighterId = data.fighterId as string;
          const spriteData = data.spriteData as string | undefined;
          const config = data.config as Record<string, unknown>;

          if (spriteData) {
            scene.loadFighterSprite(fighterId, spriteData);
          }

          // Show summon effect
          scene.showSummonEffect(data.x as number, data.y as number);

          if (onCommentaryRef.current && config) {
            maybeCommentary(
              { eventType: "attack", attackerName: config.name as string, targetName: "battle", action: "enters" },
              `${config.name} has entered the battle!`
            );
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

  // Update cooldown display every 100ms while on cooldown
  const [cooldownRemaining, setCooldownRemaining] = useState(0);
  useEffect(() => {
    if (attackCooldownUntil <= 0) {
      setCooldownRemaining(0);
      return;
    }
    const tick = () => {
      const remaining = Math.max(0, (attackCooldownUntil - Date.now()) / 1000);
      setCooldownRemaining(remaining);
    };
    tick();
    const id = setInterval(tick, 100);
    return () => clearInterval(id);
  }, [attackCooldownUntil]);

  // Track player's ink
  useEffect(() => {
    const updateInk = () => {
      const { players } = parseRoomState(room);
      const myPlayer = players.get(mySessionId);
      if (myPlayer) {
        setMyInk(myPlayer.ink);
      }
    };

    updateInk();
    room.onStateChange(updateInk);

    return () => {
      room.onStateChange.clear();
    };
  }, [room, mySessionId]);

  return (
    <div className="flex flex-col items-center gap-2 w-full">
      <div
        ref={arenaWrapperRef}
        className="relative w-full max-w-[800px] aspect-[8/5] border-2 border-gray-800 rounded-lg overflow-hidden shadow-lg"
      >
        <div ref={containerRef} className="absolute inset-0" />
        {battleCountdownRemaining > 0 && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 pointer-events-none z-10">
            <div className="font-hand text-5xl font-bold text-white drop-shadow-lg text-center animate-pulse">
              {battleCountdownRemaining > 5
                ? "Ready..."
                : battleCountdownRemaining > 4
                  ? "3"
                  : battleCountdownRemaining > 3
                    ? "2"
                    : battleCountdownRemaining > 2
                      ? "1"
                      : "START!!!"}
            </div>
          </div>
        )}

        {/* Autoattack indicator */}
        {battleReady && (
          <div className="absolute bottom-2 left-2 px-3 py-1.5 rounded-lg bg-black/70 text-white font-hand text-sm font-bold pointer-events-none">
            ⚔️ Autoattacking
          </div>
        )}

        {/* Summon button */}
        {battleReady && (
          <button
            onClick={() => setIsSummonModalOpen(true)}
            disabled={myInk < SUMMON_INK_COST || isSummoning}
            className="absolute bottom-2 right-2 px-4 py-2 bg-purple-500 hover:bg-purple-600 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-hand font-bold text-sm rounded-lg transition-colors border-2 border-white shadow-lg flex items-center gap-2"
          >
            ✨ Summon ({SUMMON_INK_COST} ink)
          </button>
        )}
      </div>

      {/* Summon modal */}
      <SummonDrawingModal
        isOpen={isSummonModalOpen}
        onClose={() => setIsSummonModalOpen(false)}
        onSubmit={handleSummonSubmit}
        inkCost={SUMMON_INK_COST}
        currentInk={myInk}
      />
    </div>
  );
}
