"use client";

import React, { useState } from "react";

interface LobbyProps {
  roomCode: string;
  playerCount: number;
  isReady: boolean;
  onReady: () => void;
  onCopyCode: () => void;
  inkBudget: number;
  drawingTimeLimit: number;
  onConfigChange?: (config: {
    inkBudget: number;
    drawingTimeLimit: number;
  }) => void;
  isHost?: boolean;
  /** Spectator view: no ready/config, show spectator link */
  isSpectator?: boolean;
  onCopySpectatorLink?: () => void;
  /** Host/player: show "Share spectator link" alongside room code */
  spectatorUrl?: string;
  onCopySpectatorLinkAsHost?: () => void;
}

export default function Lobby({
  roomCode,
  playerCount,
  isReady,
  onReady,
  onCopyCode,
  inkBudget,
  drawingTimeLimit,
  onConfigChange,
  isHost,
  isSpectator = false,
  onCopySpectatorLink,
  spectatorUrl,
  onCopySpectatorLinkAsHost,
}: LobbyProps) {
  const [copied, setCopied] = useState(false);
  const [copiedSpectator, setCopiedSpectator] = useState(false);
  const [copiedSpectatorHost, setCopiedSpectatorHost] = useState(false);

  const handleCopy = () => {
    onCopyCode();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopySpectator = () => {
    onCopySpectatorLink?.();
    setCopiedSpectator(true);
    setTimeout(() => setCopiedSpectator(false), 2000);
  };

  const handleCopySpectatorAsHost = () => {
    onCopySpectatorLinkAsHost?.();
    setCopiedSpectatorHost(true);
    setTimeout(() => setCopiedSpectatorHost(false), 2000);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-8 px-4">
      <h1 className="font-hand text-6xl font-bold text-gray-800 text-center leading-tight">
        Scribble Fighters
      </h1>
      <p className="font-hand text-xl text-gray-500 text-center max-w-md">
        Draw your champion, bring it to life, and fight!
      </p>

      {/* Room code */}
      <div className="flex flex-col items-center gap-2">
        <p className="font-hand text-lg text-gray-600">
          {isSpectator ? "Watching Room:" : "Room Code:"}
        </p>
        <button
          onClick={handleCopy}
          className="sketchy-button bg-white text-4xl font-hand font-bold tracking-[0.3em] px-8 py-4 border-2 border-gray-800 hover:bg-gray-100 transition-colors"
        >
          {roomCode || "..."}
        </button>
        <p className="font-hand text-sm text-gray-400">
          {copied ? "Copied!" : "Click to copy"}
        </p>
        {!isSpectator && spectatorUrl && onCopySpectatorLinkAsHost && (
          <button
            onClick={handleCopySpectatorAsHost}
            className="font-hand text-md px-3 py-1.5 rounded-lg bg-blue-100 border border-blue-400 text-blue-800 hover:bg-blue-200 transition-colors mt-1"
          >
            {copiedSpectatorHost ? "Copied!" : "📺 Copy spectator link"}
          </button>
        )}
      </div>

      {/* Player status */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <div
            className={`w-4 h-4 rounded-full ${playerCount >= 1 ? "bg-green-500" : "bg-gray-300"}`}
          />
          <span className="font-hand text-lg">Player 1</span>
        </div>
        <span className="font-hand text-2xl text-gray-400">VS</span>
        <div className="flex items-center gap-2">
          <div
            className={`w-4 h-4 rounded-full ${playerCount >= 2 ? "bg-green-500" : "bg-gray-300"}`}
          />
          <span className="font-hand text-lg">
            {playerCount >= 2 ? "Player 2" : "Waiting..."}
          </span>
        </div>
      </div>

      {/* Spectator link */}
      {isSpectator && onCopySpectatorLink && (
        <button
          onClick={handleCopySpectator}
          className="font-hand text-md px-4 py-2 rounded-lg bg-blue-100 border-2 border-blue-400 text-blue-800 hover:bg-blue-200 transition-colors"
        >
          {copiedSpectator ? "Copied!" : "📺 Copy spectator link"}
        </button>
      )}

      {/* Game config (host only) */}
      {!isSpectator && isHost && onConfigChange && (
        <div className="flex flex-col items-center gap-3 p-4 border border-dashed border-gray-400 rounded-lg bg-white">
          <p className="font-hand text-lg font-bold text-gray-700">
            Game Settings
          </p>
          <div className="flex items-center gap-3">
            <label className="font-hand text-sm text-gray-600">Ink:</label>
            <input
              type="range"
              min={2000}
              max={10000}
              step={1000}
              value={inkBudget}
              onChange={(e) =>
                onConfigChange({
                  inkBudget: Number(e.target.value),
                  drawingTimeLimit,
                })
              }
              className="w-32"
            />
            <span className="font-hand text-sm w-12">{inkBudget}</span>
          </div>
          <div className="flex items-center gap-3">
            <label className="font-hand text-sm text-gray-600">Time:</label>
            <input
              type="range"
              min={30}
              max={120}
              step={15}
              value={drawingTimeLimit}
              onChange={(e) =>
                onConfigChange({
                  inkBudget,
                  drawingTimeLimit: Number(e.target.value),
                })
              }
              className="w-32"
            />
            <span className="font-hand text-sm w-12">{drawingTimeLimit}s</span>
          </div>
        </div>
      )}

      {/* Ready button (hidden for spectators) */}
      {!isSpectator && (
        <>
          <button
            onClick={onReady}
            disabled={isReady || playerCount < 2}
            className={`sketchy-button font-hand text-2xl px-10 py-4 transition-all ${
              isReady
                ? "bg-green-300 border-green-600 text-green-800"
                : playerCount < 2
                  ? "bg-gray-200 border-gray-400 text-gray-400"
                  : "bg-yellow-300 border-yellow-600 text-yellow-800 hover:bg-yellow-400 hover:scale-105"
            }`}
          >
            {isReady
              ? "Ready!"
              : playerCount < 2
                ? "Waiting for opponent..."
                : "Ready Up!"}
          </button>

          {isReady && playerCount >= 2 && (
            <p className="font-hand text-gray-500 animate-pulse">
              Waiting for opponent to ready up...
            </p>
          )}
        </>
      )}

      {isSpectator && (
        <p className="font-hand text-gray-500">
          👀 Spectating — waiting for players to start...
        </p>
      )}
    </div>
  );
}
