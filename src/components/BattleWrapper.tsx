"use client";

import { useRef, useEffect, useCallback, useState } from "react";
import type { Room } from "colyseus.js";

import SummonDrawingModal from "./SummonDrawingModal";
import {
  extractSprite as extractSpriteLib,
  autoDetectBounds,
} from "@/lib/sprites";

const COMMENTARY_LINES = {
  attack: [
    (a: string, t: string, action: string) =>
      `Ohhh! ${a} just hit ${t} with a ${action}!`,
    (a: string, t: string, action: string) =>
      `And ${a} lands a ${action} on ${t}!`,
    (a: string, t: string, action: string) =>
      `Whoa, ${a} with the ${action}—${t} felt that one!`,
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
};

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

interface SummonedFighterData {
  id: string;
  ownerId: string;
  name: string;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  facingRight: boolean;
  spriteData: string;
  teamColor: string;
}

interface BattleWrapperProps {
  room: Room;
  mySessionId: string;
  spriteDataMap: Map<string, string>;
  summonedFighters: Map<string, SummonedFighterData>;
  /** Callback to speak commentary lines (e.g. LiveCommentator) */
  onCommentary?: (line: string) => void;
  /** Seconds remaining until attacks enabled (Ready... START countdown) */
  battleCountdownRemaining?: number;
  /** Called when summon ink changes (for parent to sync InkBar above battle) */
  onSummonInkChange?: (ink: number) => void;
}

const SUMMON_INK_COST = 50;

function parseRoomState(room: Room) {
  const state = room.state as Record<string, unknown>;
  const players = new Map<
    string,
    {
      x: number;
      y: number;
      hp: number;
      maxHp: number;
      ink: number;
      maxInk: number;
      facingRight: boolean;
      isShielding: boolean;
      fighterName: string;
      teamColor?: string;
      abilities: {
        abilityType: string;
        cooldownRemaining: number;
        cooldownMax: number;
        label: string;
      }[];
    }
  >();

  (
    state.players as {
      forEach: (cb: (p: Record<string, unknown>, id: string) => void) => void;
    }
  ).forEach((p: Record<string, unknown>, id: string) => {
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
      teamColor: (p.teamColor as string) || "#1a1a1a",
      abilities:
        (p.abilities as Array<Record<string, unknown>> | undefined)?.map(
          (a: Record<string, unknown>) => ({
            abilityType: a.abilityType as string,
            cooldownRemaining: a.cooldownRemaining as number,
            cooldownMax: a.cooldownMax as number,
            label: a.label as string,
          }),
        ) || [],
    });
  });

  const projectiles = (
    (state.projectiles as Array<Record<string, unknown>>) || []
  ).map((p: Record<string, unknown>) => ({
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
  spriteDataMap,
  onCommentary,
  battleCountdownRemaining = 0,
  onSummonInkChange,
}: BattleWrapperProps) {
  const battleReady = battleCountdownRemaining <= 0;
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<import("phaser").Game | null>(null);
  const roomRef = useRef(room);
  const lastCommentaryRef = useRef(0);
  const onCommentaryRef = useRef(onCommentary);
  onCommentaryRef.current = onCommentary;
  const COMMENTARY_COOLDOWN_MS = 900;
  /** AI-generated commentary = fun & varied. Preset = boring repeats. */
  const USE_AI_COMMENTARY = true;
  roomRef.current = room;

  // Summon modal state

  const [isSummoning, setIsSummoning] = useState(false);
  const [myInk, setMyInk] = useState(0);
  const [myTeamColor, setMyTeamColor] = useState("#1a1a1a");
  /** Summon ink only decreases on SUMMON - not from battle sim (moves/abilities). */
  const battleInkInitializedRef = useRef(false);
  const lastDeductedInkRef = useRef(0);
  const [summonHistory, setSummonHistory] = useState<
    Array<{
      imageData: string;
      inkCost: number;
      config: Record<string, unknown>;
      spriteData: string;
    }>
  >([]);

  const maybeCommentary = useCallback(
    async (
      context: {
        eventType: "attack" | "damage" | "death";
        attackerName?: string;
        targetName?: string;
        action?: string;
        amount?: number;
      },
      presetLine: string,
    ) => {
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
              setTimeout(() => reject(new Error("timeout")), 600),
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
    },
    [],
  );

  const handleSummonSubmit = useCallback(
    async (imageData: string, inkSpent: number) => {
      setIsSummoning(true);

      try {
        // Analyze the drawing with AI
        const response = await fetch("/api/analyzeSummon", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageData, inkSpent }),
        });

        if (!response.ok) {
          throw new Error("Failed to analyze drawing");
        }

        const { config } = await response.json();

        const spriteData = await extractSprite(imageData);

        // Add to history
        setSummonHistory((prev) => [
          ...prev,
          { imageData, inkCost: inkSpent, config, spriteData },
        ]);

        // Send to server with ink cost
        room.send("summonFighter", { config, spriteData, inkCost: inkSpent });
        lastDeductedInkRef.current = inkSpent;
        setMyInk((prev) => Math.max(0, prev - inkSpent));
      } catch (error) {
        console.error("Failed to summon fighter:", error);
        alert("Failed to summon fighter. Please try again.");
      } finally {
        setIsSummoning(false);
      }
    },
    [room],
  );

  const handleRespawnFromHistory = useCallback(
    (index: number) => {
      const summon = summonHistory[index];
      if (!summon || myInk < summon.inkCost) return;

      // Send directly to server
      room.send("summonFighter", {
        config: summon.config,
        spriteData: summon.spriteData,
        inkCost: summon.inkCost,
      });
      lastDeductedInkRef.current = summon.inkCost;
      setMyInk((prev) => Math.max(0, prev - summon.inkCost));
    },
    [room, summonHistory, myInk],
  );

  const extractSprite = async (imageData: string): Promise<string> => {
    try {
      const detectedBounds = await autoDetectBounds(imageData);
      return await extractSpriteLib(imageData, detectedBounds);
    } catch {
      return imageData;
    }
  };

  useEffect(() => {
    let game: import("phaser").Game | null = null;
    let scene: InstanceType<
      typeof import("@/game/scenes/BattleScene").BattleScene
    > | null = null;
    let unsubStateChange: (() => void) | null = null;

    const initPhaser = async () => {
      if (!containerRef.current) return;

      const phaserModule = await import("phaser");
      const { BattleScene } = await import("@/game/scenes/BattleScene");
      const { createPhaserConfig } = await import("@/game/config");

      const config = createPhaserConfig(containerRef.current, [BattleScene]);
      game = new phaserModule.default.Game(config);
      gameRef.current = game;

      game.events.on("ready", () => {
        scene = game!.scene.getScene("BattleScene") as InstanceType<
          typeof BattleScene
        >;

        spriteDataMap.forEach((spriteData, playerId) => {
          if (spriteData) {
            scene!.loadFighterSprite(playerId, spriteData);
          }
        });

        const currentRoom = roomRef.current;
        if (!currentRoom) return;

        // Create a function to get current summoned fighters from state
        const getCurrentSummonedFighters = () => {
          const state = currentRoom.state as Record<string, unknown>;
          const fighters = new Map<
            string,
            {
              id: string;
              name: string;
              x: number;
              y: number;
              hp: number;
              maxHp: number;
              facingRight: boolean;
              spriteData: string;
              teamColor: string;
            }
          >();

          (
            state.summonedFighters as {
              forEach?: (
                cb: (f: Record<string, unknown>, id: string) => void,
              ) => void;
            }
          )?.forEach?.((f: Record<string, unknown>, id: string) => {
            fighters.set(id, {
              id: f.id as string,
              name: f.name as string,
              x: f.x as number,
              y: f.y as number,
              hp: f.hp as number,
              maxHp: f.maxHp as number,
              facingRight: f.facingRight as boolean,
              spriteData: f.spriteData as string,
              teamColor: f.teamColor as string,
            });
          });

          return fighters;
        };

        scene.updateState(
          parseRoomState(currentRoom),
          getCurrentSummonedFighters(),
        );

        const onSceneStateChange = () => {
          if (!scene) return;
          scene.updateState(
            parseRoomState(currentRoom),
            getCurrentSummonedFighters(),
          );
        };
        currentRoom.onStateChange(onSceneStateChange);
        unsubStateChange = () =>
          currentRoom.onStateChange.remove(onSceneStateChange);

        currentRoom.onMessage(
          "battleEvents",
          (events: Array<Record<string, unknown>>) => {
            if (!scene) return;
            const { players } = parseRoomState(currentRoom);
            const summoned = getCurrentSummonedFighters();
            const getName = (id: string) =>
              players.get(id)?.fighterName ?? summoned.get(id)?.name ?? "Fighter";

            for (const event of events) {
              if (event.type === "meleeHit") {
                // Play autoattack melee visual effect
                const attackerId = event.playerId as string;
                const targetId = event.targetId as string;
                if (attackerId && targetId) {
                  scene.playAutoMeleeEffect(attackerId, targetId);
                }

                // Play hit sound
                scene.playSound("hit");

                const targetPlayer = players.get(targetId);
                if (targetPlayer) {
                  scene.showDamageNumber(
                    targetPlayer.x,
                    targetPlayer.y - 20,
                    (event.amount as number) || 0,
                  );
                }

                const amount = (event.amount as number) || 0;
                if (onCommentaryRef.current && targetId && amount > 0) {
                  const attackerName = getName(attackerId);
                  const targetName = getName(targetId);
                  maybeCommentary(
                    {
                      eventType: "attack",
                      attackerName,
                      targetName,
                      action: "strike",
                      amount,
                    },
                    pick(COMMENTARY_LINES.attack)(
                      attackerName,
                      targetName,
                      "strike",
                    ),
                  );
                }
              }
              if (event.type === "damage") {
                scene.showDamageNumber(
                  (event.x as number) || 400,
                  (event.y as number) || 300,
                  (event.amount as number) || 0,
                );
                const attackerId = event.playerId as string | undefined;
                const targetId = event.targetId as string | undefined;
                const amount = (event.amount as number) || 0;
                if (onCommentaryRef.current && targetId && amount > 0) {
                  const attackerName = attackerId ? getName(attackerId) : undefined;
                  const targetName = getName(targetId);
                  maybeCommentary(
                    {
                      eventType: "damage",
                      attackerName,
                      targetName,
                      action: "ranged hit",
                      amount,
                    },
                    pick(COMMENTARY_LINES.damage)(targetName, amount),
                  );
                }
              }
              if (event.type === "projectileSpawn") {
                // Play autoattack projectile visual effect
                const attackerId = event.playerId as string;
                if (attackerId) {
                  scene.playAutoProjectileEffect(attackerId);
                  scene.playSound("projectile");
                }
              }
              if (event.type === "death") {
                scene.showDeathAnimation(event.playerId as string);
                scene.playSound("death");
                if (onCommentaryRef.current) {
                  const name = getName(event.playerId as string);
                  maybeCommentary(
                    { eventType: "death", targetName: name },
                    pick(COMMENTARY_LINES.death)(name),
                  );
                }
              }
              if (event.type === "dash") {
                scene.playDashEffect(
                  event.playerId as string,
                  (event.x as number) || 0,
                  (event.y as number) || 0,
                );
                scene.playSound("dash");
              }
              if (event.type === "chargeStart") {
                scene.playChargeEffect(
                  event.playerId as string,
                  (event.x as number) || 0,
                  (event.y as number) || 0,
                  true,
                );
                scene.playSound("chargeStart");
              }
              if (event.type === "chargeHit") {
                scene.playChargeEffect(
                  event.playerId as string,
                  (event.x as number) || 0,
                  (event.y as number) || 0,
                  false,
                );
                scene.playSound("chargeHit");
              }
              if (event.type === "aoeExplosion") {
                scene.playAOEEffect(
                  (event.x as number) || 0,
                  (event.y as number) || 0,
                  (event.radius as number) || 50,
                );
                scene.playSound("aoeExplosion");
              }
              if (event.type === "special") {
                scene.playSpecialEffect(
                  (event.x as number) || 0,
                  (event.y as number) || 0,
                  (event.effectType as string) || "knockback",
                  event.targetId as string | undefined,
                );
                scene.playSound("special");
              }
            }
          },
        );

        currentRoom.onMessage(
          "fighterSummoned",
          (data: Record<string, unknown>) => {
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
                {
                  eventType: "attack",
                  attackerName: config.name as string,
                  targetName: "battle",
                  action: "enters",
                },
                `${config.name} has entered the battle!`,
              );
            }
          },
        );
      });
    };

    initPhaser();

    return () => {
      scene = null;
      unsubStateChange?.();
      if (game) {
        game.destroy(true);
        gameRef.current = null;
      }
    };
  }, [spriteDataMap]);

  // Track player's ink and team color
  // Ink for SUMMON display: only init from server when battle starts, then only decrease on summon
  // (server's player.ink changes every tick from battle sim moves/abilities - we ignore that)
  useEffect(() => {
    const updatePlayerData = () => {
      const state = room.state as Record<string, unknown>;
      const phase = state.phase as string;
      const { players } = parseRoomState(room);
      const myPlayer = players.get(mySessionId);
      if (!myPlayer) return;

      setMyTeamColor(myPlayer.teamColor || "#1a1a1a");

      if (phase !== "battle") {
        battleInkInitializedRef.current = false;
        return;
      }

      // Only sync ink from server when first entering battle (initial summon budget)
      if (!battleInkInitializedRef.current) {
        setMyInk(myPlayer.ink);
        battleInkInitializedRef.current = true;
      }
      // Otherwise: myInk only changes when user summons (handled in handleSummonSubmit / handleRespawnFromHistory)
    };

    updatePlayerData();
    room.onStateChange(updatePlayerData);

    return () => {
      room.onStateChange.remove(updatePlayerData);
    };
  }, [room, mySessionId]);

  // Revert ink deduction if server rejects summon (e.g. not enough ink race condition)
  useEffect(() => {
    const handler = () => {
      const amount = lastDeductedInkRef.current;
      if (amount > 0) {
        setMyInk((prev) => prev + amount);
        lastDeductedInkRef.current = 0;
      }
    };
    const remove = room.onMessage("summonFailed", handler);
    return remove;
  }, [room]);

  // Notify parent of summon ink changes (for InkBar above battle)
  useEffect(() => {
    onSummonInkChange?.(myInk);
  }, [myInk, onSummonInkChange]);

  return (
    <div className="flex flex-col items-center gap-3 w-full">
      <div
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
      </div>

      {/* Inline summon UI - always visible during battle */}
      {battleReady && (
        <div className="w-full max-w-[800px] flex gap-3">
          {/* Main summon area */}
          <div className="flex-1 p-4 bg-white/90 backdrop-blur-sm border-2 border-gray-800 rounded-lg shadow-lg">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-hand text-lg font-bold text-gray-800">
                Quick Summon
              </h3>
              <span className="font-hand text-sm text-gray-600">
                {myInk.toFixed(0)} ink available
              </span>
            </div>
            {isSummoning && (
              <div className="mb-4 p-3 bg-purple-100 border-2 border-purple-400 rounded-lg">
                <p className="text-purple-700 font-hand font-bold animate-pulse">
                  AI analyzing your summon... ✨
                </p>
              </div>
            )}
            <SummonDrawingModal
              isOpen={true}
              onClose={() => {}}
              onSubmit={handleSummonSubmit}
              inkCost={SUMMON_INK_COST}
              currentInk={myInk}
              inline={true}
              teamColor={myTeamColor}
            />
          </div>

          {/* History sidebar */}
          {summonHistory.length > 0 && (
            <div className="w-48 p-3 bg-white/90 backdrop-blur-sm border-2 border-gray-800 rounded-lg shadow-lg shrink-0">
              <h4 className="font-hand text-sm font-bold text-gray-800 mb-2">
                History
              </h4>
              <div className="flex flex-col gap-2 max-h-[320px] overflow-y-auto overflow-x-visible">
                {summonHistory.map((summon, index) => {
                  const canAfford = myInk >= summon.inkCost;
                  return (
                    <button
                      key={index}
                      onClick={() => handleRespawnFromHistory(index)}
                      disabled={!canAfford}
                      className="p-2 bg-purple-100 hover:bg-purple-200 disabled:bg-gray-200 disabled:cursor-not-allowed border-2 border-purple-400 disabled:border-gray-300 rounded-lg transition-colors text-left min-w-0"
                      title={`${String(summon.config?.name ?? "")} - ${summon.inkCost.toFixed(0)} ink`}
                    >
                      <div
                        className="w-full min-h-[100px] flex items-center justify-center bg-gray-100/50 rounded mb-1"
                        style={{ aspectRatio: "1" }}
                      >
                        <img
                          src={summon.spriteData}
                          alt={String(summon.config?.name ?? "")}
                          className="max-w-full max-h-[120px] w-auto h-auto object-contain"
                        />
                      </div>
                      <p className="font-hand text-xs text-center mt-1 truncate">
                        {String(summon.config?.name ?? "")}
                      </p>
                      <p className="font-hand text-xs text-center text-gray-600">
                        {summon.inkCost.toFixed(0)} ink
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
