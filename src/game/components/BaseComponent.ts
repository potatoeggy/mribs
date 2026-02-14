import type { ComponentType } from "@shared/types";

export interface ComponentOwner {
  x: number;
  y: number;
  vx: number;
  vy: number;
  facingRight: boolean;
  isOnGround: boolean;
  hp: number;
  maxHp: number;
  isShielding: boolean;
  shieldHp: number;
}

export interface ComponentTarget {
  x: number;
  y: number;
}

export interface SpawnProjectile {
  x: number;
  y: number;
  vx: number;
  vy: number;
  damage: number;
  ownerId: string;
}

export interface ComponentOutput {
  dx?: number; // horizontal velocity change
  dy?: number; // vertical velocity change
  damage?: number; // direct damage dealt (melee)
  shieldActive?: boolean;
  shieldHp?: number;
  spawnProjectile?: SpawnProjectile;
}

export abstract class BaseComponent {
  abstract readonly type: ComponentType;
  cooldownRemaining: number = 0;
  abstract readonly cooldown: number;

  get isReady(): boolean {
    return this.cooldownRemaining <= 0;
  }

  update(dt: number): void {
    if (this.cooldownRemaining > 0) {
      this.cooldownRemaining -= dt;
      if (this.cooldownRemaining < 0) {
        this.cooldownRemaining = 0;
      }
    }
  }

  abstract activate(
    owner: ComponentOwner,
    ownerId: string,
    target?: ComponentTarget
  ): ComponentOutput | null;

  startCooldown(): void {
    this.cooldownRemaining = this.cooldown;
  }

  serialize(): { type: string; cooldownRemaining: number } {
    return {
      type: this.type,
      cooldownRemaining: this.cooldownRemaining,
    };
  }
}
