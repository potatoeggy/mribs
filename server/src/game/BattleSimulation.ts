import {
  ARENA_WIDTH,
  GROUND_Y,
  GRAVITY,
  FRICTION,
  PLAYER_SIZE,
  PROJECTILE_SIZE,
  PROJECTILE_LIFETIME,
  BATTLE_INK_COSTS,
} from "./BalanceConfig";

// ---- Lightweight types mirroring shared/types without import issues ----

interface Vec2 {
  x: number;
  y: number;
}

interface ProjectileState {
  id: string;
  ownerId: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  damage: number;
  active: boolean;
  age: number;
}

interface AbilityState {
  type: string;
  cooldownRemaining: number;
  cooldownMax: number;
  label: string;
  // Ability params stored for activation
  params: Record<string, number | string>;
}

interface FighterState {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  hp: number;
  maxHp: number;
  ink: number;
  maxInk: number;
  inkRegen: number;
  facingRight: boolean;
  isOnGround: boolean;
  isShielding: boolean;
  shieldHp: number;
  shieldTimer: number;
  abilities: AbilityState[];
  movementSpeed: number;
}

export interface BattleEvent {
  type: "damage" | "projectileSpawn" | "shieldActivate" | "death" | "meleeHit";
  playerId: string;
  targetId?: string;
  amount?: number;
  x?: number;
  y?: number;
}

/**
 * Server-side battle simulation.
 * Runs physics, collision detection, and game logic.
 */
export class BattleSimulation {
  fighters: Map<string, FighterState> = new Map();
  projectiles: ProjectileState[] = [];
  events: BattleEvent[] = [];
  private nextProjectileId = 0;

  addFighter(
    id: string,
    startX: number,
    facingRight: boolean,
    config: {
      maxHp: number;
      movementSpeed: number;
      abilities: { type: string; params: Record<string, number | string> }[];
      battleInkMax: number;
      battleInkRegen: number;
    }
  ): void {
    const abilities: AbilityState[] = config.abilities.map((a) => ({
      type: a.type,
      cooldownRemaining: 0,
      cooldownMax: (a.params.cooldown as number) || 1,
      label: (a.params.label as string) || a.type,
      params: a.params,
    }));

    this.fighters.set(id, {
      id,
      x: startX,
      y: GROUND_Y,
      vx: 0,
      vy: 0,
      hp: config.maxHp,
      maxHp: config.maxHp,
      ink: config.battleInkMax,
      maxInk: config.battleInkMax,
      inkRegen: config.battleInkRegen,
      facingRight,
      isOnGround: true,
      isShielding: false,
      shieldHp: 0,
      shieldTimer: 0,
      abilities,
      movementSpeed: config.movementSpeed,
    });
  }

  /**
   * Process a move command from a player.
   */
  handleMove(playerId: string, targetX: number, targetY: number): void {
    const fighter = this.fighters.get(playerId);
    if (!fighter || fighter.hp <= 0) return;

    const inkCost = BATTLE_INK_COSTS.move || 1;
    if (fighter.ink < inkCost) return;
    fighter.ink -= inkCost;

    const dx = targetX - fighter.x;
    const speed = fighter.movementSpeed * 60;
    fighter.vx = Math.sign(dx) * Math.min(Math.abs(dx), speed);

    // Update facing direction
    if (dx !== 0) {
      fighter.facingRight = dx > 0;
    }

    // Handle vertical movement if target is above
    const dy = targetY - fighter.y;
    if (dy < -20 && fighter.isOnGround) {
      // Jump
      fighter.vy = -350;
      fighter.isOnGround = false;
    }
  }

  /**
   * Process an ability activation from a player.
   */
  handleAbility(playerId: string, abilityType: string, targetX?: number, targetY?: number): void {
    const fighter = this.fighters.get(playerId);
    if (!fighter || fighter.hp <= 0) return;

    const ability = fighter.abilities.find((a) => a.type === abilityType);
    if (!ability) return;
    if (ability.cooldownRemaining > 0) return;

    const inkCost = BATTLE_INK_COSTS[abilityType] || 5;
    if (fighter.ink < inkCost) return;
    fighter.ink -= inkCost;

    // Start cooldown
    ability.cooldownRemaining = ability.cooldownMax;

    // Find opponent
    const opponent = this.getOpponent(playerId);

    switch (abilityType) {
      case "fireProjectile": {
        const projSpeed = ((ability.params.speed as number) || 5) * 100;
        let vx: number, vy: number;

        if (targetX !== undefined && targetY !== undefined) {
          const dx = targetX - fighter.x;
          const dy = targetY - fighter.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          vx = (dx / dist) * projSpeed;
          vy = (dy / dist) * projSpeed;
        } else {
          vx = (fighter.facingRight ? 1 : -1) * projSpeed;
          vy = 0;
        }

        this.projectiles.push({
          id: `proj_${this.nextProjectileId++}`,
          ownerId: playerId,
          x: fighter.x + (fighter.facingRight ? 30 : -30),
          y: fighter.y - 10,
          vx,
          vy,
          damage: (ability.params.damage as number) || 10,
          active: true,
          age: 0,
        });

        this.events.push({
          type: "projectileSpawn",
          playerId,
          x: fighter.x,
          y: fighter.y,
        });
        break;
      }

      case "melee": {
        if (opponent) {
          const dx = opponent.x - fighter.x;
          const dy = opponent.y - fighter.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const range = (ability.params.range as number) || 40;

          if (dist <= range + PLAYER_SIZE.width) {
            const damage = (ability.params.damage as number) || 15;
            this.applyDamage(opponent, damage);
            this.events.push({
              type: "meleeHit",
              playerId,
              targetId: opponent.id,
              amount: damage,
            });
          }
        }
        break;
      }

      case "shield": {
        fighter.isShielding = true;
        fighter.shieldHp = (ability.params.blockAmount as number) || 30;
        fighter.shieldTimer = (ability.params.duration as number) || 2;
        this.events.push({
          type: "shieldActivate",
          playerId,
        });
        break;
      }

      case "dash": {
        const dashDist = (ability.params.distance as number) || 100;
        let dir: number;
        if (targetX !== undefined) {
          dir = Math.sign(targetX - fighter.x);
        } else {
          dir = fighter.facingRight ? 1 : -1;
        }
        fighter.vx = dir * dashDist * 5;
        break;
      }

      case "flying": {
        const flySpeed = ((ability.params.speed as number) || 3) * 80;
        fighter.vy = -flySpeed;
        fighter.isOnGround = false;
        break;
      }
    }
  }

