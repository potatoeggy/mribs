"use client";

import { Client, Room } from "colyseus.js";

let client: Client | null = null;

const serverHttpUrl =
  (process.env.NEXT_PUBLIC_COLYSEUS_URL || "ws://localhost:2567").replace(/^ws/, "http");

export function getColyseusClient(): Client {
  if (!client) {
    const url = process.env.NEXT_PUBLIC_COLYSEUS_URL || "ws://localhost:2567";
    client = new Client(url);
  }
  return client;
}

async function findRoomIdByCode(code: string): Promise<string> {
  const res = await fetch(`${serverHttpUrl}/rooms/find/${encodeURIComponent(code)}`);
  if (!res.ok) {
    throw new Error(`Room with code "${code}" not found or is full`);
  }
  const data = await res.json();
  return data.roomId;
}

export async function createRoom(options?: Record<string, unknown>): Promise<Room> {
  const c = getColyseusClient();
  return await c.create("game", options);
}

export async function joinRoomById(
  roomId: string,
  options?: Record<string, unknown>,
  retries = 3
): Promise<Room> {
  const c = getColyseusClient();
  for (let i = 0; i < retries; i++) {
    try {
      return await c.joinById(roomId, options ?? {});
    } catch (err) {
      const isLocked = err instanceof Error && err.message.includes("is locked");
      if (!isLocked || i === retries - 1) throw err;
      await new Promise((r) => setTimeout(r, 500 * (i + 1)));
    }
  }
  throw new Error("failed to join room");
}

export async function joinByCode(code: string): Promise<Room> {
  const roomId = await findRoomIdByCode(code);
  return await joinRoomById(roomId);
}

export async function joinOrCreate(
  code?: string,
  options?: Record<string, unknown>
): Promise<Room> {
  if (code && code !== "new") {
    const roomId = await findRoomIdByCode(code);
    return await joinRoomById(roomId, options);
  }
  return await createRoom(options);
}

/** Join an existing room as a spectator (read-only, can chat) */
export async function joinAsSpectator(code: string): Promise<Room> {
  const roomId = await findRoomIdByCode(code);
  const c = getColyseusClient();
  return await c.joinById(roomId, { spectator: true });
}
