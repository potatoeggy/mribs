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
  /** When set, update() skips position lerp until this time (ms) - for attack animations */
  ignoreLerpUntil?: number;
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

interface FallingDrawing {
  sprite: Phaser.GameObjects.Image;
  targetId: string;
  textureKey: string;
  hit: boolean;
}

export class BattleScene extends Phaser.Scene {
  private fighters: Map<string, FighterDisplay> = new Map();
  private projectileDisplays: Map<string, ProjectileDisplay> = new Map();
  private fallingDrawings: FallingDrawing[] = [];

  constructor() {
    super({ key: "BattleScene" });
  }

  create(): void {
    this.drawArenaBackground();
  }

  update(): void {
    const now = this.time.now;
    for (const [, fighter] of this.fighters) {
      const sprite = fighter.sprite;
      const skipLerp = fighter.ignoreLerpUntil != null && now < fighter.ignoreLerpUntil;
      if (!skipLerp) {
        const lerpFactor = 0.3;
        sprite.x += (fighter.targetX - sprite.x) * lerpFactor;
        sprite.y += (fighter.targetY - sprite.y) * lerpFactor;
      }

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

    for (let i = this.fallingDrawings.length - 1; i >= 0; i--) {
      const fd = this.fallingDrawings[i];
      if (!fd.sprite.active || fd.hit) continue;
      const target = this.fighters.get(fd.targetId);
      if (target) {
        const dx = fd.sprite.x - target.sprite.x;
        const drawY = fd.sprite.y;
        const targetY = target.sprite.y;
        const hasReachedFighter = drawY >= targetY - 25;
        if (Math.abs(dx) < 50 && hasReachedFighter && drawY <= targetY + 60) {
          fd.hit = true;
          const body = fd.sprite.body as Phaser.Physics.Arcade.Body;
          if (body) {
            body.setVelocity(0, 0);
            body.setGravityY(0);
          }
          const hit = this.add.circle(fd.sprite.x, fd.sprite.y, 15, 0xe74c3c, 0.4);
          hit.setDepth(30);
          this.tweens.add({
            targets: hit,
            scale: 2,
            alpha: 0,
            duration: 250,
            onComplete: () => hit.destroy(),
          });
          // Keep drawing visible on opponent for ~1.2s, then fade out
          this.tweens.add({
            targets: fd.sprite,
            alpha: 0,
            duration: 1200,
            delay: 400,
            ease: "Quad.easeIn",
            onComplete: () => {
              fd.sprite.destroy();
              if (this.textures.exists(fd.textureKey)) this.textures.remove(fd.textureKey);
              this.fallingDrawings.splice(i, 1);
            },
          });
        }
      }
      if (fd.sprite.y > GROUND_Y + 20) {
        fd.hit = true;
        this.tweens.add({
          targets: fd.sprite,
          alpha: 0,
          duration: 600,
          onComplete: () => {
            fd.sprite.destroy();
            if (this.textures.exists(fd.textureKey)) this.textures.remove(fd.textureKey);
            const idx = this.fallingDrawings.indexOf(fd);
            if (idx !== -1) this.fallingDrawings.splice(idx, 1);
          },
        });
      }
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

    fighter.nameText.setVisible(false);
    fighter.hpBarBg.setVisible(false);
    fighter.hpBarFill.setVisible(false);
    if (fighter.shieldGraphic) fighter.shieldGraphic.setVisible(false);

    const sprite = fighter.sprite;
    const x = sprite.x;
    const y = sprite.y;

    sprite.setDepth(50);

    this.tweens.add({
      targets: sprite,
      scaleX: 1.4,
      scaleY: 1.4,
      alpha: 0.95,
      duration: 120,
      ease: "Quad.easeOut",
      onComplete: () => {
        this.tweens.add({
          targets: sprite,
          y: y + 140,
          scaleX: 0.15,
          scaleY: 0.15,
          rotation: Math.PI * 2,
          alpha: 0,
          duration: 900,
          ease: "Cubic.easeIn",
        });
      },
    });

    const flash = this.add.rectangle(ARENA_WIDTH / 2, ARENA_HEIGHT / 2, ARENA_WIDTH * 2, ARENA_HEIGHT * 2, 0xffffff, 0);
    flash.setDepth(55);
    this.tweens.add({ targets: flash, alpha: 0.4, duration: 80 });
    this.tweens.add({ targets: flash, alpha: 0, duration: 250, delay: 100, onComplete: () => flash.destroy() });

    const koText = this.add.text(ARENA_WIDTH / 2, 130, "K.O.", {
      fontFamily: '"Caveat", cursive',
      fontSize: "96px",
      color: "#1a1a1a",
      fontStyle: "bold",
    });
    koText.setOrigin(0.5);
    koText.setDepth(60);
    koText.setAlpha(0);
    koText.setScale(0.1);
    koText.setStroke("#e74c3c", 8);
    this.time.delayedCall(80, () => {
      this.tweens.add({
        targets: koText,
        alpha: 1,
        scale: 1.4,
        duration: 250,
        ease: "Back.easeOut",
      });
      this.time.delayedCall(600, () => {
        this.tweens.add({
          targets: koText,
          alpha: 0,
          scale: 1.1,
          duration: 350,
          onComplete: () => koText.destroy(),
        });
      });
    });
  }

  playGestureAttackVisual(data: {
    playerId: string;
    targetId: string;
    gesture: string;
    action: string;
    power: number;
    drawingData?: string;
  }): void {
    const attacker = this.fighters.get(data.playerId);
    const target = this.fighters.get(data.targetId);
    if (!attacker || !target) return;

    if (data.gesture === "tap") {
      this.playTapAttack(attacker, target, data.action);
    } else if (data.gesture === "swipe") {
      this.playSwipeAttack(attacker, target, data.action);
    } else if (data.gesture === "draw") {
      this.playDrawAttack(data.playerId, target, data.drawingData);
    }
  }

  private playTapAttack(attacker: FighterDisplay, target: FighterDisplay, _action: string): void {
    const sprite = attacker.sprite;
    const hitX = target.targetX + (target.targetX > ARENA_WIDTH / 2 ? -35 : 35);
    const hitY = target.targetY;
    const returnX = attacker.targetX;
    const returnY = attacker.targetY;

    attacker.ignoreLerpUntil = this.time.now + 350;

    // Lunge (position only – no scale change so the fighter never grows)
    this.tweens.add({
      targets: sprite,
      x: hitX,
      y: hitY,
      duration: 120,
      ease: "Cubic.Out",
      onComplete: () => {
        const impact = this.add.circle(hitX, hitY, 8, 0xe74c3c, 0.8);
        impact.setStrokeStyle(3, 0x1a1a1a);
        impact.setDepth(20);
        this.tweens.add({
          targets: impact,
          scale: 2,
          alpha: 0,
          duration: 300,
          onComplete: () => impact.destroy(),
        });
      },
    });

    this.time.delayedCall(120, () => {
      this.tweens.add({
        targets: sprite,
        x: returnX,
        y: returnY,
        duration: 200,
        ease: "Cubic.InOut",
      });
    });
  }

  private playSwipeAttack(attacker: FighterDisplay, target: FighterDisplay, action: string): void {
    const fromX = attacker.sprite.x;
    const fromY = attacker.sprite.y;
    const toX = target.targetX;
    const toY = target.targetY;
    const dx = toX - fromX;
    const dy = toY - fromY;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const ux = dx / len;
    const uy = dy / len;
    const angle = Math.atan2(uy, ux);
    const actionLower = action.toLowerCase();

    const slashLen = 95;
    const g = this.add.graphics();
    g.setDepth(25);

    if (actionLower.includes("scratch") || actionLower.includes("claw")) {
      const spread = 0.35;
      for (let i = -1; i <= 1; i++) {
        const a = angle + i * spread;
        const ex = fromX + Math.cos(a) * slashLen;
        const ey = fromY + Math.sin(a) * slashLen;
        g.lineStyle(5, 0x1a1a1a, 1);
        g.beginPath();
        g.moveTo(fromX, fromY);
        g.lineTo(ex, ey);
        g.strokePath();
      }
    } else if (actionLower.includes("bite") || actionLower.includes("chomp")) {
      const r = 35;
      g.lineStyle(8, 0x1a1a1a, 1);
      g.beginPath();
      g.arc(fromX + ux * 25, fromY + uy * 25, r, angle - 0.8, angle + 0.8);
      g.strokePath();
      g.beginPath();
      g.arc(fromX + ux * 35, fromY + uy * 35, r * 0.7, angle - 0.6, angle + 0.6);
      g.strokePath();
    } else if (actionLower.includes("slash") || actionLower.includes("cut")) {
      const ex = fromX + Math.cos(angle) * slashLen;
      const ey = fromY + Math.sin(angle) * slashLen;
      g.lineStyle(10, 0x1a1a1a, 1);
      g.beginPath();
      g.moveTo(fromX, fromY);
      g.lineTo(ex, ey);
      g.strokePath();
    } else {
      const spread = 0.25;
      for (let i = -1; i <= 1; i++) {
        const a = angle + i * spread;
        const ex = fromX + Math.cos(a) * slashLen;
        const ey = fromY + Math.sin(a) * slashLen;
        g.lineStyle(6, 0x1a1a1a, 1);
        g.beginPath();
        g.moveTo(fromX, fromY);
        g.lineTo(ex, ey);
        g.strokePath();
      }
    }

    g.setScale(0.1);
    this.tweens.add({
      targets: g,
      scaleX: 1,
      scaleY: 1,
      duration: 80,
      ease: "Cubic.Out",
    });
    this.tweens.add({
      targets: g,
      alpha: 0,
      duration: 300,
      delay: 150,
      onComplete: () => g.destroy(),
    });

    attacker.ignoreLerpUntil = this.time.now + 220;
    const lungeX = fromX + ux * 35;
    const lungeY = fromY + uy * 20;
    this.tweens.add({
      targets: attacker.sprite,
      x: lungeX,
      y: lungeY,
      duration: 90,
      yoyo: true,
      ease: "Cubic.Out",
    });
  }

  private playDrawAttack(_ownerId: string, target: FighterDisplay, drawingData?: string): void {
    const spawnX = target.targetX;
    const spawnY = target.targetY - 260;

    const spawnFallingDrawing = (textureKey: string) => {
      if (!this.textures.exists(textureKey)) return;
      const drawSprite = this.add.image(spawnX, spawnY, textureKey);
      drawSprite.setDisplaySize(88, 88);
      drawSprite.setDepth(18);

      this.physics.add.existing(drawSprite, false);
      const body = drawSprite.body as Phaser.Physics.Arcade.Body;
      body.setGravityY(450);
      body.setCollideWorldBounds(true);
      body.setSize(drawSprite.displayWidth * 0.85, drawSprite.displayHeight * 0.85);

      this.fallingDrawings.push({
        sprite: drawSprite,
        targetId: target.id,
        textureKey,
        hit: false,
      });

      this.time.delayedCall(2200, () => {
        const fd = this.fallingDrawings.find((f) => f.sprite === drawSprite);
        if (fd && !fd.hit) {
          fd.hit = true;
          body.setVelocity(0, 0);
          body.setGravityY(0);
          this.tweens.add({
            targets: drawSprite,
            alpha: 0,
            duration: 1000,
            onComplete: () => {
              drawSprite.destroy();
              if (this.textures.exists(textureKey)) this.textures.remove(textureKey);
              const idx = this.fallingDrawings.indexOf(fd);
              if (idx !== -1) this.fallingDrawings.splice(idx, 1);
            },
          });
        }
      });
    };

    if (drawingData && drawingData.length > 100) {
      const key = `drawAttack_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      const img = new Image();
      img.onload = () => {
        try {
          if (!this.sys?.game?.renderer) return;
          if (this.textures.exists(key)) this.textures.remove(key);
          this.textures.addImage(key, img);
          spawnFallingDrawing(key);
        } catch {
          this.spawnFallbackDrawAttack(spawnX, spawnY, target.id);
        }
      };
      img.onerror = () => {
        this.spawnFallbackDrawAttack(spawnX, spawnY, target.id);
      };
      img.src = drawingData.startsWith("data:") ? drawingData : `data:image/png;base64,${drawingData}`;
    } else {
      this.spawnFallbackDrawAttack(spawnX, spawnY, target.id);
    }
  }

  private spawnFallbackDrawAttack(spawnX: number, spawnY: number, targetId: string): void {
    const key = `drawFallback_${Date.now()}`;
    const g = this.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(0x1a1a1a, 1);
    g.fillCircle(44, 44, 36);
    g.generateTexture(key, 88, 88);
    g.destroy();

    const drawSprite = this.add.image(spawnX, spawnY, key);
    drawSprite.setDisplaySize(88, 88);
    drawSprite.setDepth(18);

    this.physics.add.existing(drawSprite, false);
    const body = drawSprite.body as Phaser.Physics.Arcade.Body;
    body.setGravityY(450);
    body.setCollideWorldBounds(true);
    body.setSize(75, 75);

    this.fallingDrawings.push({
      sprite: drawSprite,
      targetId,
      textureKey: key,
      hit: false,
    });

    this.time.delayedCall(2200, () => {
      const fd = this.fallingDrawings.find((f) => f.sprite === drawSprite);
      if (fd && !fd.hit) {
        fd.hit = true;
        body.setVelocity(0, 0);
        body.setGravityY(0);
        this.tweens.add({
          targets: drawSprite,
          alpha: 0,
          duration: 1000,
          onComplete: () => {
            drawSprite.destroy();
            if (this.textures.exists(key)) this.textures.remove(key);
            const idx = this.fallingDrawings.indexOf(fd);
            if (idx !== -1) this.fallingDrawings.splice(idx, 1);
          },
        });
      }
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
