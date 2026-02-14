import { BaseComponent, ComponentOwner, ComponentTarget, ComponentOutput } from "./BaseComponent";
import type { ComponentType, MovementParams } from "@shared/types";

export class MovementComponent extends BaseComponent {
  readonly type: ComponentType = "movement";
  readonly cooldown = 0; // No cooldown for movement
  readonly speed: number;
  readonly movementType: "walk" | "hover";

  constructor(params: MovementParams) {
    super();
    this.speed = params.speed;
    this.movementType = params.type;
  }

  activate(
    owner: ComponentOwner,
    _ownerId: string,
    target?: ComponentTarget
  ): ComponentOutput | null {
    if (!target) return null;

    const dx = target.x - owner.x;
    const speed = this.speed * 60; // Convert to pixels/second

    return {
      dx: Math.sign(dx) * speed,
    };
  }
}
