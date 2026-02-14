import Phaser from "phaser";
import { ARENA_WIDTH, ARENA_HEIGHT, GROUND_Y } from "@shared/types";

interface FighterDisplay {
  id: string;
  sprite: Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle;
  nameText: Phaser.GameObjects.Text;
  hpBarBg: Phaser.GameObjects.Rectangle;
  hpBarFill: Phaser.GameObjects.Rectangle;
  shieldGraphic: Phaser.GameObjects.Arc | null;
  targetX: number;
  targetY: number;
}

interface ProjectileDisplay {
  id: string;
  graphic: Phaser.GameObjects.Arc;
}

interface BattleState {
  players: Map<string, {
    x: number;
    y: number;
    hp: number;
    maxHp: number;
    ink: number;
    maxInk: number;
    facingRight: boolean;
    isShielding: boolean;
    fighterName: string;
    abilities: { abilityType: string; cooldownRemaining: number; cooldownMax: number; label: string }[];
  }>;
  projectiles: { id: string; x: number; y: number; ownerId: string }[];
}

export class BattleScene extends Phaser.Scene {
  private fighters: Map<string, FighterDisplay> = new Map();
  private projectileDisplays: Map<string, ProjectileDisplay> = new Map();

  constructor() {
    super({ key: "BattleScene" });
  }

  create(): void {
    this.drawArenaBackground();
  }

  update(): void {
    for (const [, fighter] of this.fighters) {
      const sprite = fighter.sprite;
      const lerpFactor = 0.3;
      sprite.x += (fighter.targetX - sprite.x) * lerpFactor;
      sprite.y += (fighter.targetY - sprite.y) * lerpFactor;

      fighter.nameText.x = sprite.x;
      fighter.nameText.y = sprite.y - 55;
      fighter.hpBarBg.x = sprite.x;
      fighter.hpBarBg.y = sprite.y - 42;
      fighter.hpBarFill.x = sprite.x - 24;
      fighter.hpBarFill.y = sprite.y - 42;

      if (fighter.shieldGraphic) {
        fighter.shieldGraphic.x = sprite.x;
        fighter.shieldGraphic.y = sprite.y;
      }

      sprite.setRotation(Math.sin(this.time.now * 0.005 + sprite.x) * 0.03);
    }
  }

  updateState(state: BattleState): void {
    state.players.forEach((data, id) => {
      let fighter = this.fighters.get(id);

      if (!fighter) {
        fighter = this.createFighterDisplay(id, data.fighterName);
        this.fighters.set(id, fighter);
      }

      fighter.targetX = data.x;
      fighter.targetY = data.y;

      if (fighter.sprite instanceof Phaser.GameObjects.Image) {
        fighter.sprite.setFlipX(!data.facingRight);
      }

      const hpFraction = Math.max(0, data.hp / data.maxHp);
      fighter.hpBarFill.width = 48 * hpFraction;
      fighter.hpBarFill.fillColor = hpFraction > 0.5 ? 0x2ecc71 : hpFraction > 0.25 ? 0xf39c12 : 0xe74c3c;

      if (data.isShielding) {
        if (!fighter.shieldGraphic) {
          fighter.shieldGraphic = this.add.circle(data.x, data.y, 40, 0x3498db, 0.25);
          fighter.shieldGraphic.setStrokeStyle(2, 0x3498db, 0.6);
          fighter.shieldGraphic.setDepth(5);
        }
        fighter.shieldGraphic.setVisible(true);
      } else if (fighter.shieldGraphic) {
        fighter.shieldGraphic.setVisible(false);
      }
    });

    for (const [id] of this.fighters) {
      if (!state.players.has(id)) {
        this.removeFighter(id);
      }
    }

    const activeProjectileIds = new Set(state.projectiles.map((p) => p.id));

    for (const [id, display] of this.projectileDisplays) {
      if (!activeProjectileIds.has(id)) {
        display.graphic.destroy();
        this.projectileDisplays.delete(id);
      }
    }

    for (const proj of state.projectiles) {
      let display = this.projectileDisplays.get(proj.id);
      if (!display) {
        const graphic = this.add.circle(proj.x, proj.y, 6, 0x1a1a1a);
        graphic.setStrokeStyle(2, 0x333333);
        graphic.setDepth(10);
        display = { id: proj.id, graphic };
        this.projectileDisplays.set(proj.id, display);
      }
      display.graphic.x += (proj.x - display.graphic.x) * 0.5;
      display.graphic.y += (proj.y - display.graphic.y) * 0.5;
    }
  }

