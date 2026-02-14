import { BaseComponent, ComponentOwner, ComponentTarget, ComponentOutput } from "./BaseComponent";
import type { ComponentType, FlyingParams } from "@shared/types";
import { GROUND_Y } from "@shared/types";

export class FlyingComponent extends BaseComponent {
  readonly type: ComponentType = "flying";
  readonly cooldown = 0.3; // Small cooldown between fly activations
  readonly speed: number;
  readonly maxAltitude: number;

  constructor(params: FlyingParams) {
    super();
    this.speed = params.speed;
    this.maxAltitude = params.maxAltitude || 250;
  }

  activate(
    owner: ComponentOwner,
    _ownerId: string,
    target?: ComponentTarget
  ): ComponentOutput | null {
    // Fly upward (or toward target Y if provided)
    const targetY = target?.y ?? (GROUND_Y - this.maxAltitude);
    const dy = targetY - owner.y;
    const flySpeed = this.speed * 80;

    this.startCooldown();

    return {
      dy: Math.sign(dy) * Math.min(Math.abs(dy), flySpeed) * -1, // Negative Y is up
    };
  }
}
