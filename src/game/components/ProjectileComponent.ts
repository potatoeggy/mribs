import { BaseComponent, ComponentOwner, ComponentTarget, ComponentOutput } from "./BaseComponent";
import type { ComponentType, ProjectileParams } from "@shared/types";

export class ProjectileComponent extends BaseComponent {
  readonly type: ComponentType = "fireProjectile";
  readonly cooldown: number;
  readonly damage: number;
  readonly speed: number;
  readonly label: string;

  constructor(params: ProjectileParams) {
    super();
    this.damage = params.damage;
    this.cooldown = params.cooldown;
    this.speed = params.speed;
    this.label = params.label;
  }

  activate(
    owner: ComponentOwner,
    ownerId: string,
    target?: ComponentTarget
  ): ComponentOutput | null {
    if (!this.isReady) return null;

    this.startCooldown();

    // Calculate direction to target, or fire in facing direction
    let vx: number;
    let vy: number;

    if (target) {
      const dx = target.x - owner.x;
      const dy = target.y - owner.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist === 0) {
        vx = owner.facingRight ? 1 : -1;
        vy = 0;
      } else {
        vx = (dx / dist);
        vy = (dy / dist);
      }
    } else {
      vx = owner.facingRight ? 1 : -1;
      vy = 0;
    }

    const projectileSpeed = this.speed * 100; // Convert to pixels/second

    return {
      spawnProjectile: {
        x: owner.x + (owner.facingRight ? 30 : -30),
        y: owner.y - 10,
        vx: vx * projectileSpeed,
        vy: vy * projectileSpeed,
        damage: this.damage,
        ownerId,
      },
    };
  }
}
