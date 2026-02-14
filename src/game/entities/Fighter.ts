import { BaseComponent, ComponentOwner, ComponentTarget, ComponentOutput } from "../components/BaseComponent";
import { HealthComponent } from "../components/HealthComponent";
import { MovementComponent } from "../components/MovementComponent";
import { FlyingComponent } from "../components/FlyingComponent";
import { ProjectileComponent } from "../components/ProjectileComponent";
import { MeleeComponent } from "../components/MeleeComponent";
import { ShieldComponent } from "../components/ShieldComponent";
import { DashComponent } from "../components/DashComponent";
import type {
  FighterConfig,
  AbilityConfig,
  ComponentType,
  FlyingParams,
  ProjectileParams,
  MeleeParams,
  ShieldParams,
  DashParams,
} from "@shared/types";
import { ARENA_WIDTH } from "@shared/types";

export class Fighter implements ComponentOwner {
  id: string;
  name: string;
  description: string;

  // Position and velocity
  x: number;
  y: number;
  vx: number = 0;
  vy: number = 0;
  facingRight: boolean;

  // State
  hp: number;
  maxHp: number;
  isOnGround: boolean = true;
  isShielding: boolean = false;
  shieldHp: number = 0;

  // Ink
  ink: number;
  maxInk: number;
  inkRegen: number;

  // Components
  health: HealthComponent;
  movement: MovementComponent;
  abilities: BaseComponent[] = [];

  // Sprite data
  spriteData: string = ""; // base64 PNG of the extracted sprite

  constructor(
    id: string,
    config: FighterConfig,
    startX: number,
    startFacingRight: boolean,
    battleInkMax: number,
    battleInkRegen: number
  ) {
    this.id = id;
    this.name = config.name;
    this.description = config.description;

    this.x = startX;
    this.y = 420; // GROUND_Y
    this.facingRight = startFacingRight;

    // Health
    this.health = new HealthComponent(config.health.maxHp);
    this.hp = config.health.maxHp;
    this.maxHp = config.health.maxHp;

    // Movement (always present)
    this.movement = new MovementComponent(config.movement);

    // Ink
    this.ink = battleInkMax;
    this.maxInk = battleInkMax;
    this.inkRegen = battleInkRegen;

    // Build abilities from config
    for (const ability of config.abilities) {
      const component = createComponent(ability);
      if (component) {
        this.abilities.push(component);
      }
    }
  }

  get isDead(): boolean {
    return this.health.isDead;
  }

  getAbility(type: ComponentType): BaseComponent | undefined {
    return this.abilities.find((a) => a.type === type);
  }

  getAllCooldowns(): Record<string, number> {
    const cooldowns: Record<string, number> = {};
    for (const ability of this.abilities) {
      cooldowns[ability.type] = ability.cooldownRemaining;
    }
    return cooldowns;
  }

  update(dt: number): void {
    // Update all ability cooldowns
    for (const ability of this.abilities) {
      ability.update(dt);
    }

    // Shield decay
    const shield = this.abilities.find((a) => a.type === "shield") as ShieldComponent | undefined;
    if (shield && !shield.isShieldActive) {
      this.isShielding = false;
      this.shieldHp = 0;
    }

    // Ink regeneration
    this.ink = Math.min(this.maxInk, this.ink + this.inkRegen * dt);

    // Sync HP
    this.hp = this.health.hp;
  }

  move(target: ComponentTarget): ComponentOutput | null {
    return this.movement.activate(this, this.id, target);
  }

  activateAbility(
    type: ComponentType,
    target?: ComponentTarget,
    inkCost: number = 0
  ): ComponentOutput | null {
    const ability = this.getAbility(type);
    if (!ability) return null;
    if (!ability.isReady) return null;
    if (this.ink < inkCost) return null;

    this.ink -= inkCost;
    const output = ability.activate(this, this.id, target);

    // Handle shield output
    if (output?.shieldActive) {
      this.isShielding = true;
      this.shieldHp = output.shieldHp ?? 0;
    }

    return output;
  }

  takeDamage(amount: number): void {
    const result = this.health.takeDamage(amount, this.shieldHp);
    this.shieldHp = result.newShieldHp;
    this.hp = this.health.hp;
    if (this.shieldHp <= 0) {
      this.isShielding = false;
    }
  }

  /**
   * Clamp position within arena bounds.
   */
  clampPosition(groundY: number): void {
    this.x = Math.max(30, Math.min(ARENA_WIDTH - 30, this.x));
    if (this.y >= groundY) {
      this.y = groundY;
      this.vy = 0;
      this.isOnGround = true;
    } else {
      this.isOnGround = false;
    }
    if (this.y < 20) {
      this.y = 20;
      this.vy = 0;
    }
  }
}

/**
 * Factory function to create a component from an AbilityConfig.
 */
function createComponent(config: AbilityConfig): BaseComponent | null {
  switch (config.type) {
    case "flying":
      return new FlyingComponent(config.params as FlyingParams);
    case "fireProjectile":
      return new ProjectileComponent(config.params as ProjectileParams);
    case "melee":
      return new MeleeComponent(config.params as MeleeParams);
    case "shield":
      return new ShieldComponent(config.params as ShieldParams);
    case "dash":
      return new DashComponent(config.params as DashParams);
    default:
      console.warn(`Unknown component type: ${config.type}`);
      return null;
  }
}
