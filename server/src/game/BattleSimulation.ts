import {
  ARENA_WIDTH,
  GROUND_Y,
  GRAVITY,
  FRICTION,
  PLAYER_SIZE,
  PROJECTILE_SIZE,
  PROJECTILE_LIFETIME,
  BATTLE_INK_COSTS,
  PLATFORMS,
  AOE_DAMAGE_SCALING,
  type PlatformConfig,
} from "./BalanceConfig";

// ---- Lightweight types mirroring shared/types without import issues ----

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
  homing: boolean; // Whether projectile homes in on target
  speed: number; // Base speed for homing calculations
  isAOE: boolean; // Whether projectile explodes on impact
  aoeRadius: number; // Explosion radius for AOE projectiles
}

interface Platform {
  config: PlatformConfig;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number; // For circular movement
}

interface AbilityState {
  type: string;
  cooldownRemaining: number;
  cooldownMax: number;
  label: string;
  // Ability params stored for activation
  params: Record<string, number | string | boolean>;
}

interface FighterState {
  id: string;
  ownerId: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  hp: number;
  maxHp: number;
  ink: number;
  maxInk: number;
  inkRegen: number;
  inkSpentOnCreation: number; // Ink spent drawing this character (for AOE scaling)
  facingRight: boolean;
  isOnGround: boolean;
  isShielding: boolean;
  shieldHp: number;
  shieldTimer: number;
  abilities: AbilityState[];
  movementSpeed: number;
  autoAttackCooldown: number; // Time until next autoattack
  primaryAttackType: string; // Type of primary attack (melee or fireProjectile)
  idleTimer: number; // Time until next idle movement
  idleTargetX?: number; // Target position for idle wandering
  jumpCooldown: number; // Time until can jump again (dodge)
  isDead: boolean; // Track if death event already sent
  comboCounter: number; // Track combo hits for varied attacks
  chargeTimer: number; // Track charge time for power attacks
  isCharging: boolean; // Currently charging an attack
  isInvulnerable: boolean; // Temporary invulnerability (e.g., during dash)
  invulnerabilityTimer: number; // Time remaining for invulnerability
  stunned: boolean; // Cannot move or attack
  stunnedTimer: number; // Time remaining stunned
  slowed: boolean; // Reduced movement speed
  slowedTimer: number; // Time remaining slowed
  poisoned: boolean; // Taking damage over time
  poisonedTimer: number; // Time remaining poisoned
  poisonDamage: number; // Damage per second from poison
  onPlatformId: number | null; // ID of platform fighter is standing on
}

export interface BattleEvent {
  type: "damage" | "projectileSpawn" | "shieldActivate" | "death" | "meleeHit"
    | "dash" | "chargeStart" | "chargeHit" | "aoeExplosion" | "special";
  playerId: string;
  targetId?: string;
  amount?: number;
  x?: number;
  y?: number;
  radius?: number; // For AOE effects
  effectType?: string; // For special abilities
  soundType?: string; // Custom sound for special
}

/**
 * Server-side battle simulation.
 * Runs physics, collision detection, and game logic.
 */
export class BattleSimulation {
  fighters: Map<string, FighterState> = new Map();
  projectiles: ProjectileState[] = [];
  platforms: Platform[] = [];
  events: BattleEvent[] = [];
  private nextProjectileId = 0;
  private battleStartTime: number = 0;
  private readonly BATTLE_START_DELAY_SEC = 6; // Wait for countdown before autoattacks

  constructor() {
    // Initialize platforms from config
    this.platforms = PLATFORMS.map((config, index) => ({
      config,
      x: config.x,
      y: config.y,
      vx: 0,
      vy: 0,
      angle: 0,
    }));
  }

