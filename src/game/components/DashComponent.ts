import { BaseComponent, ComponentOwner, ComponentTarget, ComponentOutput } from "./BaseComponent";
import type { ComponentType, DashParams } from "@shared/types";

export class DashComponent extends BaseComponent {
  readonly type: ComponentType = "dash";
  readonly cooldown: number;
  readonly distance: number;

  constructor(params: DashParams) {
    super();
    this.distance = params.distance;
    this.cooldown = params.cooldown;
  }

  activate(
    owner: ComponentOwner,
    _ownerId: string,
    target?: ComponentTarget
  ): ComponentOutput | null {
    if (!this.isReady) return null;

    this.startCooldown();

    // Dash toward target, or in facing direction
    let dx: number;
    if (target) {
      dx = target.x - owner.x;
    } else {
      dx = owner.facingRight ? 1 : -1;
    }

    const direction = Math.sign(dx);
    // Apply a large burst of velocity
    return {
      dx: direction * this.distance * 5, // burst velocity
    };
  }
}