  loadFighterSprite(playerId: string, spriteDataUrl: string): void {
    const textureKey = `fighter_${playerId}`;

    if (this.textures.exists(textureKey)) {
      this.textures.remove(textureKey);
    }

    const img = new Image();
    img.onload = () => {
      try {
        if (!this.sys?.game?.renderer) return;
        if (this.textures.exists(textureKey)) {
          this.textures.remove(textureKey);
        }
        this.textures.addImage(textureKey, img);

        const fighter = this.fighters.get(playerId);
        if (fighter) {
          const oldSprite = fighter.sprite;
          const newSprite = this.add.image(oldSprite.x, oldSprite.y, textureKey);
          newSprite.setDisplaySize(60, 60);
          newSprite.setDepth(3);
          oldSprite.destroy();
          fighter.sprite = newSprite;
        }
      } catch {
        // scene was destroyed before image loaded
      }
    };
    img.src = spriteDataUrl;
  }

  showDamageNumber(x: number, y: number, amount: number): void {
    const text = this.add.text(x, y - 20, `-${amount}`, {
      fontFamily: '"Caveat", cursive',
      fontSize: "24px",
      color: "#e74c3c",
      fontStyle: "bold",
    });
    text.setOrigin(0.5);
    text.setDepth(50);

    this.tweens.add({
      targets: text,
      y: y - 60,
      alpha: 0,
      duration: 800,
      ease: "Power2",
      onComplete: () => text.destroy(),
    });
  }

  showDeathAnimation(playerId: string): void {
    const fighter = this.fighters.get(playerId);
    if (!fighter) return;

    this.tweens.add({
      targets: fighter.sprite,
      alpha: 0,
      scaleX: 0.1,
      scaleY: 0.1,
      rotation: Math.PI * 2,
      duration: 1000,
      ease: "Power3",
    });
  }

  private drawArenaBackground(): void {
    const g = this.add.graphics();
    g.setDepth(0);

    g.fillStyle(0xfefef6);
    g.fillRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);

    g.lineStyle(0.5, 0xe8e8e0);
    for (let y = 30; y < ARENA_HEIGHT; y += 30) {
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(ARENA_WIDTH, y);
      g.strokePath();
    }

    g.lineStyle(3, 0x8b7355);
    g.beginPath();
    g.moveTo(0, GROUND_Y + 5);
    for (let x = 0; x < ARENA_WIDTH; x += 8) {
      const wobble = Math.sin(x * 0.05) * 2 + Math.random() * 1;
      g.lineTo(x, GROUND_Y + 5 + wobble);
    }
    g.strokePath();

    g.fillStyle(0xf0e6d3, 0.5);
    g.fillRect(0, GROUND_Y + 5, ARENA_WIDTH, ARENA_HEIGHT - GROUND_Y);
  }

  private createFighterDisplay(id: string, name: string): FighterDisplay {
    const sprite = this.add.rectangle(ARENA_WIDTH / 2, GROUND_Y, 50, 60, 0x333333);
    sprite.setDepth(3);

    const nameText = this.add.text(sprite.x, sprite.y - 55, name || "???", {
      fontFamily: '"Caveat", cursive',
      fontSize: "16px",
      color: "#333",
    });
    nameText.setOrigin(0.5);
    nameText.setDepth(4);

    const hpBarBg = this.add.rectangle(sprite.x, sprite.y - 42, 50, 8, 0xcccccc);
    hpBarBg.setStrokeStyle(1, 0x666666);
    hpBarBg.setDepth(4);

    const hpBarFill = this.add.rectangle(sprite.x - 24, sprite.y - 42, 48, 6, 0x2ecc71);
    hpBarFill.setOrigin(0, 0.5);
    hpBarFill.setDepth(5);

    return {
      id,
      sprite,
      nameText,
      hpBarBg,
      hpBarFill,
      shieldGraphic: null,
      targetX: sprite.x,
      targetY: sprite.y,
    };
  }

  private removeFighter(id: string): void {
    const fighter = this.fighters.get(id);
    if (!fighter) return;
    fighter.sprite.destroy();
    fighter.nameText.destroy();
    fighter.hpBarBg.destroy();
    fighter.hpBarFill.destroy();
    if (fighter.shieldGraphic) fighter.shieldGraphic.destroy();
    this.fighters.delete(id);
  }
}
