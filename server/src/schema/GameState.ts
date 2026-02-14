import { Schema, MapSchema, ArraySchema, type, filter } from "@colyseus/schema";

export class ProjectileSchema extends Schema {
  @type("string") id: string = "";
  @type("string") ownerId: string = "";
  @type("number") x: number = 0;
  @type("number") y: number = 0;
  @type("number") vx: number = 0;
  @type("number") vy: number = 0;
  @type("number") damage: number = 0;
  @type("boolean") active: boolean = true;
}

export class AbilitySchema extends Schema {
  @type("string") abilityType: string = "";
  @type("number") cooldownRemaining: number = 0;
  @type("number") cooldownMax: number = 0;
  @type("string") label: string = "";
}

export class PlayerSchema extends Schema {
  @type("string") id: string = "";
  @type("string") name: string = "";
  @type("number") x: number = 0;
  @type("number") y: number = 0;
  @type("number") vx: number = 0;
  @type("number") vy: number = 0;
  @type("number") hp: number = 100;
  @type("number") maxHp: number = 100;
  @type("number") ink: number = 100;
  @type("number") maxInk: number = 100;
  @type("boolean") facingRight: boolean = true;
  @type("boolean") isShielding: boolean = false;
  @type("number") shieldHp: number = 0;
  @type("boolean") isReady: boolean = false;
  @type("boolean") drawingSubmitted: boolean = false;
  @type("string") fighterName: string = "";
  @type("string") fighterDescription: string = "";
  @type("string") spriteData: string = ""; // base64 PNG
  @type("string") gestureMoveSummary: string = ""; // JSON array of { action, power } for analyzing UI
  @type([AbilitySchema]) abilities = new ArraySchema<AbilitySchema>();
}

export class GameStateSchema extends Schema {
  @type("string") phase: string = "lobby"; // lobby, drawing, analyzing, reveal, battle, result
  @type({"map": PlayerSchema}) players = new MapSchema<PlayerSchema>();
  @type([ProjectileSchema]) projectiles = new ArraySchema<ProjectileSchema>();
  @type("number") timer: number = 0; // countdown timer for current phase
  @type("string") winnerId: string = "";
  @type("string") roomCode: string = "";

  // Room config
  @type("number") inkBudget: number = 5000;
  @type("number") drawingTimeLimit: number = 75;
  @type("number") battleInkMax: number = 100;
  @type("number") battleInkRegen: number = 8;
}
