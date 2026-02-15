"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams } from "next/navigation";
import type { Room } from "colyseus.js";
import { joinAsSpectator } from "@/lib/colyseus";
import OpponentCanvas from "@/components/OpponentCanvas";
import RevealScreen from "@/components/RevealScreen";
import ResultScreen from "@/components/ResultScreen";
import InkBar from "@/components/InkBar";
import BattleChat from "@/components/BattleChat";
import type { Stroke } from "@/lib/ink";
import Link from "next/link";
import dynamic from "next/dynamic";

const LiveCommentator = dynamic(() => import("@/components/LiveCommentator"), {
  ssr: false,
});

const BattleWrapper = dynamic(() => import("@/components/BattleWrapper"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-64 font-hand text-2xl text-gray-400">
      Loading battle arena...
    </div>
  ),
});

const Lobby = dynamic(() => import("@/components/Lobby"), { ssr: false });

interface GestureMoveSummary {
  action: string;
  power: number;
}

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
  gestureMoveSummary: string;
  teamColor: string;
  abilities: {
    abilityType: string;
    cooldownRemaining: number;
    cooldownMax: number;
    label: string;
  }[];
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

const AVATAR_ID = "0930fd59-c8ad-434d-ad53-b391a1768720";

export default function SpectatorPage() {
  const params = useParams();
  const code = (params.code as string)?.toUpperCase();
  const isInvalidCode = !code || code === "new";

  const [room, setRoom] = useState<Room | null>(null);
  const [phase, setPhase] = useState<string>("connecting");
  const [timer, setTimer] = useState(0);
  const [players, setPlayers] = useState<Map<string, PlayerData>>(new Map());
  const [summonedFighters, setSummonedFighters] = useState<
    Map<string, SummonedFighterData>
  >(new Map());
  const [roomCode, setRoomCode] = useState<string>("");
  const [winnerId, setWinnerId] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [inkBudget, setInkBudget] = useState(5000);
  const [drawingTimeLimit, setDrawingTimeLimit] = useState(75);
  const [showResultScreen, setShowResultScreen] = useState(false);
  /** Strokes per player (ownerId -> Stroke[]) for spectator drawing view */
  const [strokesMap, setStrokesMap] = useState<Map<string, Stroke[]>>(
    new Map(),
  );
  const [drawingRoundKey, setDrawingRoundKey] = useState(0);
  const [battleCountdown, setBattleCountdown] = useState(0);
  const [player1Ink, setPlayer1Ink] = useState(0);
  const [player2Ink, setPlayer2Ink] = useState(0);

  const roomRef = useRef<Room | null>(null);
  const commentatorRef = useRef<{ speak: (text: string) => void } | null>(null);
  const previousPhaseRef = useRef<string>("");
  const resultPhaseStartRef = useRef<number>(0);
  const playerInkInitializedRef = useRef(false);
  const battleCountdownStartRef = useRef<number>(0);
  const settersRef = useRef({
    setStrokesMap,
    setPlayer1Ink,
    setPlayer2Ink,
    setBattleCountdown,
  });
  useEffect(() => {
    settersRef.current = {
      setStrokesMap,
      setPlayer1Ink,
      setPlayer2Ink,
      setBattleCountdown,
    };
  }, []);
  const RESULT_DELAY_MS = 1700;
  const BATTLE_COUNTDOWN_SEC = 6;

  // Battle-start commentator intro (spectators get the commentator)
  useEffect(() => {
    if (phase !== "battle") return;
    const t = setTimeout(async () => {
      try {
        const res = await fetch("/api/commentary", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ eventType: "battleStart" }),
        });
        const data = await res.json();
        const line = data?.line || "Let's get ready to rumble!";
        commentatorRef.current?.speak(line);
      } catch {
        commentatorRef.current?.speak("Let's get ready to rumble!");
      }
    }, BATTLE_COUNTDOWN_SEC * 1000);
    return () => clearTimeout(t);
  }, [phase]);

  const spectatorUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/room/${code}/spectator`
      : "";

  const handleCopySpectatorLink = useCallback(() => {
    if (spectatorUrl) {
      navigator.clipboard.writeText(spectatorUrl).catch(() => {
        const input = document.createElement("input");
        input.value = spectatorUrl;
        document.body.appendChild(input);
        input.select();
        document.execCommand("copy");
        document.body.removeChild(input);
      });
    }
  }, [spectatorUrl]);

  useEffect(() => {
    if (isInvalidCode) return;

    let mounted = true;

    const connect = async () => {
      try {
        const r = await joinAsSpectator(code);

        if (!mounted) {
          r.leave();
          return;
        }

        roomRef.current = r;
        setRoom(r);
        setPhase("lobby");
        setStrokesMap(new Map());
        setDrawingRoundKey((k) => k + 1);

        r.onStateChange((state: Record<string, unknown>) => {
          if (!mounted) return;
          const newPhase = state.phase as string;
          const prevPhase = previousPhaseRef.current;
          previousPhaseRef.current = newPhase;
          const s = settersRef.current;
          setPhase(newPhase);
          setTimer(Math.ceil(state.timer as number));
          setRoomCode(state.roomCode as string);
          setWinnerId(state.winnerId as string);
          if (newPhase === "result") {
            if (prevPhase !== "result") {
              setShowResultScreen(false);
              resultPhaseStartRef.current = Date.now();
            }
          } else {
            setShowResultScreen(false);
          }
          if (newPhase === "lobby" && prevPhase !== "lobby") {
            s.setStrokesMap(new Map());
          }
          if (newPhase === "drawing" && prevPhase !== "drawing") {
            s.setStrokesMap(new Map());
          }
          if (newPhase !== "battle" && newPhase !== "result") {
            s.setPlayer1Ink(0);
            s.setPlayer2Ink(0);
            playerInkInitializedRef.current = false;
            s.setBattleCountdown(0);
          }
          if (newPhase === "battle" && prevPhase !== "battle") {
            battleCountdownStartRef.current = Date.now();
          }
          setInkBudget(state.inkBudget as number);
          setDrawingTimeLimit(state.drawingTimeLimit as number);

          const newPlayers = new Map<string, PlayerData>();
          (
            state.players as {
              forEach: (
                cb: (p: Record<string, unknown>, id: string) => void,
              ) => void;
            }
          ).forEach((p: Record<string, unknown>, id: string) => {
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
              gestureMoveSummary: (p.gestureMoveSummary as string) || "",
              teamColor: (p.teamColor as string) || "#1a1a1a",
              abilities:
                (
                  p.abilities as Array<Record<string, unknown>> | undefined
                )?.map((a: Record<string, unknown>) => ({
                  abilityType: a.abilityType as string,
                  cooldownRemaining: a.cooldownRemaining as number,
                  cooldownMax: a.cooldownMax as number,
                  label: a.label as string,
                })) || [],
            });
          });
          setPlayers(newPlayers);

          if (newPhase === "battle" && !playerInkInitializedRef.current) {
            const pList = Array.from(newPlayers.values());
            if (pList[0]) setPlayer1Ink(pList[0].ink);
            if (pList[1]) setPlayer2Ink(pList[1].ink);
            playerInkInitializedRef.current = true;
          }

          const newSummonedFighters = new Map<string, SummonedFighterData>();
          (
            state.summonedFighters as {
              forEach: (
                cb: (f: Record<string, unknown>, id: string) => void,
              ) => void;
            }
          )?.forEach((f: Record<string, unknown>, id: string) => {
            newSummonedFighters.set(id, {
              id: f.id as string,
              ownerId: f.ownerId as string,
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
          setSummonedFighters(newSummonedFighters);
        });

        r.onMessage(
          "drawingStroke",
          (data: { ownerId: string; action: string; stroke?: Stroke }) => {
            if (!mounted) return;
            setStrokesMap((prev) => {
              const next = new Map(prev);
              const strokes = [...(next.get(data.ownerId) || [])];
              if (data.action === "stroke" && data.stroke) {
                strokes.push(data.stroke);
              } else if (data.action === "undo") {
                strokes.pop();
              } else if (data.action === "clear") {
                strokes.length = 0;
              }
              next.set(data.ownerId, strokes);
              return next;
            });
          },
        );

        r.onMessage(
          "fighterSummoned",
          (data: { ownerId?: string; inkCost?: number }) => {
            if (!mounted) return;
            const inkCost = data.inkCost;
            if (data.ownerId && typeof inkCost === "number") {
              const state = r.state as unknown as {
                players: Map<string, unknown>;
              };
              const ids = Array.from(state?.players?.keys() ?? []);
              const idx = ids.indexOf(data.ownerId);
              if (idx === 0)
                setPlayer1Ink((prev) => Math.max(0, prev - inkCost));
              else if (idx === 1)
                setPlayer2Ink((prev) => Math.max(0, prev - inkCost));
            }
          },
        );

        r.onError((errCode, message) => {
          console.error("Room error:", errCode, message);
          setError(`Connection error: ${message}`);
        });

        r.onLeave(() => {
          if (mounted) setPhase("disconnected");
        });
      } catch (err) {
        if (mounted) {
          console.error("Failed to connect:", err);
          setError(
            `Failed to connect: ${err instanceof Error ? err.message : "Unknown error"}`,
          );
          setPhase("error");
        }
      }
    };

    connect();

    return () => {
      mounted = false;
      if (roomRef.current) roomRef.current.leave();
    };
  }, [code, isInvalidCode]);

  useEffect(() => {
    if (phase !== "result" || showResultScreen) return;
    const start = resultPhaseStartRef.current || Date.now();
    resultPhaseStartRef.current = start;
    const id = setInterval(() => {
      if (Date.now() - start >= RESULT_DELAY_MS) {
        setShowResultScreen(true);
      }
    }, 150);
    return () => clearInterval(id);
  }, [phase, showResultScreen]);

  useEffect(() => {
    if (phase !== "battle") return;
    const tick = () => {
      const elapsed = (Date.now() - battleCountdownStartRef.current) / 1000;
      const remaining = Math.max(0, BATTLE_COUNTDOWN_SEC - elapsed);
      setBattleCountdown(remaining);
    };
    const id = setInterval(tick, 100);
    return () => clearInterval(id);
  }, [phase]);

  // Stable spriteDataMap: only update when sprite data content changes, not on every state
  // tick. Otherwise BattleWrapper's Phaser game would destroy/recreate every tick.
  const spriteDataKey = Array.from(players.entries())
    .filter(([, p]) => p.spriteData)
    .map(([id, p]) => `${id}:${(p.spriteData as string).length}`)
    .sort()
    .join("|");
  const [spriteDataMap, setSpriteDataMap] = useState<Map<string, string>>(
    () => new Map(),
  );
  useEffect(() => {
    const next = new Map<string, string>();
    players.forEach((p, id) => {
      if (p.spriteData) next.set(id, p.spriteData);
    });
    setSpriteDataMap(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- spriteDataKey only: avoid updating on every state tick (would destroy Phaser)
  }, [spriteDataKey]);

  const playerList = Array.from(players.values());
  const player1 = playerList[0];
  const player2 = playerList[1];

  if (phase === "error" || error) {
    return (
      <main className="flex flex-col items-center justify-center min-h-screen gap-6 p-8">
        <h1 className="font-hand text-4xl font-bold text-red-500 shake">
          Oops!
        </h1>
        <p className="font-hand text-xl text-gray-600 text-center">
          {error || "Something went wrong"}
        </p>
        <Link
          href="/"
          className="sketchy-button bg-yellow-300 px-6 py-3 text-xl font-hand hover:bg-yellow-400 hover:shadow-[4px_4px_0_#1a1a1a] transition-all hover:-translate-y-0.5"
        >
          Back to Home
        </Link>
      </main>
    );
  }

  if (phase === "connecting") {
    return (
      <main className="flex flex-col items-center justify-center min-h-screen gap-4">
        <h1 className="font-hand text-4xl font-bold text-gray-600 animate-pulse">
          Connecting as spectator<span className="loading-dots"></span>
        </h1>
        <div className="wobble mt-4">
          <svg
            width="60"
            height="60"
            viewBox="0 0 80 80"
            className="opacity-40"
          >
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
                dur="1.5s"
                repeatCount="indefinite"
              />
            </circle>
          </svg>
        </div>
      </main>
    );
  }

  if (phase === "disconnected") {
    return (
      <main className="flex flex-col items-center justify-center min-h-screen gap-6 p-8">
        <h1 className="font-hand text-4xl font-bold text-gray-500">
          Disconnected
        </h1>
        <Link
          href="/"
          className="sketchy-button bg-yellow-300 px-6 py-3 text-xl font-hand hover:bg-yellow-400 hover:shadow-[4px_4px_0_#1a1a1a] transition-all hover:-translate-y-0.5"
        >
          Back to Home
        </Link>
      </main>
    );
  }

  return (
    <main className="flex flex-col h-screen overflow-hidden">
      <header className="shrink-0 flex items-center justify-between px-6 py-3 border-b-2 border-gray-300 bg-white/80 backdrop-blur-sm shadow-[0_2px_0_rgba(0,0,0,0.05)]">
        <Link
          href="/"
          className="font-hand text-2xl font-bold text-gray-800 hover:text-gray-600 transition-colors duration-200"
        >
          Scribble Fighters
        </Link>
        <div className="flex items-center gap-4">
          <span className="px-3 py-1 rounded-full bg-blue-100 text-blue-800 font-hand text-sm font-bold border-2 border-blue-200 animate-pulse">
            👀 SPECTATOR
          </span>
          <span className="text-sm text-gray-500">
            Room: <span className="font-bold text-gray-800">{roomCode}</span>
          </span>
          <span className="text-sm text-gray-400">
            {players.size}/2 players
          </span>
        </div>
      </header>

      <div className="flex-1 flex min-h-0 overflow-hidden">
        <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-auto">
          {phase === "lobby" && (
            <Lobby
              roomCode={roomCode}
              playerCount={players.size}
              isReady={false}
              onReady={() => {}}
              onCopyCode={() => navigator.clipboard.writeText(roomCode)}
              inkBudget={inkBudget}
              drawingTimeLimit={drawingTimeLimit}
              isSpectator
              onCopySpectatorLink={handleCopySpectatorLink}
            />
          )}

          {phase === "drawing" && (
            <div className="flex-1 flex flex-col p-4 gap-2 animate-fade-in-up">
              <div className="flex items-center justify-between">
                <h2 className="font-hand text-2xl font-bold text-gray-800">
                  Watch them draw!
                </h2>
                <div className="font-hand text-2xl font-bold tabular-nums">
                  {Math.floor(timer / 60)}:
                  {(timer % 60).toString().padStart(2, "0")}
                </div>
              </div>
              <div className="flex gap-4 flex-1 min-h-0">
                {playerList.map((p) => (
                  <div key={p.id} className="flex-1 flex flex-col min-w-0">
                    <p className="font-hand text-base text-gray-500 text-center mb-1">
                      {p.name}&apos;s Drawing
                    </p>
                    <div className="flex-1 min-h-0">
                      <OpponentCanvas
                        key={`spectator-drawing-${drawingRoundKey}-${p.id}`}
                        strokes={strokesMap.get(p.id) || []}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {phase === "analyzing" && (
            <div className="flex-1 flex flex-col items-center justify-center gap-6 p-8 animate-fade-in-up">
              <h2 className="font-hand text-4xl font-bold text-gray-800 animate-pulse">
                AI is analyzing...
              </h2>
              {timer > 0 && (
                <p className="text-lg text-gray-500">
                  Battle starts in {timer}s
                </p>
              )}
              <div className="flex gap-8 w-full justify-center max-w-3xl">
                {playerList.map((p) => {
                  let moves: GestureMoveSummary[] = [];
                  try {
                    if (p.gestureMoveSummary)
                      moves = JSON.parse(
                        p.gestureMoveSummary,
                      ) as GestureMoveSummary[];
                  } catch {
                    /* ignore */
                  }
                  return (
                    <div
                      key={p.id}
                      className="flex-1 flex flex-col items-center gap-3 border border-gray-300 rounded-lg p-5 bg-white max-w-xs"
                    >
                      {spriteDataMap.get(p.id) ? (
                        // eslint-disable-next-line @next/next/no-img-element -- dynamic base64 sprite data
                        <img
                          src={spriteDataMap.get(p.id)}
                          alt={p.fighterName || p.name}
                          className="w-28 h-28 object-contain border border-gray-200 rounded-lg bg-gray-50 p-2"
                        />
                      ) : (
                        <div className="w-28 h-28 flex items-center justify-center border border-gray-200 rounded-lg bg-gray-50 text-gray-400 text-sm">
                          analyzing...
                        </div>
                      )}
                      <p className="font-bold text-xl text-gray-800">
                        {p.fighterName || p.name}
                      </p>
                      <p className="text-gray-600 text-sm text-center">
                        {p.fighterDescription || "Waiting for analysis..."}
                      </p>
                      {moves.length > 0 && (
                        <ul className="list-none text-xs text-gray-500 space-y-0.5">
                          {moves.map((m, i) => (
                            <li key={i}>{m.action}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {(phase === "reveal" ||
            phase === "battle" ||
            (phase === "result" && !showResultScreen)) && (
            <div className="flex-1 flex flex-col">
              {/* Commentator: mount during reveal so it connects before battle */}
              <div className="shrink-0 px-4 pt-2 flex items-center gap-4">
                <LiveCommentator
                  ref={commentatorRef}
                  avatarId={AVATAR_ID}
                  voiceId={undefined}
                  className="w-[340px] shrink-0"
                />
                {phase === "battle" ||
                (phase === "result" && !showResultScreen) ? (
                  <div className="flex-1 flex items-center justify-center gap-8 min-w-0">
                    <InkBar
                      ink={player1Ink}
                      maxInk={player1?.maxInk || 6000}
                      name={player1?.fighterName || player1?.name || "P1"}
                      side="left"
                      color={player1?.teamColor || "#ef4444"}
                    />
                    <span className="text-2xl font-bold text-gray-400">VS</span>
                    <InkBar
                      ink={player2Ink}
                      maxInk={player2?.maxInk || 6000}
                      name={player2?.fighterName || player2?.name || "P2"}
                      side="right"
                      color={player2?.teamColor || "#3b82f6"}
                    />
                  </div>
                ) : null}
              </div>
              {phase === "reveal" && player1 && player2 && (
                <RevealScreen
                  fighter1={{
                    name: player1.fighterName || "Fighter 1",
                    description: player1.fighterDescription || "",
                    maxHp: player1.maxHp || 100,
                    abilities:
                      player1.abilities?.map((a) => a.label || a.abilityType) ||
                      [],
                    spriteData: spriteDataMap.get(player1.id),
                  }}
                  fighter2={{
                    name: player2.fighterName || "Fighter 2",
                    description: player2.fighterDescription || "",
                    maxHp: player2.maxHp || 100,
                    abilities:
                      player2.abilities?.map((a) => a.label || a.abilityType) ||
                      [],
                    spriteData: spriteDataMap.get(player2.id),
                  }}
                  timer={timer}
                />
              )}
              {(phase === "battle" ||
                (phase === "result" && !showResultScreen)) &&
                room &&
                player1 &&
                player2 && (
                  <div className="flex-1 flex flex-col gap-3 p-4">
                    <BattleWrapper
                      room={room}
                      mySessionId=""
                      spriteDataMap={spriteDataMap}
                      summonedFighters={summonedFighters}
                      battleCountdownRemaining={battleCountdown}
                      onCommentary={(line) =>
                        commentatorRef.current?.speak(line)
                      }
                      spectator
                    />
                  </div>
                )}
            </div>
          )}

          {phase === "result" && showResultScreen && (
            <ResultScreen
              winnerId={winnerId}
              mySessionId=""
              playerNames={
                new Map(
                  Array.from(players.entries()).map(([id, p]) => [
                    id,
                    p.fighterName || p.name,
                  ]),
                )
              }
              timer={timer}
              spectator
            />
          )}
        </div>

        {/* Chat sidebar - right side (Twitch-style) */}
        {room && (
          <div className="w-80 shrink-0 border-l border-gray-200 bg-white flex flex-col min-h-0 overflow-hidden">
            <BattleChat
              room={room}
              defaultName="Spectator"
              className="flex-1 min-h-0 flex flex-col"
              sidebar
            />
          </div>
        )}
      </div>
    </main>
  );
}
