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
  | "ranged"
  | "fireProjectile" // deprecated, use "ranged"
  | "melee"
  | "meleeAOE"
  | "rangedAOE"
  | "chargeAttack"
  | "special"
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
  homing?: boolean; // Whether projectile homes in on target
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

export interface MeleeAOEParams {
  damage: number; // 8-25
  radius: number; // 60-120 pixels
  cooldown: number; // 2-5 seconds
}

export interface RangedAOEParams {
  damage: number; // 10-30
  radius: number; // 50-100 pixels
  speed: number; // 2-6
  cooldown: number; // 2-6 seconds
  label: string; // e.g. "Explosive Shot"
}

export interface ChargeAttackParams {
  damage: number; // 20-50
  chargeTime: number; // 0.8-1.5 seconds
  cooldown: number; // 4-8 seconds
}

export interface SpecialParams {
  effectType: "stun" | "slow" | "poison" | "knockback" | "lifesteal" | "teleport";
  power: number; // 10-40
  duration: number; // 1-5 seconds
  cooldown: number; // 8-15 seconds
  label: string; // e.g. "Shadow Strike"
}

export interface AbilityConfig {
  type: ComponentType;
  params: MovementParams | FlyingParams | ProjectileParams | MeleeParams | ShieldParams | DashParams
    | MeleeAOEParams | RangedAOEParams | ChargeAttackParams | SpecialParams;
}

// --- Gesture-based battle moves (from AI interpretation of drawing) ---
export type BattleGestureType = "tap" | "swipe" | "draw";

export interface GestureMove {
  id: string;
  gesture: BattleGestureType;
  action: string; // e.g. "Scratch the other player"
  power: number; // damage 5-25
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
  /** 2-3 gesture moves for battle (tap, swipe, draw) */
  gestureMoves?: GestureMove[];
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
  isAOE?: boolean; // True if projectile explodes on impact
  aoeRadius?: number; // Explosion radius for AOE projectiles
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
  ranged: 12,
  fireProjectile: 12, // deprecated
  melee: 8,
  meleeAOE: 15,
  rangedAOE: 18,
  shield: 15,
  dash: 10,
  chargeAttack: 20,
  special: 25,
  flying: 5,
};