  addFighter(
    id: string,
    ownerId: string,
    startX: number,
    facingRight: boolean,
    config: {
      maxHp: number;
      movementSpeed: number;
      abilities: { type: string; params: Record<string, number | string | boolean> }[];
      battleInkMax: number;
      battleInkRegen: number;
      inkSpentOnCreation?: number;
    }
  ): void {
    const abilities: AbilityState[] = config.abilities.map((a) => ({
      type: a.type,
      cooldownRemaining: 0,
      cooldownMax: (a.params.cooldown as number) || 1,
      label: (a.params.label as string) || a.type,
      params: a.params,
    }));

    // Determine primary attack type (first offensive ability)
    const primaryAttackType = abilities.find(a => a.type === "melee" || a.type === "fireProjectile")?.type || "melee";

    this.fighters.set(id, {
      id,
      ownerId,
      x: startX,
      y: GROUND_Y,
      vx: 0,
      vy: 0,
      hp: config.maxHp,
      maxHp: config.maxHp,
      ink: config.battleInkMax,
      maxInk: config.battleInkMax,
      inkRegen: config.battleInkRegen,
      inkSpentOnCreation: config.inkSpentOnCreation || 100,
      facingRight,
      isOnGround: true,
      isShielding: false,
      shieldHp: 0,
      shieldTimer: 0,
      abilities,
      movementSpeed: config.movementSpeed,
      autoAttackCooldown: 0,
      primaryAttackType,
      idleTimer: Math.random() * 3 + 1, // Start with random idle timer
      idleTargetX: undefined,
      jumpCooldown: 0,
      isDead: false,
      comboCounter: 0,
      chargeTimer: 0,
      isCharging: false,
      isInvulnerable: false,
      invulnerabilityTimer: 0,
      stunned: false,
      stunnedTimer: 0,
      slowed: false,
      slowedTimer: 0,
      poisoned: false,
      poisonedTimer: 0,
      poisonDamage: 0,
      onPlatformId: null,
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
        const baseSpeed = (ability.params.speed as number) || 5;
        const projSpeed = baseSpeed * 100;
        const isHoming = Boolean(ability.params.homing);
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
          homing: isHoming,
          speed: baseSpeed,
          isAOE: false,
          aoeRadius: 0,
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
            this.applyDamage(opponent, damage, playerId);
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

        // Grant brief invulnerability during dash
        fighter.isInvulnerable = true;
        fighter.invulnerabilityTimer = 0.2;

        this.events.push({
          type: "dash",
          playerId,
          x: fighter.x,
          y: fighter.y,
        });
        break;
      }

      case "flying": {
        const flySpeed = ((ability.params.speed as number) || 3) * 80;
        fighter.vy = -flySpeed;
        fighter.isOnGround = false;
        break;
      }

      case "chargeAttack": {
        // Start charging
        fighter.isCharging = true;
        fighter.chargeTimer = (ability.params.chargeTime as number) || 1.0;

        this.events.push({
          type: "chargeStart",
          playerId,
          x: fighter.x,
          y: fighter.y,
        });
        break;
      }

      case "meleeAOE": {
        // Close-range area effect attack
        const radius = (ability.params.radius as number) || 80;
        const baseDamage = (ability.params.damage as number) || 15;

        // Apply ink scaling
        const inkScaledDamage = this.applyInkScaling(fighter, baseDamage);

        // Hit all enemies within radius
        let hitCount = 0;
        for (const [, target] of this.fighters) {
          if (target.ownerId === fighter.ownerId) continue;
          if (target.hp <= 0) continue;

          const dx = target.x - fighter.x;
          const dy = target.y - fighter.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist <= radius + PLAYER_SIZE.width / 2) {
            this.applyDamage(target, inkScaledDamage, playerId);
            hitCount++;

            this.events.push({
              type: "damage",
              playerId,
              targetId: target.id,
              amount: inkScaledDamage,
              x: target.x,
              y: target.y,
            });
          }
        }

        // Broadcast AOE explosion event
        this.events.push({
          type: "aoeExplosion",
          playerId,
          x: fighter.x,
          y: fighter.y,
          radius,
        });
        break;
      }

      case "rangedAOE": {
        // Explosive projectile
        const baseSpeed = (ability.params.speed as number) || 4;
        const projSpeed = baseSpeed * 100;
        const radius = (ability.params.radius as number) || 75;
        const baseDamage = (ability.params.damage as number) || 20;

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
          damage: baseDamage,
          active: true,
          age: 0,
          homing: false,
          speed: baseSpeed,
          isAOE: true,
          aoeRadius: radius,
        });

