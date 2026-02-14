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

type GestureCallback = (gesture: {
  type: string;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  velocity: number;
}) => void;

export class BattleScene extends Phaser.Scene {
  private fighters: Map<string, FighterDisplay> = new Map();
  private projectileDisplays: Map<string, ProjectileDisplay> = new Map();
  private gestureCallback: GestureCallback | null = null;

  // Gesture tracking
  private gestureStart: { x: number; y: number; time: number } | null = null;
  private gesturePoints: { x: number; y: number }[] = [];
  private gestureTrail: Phaser.GameObjects.Graphics | null = null;

  // Background elements
  private groundLine: Phaser.GameObjects.Graphics | null = null;

  constructor() {
    super({ key: "BattleScene" });
  }

  create(): void {
    // Draw scribble-style arena background
    this.drawArenaBackground();

    // Gesture trail graphics
    this.gestureTrail = this.add.graphics();
    this.gestureTrail.setDepth(100);

    // Set up pointer input for gestures
    this.input.on("pointerdown", this.onPointerDown, this);
    this.input.on("pointermove", this.onPointerMove, this);
    this.input.on("pointerup", this.onPointerUp, this);
  }

  update(): void {
    // Interpolate fighter positions toward targets
    for (const [, fighter] of this.fighters) {
      const sprite = fighter.sprite;
      const lerpFactor = 0.3;
      sprite.x += (fighter.targetX - sprite.x) * lerpFactor;
      sprite.y += (fighter.targetY - sprite.y) * lerpFactor;

      // Update name and HP bar positions
      fighter.nameText.x = sprite.x;
      fighter.nameText.y = sprite.y - 55;
      fighter.hpBarBg.x = sprite.x;
      fighter.hpBarBg.y = sprite.y - 42;
      fighter.hpBarFill.x = sprite.x - 24;
      fighter.hpBarFill.y = sprite.y - 42;

      // Shield position
      if (fighter.shieldGraphic) {
        fighter.shieldGraphic.x = sprite.x;
        fighter.shieldGraphic.y = sprite.y;
      }

      // Wobble effect (scribble animation)
      sprite.setRotation(Math.sin(this.time.now * 0.005 + sprite.x) * 0.03);
    }
  }

