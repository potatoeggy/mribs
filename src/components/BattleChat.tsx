"use client";

import React, { useState, useRef, useEffect } from "react";
import type { Room } from "colyseus.js";

interface ChatMessage {
  sessionId: string;
  name: string;
  text: string;
}

interface BattleChatProps {
  room: Room;
  /** Optional display name (for players; spectators can set in input) */
  defaultName?: string;
  className?: string;
  /** Sidebar layout: fills height, no max-height on messages */
  sidebar?: boolean;
}

export default function BattleChat({
  room,
  defaultName = "",
  className = "",
  sidebar = false,
}: BattleChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [name, setName] = useState(defaultName || "Spectator");
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (msg: ChatMessage) => {
      setMessages((prev) => [...prev.slice(-49), msg]);
    };
    const remove = room.onMessage("chat", handler);
    return () => {
      if (typeof remove === "function") remove();
    };
  }, [room]);

  useEffect(() => {
    listRef.current?.scrollTo(0, listRef.current.scrollHeight);
  }, [messages]);

  const send = (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text) return;
    room.send("chat", { text, name });
    setInput("");
  };

  const mySessionId = room.sessionId;

  return (
    <div
      className={`flex flex-col overflow-hidden ${sidebar ? "h-full min-h-0 border-0 rounded-none shadow-none" : "border-2 border-gray-300 rounded-xl bg-white/95 shadow-lg"} ${className}`}
    >
      {/* Top bar: title + name input */}
      <div className="px-2 py-2 border-b border-gray-200 bg-gray-50 shrink-0 flex flex-col gap-1.5">
        <p className="font-hand text-lg font-bold text-gray-700">
          💬 Live Chat
        </p>
        <label className="flex items-center gap-4 min-w-0 w-full">
          <span className="font-hand text-lg font-bold text-gray-500 shrink-0">
            Name
          </span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value.slice(0, 20))}
            placeholder="Your name"
            className="font-hand flex-1 min-w-0 h-8 px-2 text-xs border border-gray-300 rounded bg-white"
          />
        </label>
      </div>
      <div
        ref={listRef}
        className={`flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-2 space-y-1 bg-[#fefef6] ${sidebar ? "" : "max-h-[200px]"}`}
      >
        {messages.length === 0 ? (
          <p className="font-hand text-lg text-gray-400 text-center py-3">
            No messages yet. Say something!
          </p>
        ) : (
          (() => {
            const groups: {
              sessionId: string;
              name: string;
              texts: string[];
            }[] = [];
            for (const m of messages) {
              const last = groups[groups.length - 1];
              if (last?.sessionId === m.sessionId) {
                last.texts.push(m.text);
              } else {
                groups.push({
                  sessionId: m.sessionId,
                  name: m.name,
                  texts: [m.text],
                });
              }
            }
            return groups.map((g, gi) => {
              const isMe = g.sessionId === mySessionId;
              return (
                <div
                  key={gi}
                  className={`flex flex-col gap-0.5 rounded px-1.5 py-1 -mx-0.5 ${
                    isMe ? "bg-yellow-50/80 border-l-2 border-yellow-500" : ""
                  }`}
                >
                  <span
                    className={`font-hand text-base font-bold leading-tight ${
                      isMe ? "text-yellow-800" : "text-gray-600"
                    }`}
                  >
                    {g.name}
                    {isMe && " (You)"}
                  </span>
                  {g.texts.map((text, ti) => (
                    <span
                      key={ti}
                      className="font-hand text-lg text-gray-800 break-words leading-snug"
                    >
                      {text}
                    </span>
                  ))}
                </div>
              );
            });
          })()
        )}
      </div>
      <form
        onSubmit={send}
        className="p-1.5 border-t border-gray-200 bg-white flex gap-1.5 shrink-0"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value.slice(0, 200))}
          placeholder="Type a message..."
          className="font-hand flex-1 min-w-0 px-2 py-1.5 text-lg border border-gray-300 rounded-lg bg-white"
          maxLength={200}
        />
        <button
          type="submit"
          className="font-hand px-3 py-1.5 text-lg font-bold bg-yellow-300 border-2 border-yellow-600 rounded-lg hover:bg-yellow-400 transition-colors shrink-0"
        >
          Send
        </button>
      </form>
    </div>
  );
}
