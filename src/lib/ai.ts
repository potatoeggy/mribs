import OpenAI from "openai";
import type { FighterConfig, GestureMove } from "@shared/types";

const SYSTEM_PROMPT = `You are the game master for "Scribble Fighters", a drawing combat game. Players hand-draw creatures and their attacks on a canvas. You must analyze the drawing and determine what the creature is, what combat abilities it should have, and assign balanced stats.

AVAILABLE COMPONENTS (pick 1-3 abilities, plus movement is always included):

1. "flying" - Creature can fly
   Params: { speed: 1-5 }
   
2. "fireProjectile" - Ranged attack (fireball, arrow, laser, etc.)
   Params: { damage: 5-30, cooldown: 0.5-3, speed: 2-8, label: "descriptive name" }
   
3. "melee" - Close-range attack (bite, slash, punch, etc.)
   Params: { damage: 5-40, range: 20-60, cooldown: 0.3-2 }
   
4. "shield" - Blocks incoming damage
   Params: { blockAmount: 10-50, duration: 1-3, cooldown: 3-8 }
   
5. "dash" - Quick burst of movement / dodge
   Params: { distance: 50-200, cooldown: 2-5 }

BALANCE RULES:
- Total power budget is 100 points
- Each ability costs points roughly proportional to its power
- More offensive abilities = lower HP (250-400)
- More defensive abilities = higher HP (400-600)
- Balanced builds = medium HP (400-500)
- A creature that looks big/tough should have more HP
- A creature that looks fast/small should have higher speed but less HP

TEXT ANNOTATIONS:
- Players may write text like "+fire", "+fly", "+shield" on the canvas
- These OVERRIDE your judgment - if the player wrote it, include that ability
- Players may draw arrows pointing from attack shapes to the creature

SPRITE BOUNDS:
- Identify the bounding box of the MAIN creature body (not annotations or separate attack drawings)
- Return as { x, y, width, height } in pixel coordinates (canvas is typically ~800x500)

DRAWING EFFORT & INK INVESTMENT:
- The player spent INK_SPENT ink drawing this creature (out of 200 max).
- More ink spent = more lines drawn = more detail = STRONGER fighter
- Scale ALL stats (HP, damage, abilities) based on ink investment:
  - Low ink (20-60): Weak fighter - HP 250-350, damage 5-10, basic abilities
  - Medium ink (60-120): Medium fighter - HP 350-500, damage 10-20, standard abilities
  - High ink (120-200): Strong fighter - HP 500-750, damage 20-30, powerful abilities
- This creates strategic trade-off: detailed/strong characters use more ink upfront, leaving less for summoning reinforcements during battle
- Scale gesture move power (5-25) proportionally to ink spent:
  - Low ink: power 5-12
  - Medium ink: power 12-18
  - High ink: power 18-25

GESTURE MOVES (required):
- Return exactly 2 or 3 "gestureMoves" for battle. Each move is performed by the player doing a gesture: "tap" (quick tap), "swipe" (swipe on screen), or "draw" (draw something on battle canvas).
- Each move: { "id": "unique-id", "gesture": "tap"|"swipe"|"draw", "action": "short description", "power": 5-25 }
- Set each move's "power" using the DRAWING EFFORT & STRENGTH rules above. Do NOT give everyone the same power range—vary by drawing quality.
- Gesture moves must be OFFENSIVE attacks that deal damage. Do NOT suggest defensive actions like shield, block, or protect. Only suggest attacks that fit the creature.
- Use at least one of each gesture type if you have 3 moves; for 2 moves use tap and swipe. Within the chosen power range, tap can be slightly lower, draw slightly higher.
- "action" is the ATTACK NAME only: short, punchy, creative (e.g. Whisker Whack, Ink Splatter, Shadow Bite). No gesture labels—do not include "tap", "swipe", or "draw" in the action name.

You MUST respond with a valid JSON object matching the FighterConfig schema. Be creative with names and descriptions!`;

const FIGHTER_CONFIG_SCHEMA = {
  type: "object" as const,
  additionalProperties: false,
  properties: {
    name: { type: "string" as const },
    description: { type: "string" as const },
    health: {
      type: "object" as const,
      additionalProperties: false,
      properties: {
        maxHp: { type: "number" as const },
      },
      required: ["maxHp"],
    },
    movement: {
      type: "object" as const,
      additionalProperties: false,
      properties: {
        speed: { type: "number" as const },
        type: { type: "string" as const, enum: ["walk", "hover"] },
      },
      required: ["speed", "type"],
    },
    abilities: {
      type: "array" as const,
      items: {
        type: "object" as const,
        additionalProperties: false,
        properties: {
          type: {
            type: "string" as const,
            enum: ["flying", "fireProjectile", "melee", "shield", "dash"],
          },
          params: {
            type: "object" as const,
            additionalProperties: false,
            properties: {
              damage: { type: ["number", "null"] as const },
              cooldown: { type: ["number", "null"] as const },
              speed: { type: ["number", "null"] as const },
              range: { type: ["number", "null"] as const },
              label: { type: ["string", "null"] as const },
              blockAmount: { type: ["number", "null"] as const },
              duration: { type: ["number", "null"] as const },
              distance: { type: ["number", "null"] as const },
            },
            required: ["damage", "cooldown", "speed", "range", "label", "blockAmount", "duration", "distance"],
          },
        },
        required: ["type", "params"],
      },
    },
    spriteBounds: {
      type: "object" as const,
      additionalProperties: false,
      properties: {
        x: { type: "number" as const },
        y: { type: "number" as const },
        width: { type: "number" as const },
        height: { type: "number" as const },
      },
      required: ["x", "y", "width", "height"],
    },
    balanceScore: { type: "number" as const },
    gestureMoves: {
      type: "array" as const,
      minItems: 2,
      maxItems: 3,
      items: {
        type: "object" as const,
        additionalProperties: false,
        properties: {
          id: { type: "string" as const },
          gesture: { type: "string" as const, enum: ["tap", "swipe", "draw"] },
          action: { type: "string" as const },
          power: { type: "number" as const },
        },
        required: ["id", "gesture", "action", "power"],
      },
    },
  },
  required: ["name", "description", "health", "movement", "abilities", "spriteBounds", "balanceScore", "gestureMoves"],
};