        this.events.push({
          type: "projectileSpawn",
          playerId,
          x: fighter.x,
          y: fighter.y,
        });
        break;
      }

      case "special": {
        const effectType = (ability.params.effectType as string) || "knockback";
        const power = (ability.params.power as number) || 20;
        const duration = (ability.params.duration as number) || 2;

        if (opponent) {
          const dx = opponent.x - fighter.x;
          const dy = opponent.y - fighter.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const range = 150; // Special ability range

          if (dist <= range + PLAYER_SIZE.width) {
            switch (effectType) {
              case "stun":
                opponent.stunned = true;
                opponent.stunnedTimer = duration;
                break;

              case "slow":
                opponent.slowed = true;
                opponent.slowedTimer = duration;
                break;

              case "poison":
                opponent.poisoned = true;
                opponent.poisonedTimer = duration;
                opponent.poisonDamage = power;
                break;

              case "knockback": {
                const knockbackDirection = Math.sign(dx) || 1;
                opponent.vx += knockbackDirection * power * 50;
                opponent.vy -= power * 0.8;
                opponent.isOnGround = false;
                break;
              }

              case "lifesteal":
                this.applyDamage(opponent, power, playerId);
                fighter.hp = Math.min(fighter.maxHp, fighter.hp + power * 0.5);
                break;

              case "teleport": {
                // Teleport behind opponent
                const teleportX = opponent.x + (opponent.x > fighter.x ? -80 : 80);
                fighter.x = Math.max(30, Math.min(ARENA_WIDTH - 30, teleportX));
                fighter.facingRight = opponent.x > fighter.x;
                break;
              }
            }

            this.events.push({
              type: "special",
              playerId,
              targetId: opponent.id,
              amount: power,
              x: opponent.x,
              y: opponent.y,
              effectType,
            });
          }
        }
        break;
      }
    }
  }

  /**
   * Apply ink scaling to AOE damage based on ink spent during drawing.
   */
  private applyInkScaling(fighter: FighterState, baseDamage: number): number {
    const inkSpent = fighter.inkSpentOnCreation;
    const multiplier = 1 + inkSpent / AOE_DAMAGE_SCALING.inkDivisor;
    return baseDamage * multiplier;
  }

  /**
   * Process a gesture-based attack (tap, swipe, or draw). Applies damage to opponent.
   */
  handleGestureAttack(playerId: string, damage: number): void {
    const fighter = this.fighters.get(playerId);
    if (!fighter || fighter.hp <= 0) return;

    const opponent = this.getOpponent(playerId);
    if (!opponent || opponent.hp <= 0) return;

    this.applyDamage(opponent, damage, playerId);
    this.events.push({
      type: "meleeHit",
      playerId,
      targetId: opponent.id,
      amount: damage,
      x: opponent.x,
      y: opponent.y - 30,
    });
  }

  /**
   * Initialize battle start time (call this when battle phase begins).
   */
  startBattle(): void {
    this.battleStartTime = Date.now() / 1000;
  }

  /**
   * Check if battle has started (countdown finished).
   */
  private isBattleReady(): boolean {
    const elapsed = Date.now() / 1000 - this.battleStartTime;
    return elapsed >= this.BATTLE_START_DELAY_SEC;
  }

  /**
   * Run one physics tick.
   */
  tick(dt: number): BattleEvent[] {
    this.events = [];

    const battleReady = this.isBattleReady();

    // Update platforms
    for (const platform of this.platforms) {
      const config = platform.config;

      switch (config.pattern) {
        case "horizontal":
          if (config.speed && config.minX !== undefined && config.maxX !== undefined) {
            platform.x += platform.vx * dt;
            if (platform.x >= config.maxX) {
              platform.x = config.maxX;
              platform.vx = -config.speed;
            } else if (platform.x <= config.minX) {
              platform.x = config.minX;
              platform.vx = config.speed;
            } else if (platform.vx === 0) {
              platform.vx = config.speed;
            }
          }
          break;

        case "vertical":
          if (config.speed && config.minY !== undefined && config.maxY !== undefined) {
            platform.y += platform.vy * dt;
            if (platform.y >= config.maxY) {
              platform.y = config.maxY;
              platform.vy = -config.speed;
            } else if (platform.y <= config.minY) {
              platform.y = config.minY;
              platform.vy = config.speed;
            } else if (platform.vy === 0) {
              platform.vy = config.speed;
            }
          }
          break;

        case "circular":
          if (config.speed && config.radius && config.centerX !== undefined && config.centerY !== undefined) {
            platform.angle += (config.speed / config.radius) * dt;
            platform.x = config.centerX + Math.cos(platform.angle) * config.radius;
            platform.y = config.centerY + Math.sin(platform.angle) * config.radius;
            platform.vx = -Math.sin(platform.angle) * config.speed;
            platform.vy = Math.cos(platform.angle) * config.speed;
          }
          break;

        case "static":
        default:
          // No movement
          break;
      }
    }

    for (const [, fighter] of this.fighters) {
      if (fighter.hp <= 0 || fighter.isDead) continue;

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

      // Platform collision
      let onPlatform = false;
      fighter.onPlatformId = null;

      for (let i = 0; i < this.platforms.length; i++) {
        const platform = this.platforms[i];
        const config = platform.config;

        // Check if fighter is above platform and descending/stationary
        const isAbovePlatform = fighter.y <= platform.y && fighter.y + PLAYER_SIZE.height / 2 >= platform.y - 10;
        const isWithinPlatformX = fighter.x >= platform.x - config.width / 2 && fighter.x <= platform.x + config.width / 2;
        const isDescending = fighter.vy >= 0;

        if (isAbovePlatform && isWithinPlatformX && isDescending) {
          // Land on platform
          fighter.y = platform.y;
          fighter.vy = 0;
          fighter.isOnGround = true;
          onPlatform = true;
          fighter.onPlatformId = i;

          // Inherit platform velocity
          fighter.vx += platform.vx * dt * 60;
          fighter.vy += platform.vy * dt * 60;
          break;
        }
      }

      // Ground collision (if not on platform)
      if (!onPlatform && fighter.y >= GROUND_Y) {
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

      // Invulnerability timer
      if (fighter.isInvulnerable) {
        fighter.invulnerabilityTimer -= dt;
        if (fighter.invulnerabilityTimer <= 0) {
          fighter.isInvulnerable = false;
          fighter.invulnerabilityTimer = 0;
        }
      }

      // Status effect timers
      if (fighter.stunned) {
        fighter.stunnedTimer -= dt;
        if (fighter.stunnedTimer <= 0) {
          fighter.stunned = false;
          fighter.stunnedTimer = 0;
        }
      }

      if (fighter.slowed) {
        fighter.slowedTimer -= dt;
        if (fighter.slowedTimer <= 0) {
          fighter.slowed = false;
          fighter.slowedTimer = 0;
        }
      }

      if (fighter.poisoned) {
        fighter.poisonedTimer -= dt;
        if (fighter.poisonedTimer <= 0) {
          fighter.poisoned = false;
          fighter.poisonedTimer = 0;
          fighter.poisonDamage = 0;
        } else {
          // Apply poison damage over time
          const poisonDmg = fighter.poisonDamage * dt;
          this.applyDamage(fighter, poisonDmg);
        }
      }

      // Ink regen (disabled - no regeneration in new system)
      // fighter.ink = Math.min(fighter.maxInk, fighter.ink + fighter.inkRegen * dt);

      // Charge attack timer
      if (fighter.isCharging) {
        fighter.chargeTimer -= dt;
        if (fighter.chargeTimer <= 0) {
          // Release charged attack
          fighter.isCharging = false;
          fighter.chargeTimer = 0;

          const opponent = this.getOpponent(fighter.id);
          if (opponent) {
            const ability = fighter.abilities.find((a) => a.type === "chargeAttack");
            if (ability) {
              const dx = opponent.x - fighter.x;
              const dy = opponent.y - fighter.y;
              const dist = Math.sqrt(dx * dx + dy * dy);
              const range = 100; // Charge attack range

              if (dist <= range + PLAYER_SIZE.width) {
                const damage = (ability.params.damage as number) || 35;
                this.applyDamage(opponent, damage, fighter.id);

                // Apply extra knockback
                const knockbackDirection = Math.sign(dx) || 1;
                opponent.vx += knockbackDirection * damage * 40;
                opponent.vy -= damage * 0.6;
                opponent.isOnGround = false;

                this.events.push({
                  type: "chargeHit",
                  playerId: fighter.id,
                  targetId: opponent.id,
                  amount: damage,
                  x: opponent.x,
                  y: opponent.y,
                });
              }
            }
          }
        }
      }

      // Update facing direction toward opponent
      const opponent = this.getOpponent(fighter.id);
      if (opponent && Math.abs(fighter.vx) < 10) {
        fighter.facingRight = opponent.x > fighter.x;
      }

      // Jump cooldown
      fighter.jumpCooldown = Math.max(0, fighter.jumpCooldown - dt);

      // Idle movement timer
      fighter.idleTimer -= dt;
      if (fighter.idleTimer <= 0) {
        // Pick a new random idle target
        fighter.idleTimer = Math.random() * 4 + 2; // 2-6 seconds between movements
        fighter.idleTargetX = Math.random() * (ARENA_WIDTH - 100) + 50;
      }

      // Dodging logic: Check for incoming projectiles and jump to dodge
      if (battleReady && fighter.isOnGround && fighter.jumpCooldown <= 0) {
        for (const proj of this.projectiles) {
          if (!proj.active) continue;
          const projTeam = this.getTeamId(proj.ownerId);
          if (projTeam === fighter.ownerId) continue;

          const dx = proj.x - fighter.x;
          const dy = proj.y - fighter.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          // If projectile is close and heading toward fighter, try to dodge
          if (dist < 150) {
            const projVelToFighter = proj.vx * dx + proj.vy * dy;
            if (projVelToFighter < 0) { // Projectile moving toward fighter
              // 40% chance to dodge when projectile is incoming
              if (Math.random() < 0.4) {
                fighter.vy = -350; // Jump
                fighter.isOnGround = false;
                fighter.jumpCooldown = 1.5; // Can't jump again for 1.5 seconds
                break;
              }
            }
          }
        }

        // Also dodge when opponent is very close (melee range)
        if (opponent && opponent.hp > 0 && Math.random() < 0.15) {
          const dx = opponent.x - fighter.x;
          const dy = opponent.y - fighter.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < 80) { // Very close
            fighter.vy = -350; // Jump
            fighter.isOnGround = false;
            fighter.jumpCooldown = 2; // Can't jump again for 2 seconds
          }
        }
      }

      // AI Auto-trigger abilities
      if (battleReady && opponent && opponent.hp > 0 && !fighter.stunned && !fighter.isCharging) {
        const dx = opponent.x - fighter.x;
        const dy = opponent.y - fighter.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        // Auto-trigger DASH
        const dashAbility = fighter.abilities.find((a) => a.type === "dash");
        if (dashAbility && dashAbility.cooldownRemaining <= 0) {
          const inkCost = BATTLE_INK_COSTS.dash || 10;
          let shouldDash = false;

          // Gap closer: enemy far away
          if (dist > 200 && fighter.ink >= inkCost) {
            shouldDash = Math.random() < 0.3;
          }

          // Retreat: enemy very close and low HP
          if (dist < 50 && fighter.hp < fighter.maxHp * 0.3 && fighter.ink >= inkCost) {
            shouldDash = Math.random() < 0.5;
          }

          if (shouldDash) {
            this.handleAbility(fighter.id, "dash", opponent.x, opponent.y);
          }
        }

        // Auto-trigger SHIELD
        const shieldAbility = fighter.abilities.find((a) => a.type === "shield");
        if (shieldAbility && shieldAbility.cooldownRemaining <= 0 && !fighter.isShielding) {
          const inkCost = BATTLE_INK_COSTS.shield || 15;
          let shouldShield = false;

          // Incoming projectile detected
          for (const proj of this.projectiles) {
            if (!proj.active) continue;
            const projTeam = this.getTeamId(proj.ownerId);
            if (projTeam === fighter.ownerId) continue;

            const projDx = proj.x - fighter.x;
            const projDy = proj.y - fighter.y;
            const projDist = Math.sqrt(projDx * projDx + projDy * projDy);

            if (projDist < 100) {
              const projVelToFighter = proj.vx * projDx + proj.vy * projDy;
              if (projVelToFighter < 0 && fighter.ink >= inkCost) {
                shouldShield = Math.random() < 0.6;
                break;
              }
            }
          }

          // Enemy charging attack nearby
          if (opponent.isCharging && dist < 120 && fighter.ink >= inkCost) {
            shouldShield = Math.random() < 0.7;
          }

          // Low HP defensive mode
          if (fighter.hp < fighter.maxHp * 0.3 && fighter.ink >= inkCost) {
            shouldShield = Math.random() < 0.4;
          }

          if (shouldShield) {
            this.handleAbility(fighter.id, "shield");
          }
        }

        // Auto-trigger CHARGE ATTACK
        const chargeAbility = fighter.abilities.find((a) => a.type === "chargeAttack");
        if (chargeAbility && chargeAbility.cooldownRemaining <= 0) {
          const inkCost = BATTLE_INK_COSTS.chargeAttack || 20;
          let shouldCharge = false;

          // Enemy in range, not under immediate threat, random chance
          if (dist < 150 && dist > 50 && fighter.hp > fighter.maxHp * 0.3 && fighter.ink >= inkCost) {
            shouldCharge = Math.random() < 0.3;
          }

          if (shouldCharge) {
            this.handleAbility(fighter.id, "chargeAttack");
          }
        }

        // Auto-trigger SPECIAL ATTACK
        const specialAbility = fighter.abilities.find((a) => a.type === "special");
        if (specialAbility && specialAbility.cooldownRemaining <= 0) {
          const inkCost = BATTLE_INK_COSTS.special || 25;
          let shouldSpecial = false;

          // Random 20% chance when cooldown ready
          if (fighter.ink >= inkCost) {
            shouldSpecial = Math.random() < 0.2;
          }

          if (shouldSpecial) {
            this.handleAbility(fighter.id, "special");
          }
        }
      }

      // Autoattack logic - only after battle countdown finishes (and not stunned or charging)
      if (battleReady && opponent && opponent.hp > 0 && !fighter.stunned && !fighter.isCharging) {
        fighter.autoAttackCooldown = Math.max(0, fighter.autoAttackCooldown - dt);

        const dx = opponent.x - fighter.x;
        const dy = opponent.y - fighter.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        // AI Movement: Move toward opponent if out of melee range
        const speedMultiplier = fighter.slowed ? 0.5 : 1.0;

        if (fighter.primaryAttackType === "melee") {
          const ability = fighter.abilities.find((a) => a.type === "melee");
          const meleeRange = (ability?.params.range as number) || 40;

          if (dist > meleeRange + PLAYER_SIZE.width + 10) {
            // Move toward opponent
            const moveSpeed = fighter.movementSpeed * 50 * speedMultiplier;
            fighter.vx += (dx / dist) * moveSpeed * dt * 60;
          } else {
            // Stop when in range
            fighter.vx *= 0.85;
          }
        } else {
          // Ranged fighters: do idle movement when not attacking
          if (fighter.autoAttackCooldown <= 0 && fighter.idleTargetX !== undefined) {
            const idleDx = fighter.idleTargetX - fighter.x;
            if (Math.abs(idleDx) > 20) {
              const idleMoveSpeed = fighter.movementSpeed * 20 * speedMultiplier;
              fighter.vx += Math.sign(idleDx) * idleMoveSpeed * dt * 60;
            }
          }
        }

        if (fighter.autoAttackCooldown <= 0) {
          const ability = fighter.abilities.find((a) => a.type === fighter.primaryAttackType);
          if (ability && ability.cooldownRemaining <= 0) {
            const inkCost = BATTLE_INK_COSTS[ability.type] || 5;

            if (fighter.ink >= inkCost) {
              let canAttack = false;

              if (ability.type === "melee") {
                const range = (ability.params.range as number) || 40;
                canAttack = dist <= range + PLAYER_SIZE.width;
              } else if (ability.type === "fireProjectile") {
                // Projectiles have unlimited range
                canAttack = true;
              }

              if (canAttack) {
                fighter.ink -= inkCost;
                ability.cooldownRemaining = ability.cooldownMax;

                // Increment combo counter for attack variety
                fighter.comboCounter = (fighter.comboCounter + 1) % 5;

                // Varied cooldown based on attack type
                const isComboAttack = fighter.comboCounter === 3; // Every 4th attack
                const isChargedAttack = fighter.comboCounter === 4; // Every 5th attack

                fighter.autoAttackCooldown = isComboAttack ? 0.1 : (isChargedAttack ? 0.6 : 0.3);

                // Execute attack with variety
                if (ability.type === "melee") {
                  const baseDamage = (ability.params.damage as number) || 15;
                  const damage = isChargedAttack ? baseDamage * 1.5 : baseDamage;
                  this.applyDamage(opponent, damage, fighter.id);
                  this.events.push({
                    type: "meleeHit",
                    playerId: fighter.id,
                    targetId: opponent.id,
                    amount: damage,
                  });
                } else if (ability.type === "fireProjectile") {
                  const baseSpeed = (ability.params.speed as number) || 5;
                  const projSpeed = baseSpeed * 100;
                  const isHoming = Boolean(ability.params.homing);
                  const baseDamage = (ability.params.damage as number) || 10;

                  // Double shot for combo attacks
                  const shotCount = isComboAttack ? 2 : 1;
                  const damagePerShot = isChargedAttack ? baseDamage * 1.3 : baseDamage;

                  for (let i = 0; i < shotCount; i++) {
                    const angleOffset = shotCount > 1 ? (i === 0 ? -0.2 : 0.2) : 0;
                    const angle = Math.atan2(dy, dx) + angleOffset;
                    const vx = Math.cos(angle) * projSpeed;
                    const vy = Math.sin(angle) * projSpeed;

                    this.projectiles.push({
                      id: `proj_${this.nextProjectileId++}`,
                      ownerId: fighter.id,
                      x: fighter.x + (fighter.facingRight ? 30 : -30),
                      y: fighter.y - 10 + (i * 5),
                      vx,
                      vy,
                      damage: damagePerShot,
                      active: true,
                      age: 0,
                      homing: isHoming,
                      speed: baseSpeed,
                      isAOE: false,
                      aoeRadius: 0,
                    });
                  }

                  this.events.push({
                    type: "projectileSpawn",
                    playerId: fighter.id,
                    x: fighter.x,
                    y: fighter.y,
                  });
                }
              }
            }
          }
        }
      }
    }

    // Update projectiles
    for (const proj of this.projectiles) {
      if (!proj.active) continue;

      // Homing projectile logic
      if (proj.homing) {
        const target = this.getOpponent(proj.ownerId);
        if (target && target.hp > 0) {
          const dx = target.x - proj.x;
          const dy = target.y - proj.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;

          // Gradually adjust velocity toward target
          const homingStrength = 0.15; // How quickly it homes in
          const targetSpeed = proj.speed * 100;
          const targetVx = (dx / dist) * targetSpeed;
          const targetVy = (dy / dist) * targetSpeed;

          proj.vx += (targetVx - proj.vx) * homingStrength;
          proj.vy += (targetVy - proj.vy) * homingStrength;
        }
      }

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

      // Check collision with fighters (skip same-team fighters)
      const projTeam = this.getTeamId(proj.ownerId);
      for (const [, fighter] of this.fighters) {
        if (fighter.ownerId === projTeam) continue;
        if (fighter.hp <= 0) continue;

        const dx = proj.x - fighter.x;
        const dy = proj.y - fighter.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < PLAYER_SIZE.width / 2 + PROJECTILE_SIZE) {
          // Hit!
          if (proj.isAOE) {
            // AOE explosion - hit all enemies within radius
            const owner = this.fighters.get(proj.ownerId);
            const inkScaledDamage = owner ? this.applyInkScaling(owner, proj.damage) : proj.damage;

            for (const [, target] of this.fighters) {
              if (target.ownerId === projTeam) continue;
              if (target.hp <= 0) continue;

              const tdx = target.x - proj.x;
              const tdy = target.y - proj.y;
              const tdist = Math.sqrt(tdx * tdx + tdy * tdy);

              if (tdist <= proj.aoeRadius + PLAYER_SIZE.width / 2) {
                this.applyDamage(target, inkScaledDamage, proj.ownerId);

                this.events.push({
                  type: "damage",
                  playerId: proj.ownerId,
                  targetId: target.id,
                  amount: inkScaledDamage,
                  x: target.x,
                  y: target.y,
                });
              }
            }

            // Broadcast AOE explosion
            this.events.push({
              type: "aoeExplosion",
              playerId: proj.ownerId,
              x: proj.x,
              y: proj.y,
              radius: proj.aoeRadius,
            });
          } else {
            // Regular single-target projectile
            this.applyDamage(fighter, proj.damage, proj.ownerId);
            this.events.push({
              type: "damage",
              playerId: proj.ownerId,
              targetId: fighter.id,
              amount: proj.damage,
              x: proj.x,
              y: proj.y,
            });
          }

          proj.active = false;
          break;
        }
      }
    }

    // Remove inactive projectiles
    this.projectiles = this.projectiles.filter((p) => p.active);

    // Check for death (only emit event once per fighter)
    for (const [, fighter] of this.fighters) {
      if (fighter.hp <= 0 && !fighter.isDead) {
        fighter.isDead = true;
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
  private applyDamage(fighter: FighterState, amount: number, attackerId?: string): void {
    if (fighter.isShielding && fighter.shieldHp > 0) {
      const blocked = Math.min(amount, fighter.shieldHp);
      fighter.shieldHp -= blocked;
      amount -= blocked;
      if (fighter.shieldHp <= 0) {
        fighter.isShielding = false;
      }
    }
    fighter.hp = Math.max(0, fighter.hp - amount);

    // Apply knockback - ALWAYS apply knockback on ANY damage, increased 5x for dramatic battles
    if (amount > 0) {
      let knockbackDirection = 1;

      if (attackerId) {
        const attacker = this.fighters.get(attackerId);
        if (attacker) {
          const dx = fighter.x - attacker.x;
          knockbackDirection = Math.sign(dx) || 1;
        }
      }

      const knockbackForce = amount * 25; // 5x multiplier (was 15, now 25)
      fighter.vx += knockbackDirection * knockbackForce;
      // Significant upward knock for dramatic effect
      fighter.vy -= knockbackForce * 0.4;
      fighter.isOnGround = false;
    }
  }

  private getTeamId(fighterId: string): string | undefined {
    return this.fighters.get(fighterId)?.ownerId;
  }

  /**
   * Get the nearest alive enemy of a given fighter (different team).
   */
  private getOpponent(playerId: string): FighterState | undefined {
    const teamId = this.getTeamId(playerId);
    for (const [, fighter] of this.fighters) {
      if (fighter.ownerId !== teamId && !fighter.isDead && fighter.hp > 0) return fighter;
    }
    return undefined;
  }

  /**
   * Check if the battle is over. A team wins when only their fighters remain alive.
   */
  getWinnerId(): string | null {
    const aliveTeams = new Set<string>();
    for (const [, fighter] of this.fighters) {
      if (fighter.hp > 0 && !fighter.isDead) {
        aliveTeams.add(fighter.ownerId);
      }
    }
    if (aliveTeams.size === 1) return [...aliveTeams][0];
    if (aliveTeams.size === 0) return "draw";
    return null;
  }
}
