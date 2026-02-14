import { BaseComponent, ComponentOwner, ComponentOutput } from "./BaseComponent";
import type { ComponentType, ShieldParams } from "@shared/types";

export class ShieldComponent extends BaseComponent {
  readonly type: ComponentType = "shield";
  readonly cooldown: number;
  readonly blockAmount: number;
  readonly duration: number;

  private shieldTimer: number = 0;

  constructor(params: ShieldParams) {
    super();
    this.blockAmount = params.blockAmount;
    this.duration = params.duration;
    this.cooldown = params.cooldown;
  }

  override update(dt: number): void {
    super.update(dt);
    if (this.shieldTimer > 0) {
      this.shieldTimer -= dt;
      if (this.shieldTimer <= 0) {
        this.shieldTimer = 0;
      }
    }
  }

  get isShieldActive(): boolean {
    return this.shieldTimer > 0;
  }

  activate(
    _owner: ComponentOwner,
    _ownerId: string,
  ): ComponentOutput | null {
    if (!this.isReady) return null;

    this.startCooldown();
    this.shieldTimer = this.duration;

    return {
      shieldActive: true,
      shieldHp: this.blockAmount,
    };
  }
}
