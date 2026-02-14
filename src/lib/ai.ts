import OpenAI from "openai";
import type { FighterConfig } from "@shared/types";

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
- More offensive abilities = lower HP (50-80)
- More defensive abilities = higher HP (80-120)  
- Balanced builds = medium HP (80-100)
- A creature that looks big/tough should have more HP
- A creature that looks fast/small should have higher speed but less HP

TEXT ANNOTATIONS:
- Players may write text like "+fire", "+fly", "+shield" on the canvas
- These OVERRIDE your judgment - if the player wrote it, include that ability
- Players may draw arrows pointing from attack shapes to the creature

SPRITE BOUNDS:
- Identify the bounding box of the MAIN creature body (not annotations or separate attack drawings)
- Return as { x, y, width, height } in pixel coordinates (canvas is typically ~800x500)

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
  },
  required: ["name", "description", "health", "movement", "abilities", "spriteBounds", "balanceScore"],
};

/**
 * Analyze a drawing using GPT-4o Vision and return a FighterConfig.
 */
export async function analyzeDrawing(imageBase64: string): Promise<FighterConfig> {
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
        content: SYSTEM_PROMPT,
      },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "Analyze this hand-drawn creature for Scribble Fighters. Determine its abilities, stats, and sprite bounds. Return a JSON FighterConfig.",
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
 * Validate and fix a FighterConfig to ensure it's within bounds.
 */
function validateAndFixConfig(config: FighterConfig): FighterConfig {
  // Clamp health
  config.health.maxHp = clamp(config.health.maxHp, 50, 150);

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
    health: { maxHp: 100 },
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
  };
}
