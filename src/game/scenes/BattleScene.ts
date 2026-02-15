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
  teamColor: string; // Player's team color for HP bar and sprite tint
  /** When set, update() skips position lerp until this time (ms) - for attack animations */
  ignoreLerpUntil?: number;
}

interface ProjectileDisplay {
  id: string;
  graphic: Phaser.GameObjects.Arc;
  trail: Phaser.GameObjects.Arc[];
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
    teamColor?: string;
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
  private sounds: { [key: string]: Phaser.Sound.BaseSound } = {};

  constructor() {
    super({ key: "BattleScene" });
  }

  preload(): void {
    // Load sound effects
    // For now, we'll use procedurally generated sounds
    // You can replace these with actual audio files in /public/sounds/
  }

  create(): void {
    this.drawArenaBackground();

    // Create procedural sound effects using Web Audio
    this.createProceduralSounds();
  }

  private createProceduralSounds(): void {
    // These are simple beep sounds - you can replace with actual audio files
    // by uncommenting the load.audio lines in preload and using this.sound.add()
  }

  playSound(key: string, volume: number = 0.4): void {
    // Play procedural sound effects using Web Audio API
    const soundManager = this.sys.game?.sound;
    if (!soundManager || !("context" in soundManager)) return;

    const context = (soundManager as { context: AudioContext }).context;
    const oscillator = context.createOscillator();
    const gainNode = context.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(context.destination);

    // Enhanced sound variety for different actions
    switch (key) {
      case "melee":
        // Punchy melee hit - swoosh + impact
        oscillator.type = "sawtooth";
        oscillator.frequency.setValueAtTime(400, context.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(150, context.currentTime + 0.08);
        gainNode.gain.setValueAtTime(volume * 0.8, context.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, context.currentTime + 0.12);
        oscillator.start(context.currentTime);
        oscillator.stop(context.currentTime + 0.12);
        break;

      case "projectile":
        // Whoosh sound for projectile launch
        oscillator.type = "sine";
        oscillator.frequency.setValueAtTime(600, context.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(300, context.currentTime + 0.15);
        gainNode.gain.setValueAtTime(volume * 0.5, context.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, context.currentTime + 0.15);
        oscillator.start(context.currentTime);
        oscillator.stop(context.currentTime + 0.15);
        break;

      case "damage":
        // Impact sound - lower thud
        oscillator.type = "triangle";
        oscillator.frequency.value = 180;
        gainNode.gain.setValueAtTime(volume, context.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, context.currentTime + 0.1);
        oscillator.start(context.currentTime);
        oscillator.stop(context.currentTime + 0.1);
        break;

      case "death":
        // Dramatic death sound - descending tone
        oscillator.type = "square";
        oscillator.frequency.setValueAtTime(400, context.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(50, context.currentTime + 0.5);
        gainNode.gain.setValueAtTime(volume * 0.6, context.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, context.currentTime + 0.5);
        oscillator.start(context.currentTime);
        oscillator.stop(context.currentTime + 0.5);
        break;

      case "summon":
        // Magical sparkle sound
        oscillator.type = "sine";
        oscillator.frequency.setValueAtTime(800, context.currentTime);
        oscillator.frequency.linearRampToValueAtTime(1200, context.currentTime + 0.3);
        gainNode.gain.setValueAtTime(volume * 0.4, context.currentTime);
        gainNode.gain.linearRampToValueAtTime(0, context.currentTime + 0.3);
        oscillator.start(context.currentTime);
        oscillator.stop(context.currentTime + 0.3);
        break;

      case "shield":
        // Shield activate - bright ping
        oscillator.type = "sine";
        oscillator.frequency.value = 800;
        gainNode.gain.setValueAtTime(volume * 0.5, context.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, context.currentTime + 0.2);
        oscillator.start(context.currentTime);
        oscillator.stop(context.currentTime + 0.2);
        break;

      case "hit":
        // Sharp hit sound
        oscillator.type = "square";
        oscillator.frequency.value = 250;
        gainNode.gain.setValueAtTime(volume * 0.7, context.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, context.currentTime + 0.08);
        oscillator.start(context.currentTime);
        oscillator.stop(context.currentTime + 0.08);
        break;
    }
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

      // Dynamic idle animation - gentle breathing/bobbing
      if (!skipLerp) {
        // Check if character is moving
        const isMoving = Math.abs(fighter.targetX - sprite.x) > 5;

        if (isMoving) {
          // Moving animation - squash/stretch based on velocity
          const velX = fighter.targetX - sprite.x;
          const moveSpeed = Math.abs(velX) / 50; // Normalize
          const squashAmount = Math.min(moveSpeed * 0.15, 0.15);

          // Lean in direction of movement
          const leanAngle = Math.sign(velX) * Math.min(moveSpeed * 0.1, 0.15);

          sprite.setScale(1 - squashAmount, 1 + squashAmount);
          sprite.setRotation(leanAngle);

          // Bounce while moving
          const bounceY = Math.sin(now * 0.015) * 3;
          sprite.y += bounceY;
        } else {
          // Idle breathing animation
          const breatheScale = 1 + Math.sin(now * 0.003 + sprite.x * 0.01) * 0.04;
          const breatheY = Math.sin(now * 0.002 + sprite.x * 0.01) * 1.5;
          sprite.setScale(breatheScale, breatheScale);
          sprite.y += breatheY;

          // Slight rotation wobble
          const wobble = Math.sin(now * 0.004 + sprite.x) * 0.02;
          sprite.setRotation(wobble);
        }
      }
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

  updateState(state: BattleState, summonedFighters?: Map<string, {
    id: string;
    name: string;
    x: number;
    y: number;
    hp: number;
    maxHp: number;
    facingRight: boolean;
    spriteData: string;
    teamColor: string;
  }>): void {
    // Update main players
    state.players.forEach((data, id) => {
      let fighter = this.fighters.get(id);

      if (!fighter) {
        fighter = this.createFighterDisplay(id, data.fighterName, data.teamColor || "#1a1a1a");
        this.fighters.set(id, fighter);
        // Animate character spawn
        this.animateCharacterSpawn(id);
        // Don't apply team color tint - keep sprites transparent with original colors
      }

      fighter.targetX = data.x;
      fighter.targetY = data.y;

      if (fighter.sprite instanceof Phaser.GameObjects.Image) {
        fighter.sprite.setFlipX(!data.facingRight);
      }

      // Use team color for HP bar instead of health-based colors
      const hpFraction = Math.max(0, data.hp / data.maxHp);
      fighter.hpBarFill.width = 48 * hpFraction;
      const teamColorInt = Phaser.Display.Color.HexStringToColor(fighter.teamColor).color;
      fighter.hpBarFill.fillColor = teamColorInt;

      if (data.isShielding) {
        if (!fighter.shieldGraphic) {
          fighter.shieldGraphic = this.add.circle(data.x, data.y, 40, teamColorInt, 0.25);
          fighter.shieldGraphic.setStrokeStyle(2, teamColorInt, 0.6);
          fighter.shieldGraphic.setDepth(5);
        }
        fighter.shieldGraphic.setVisible(true);
      } else if (fighter.shieldGraphic) {
        fighter.shieldGraphic.setVisible(false);
      }
    });

    // Update summoned fighters
    if (summonedFighters) {
      summonedFighters.forEach((data, id) => {
        let fighter = this.fighters.get(id);

        if (!fighter) {
          fighter = this.createFighterDisplay(id, data.name, data.teamColor);
          this.fighters.set(id, fighter);
          // Animate character spawn
          this.animateCharacterSpawn(id);
          // Don't apply team color tint - keep sprites transparent with original colors
          // Load sprite if available
          if (data.spriteData) {
            this.loadFighterSprite(id, data.spriteData);
          }
        }

        fighter.targetX = data.x;
        fighter.targetY = data.y;

        if (fighter.sprite instanceof Phaser.GameObjects.Image) {
          fighter.sprite.setFlipX(!data.facingRight);
        }

        const hpFraction = Math.max(0, data.hp / data.maxHp);
        fighter.hpBarFill.width = 48 * hpFraction;
        const teamColorInt = Phaser.Display.Color.HexStringToColor(fighter.teamColor).color;
        fighter.hpBarFill.fillColor = teamColorInt;
      });
    }

    // Remove fighters that no longer exist
    for (const [id] of this.fighters) {
      if (!state.players.has(id) && !(summonedFighters && summonedFighters.has(id))) {
        this.removeFighter(id);
      }
    }

    const activeProjectileIds = new Set(state.projectiles.map((p) => p.id));

    for (const [id, display] of this.projectileDisplays) {
      if (!activeProjectileIds.has(id)) {
        display.graphic.destroy();
        display.trail.forEach((t) => t.destroy());
        this.projectileDisplays.delete(id);
      }
    }

    for (const proj of state.projectiles) {
      let display = this.projectileDisplays.get(proj.id);
      if (!display) {
        const owner = this.fighters.get(proj.ownerId);
        const colorInt = owner
          ? Phaser.Display.Color.HexStringToColor(owner.teamColor).color
          : 0x3498db;

        const graphic = this.add.circle(proj.x, proj.y, 8, colorInt, 0.9);
        graphic.setStrokeStyle(3, 0xffffff, 0.8);
        graphic.setDepth(10);

        const trail: Phaser.GameObjects.Arc[] = [];
        for (let i = 0; i < 5; i++) {
          const trailPart = this.add.circle(proj.x, proj.y, 6 - i, colorInt, 0.5 - i * 0.08);
          trailPart.setDepth(9);
          trail.push(trailPart);
        }

        display = { id: proj.id, graphic, trail };
        this.projectileDisplays.set(proj.id, display);
      }

      // Smooth projectile movement
      const prevX = display.graphic.x;
      const prevY = display.graphic.y;
      display.graphic.x += (proj.x - display.graphic.x) * 0.5;
      display.graphic.y += (proj.y - display.graphic.y) * 0.5;

      // Update trail with smooth delay
      for (let i = display.trail.length - 1; i >= 0; i--) {
        const trailPart = display.trail[i];
        if (i === 0) {
          trailPart.x += (prevX - trailPart.x) * 0.6;
          trailPart.y += (prevY - trailPart.y) * 0.6;
        } else {
          const prev = display.trail[i - 1];
          trailPart.x += (prev.x - trailPart.x) * 0.5;
          trailPart.y += (prev.y - trailPart.y) * 0.5;
        }
      }

      // Pulse effect on main projectile
      const pulse = 1 + Math.sin(this.time.now * 0.01) * 0.2;
      display.graphic.setScale(pulse);
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
          // Don't apply team color tint - keep sprite transparent with original colors
        }
      } catch {
        // scene was destroyed before image loaded
      }
    };
    img.src = spriteDataUrl;
  }

  showDamageNumber(x: number, y: number, amount: number): void {
    // Play damage sound
    this.playSound("damage");

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
    const y = sprite.y;

    sprite.setDepth(50);

    // Dramatic defeat sequence
    // 1. Freeze and flash
    if (sprite instanceof Phaser.GameObjects.Image) {
      sprite.setTint(0xffffff);
      this.time.delayedCall(80, () => {
        sprite.clearTint();
      });
    } else if (sprite instanceof Phaser.GameObjects.Rectangle) {
      const originalColor = sprite.fillColor;
      sprite.setFillStyle(0xffffff);
      this.time.delayedCall(80, () => {
        sprite.setFillStyle(originalColor);
      });
    }

    // 2. Expand and shake
    this.tweens.add({
      targets: sprite,
      scaleX: 1.3,
      scaleY: 0.8,
      duration: 100,
      ease: "Quad.Out",
      yoyo: true,
      repeat: 1,
      onComplete: () => {
        // 3. Dramatic fall and spin
        this.tweens.add({
          targets: sprite,
          y: y + 150,
          scaleX: 0.2,
          scaleY: 0.2,
          rotation: Math.PI * 3,
          alpha: 0,
          duration: 800,
          ease: "Cubic.easeIn",
        });

        // Add trailing afterimages
        for (let i = 0; i < 5; i++) {
          this.time.delayedCall(i * 120, () => {
            let ghost: Phaser.GameObjects.Sprite | Phaser.GameObjects.Rectangle;

            if (sprite instanceof Phaser.GameObjects.Image) {
              ghost = this.add.sprite(sprite.x, sprite.y, sprite.texture);
              ghost.setScale(sprite.scaleX, sprite.scaleY);
              ghost.setRotation(sprite.rotation);
              ghost.setAlpha(0.3);
              ghost.setTint(0xff0000);
              ghost.setDepth(49);
            } else {
              // For Rectangle, create a rectangle ghost
              ghost = this.add.rectangle(sprite.x, sprite.y, 50, 60, 0xff0000, 0.3);
              ghost.setScale(sprite.scaleX, sprite.scaleY);
              ghost.setRotation(sprite.rotation);
              ghost.setDepth(49);
            }

            this.tweens.add({
              targets: ghost,
              alpha: 0,
              scale: 0,
              duration: 300,
              onComplete: () => ghost.destroy(),
            });
          });
        }
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

  private playSwipeAttack(attacker: FighterDisplay, target: FighterDisplay, _action: string): void {
    const sprite = attacker.sprite;
    const fromX = sprite.x;
    const fromY = sprite.y;
    const returnX = attacker.targetX;
    const returnY = attacker.targetY;
    const toX = target.targetX;
    const toY = target.targetY;
    const dx = toX - fromX;
    const dy = toY - fromY;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const ux = dx / len;
    const uy = dy / len;

    // Overshoot past the target by 40px
    const pastX = toX + ux * 40;
    const pastY = toY + uy * 40;

    attacker.ignoreLerpUntil = this.time.now + 500;

    // Spawn afterimage trail during the dash using the fighter's actual sprite
    const trailCount = 4;
    for (let i = 0; i < trailCount; i++) {
      this.time.delayedCall(i * 25, () => {
        const t = (i + 1) / (trailCount + 1);
        const trailX = fromX + (pastX - fromX) * t;
        const trailY = fromY + (pastY - fromY) * t;
        let ghost: Phaser.GameObjects.GameObject & { setDepth: (d: number) => void };
        if (sprite instanceof Phaser.GameObjects.Image) {
          const img = this.add.image(trailX, trailY, sprite.texture.key);
          img.setDisplaySize(60, 60);
          img.setAlpha(0.35);
          img.setFlipX(sprite.flipX);
          ghost = img;
        } else {
          const rect = this.add.rectangle(trailX, trailY, 50, 60, 0x1a1a1a, 0.3);
          ghost = rect;
        }
        ghost.setDepth(2);
        this.tweens.add({
          targets: ghost,
          alpha: 0,
          scaleX: 0.6,
          scaleY: 0.6,
          duration: 200,
          ease: "Quad.Out",
          onComplete: () => (ghost as Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle).destroy(),
        });
      });
    }

    // Dash through the opponent and past them
    this.tweens.add({
      targets: sprite,
      x: pastX,
      y: pastY,
      duration: 120,
      ease: "Cubic.Out",
      onComplete: () => {
        // Snap back to original position with bounce
        this.time.delayedCall(80, () => {
          this.tweens.add({
            targets: sprite,
            x: returnX,
            y: returnY,
            duration: 220,
            ease: "Back.easeOut",
          });
        });
      },
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

  private createFighterDisplay(id: string, name: string, teamColor: string): FighterDisplay {
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

    // Start with team color for HP bar
    const teamColorInt = Phaser.Display.Color.HexStringToColor(teamColor).color;
    const hpBarFill = this.add.rectangle(sprite.x - 24, sprite.y - 42, 48, 6, teamColorInt);
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
      teamColor,
    };
  }

  private applyTeamColorToSprite(fighter: FighterDisplay): void {
    // REMOVED: Don't tint sprites - we want to see the drawn lines with transparency
    // Only apply team color to placeholder rectangles before sprite loads
    if (fighter.sprite instanceof Phaser.GameObjects.Rectangle) {
      const color = Phaser.Display.Color.HexStringToColor(fighter.teamColor);
      const fillColor = Phaser.Display.Color.GetColor(color.red, color.green, color.blue);
      fighter.sprite.setFillStyle(fillColor);
    }
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

  /**
   * Play autoattack melee effect with AI-designed animation
   */
  playAutoMeleeEffect(attackerId: string, targetId: string): void {
    const attacker = this.fighters.get(attackerId);
    const target = this.fighters.get(targetId);
    if (!attacker || !target) return;

    const fromX = attacker.sprite.x;
    const fromY = attacker.sprite.y;
    const toX = target.sprite.x;
    const toY = target.sprite.y;

    // Quick lunge animation with squash/stretch
    attacker.ignoreLerpUntil = this.time.now + 400;
    const lungeX = toX + (toX > fromX ? -30 : 30);
    const lungeY = toY;

    // Play melee sound
    this.playSound("melee");

    // Anticipation - squash before attack
    this.tweens.add({
      targets: attacker.sprite,
      scaleX: 0.85,
      scaleY: 1.15,
      duration: 50,
      ease: "Quad.Out",
      onComplete: () => {
        // Stretch forward during lunge
        this.tweens.add({
          targets: attacker.sprite,
          x: lungeX,
          y: lungeY,
          scaleX: 1.3,
          scaleY: 0.8,
          rotation: (toX > fromX ? 0.15 : -0.15),
          duration: 80,
          ease: "Cubic.Out",
          onComplete: () => {
            // Impact effect - energy burst
            const impact = this.add.circle(lungeX, lungeY, 12, 0xff6b6b, 0.7);
            impact.setStrokeStyle(3, 0xffffff, 0.9);
            impact.setDepth(20);
            this.tweens.add({
              targets: impact,
              scale: 2.5,
              alpha: 0,
              duration: 250,
              ease: "Quad.Out",
              onComplete: () => impact.destroy(),
            });

            // Particle burst
            for (let i = 0; i < 8; i++) {
              const angle = (i / 8) * Math.PI * 2;
              const particle = this.add.circle(lungeX, lungeY, 3, 0xff6b6b, 0.8);
              particle.setDepth(19);
              this.tweens.add({
                targets: particle,
                x: lungeX + Math.cos(angle) * 40,
                y: lungeY + Math.sin(angle) * 40,
                alpha: 0,
                duration: 300,
                ease: "Quad.Out",
                onComplete: () => particle.destroy(),
              });
            }

            // Target damage animation - shake and flash
            this.playDamageAnimation(target);
          },
        });
      },
    });

    // Return to position with bounce
    this.time.delayedCall(130, () => {
      this.tweens.add({
        targets: attacker.sprite,
        x: fromX,
        y: fromY,
        scaleX: 1,
        scaleY: 1,
        rotation: 0,
        duration: 200,
        ease: "Back.easeOut",
      });
    });
  }

  /**
   * Play damage taken animation on a fighter
   */
  private playDamageAnimation(fighter: FighterDisplay): void {
    const sprite = fighter.sprite;
    const origX = sprite.x;

    // Flash white - only for Image sprites that support tinting
    if (sprite instanceof Phaser.GameObjects.Image) {
      const originalTint = sprite.tintTopLeft;
      sprite.setTint(0xffffff);
      this.time.delayedCall(50, () => {
        sprite.clearTint();
        if (originalTint !== 0xffffff) {
          sprite.setTint(originalTint);
        }
      });
    } else if (sprite instanceof Phaser.GameObjects.Rectangle) {
      // For Rectangle, briefly change fill color to white
      const originalColor = sprite.fillColor;
      sprite.setFillStyle(0xffffff);
      this.time.delayedCall(50, () => {
        sprite.setFillStyle(originalColor);
      });
    }

    // Shake and recoil
    this.tweens.add({
      targets: sprite,
      x: origX + 10,
      scaleX: 0.9,
      scaleY: 1.1,
      duration: 40,
      yoyo: true,
      repeat: 2,
      ease: "Quad.InOut",
    });
  }

  /**
   * Play projectile spawn effect with AI-designed trail
   */
  playAutoProjectileEffect(attackerId: string): void {
    const attacker = this.fighters.get(attackerId);
    if (!attacker) return;

    // Play projectile sound
    this.playSound("projectile");

    const sprite = attacker.sprite;
    const originalScale = sprite.scaleX;

    // Character animation - lean back then forward (recoil)
    attacker.ignoreLerpUntil = this.time.now + 300;

    // Charge-up pose - pull back
    this.tweens.add({
      targets: sprite,
      scaleX: originalScale * 0.9,
      scaleY: originalScale * 1.1,
      rotation: sprite.x < ARENA_WIDTH / 2 ? -0.1 : 0.1,
      duration: 100,
      ease: "Quad.Out",
      onComplete: () => {
        // Fire pose - lean forward
        this.tweens.add({
          targets: sprite,
          scaleX: originalScale * 1.1,
          scaleY: originalScale * 0.9,
          rotation: sprite.x < ARENA_WIDTH / 2 ? 0.05 : -0.05,
          duration: 80,
          ease: "Quad.In",
        });

        // Return to normal
        this.time.delayedCall(80, () => {
          this.tweens.add({
            targets: sprite,
            scaleX: originalScale,
            scaleY: originalScale,
            rotation: 0,
            duration: 150,
            ease: "Back.easeOut",
          });
        });
      },
    });

    // Charge-up effect
    const chargeX = attacker.sprite.x + (attacker.sprite.x < ARENA_WIDTH / 2 ? 30 : -30);
    const chargeY = attacker.sprite.y - 10;
    const teamColorInt = Phaser.Display.Color.HexStringToColor(attacker.teamColor).color;

    const charge = this.add.circle(chargeX, chargeY, 8, teamColorInt, 0.6);
    charge.setStrokeStyle(2, 0xffffff, 0.8);
    charge.setDepth(15);

    this.tweens.add({
      targets: charge,
      scale: 1.8,
      alpha: 0,
      duration: 200,
      ease: "Quad.Out",
      onComplete: () => charge.destroy(),
    });

    // Energy ring
    const ring = this.add.circle(chargeX, chargeY, 15, teamColorInt, 0);
    ring.setStrokeStyle(3, teamColorInt, 0.7);
    ring.setDepth(15);
    this.tweens.add({
      targets: ring,
      scale: 2,
      alpha: 0,
      duration: 250,
      ease: "Quad.Out",
      onComplete: () => ring.destroy(),
    });
  }

  /**
   * Show magical summon effect at position
   */
  showSummonEffect(x: number, y: number): void {
    // Play summon sound
    this.playSound("summon");

    // Purple magic circle
    const circle = this.add.circle(x, y, 5, 0x9b59b6, 0.6);
    circle.setStrokeStyle(3, 0xffffff, 0.9);
    circle.setDepth(25);

    this.tweens.add({
      targets: circle,
      scale: 6,
      alpha: 0,
      duration: 500,
      ease: "Quad.Out",
      onComplete: () => circle.destroy(),
    });

    // Sparkle particles
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2;
      const distance = 40 + Math.random() * 20;
      const sparkle = this.add.circle(x, y, 3, 0xf39c12, 0.9);
      sparkle.setDepth(26);

      this.tweens.add({
        targets: sparkle,
        x: x + Math.cos(angle) * distance,
        y: y + Math.sin(angle) * distance - 30,
        alpha: 0,
        duration: 600 + Math.random() * 200,
        ease: "Quad.Out",
        onComplete: () => sparkle.destroy(),
      });
    }

    // Flash effect
    const flash = this.add.circle(x, y, 60, 0xffffff, 0);
    flash.setDepth(24);
    this.tweens.add({
      targets: flash,
      alpha: 0.6,
      duration: 100,
    });
    this.tweens.add({
      targets: flash,
      alpha: 0,
      scale: 1.5,
      duration: 400,
      delay: 100,
      ease: "Quad.Out",
      onComplete: () => flash.destroy(),
    });
  }

  /**
   * Animate character spawn - grow from small with bounce
   */
  animateCharacterSpawn(fighterId: string): void {
    const fighter = this.fighters.get(fighterId);
    if (!fighter) return;

    const sprite = fighter.sprite;

    // Start small and grow with bounce
    sprite.setScale(0.1);
    sprite.setAlpha(0);

    this.tweens.add({
      targets: sprite,
      scale: 1.2,
      alpha: 1,
      duration: 300,
      ease: "Back.easeOut",
      onComplete: () => {
        // Settle to normal size
        this.tweens.add({
          targets: sprite,
          scale: 1,
          duration: 150,
          ease: "Quad.Out",
        });
      },
    });
  }

  /**
   * Victory celebration animation
   */
  showVictoryAnimation(winnerId: string): void {
    const fighter = this.fighters.get(winnerId);
    if (!fighter) return;

    const sprite = fighter.sprite;

    // Stop normal animations
    fighter.ignoreLerpUntil = this.time.now + 10000;

    // Victory jump and pose
    this.tweens.add({
      targets: sprite,
      y: sprite.y - 60,
      scaleX: 1.1,
      scaleY: 1.1,
      duration: 400,
      ease: "Quad.Out",
      yoyo: true,
      repeat: 2,
    });

    // Spinning stars around winner
    for (let i = 0; i < 8; i++) {
      this.time.delayedCall(i * 100, () => {
        const angle = (i / 8) * Math.PI * 2;
        const radius = 50;
        const star = this.add.circle(
          sprite.x + Math.cos(angle) * radius,
          sprite.y + Math.sin(angle) * radius,
          4,
          0xffd700,
          0.9
        );
        star.setDepth(30);

        this.tweens.add({
          targets: star,
          scale: 2,
          alpha: 0,
          duration: 600,
          ease: "Quad.Out",
          onComplete: () => star.destroy(),
        });
      });
    }

    // Continuous bounce
    this.time.addEvent({
      delay: 800,
      callback: () => {
        this.tweens.add({
          targets: sprite,
          scaleY: 1.15,
          duration: 200,
          yoyo: true,
          ease: "Quad.InOut",
        });
      },
      loop: true,
    });
  }
}
