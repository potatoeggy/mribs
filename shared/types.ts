// ============================================
// Shared types between client and server
// ============================================

// --- Game Phases ---
export type GamePhase = 
  | "lobby"
  | "drawing"
  | "analyzing"
  | "reveal"
  | "battle"
  | "result";

// --- Component Types ---
export type ComponentType = 
  | "movement"
  | "flying"
  | "fireProjectile"
  | "melee"
  | "shield"
  | "dash";

export interface MovementParams {
  speed: number; // 1-5
  type: "walk" | "hover";
}

export interface FlyingParams {
  speed: number; // 1-5
  maxAltitude: number; // 100-300
}

export interface ProjectileParams {
  damage: number; // 5-30
  cooldown: number; // 0.5-3 seconds
  speed: number; // 2-8
  label: string; // e.g. "Fireball", "Arrow"
}

export interface MeleeParams {
  damage: number; // 5-40
  range: number; // 20-60 pixels
  cooldown: number; // 0.3-2 seconds
}

export interface ShieldParams {
  blockAmount: number; // 10-50 damage absorbed
  duration: number; // 1-3 seconds
  cooldown: number; // 3-8 seconds
}

export interface DashParams {
  distance: number; // 50-200 pixels
  cooldown: number; // 2-5 seconds
}

export interface AbilityConfig {
  type: ComponentType;
  params: MovementParams | FlyingParams | ProjectileParams | MeleeParams | ShieldParams | DashParams;
}

// --- AI Analysis Result ---
export interface FighterConfig {
  name: string;
  description: string;
  health: { maxHp: number }; // 50-150
  movement: MovementParams;
  abilities: AbilityConfig[];
  spriteBounds: { x: number; y: number; width: number; height: number };
  balanceScore: number; // 1-10
}

// --- Battle State (synced via Colyseus) ---
export interface Vec2 {
  x: number;
  y: number;
}

export interface ProjectileState {
  id: string;
  ownerId: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  damage: number;
  active: boolean;
}

export interface PlayerBattleState {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  hp: number;
  maxHp: number;
  ink: number;
  maxInk: number;
  facingRight: boolean;
  isShielding: boolean;
  cooldowns: Record<string, number>; // componentType -> remaining cooldown
  isReady: boolean;
  drawingSubmitted: boolean;
  fighterConfig: FighterConfig | null;
}

// --- Messages (client -> server) ---
export interface InputMessage {
  type: "move";
  targetX: number;
  targetY: number;
}

export interface AbilityMessage {
  type: "ability";
  abilityType: ComponentType;
  targetX?: number;
  targetY?: number;
}

export interface DrawingSubmitMessage {
  type: "submitDrawing";
  imageData: string; // base64 PNG
}

export interface ReadyMessage {
  type: "ready";
}

export type ClientMessage = InputMessage | AbilityMessage | DrawingSubmitMessage | ReadyMessage;

// --- Room Config ---
export interface RoomConfig {
  inkBudget: number; // total drawing ink (stroke length in pixels)
  drawingTimeLimit: number; // seconds
  battleInkMax: number; // battle ink pool
  battleInkRegen: number; // ink per second regen
}

export const DEFAULT_ROOM_CONFIG: RoomConfig = {
  inkBudget: 5000,
  drawingTimeLimit: 75,
  battleInkMax: 100,
  battleInkRegen: 8,
};

// --- Constants ---
export const ARENA_WIDTH = 800;
export const ARENA_HEIGHT = 500;
export const GROUND_Y = 420;
export const GRAVITY = 980; // pixels/s^2
export const SERVER_TICK_RATE = 60; // fps
export const NETWORK_SEND_RATE = 20; // fps

// --- Gesture Types ---
export type GestureType = "swipeRight" | "swipeLeft" | "swipeUp" | "circle" | "slash" | "tap";

export interface GestureResult {
  type: GestureType;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  velocity: number;
}

// --- Ink costs for battle actions ---
export const BATTLE_INK_COSTS: Record<string, number> = {
  move: 1,
  fireProjectile: 12,
  melee: 8,
  shield: 15,
  dash: 10,
  flying: 5,
};
