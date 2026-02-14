"use client";

import { Client, Room } from "colyseus.js";

let client: Client | null = null;

export function getColyseusClient(): Client {
  if (!client) {
    const url = process.env.NEXT_PUBLIC_COLYSEUS_URL || "ws://localhost:2567";
    client = new Client(url);
  }
  return client;
}

/**
 * Create a new game room with optional config.
 */
export async function createRoom(options?: Record<string, unknown>): Promise<Room> {
  const c = getColyseusClient();
  return await c.create("game", options);
}

/**
 * Join an existing room by its Colyseus room ID.
 */
export async function joinRoomById(roomId: string): Promise<Room> {
  const c = getColyseusClient();
  return await c.joinById(roomId, {});
}

/**
 * Join a room by room code. The server's GameRoom stores roomCode in its state.
 * We use joinOrCreate to either join an existing room or create a new one.
 *
 * For joining by code, we pass the code as an option and let the server handle matching.
 */
export async function joinByCode(code: string): Promise<Room> {
  const c = getColyseusClient();
  // Pass the code as an option; the server can use it for matching
  return await c.join("game", { roomCode: code });
}

/**
 * Create a new room or join by code.
 */
export async function joinOrCreate(
  code?: string,
  options?: Record<string, unknown>
): Promise<Room> {
  const c = getColyseusClient();

  if (code && code !== "new") {
    // Try to join an existing room by code
    try {
      return await c.join("game", { roomCode: code });
    } catch {
      // If join fails, the room might not exist or is full
      throw new Error(`Room with code "${code}" not found or is full`);
    }
  }

  // Create new room
  return await c.create("game", options || {});
}
