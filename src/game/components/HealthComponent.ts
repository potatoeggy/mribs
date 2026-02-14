/**
 * HealthComponent manages the HP pool for a fighter.
 * This is not a BaseComponent since HP is a passive stat, not an activatable ability.
 */

export class HealthComponent {
  hp: number;
  maxHp: number;

  constructor(maxHp: number) {
    this.maxHp = maxHp;
    this.hp = maxHp;
  }

  get isDead(): boolean {
    return this.hp <= 0;
  }

  get hpFraction(): number {
    return this.hp / this.maxHp;
  }

  takeDamage(amount: number, shieldHp: number): { remainingDamage: number; newShieldHp: number } {
    // Shield absorbs damage first
    if (shieldHp > 0) {
      const shieldDamage = Math.min(amount, shieldHp);
      shieldHp -= shieldDamage;
      amount -= shieldDamage;
    }

    // Apply remaining damage to HP
    this.hp = Math.max(0, this.hp - amount);

    return { remainingDamage: amount, newShieldHp: shieldHp };
  }

  heal(amount: number): void {
    this.hp = Math.min(this.maxHp, this.hp + amount);
  }
}