  /**
   * Update battle state from server.
   */
  updateState(state: BattleState): void {
    // Update or create fighters
    state.players.forEach((data, id) => {
      let fighter = this.fighters.get(id);

      if (!fighter) {
        fighter = this.createFighterDisplay(id, data.fighterName);
        this.fighters.set(id, fighter);
      }

      fighter.targetX = data.x;
      fighter.targetY = data.y;

      // Flip sprite based on facing direction
      if (fighter.sprite instanceof Phaser.GameObjects.Image) {
        fighter.sprite.setFlipX(!data.facingRight);
      }

      // Update HP bar
      const hpFraction = Math.max(0, data.hp / data.maxHp);
      fighter.hpBarFill.width = 48 * hpFraction;
      fighter.hpBarFill.fillColor = hpFraction > 0.5 ? 0x2ecc71 : hpFraction > 0.25 ? 0xf39c12 : 0xe74c3c;

      // Update shield
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

    // Remove fighters that no longer exist
    for (const [id] of this.fighters) {
      if (!state.players.has(id)) {
        this.removeFighter(id);
      }
    }

    // Update projectiles
    const activeProjectileIds = new Set(state.projectiles.map((p) => p.id));

    // Remove old projectiles
    for (const [id, display] of this.projectileDisplays) {
      if (!activeProjectileIds.has(id)) {
        display.graphic.destroy();
        this.projectileDisplays.delete(id);
      }
    }

    // Update or create projectiles
    for (const proj of state.projectiles) {
      let display = this.projectileDisplays.get(proj.id);
      if (!display) {
        // Determine color based on owner
        const ownerColor = 0x1a1a1a;
        const graphic = this.add.circle(proj.x, proj.y, 6, ownerColor);
        graphic.setStrokeStyle(2, 0x333333);
        graphic.setDepth(10);
        display = { id: proj.id, graphic };
        this.projectileDisplays.set(proj.id, display);
      }
      // Interpolate position
      display.graphic.x += (proj.x - display.graphic.x) * 0.5;
      display.graphic.y += (proj.y - display.graphic.y) * 0.5;
    }
  }

  /**
   * Load a player's drawing as a texture and update their sprite.
   */
  loadFighterSprite(playerId: string, spriteDataUrl: string): void {
    const textureKey = `fighter_${playerId}`;

    // Load the image as a texture
    if (this.textures.exists(textureKey)) {
      this.textures.remove(textureKey);
    }

    const img = new Image();
    img.onload = () => {
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
    };
    img.src = spriteDataUrl;
  }

  /**
   * Set the gesture callback for battle controls.
   */
  setGestureCallback(callback: GestureCallback): void {
    this.gestureCallback = callback;
  }

  /**
   * Show a damage number popup.
   */
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

  /**
   * Show death animation for a fighter.
   */
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

  // ---- Private Methods ----

  private drawArenaBackground(): void {
    const g = this.add.graphics();
    g.setDepth(0);

    // Paper texture background
    g.fillStyle(0xfefef6);
    g.fillRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);

    // Grid lines
    g.lineStyle(0.5, 0xe8e8e0);
    for (let y = 30; y < ARENA_HEIGHT; y += 30) {
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(ARENA_WIDTH, y);
      g.strokePath();
    }

    // Ground line (scribble style)
    g.lineStyle(3, 0x8b7355);
    g.beginPath();
    g.moveTo(0, GROUND_Y + 5);
    // Wavy ground line
    for (let x = 0; x < ARENA_WIDTH; x += 8) {
      const wobble = Math.sin(x * 0.05) * 2 + Math.random() * 1;
      g.lineTo(x, GROUND_Y + 5 + wobble);
    }
    g.strokePath();

    // Ground fill
    g.fillStyle(0xf0e6d3, 0.5);
    g.fillRect(0, GROUND_Y + 5, ARENA_WIDTH, ARENA_HEIGHT - GROUND_Y);
  }

  private createFighterDisplay(id: string, name: string): FighterDisplay {
    // Placeholder rectangle until sprite is loaded
    const sprite = this.add.rectangle(ARENA_WIDTH / 2, GROUND_Y, 50, 60, 0x333333);
    sprite.setDepth(3);

    // Name label
    const nameText = this.add.text(sprite.x, sprite.y - 55, name || "???", {
      fontFamily: '"Caveat", cursive',
      fontSize: "16px",
      color: "#333",
    });
    nameText.setOrigin(0.5);
    nameText.setDepth(4);

    // HP bar background
    const hpBarBg = this.add.rectangle(sprite.x, sprite.y - 42, 50, 8, 0xcccccc);
    hpBarBg.setStrokeStyle(1, 0x666666);
    hpBarBg.setDepth(4);

    // HP bar fill
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

  // ---- Gesture Input Handlers ----

  private onPointerDown(pointer: Phaser.Input.Pointer): void {
    this.gestureStart = { x: pointer.x, y: pointer.y, time: this.time.now };
    this.gesturePoints = [{ x: pointer.x, y: pointer.y }];
    if (this.gestureTrail) {
      this.gestureTrail.clear();
    }
  }

  private onPointerMove(pointer: Phaser.Input.Pointer): void {
    if (!this.gestureStart || !pointer.isDown) return;
    this.gesturePoints.push({ x: pointer.x, y: pointer.y });

    // Draw gesture trail
    if (this.gestureTrail && this.gesturePoints.length >= 2) {
      this.gestureTrail.clear();
      this.gestureTrail.lineStyle(3, 0x3498db, 0.6);
      this.gestureTrail.beginPath();
      this.gestureTrail.moveTo(this.gesturePoints[0].x, this.gesturePoints[0].y);
      for (let i = 1; i < this.gesturePoints.length; i++) {
        this.gestureTrail.lineTo(this.gesturePoints[i].x, this.gesturePoints[i].y);
      }
      this.gestureTrail.strokePath();
    }
  }

  private onPointerUp(pointer: Phaser.Input.Pointer): void {
    if (!this.gestureStart) return;

    const endX = pointer.x;
    const endY = pointer.y;
    const dt = (this.time.now - this.gestureStart.time) / 1000;
    const dx = endX - this.gestureStart.x;
    const dy = endY - this.gestureStart.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const velocity = dist / Math.max(dt, 0.01);

    // Classify gesture
    let gestureType = "tap";

    if (dist > 30) {
      const angle = Math.atan2(dy, dx) * (180 / Math.PI);
      const isCircle = this.detectCircle();

      if (isCircle) {
        gestureType = "circle";
      } else if (Math.abs(angle) < 45) {
        gestureType = "swipeRight";
      } else if (Math.abs(angle) > 135) {
        gestureType = "swipeLeft";
      } else if (angle < -45 && angle > -135) {
        gestureType = "swipeUp";
      } else if (velocity > 500 && dist > 50) {
        gestureType = "slash";
      }
    }

    if (this.gestureCallback) {
      this.gestureCallback({
        type: gestureType,
        startX: this.gestureStart.x,
        startY: this.gestureStart.y,
        endX,
        endY,
        velocity,
      });
    }

    // Clear trail
    if (this.gestureTrail) {
      this.gestureTrail.clear();
    }
    this.gestureStart = null;
    this.gesturePoints = [];
  }

  /**
   * Simple circle detection by checking if the path curves back near its start.
   */
  private detectCircle(): boolean {
    if (this.gesturePoints.length < 10) return false;

    const start = this.gesturePoints[0];
    const end = this.gesturePoints[this.gesturePoints.length - 1];
    const closeDist = Math.sqrt(
      (end.x - start.x) ** 2 + (end.y - start.y) ** 2
    );

    // Calculate total path length
    let totalLength = 0;
    for (let i = 1; i < this.gesturePoints.length; i++) {
      const dx = this.gesturePoints[i].x - this.gesturePoints[i - 1].x;
      const dy = this.gesturePoints[i].y - this.gesturePoints[i - 1].y;
      totalLength += Math.sqrt(dx * dx + dy * dy);
    }

    // Circle: path comes back near start, and total length is significant
    return closeDist < 50 && totalLength > 80;
  }
}
