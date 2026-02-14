"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import type { Room } from "colyseus.js";
import { createRoom, joinOrCreate } from "@/lib/colyseus";
import { extractSprite, autoDetectBounds } from "@/lib/sprites";
import Lobby from "@/components/Lobby";
import DrawingCanvas from "@/components/DrawingCanvas";
import RevealScreen from "@/components/RevealScreen";
import ResultScreen from "@/components/ResultScreen";
import HealthBar from "@/components/HealthBar";
import AbilityHUD from "@/components/AbilityHUD";
import type { FighterConfig } from "@shared/types";
import Link from "next/link";

// Dynamically import BattleWrapper (Phaser is client-side only)
import dynamic from "next/dynamic";
const BattleWrapper = dynamic(() => import("@/components/BattleWrapper"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-64 font-hand text-2xl text-gray-400">
      Loading battle arena...
    </div>
  ),
});

interface PlayerData {
  id: string;
  name: string;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  ink: number;
  maxInk: number;
  facingRight: boolean;
  isShielding: boolean;
  isReady: boolean;
  drawingSubmitted: boolean;
  fighterName: string;
  fighterDescription: string;
  spriteData: string;
  abilities: { abilityType: string; cooldownRemaining: number; cooldownMax: number; label: string }[];
}

export default function GameRoomPage() {
  const params = useParams();
  const code = params.code as string;

  const [room, setRoom] = useState<Room | null>(null);
  const [phase, setPhase] = useState<string>("connecting");
  const [timer, setTimer] = useState(0);
  const [players, setPlayers] = useState<Map<string, PlayerData>>(new Map());
  const [mySessionId, setMySessionId] = useState<string>("");
  const [roomCode, setRoomCode] = useState<string>("");
  const [winnerId, setWinnerId] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [inkBudget, setInkBudget] = useState(5000);
  const [drawingTimeLimit, setDrawingTimeLimit] = useState(75);

  // Drawing and sprite data
  const [myDrawingData, setMyDrawingData] = useState<string>("");
  const [spriteDataMap, setSpriteDataMap] = useState<Map<string, string>>(new Map());
  const [, setMyFighterConfig] = useState<FighterConfig | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const roomRef = useRef<Room | null>(null);

  // Connect to room
  useEffect(() => {
    let mounted = true;

    const connect = async () => {
      try {
        let r: Room;
        if (code === "new") {
          r = await createRoom({
            inkBudget,
            drawingTimeLimit,
          });
        } else {
          r = await joinOrCreate(code);
        }

        if (!mounted) {
          r.leave();
          return;
        }

        roomRef.current = r;
        setRoom(r);
        setMySessionId(r.sessionId);
        setPhase("lobby");

        // Listen for state changes
        r.onStateChange((state: Record<string, unknown>) => {
          if (!mounted) return;
          setPhase(state.phase as string);
          setTimer(Math.ceil(state.timer as number));
          setRoomCode(state.roomCode as string);
          setWinnerId(state.winnerId as string);
          setInkBudget(state.inkBudget as number);
          setDrawingTimeLimit(state.drawingTimeLimit as number);

          const newPlayers = new Map<string, PlayerData>();
          (state.players as { forEach: (cb: (p: Record<string, unknown>, id: string) => void) => void }).forEach((p: Record<string, unknown>, id: string) => {
            newPlayers.set(id, {
              id: p.id as string,
              name: p.name as string,
              x: p.x as number,
              y: p.y as number,
              hp: p.hp as number,
              maxHp: p.maxHp as number,
              ink: p.ink as number,
              maxInk: p.maxInk as number,
              facingRight: p.facingRight as boolean,
              isShielding: p.isShielding as boolean,
              isReady: p.isReady as boolean,
              drawingSubmitted: p.drawingSubmitted as boolean,
              fighterName: p.fighterName as string,
              fighterDescription: p.fighterDescription as string,
              spriteData: p.spriteData as string,
              abilities: (p.abilities as Array<Record<string, unknown>> | undefined)?.map((a: Record<string, unknown>) => ({
                abilityType: a.abilityType as string,
                cooldownRemaining: a.cooldownRemaining as number,
                cooldownMax: a.cooldownMax as number,
                label: a.label as string,
              })) || [],
            });
          });
          setPlayers(newPlayers);
        });

        // Listen for analysis trigger
        r.onMessage("startAnalysis", () => {
          if (myDrawingData) {
            analyzeDrawing(r, myDrawingData);
          }
        });

        r.onError((code, message) => {
          console.error("Room error:", code, message);
          setError(`Connection error: ${message}`);
        });

        r.onLeave(() => {
          if (mounted) {
            setPhase("disconnected");
          }
        });
      } catch (err) {
        if (mounted) {
          console.error("Failed to connect:", err);
          setError(`Failed to connect: ${err instanceof Error ? err.message : "Unknown error"}`);
          setPhase("error");
        }
      }
    };

    connect();

    return () => {
      mounted = false;
      if (roomRef.current) {
        roomRef.current.leave();
      }
    };
  }, [code]); // eslint-disable-line react-hooks/exhaustive-deps

  // Analyze drawing with AI
  const analyzeDrawing = useCallback(
    async (r: Room, imageData: string) => {
      setIsAnalyzing(true);
      try {
        // Call AI analysis API
        const response = await fetch("/api/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageData }),
        });

        const config: FighterConfig = await response.json();
        setMyFighterConfig(config);

        // Extract sprite from drawing
        let spriteData: string;
        try {
          spriteData = await extractSprite(imageData, config.spriteBounds);
        } catch {
          // Fallback to auto-detect bounds
          const bounds = await autoDetectBounds(imageData);
          spriteData = await extractSprite(imageData, bounds);
        }

        // Send config and sprite to server
        r.send("fighterConfig", config);
        r.send("submitDrawing", { imageData, spriteData });

        // Update local sprite map
        setSpriteDataMap((prev) => {
          const next = new Map(prev);
          next.set(r.sessionId, spriteData);
          return next;
        });
      } catch (err) {
        console.error("Analysis failed:", err);
        // Send fallback
        r.send("fighterConfig", {
          name: "Scribble Warrior",
          description: "A brave scribble!",
          health: { maxHp: 100 },
          movement: { speed: 3, type: "walk" },
          abilities: [
            { type: "melee", params: { damage: 15, range: 40, cooldown: 0.8 } },
            { type: "fireProjectile", params: { damage: 10, cooldown: 1.5, speed: 5, label: "Ink Blast" } },
          ],
          spriteBounds: { x: 0, y: 0, width: 100, height: 100 },
          balanceScore: 5,
        });
      } finally {
        setIsAnalyzing(false);
      }
    },
    []
  );

  // Handle drawing submission
  const handleDrawingSubmit = useCallback(
    (imageData: string) => {
      setMyDrawingData(imageData);
      if (room) {
        room.send("submitDrawing", { imageData });
      }
    },
    [room]
  );

  // Handle ready up
  const handleReady = useCallback(() => {
    if (room) {
      room.send("ready", {});
    }
  }, [room]);

  // Handle play again
  const handlePlayAgain = useCallback(() => {
    if (room) {
      room.send("playAgain", {});
      setMyDrawingData("");
      setMyFighterConfig(null);
      setSpriteDataMap(new Map());
    }
  }, [room]);

  // Copy room code
  const handleCopyCode = useCallback(() => {
    navigator.clipboard.writeText(roomCode).catch(() => {
      // Fallback
      const input = document.createElement("input");
      input.value = roomCode;
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      document.body.removeChild(input);
    });
  }, [roomCode]);

  // Get my player data
  const myPlayer = players.get(mySessionId);
  const opponentPlayer = Array.from(players.values()).find((p) => p.id !== mySessionId);

  // Get available abilities for battle controls
  const myAbilities = myPlayer?.abilities?.map((a) => a.abilityType) || [];

  // Build sprite data map from all players
  useEffect(() => {
    const newMap = new Map<string, string>();
    players.forEach((p, id) => {
      if (p.spriteData) {
        newMap.set(id, p.spriteData);
      }
    });
    if (newMap.size > 0) {
      setSpriteDataMap((prev) => {
        const merged = new Map(prev);
        newMap.forEach((v, k) => merged.set(k, v));
        return merged;
      });
    }
  }, [players]);

  // Error state
  if (phase === "error" || error) {
    return (
      <main className="flex flex-col items-center justify-center min-h-screen gap-6 p-8">
        <h1 className="text-4xl font-bold text-red-500">Oops!</h1>
        <p className="text-xl text-gray-600">{error || "Something went wrong"}</p>
        <Link href="/" className="sketchy-button bg-yellow-300 px-6 py-3 text-xl">
          Back to Home
        </Link>
      </main>
    );
  }

  // Connecting state
  if (phase === "connecting") {
    return (
      <main className="flex flex-col items-center justify-center min-h-screen gap-4">
        <h1 className="text-4xl font-bold text-gray-600 animate-pulse">
          Connecting<span className="loading-dots"></span>
        </h1>
      </main>
    );
  }

  // Disconnected
  if (phase === "disconnected") {
    return (
      <main className="flex flex-col items-center justify-center min-h-screen gap-6 p-8">
        <h1 className="text-4xl font-bold text-gray-500">Disconnected</h1>
        <Link href="/" className="sketchy-button bg-yellow-300 px-6 py-3 text-xl">
          Back to Home
        </Link>
      </main>
    );
  }

  return (
    <main className="flex flex-col min-h-screen">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-3 border-b border-gray-300">
        <Link href="/" className="text-2xl font-bold text-gray-800 hover:text-gray-600">
          Scribble Fighters
        </Link>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-500">
            Room: <span className="font-bold text-gray-800">{roomCode}</span>
          </span>
          <span className="text-sm text-gray-400">
            {players.size}/2 players
          </span>
        </div>
      </header>

      {/* Main content - changes based on phase */}
      <div className="flex-1 flex flex-col">
        {/* LOBBY PHASE */}
        {phase === "lobby" && (
          <Lobby
            roomCode={roomCode}
            playerCount={players.size}
            isReady={myPlayer?.isReady || false}
            onReady={handleReady}
            onCopyCode={handleCopyCode}
            inkBudget={inkBudget}
            drawingTimeLimit={drawingTimeLimit}
            isHost={code === "new"}
          />
        )}

        {/* DRAWING PHASE */}
        {phase === "drawing" && (
          <div className="flex-1 flex flex-col p-4">
            <div className="text-center mb-2">
              <h2 className="text-3xl font-bold text-gray-800">
                Draw your champion!
              </h2>
              <p className="text-lg text-gray-500">
                Draw a creature, add attacks (arrows + &quot;+fire&quot;), annotate abilities
              </p>
            </div>
            <div className="flex-1">
              <DrawingCanvas
                inkBudget={inkBudget}
                onSubmit={handleDrawingSubmit}
                timeRemaining={timer}
                disabled={myPlayer?.drawingSubmitted || false}
              />
            </div>
            {myPlayer?.drawingSubmitted && (
              <div className="text-center py-4">
                <p className="text-xl text-green-600 font-bold">
                  Drawing submitted! Waiting for opponent...
                </p>
              </div>
            )}
          </div>
        )}

        {/* ANALYZING PHASE */}
        {phase === "analyzing" && (
          <div className="flex-1 flex flex-col items-center justify-center gap-6">
            <h2 className="text-4xl font-bold text-gray-800 animate-pulse">
              AI is analyzing your creation<span className="loading-dots"></span>
            </h2>
            <p className="text-xl text-gray-500">
              {isAnalyzing
                ? "Determining abilities and stats..."
                : "Preparing for battle..."}
            </p>
            <div className="wobble">
              <svg width="80" height="80" viewBox="0 0 80 80">
                <circle
                  cx="40"
                  cy="40"
                  r="30"
                  fill="none"
                  stroke="#1a1a1a"
                  strokeWidth="3"
                  strokeDasharray="10 5"
                >
                  <animateTransform
                    attributeName="transform"
                    type="rotate"
                    from="0 40 40"
                    to="360 40 40"
                    dur="2s"
                    repeatCount="indefinite"
                  />
                </circle>
              </svg>
            </div>
          </div>
        )}

        {/* REVEAL PHASE */}
        {phase === "reveal" && (
          <RevealScreen
            fighter1={{
              name: myPlayer?.fighterName || "Your Fighter",
              description: myPlayer?.fighterDescription || "",
              maxHp: myPlayer?.maxHp || 100,
              abilities: myPlayer?.abilities?.map((a) => a.label || a.abilityType) || [],
              spriteData: spriteDataMap.get(mySessionId),
            }}
            fighter2={{
              name: opponentPlayer?.fighterName || "Opponent",
              description: opponentPlayer?.fighterDescription || "",
              maxHp: opponentPlayer?.maxHp || 100,
              abilities: opponentPlayer?.abilities?.map((a) => a.label || a.abilityType) || [],
              spriteData: opponentPlayer?.id ? spriteDataMap.get(opponentPlayer.id) : undefined,
            }}
            timer={timer}
          />
        )}

        {/* BATTLE PHASE */}
        {phase === "battle" && room && (
          <div className="flex-1 flex flex-col gap-3 p-4">
            {/* HP Bars */}
            <div className="flex items-start justify-between gap-8 px-4">
              <HealthBar
                hp={myPlayer?.hp || 0}
                maxHp={myPlayer?.maxHp || 100}
                name={myPlayer?.fighterName || "You"}
                side="left"
              />
              <span className="text-2xl font-bold text-gray-400 mt-2">VS</span>
              <HealthBar
                hp={opponentPlayer?.hp || 0}
                maxHp={opponentPlayer?.maxHp || 100}
                name={opponentPlayer?.fighterName || "Opponent"}
                side="right"
              />
            </div>

            {/* Battle Arena */}
            <BattleWrapper
              room={room}
              mySessionId={mySessionId}
              playerAbilities={myAbilities}
              spriteDataMap={spriteDataMap}
            />

            {/* Ability HUD */}
            <div className="flex justify-center">
              <AbilityHUD
                abilities={
                  myPlayer?.abilities?.map((a) => ({
                    type: a.abilityType,
                    label: a.label || a.abilityType,
                    cooldownRemaining: a.cooldownRemaining,
                    cooldownMax: a.cooldownMax,
                  })) || []
                }
                ink={myPlayer?.ink || 0}
                maxInk={myPlayer?.maxInk || 100}
              />
            </div>
          </div>
        )}

        {/* RESULT PHASE */}
        {phase === "result" && (
          <ResultScreen
            winnerId={winnerId}
            mySessionId={mySessionId}
            playerNames={
              new Map(Array.from(players.entries()).map(([id, p]) => [id, p.fighterName || p.name]))
            }
            onPlayAgain={handlePlayAgain}
            timer={timer}
          />
        )}
      </div>
    </main>
  );
}
