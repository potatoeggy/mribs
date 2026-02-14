import { BaseComponent, ComponentOwner, ComponentTarget, ComponentOutput } from "./BaseComponent";
import type { ComponentType, MeleeParams } from "@shared/types";

export class MeleeComponent extends BaseComponent {
  readonly type: ComponentType = "melee";
  readonly cooldown: number;
  readonly damage: number;
  readonly range: number;

  constructor(params: MeleeParams) {
    super();
    this.damage = params.damage;
    this.range = params.range;
    this.cooldown = params.cooldown;
  }

  activate(
    owner: ComponentOwner,
    _ownerId: string,
    target?: ComponentTarget
  ): ComponentOutput | null {
    if (!this.isReady) return null;

    this.startCooldown();

    // Check if target is within melee range
    if (target) {
      const dx = target.x - owner.x;
      const dy = target.y - owner.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist <= this.range) {
        return { damage: this.damage };
      }
    }

    // Even if out of range, still trigger the attack (might hit via collision detection)
    return { damage: this.damage };
  }
}
