/**
 * Balance constants for the game.
 */

export const ARENA_WIDTH = 800;
export const ARENA_HEIGHT = 500;
export const GROUND_Y = 420;
export const GRAVITY = 980; // pixels/s^2
export const FRICTION = 0.85; // velocity damping per frame
export const SERVER_TICK_RATE = 60; // fps
export const NETWORK_SEND_RATE = 20; // fps

export const PHASE_DURATIONS = {
  drawing: 75, // seconds (configurable)
  analyzing: 10, // max seconds to wait for AI
  reveal: 5, // seconds to show VS screen
  result: 10, // seconds before auto-return to lobby
};

export const PLAYER_SIZE = {
  width: 50,
  height: 60,
};

export const PROJECTILE_SIZE = 12;
export const PROJECTILE_LIFETIME = 4; // seconds

// Ink costs for battle actions
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

// AOE damage scaling based on ink spent during drawing
export const AOE_DAMAGE_SCALING = {
  baseMultiplier: 1.0,
  inkDivisor: 400, // finalDamage = baseDamage * (1 + inkSpent / 400)
};

// Platform configuration for moving platforms
export interface PlatformConfig {
  x: number;
  y: number;
  width: number;
  height: number;
  pattern: "static" | "horizontal" | "vertical" | "circular";
  speed?: number; // pixels per second
  minX?: number; // For horizontal movement
  maxX?: number;
  minY?: number; // For vertical movement
  maxY?: number;
  radius?: number; // For circular movement
  centerX?: number;
  centerY?: number;
}

export const PLATFORMS: PlatformConfig[] = [
  { x: 200, y: 300, width: 150, height: 20, pattern: "horizontal", minX: 100, maxX: 300, speed: 100 },
  { x: 500, y: 250, width: 120, height: 20, pattern: "vertical", minY: 200, maxY: 350, speed: 80 },
  { x: 400, y: 350, width: 100, height: 20, pattern: "static" },
];
