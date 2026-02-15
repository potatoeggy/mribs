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
}

export default function BattleChat({
  room,
  defaultName = "",
  className = "",
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

  return (
    <div
      className={`flex flex-col border-2 border-gray-300 rounded-xl bg-white/95 shadow-lg overflow-hidden ${className}`}
    >
      <div className="px-3 py-2 border-b border-gray-200 bg-gray-50">
        <p className="font-hand text-sm font-bold text-gray-700">💬 Live Chat</p>
      </div>
      <div
        ref={listRef}
        className="flex-1 min-h-[120px] max-h-[200px] overflow-y-auto p-3 space-y-2 bg-[#fefef6]"
      >
        {messages.length === 0 ? (
          <p className="font-hand text-sm text-gray-400 text-center py-4">
            No messages yet. Say something!
          </p>
        ) : (
          messages.map((m, i) => (
            <div key={i} className="flex flex-col gap-0.5">
              <span className="font-hand text-xs font-bold text-gray-600">
                {m.name}
              </span>
              <span className="font-hand text-sm text-gray-800 break-words">
                {m.text}
              </span>
            </div>
          ))
        )}
      </div>
      <form onSubmit={send} className="p-2 border-t border-gray-200 flex gap-2">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value.slice(0, 20))}
          placeholder="Name"
          className="font-hand w-20 px-2 py-1.5 text-sm border border-gray-300 rounded-lg bg-white"
        />
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value.slice(0, 200))}
          placeholder="Type a message..."
          className="font-hand flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded-lg bg-white"
          maxLength={200}
        />
        <button
          type="submit"
          className="font-hand px-3 py-1.5 text-sm font-bold bg-yellow-300 border-2 border-yellow-600 rounded-lg hover:bg-yellow-400 transition-colors"
        >
          Send
        </button>
      </form>
    </div>
  );
}