/**
 * Analyze a drawing using GPT-4o Vision and return a FighterConfig.
 */
export async function analyzeDrawing(imageBase64: string, inkSpent: number = 100): Promise<FighterConfig> {
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  // Strip the data URL prefix if present
  const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: SYSTEM_PROMPT.replace("INK_SPENT", inkSpent.toString()),
      },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `Analyze this hand-drawn creature for Scribble Fighters. The player spent ${inkSpent} ink (out of 200 max) drawing this. Scale ALL stats (HP, damage, abilities, gesture move power) proportionally to ink investment: low ink (20-60) = weak fighter (HP 250-350), medium ink (60-120) = medium fighter (HP 350-500), high ink (120-200) = strong fighter (HP 500-750). More ink = stronger character. Return a JSON FighterConfig with abilities, sprite bounds, and gestureMoves.`,
          },
          {
            type: "image_url",
            image_url: {
              url: `data:image/png;base64,${base64Data}`,
              detail: "high",
            },
          },
        ],
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "fighter_config",
        strict: true,
        schema: FIGHTER_CONFIG_SCHEMA,
      },
    },
    max_tokens: 1000,
    temperature: 0.7,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error("No response from AI");
  }

  const config = JSON.parse(content) as FighterConfig;
  return validateAndFixConfig(config);
}

/**
 * Ensure gestureMoves exist and are valid; add fallback if missing.
 */
function ensureGestureMoves(config: FighterConfig): GestureMove[] {
  const moves = config.gestureMoves;
  if (Array.isArray(moves) && moves.length >= 2) {
    return moves.slice(0, 3).map((m) => ({
      id: m.id || `move-${m.gesture}-${Math.random().toString(36).slice(2, 8)}`,
      gesture: ["tap", "swipe", "draw"].includes(m.gesture) ? m.gesture : "tap",
      action: typeof m.action === "string" ? m.action : "Attack",
      power: typeof m.power === "number" ? Math.max(5, Math.min(25, m.power)) : 10,
    }));
  }
  return [
    { id: "tap-1", gesture: "tap", action: "Pounce", power: 8 },
    { id: "swipe-1", gesture: "swipe", action: "Scratch", power: 14 },
    { id: "draw-1", gesture: "draw", action: "Special attack", power: 18 },
  ];
}

/**
 * Validate and fix a FighterConfig to ensure it's within bounds.
 */
function validateAndFixConfig(config: FighterConfig): FighterConfig {
  // Clamp health (5x multiplier for longer fights)
  config.health.maxHp = clamp(config.health.maxHp, 250, 750);

  // Clamp movement
  config.movement.speed = clamp(config.movement.speed, 1, 5);
  if (!["walk", "hover"].includes(config.movement.type)) {
    config.movement.type = "walk";
  }

  // Validate abilities (max 3)
  if (config.abilities.length > 3) {
    config.abilities = config.abilities.slice(0, 3);
  }

  // Ensure at least a name and description
  if (!config.name) config.name = "Mystery Creature";
  if (!config.description) config.description = "A mysterious scribble comes to life!";

  // Ensure sprite bounds are reasonable
  config.spriteBounds.x = Math.max(0, config.spriteBounds.x);
  config.spriteBounds.y = Math.max(0, config.spriteBounds.y);
  config.spriteBounds.width = clamp(config.spriteBounds.width, 20, 400);
  config.spriteBounds.height = clamp(config.spriteBounds.height, 20, 400);

  config.balanceScore = clamp(config.balanceScore, 1, 10);

  config.gestureMoves = ensureGestureMoves(config);

  return config;
}

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

/**
 * Generate a fallback FighterConfig for when AI analysis fails.
 */
export function fallbackFighterConfig(): FighterConfig {
  return {
    name: "Scribble Warrior",
    description: "A brave scribble that fights with determination!",
    health: { maxHp: 500 },
    movement: { speed: 3, type: "walk" },
    abilities: [
      {
        type: "melee",
        params: { damage: 15, range: 40, cooldown: 0.8 },
      },
      {
        type: "fireProjectile",
        params: { damage: 10, cooldown: 1.5, speed: 5, label: "Ink Blast" },
      },
    ],
    spriteBounds: { x: 100, y: 50, width: 150, height: 150 },
    balanceScore: 5,
    gestureMoves: [
      { id: "tap-1", gesture: "tap", action: "Pounce", power: 8 },
      { id: "swipe-1", gesture: "swipe", action: "Scratch", power: 14 },
      { id: "draw-1", gesture: "draw", action: "Ink blast", power: 18 },
    ],
  };
}
