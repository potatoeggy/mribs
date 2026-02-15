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
  analyzing: 25, // max seconds to wait for AI (prod needs more: cold starts, OpenAI latency)
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
  fireProjectile: 12,
  melee: 8,
  shield: 15,
  dash: 10,
  flying: 5,
};