  /**
   * Run one physics tick.
   */
  tick(dt: number): BattleEvent[] {
    this.events = [];

    for (const [, fighter] of this.fighters) {
      if (fighter.hp <= 0) continue;

      // Apply gravity
      if (!fighter.isOnGround) {
        // Check if fighter can fly
        const canFly = fighter.abilities.some((a) => a.type === "flying");
        if (!canFly || fighter.vy > 0) {
          fighter.vy += GRAVITY * dt;
        } else {
          fighter.vy += GRAVITY * 0.3 * dt; // Reduced gravity for flyers
        }
      }

      // Apply velocity
      fighter.x += fighter.vx * dt;
      fighter.y += fighter.vy * dt;

      // Apply friction
      fighter.vx *= FRICTION;

      // Ground collision
      if (fighter.y >= GROUND_Y) {
        fighter.y = GROUND_Y;
        fighter.vy = 0;
        fighter.isOnGround = true;
      }

      // Ceiling
      if (fighter.y < 20) {
        fighter.y = 20;
        fighter.vy = 0;
      }

      // Arena walls
      fighter.x = Math.max(30, Math.min(ARENA_WIDTH - 30, fighter.x));

      // Update cooldowns
      for (const ability of fighter.abilities) {
        if (ability.cooldownRemaining > 0) {
          ability.cooldownRemaining = Math.max(0, ability.cooldownRemaining - dt);
        }
      }

      // Shield timer
      if (fighter.isShielding) {
        fighter.shieldTimer -= dt;
        if (fighter.shieldTimer <= 0) {
          fighter.isShielding = false;
          fighter.shieldHp = 0;
        }
      }

      // Ink regen
      fighter.ink = Math.min(fighter.maxInk, fighter.ink + fighter.inkRegen * dt);

      // Update facing direction toward opponent
      const opponent = this.getOpponent(fighter.id);
      if (opponent && Math.abs(fighter.vx) < 10) {
        fighter.facingRight = opponent.x > fighter.x;
      }
    }

    // Update projectiles
    for (const proj of this.projectiles) {
      if (!proj.active) continue;

      proj.x += proj.vx * dt;
      proj.y += proj.vy * dt;
      proj.age += dt;

      // Check lifetime
      if (proj.age > PROJECTILE_LIFETIME) {
        proj.active = false;
        continue;
      }

      // Check arena bounds
      if (proj.x < -50 || proj.x > ARENA_WIDTH + 50 || proj.y < -50 || proj.y > GROUND_Y + 50) {
        proj.active = false;
        continue;
      }

      // Check collision with fighters
      for (const [, fighter] of this.fighters) {
        if (fighter.id === proj.ownerId) continue; // Don't hit owner
        if (fighter.hp <= 0) continue;

        const dx = proj.x - fighter.x;
        const dy = proj.y - fighter.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < PLAYER_SIZE.width / 2 + PROJECTILE_SIZE) {
          // Hit!
          this.applyDamage(fighter, proj.damage);
          proj.active = false;
          this.events.push({
            type: "damage",
            playerId: proj.ownerId,
            targetId: fighter.id,
            amount: proj.damage,
            x: proj.x,
            y: proj.y,
          });
          break;
        }
      }
    }

    // Remove inactive projectiles
    this.projectiles = this.projectiles.filter((p) => p.active);

    // Check for death
    for (const [, fighter] of this.fighters) {
      if (fighter.hp <= 0) {
        this.events.push({
          type: "death",
          playerId: fighter.id,
        });
      }
    }

    return this.events;
  }

  /**
   * Apply damage to a fighter, accounting for shields.
   */
  private applyDamage(fighter: FighterState, amount: number): void {
    if (fighter.isShielding && fighter.shieldHp > 0) {
      const blocked = Math.min(amount, fighter.shieldHp);
      fighter.shieldHp -= blocked;
      amount -= blocked;
      if (fighter.shieldHp <= 0) {
        fighter.isShielding = false;
      }
    }
    fighter.hp = Math.max(0, fighter.hp - amount);
  }

  /**
   * Get the opponent of a given player.
   */
  private getOpponent(playerId: string): FighterState | undefined {
    for (const [id, fighter] of this.fighters) {
      if (id !== playerId) return fighter;
    }
    return undefined;
  }

  /**
   * Check if the battle is over (someone died).
   */
  getWinnerId(): string | null {
    const alive: string[] = [];
    for (const [id, fighter] of this.fighters) {
      if (fighter.hp > 0) alive.push(id);
    }
    if (alive.length === 1) return alive[0];
    if (alive.length === 0) return "draw";
    return null;
  }
}
