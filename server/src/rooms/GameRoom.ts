import { Room, Client } from "colyseus";
import {
  GameStateSchema,
  PlayerSchema,
  ProjectileSchema,
  AbilitySchema,
} from "../schema/GameState";
import { BattleSimulation } from "../game/BattleSimulation";
import {
  SERVER_TICK_RATE,
  NETWORK_SEND_RATE,
  PHASE_DURATIONS,
  ARENA_WIDTH,
  GROUND_Y,
} from "../game/BalanceConfig";

interface GestureMove {
  id: string;
  gesture: string;
  action: string;
  power: number;
}

interface FighterConfig {
  name: string;
  description: string;
  health: { maxHp: number };
  movement: { speed: number; type: string };
  abilities: { type: string; params: Record<string, number | string> }[];
  spriteBounds: { x: number; y: number; width: number; height: number };
  balanceScore: number;
  gestureMoves?: GestureMove[];
}

function generateRoomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export class GameRoom extends Room<GameStateSchema> {
  private battleSim: BattleSimulation | null = null;
  private battleInterval: ReturnType<typeof setInterval> | null = null;
  private timerInterval: ReturnType<typeof setInterval> | null = null;
  private playerConfigs: Map<string, FighterConfig> = new Map();
  private playerDrawings: Map<string, string> = new Map(); // sessionId -> base64 PNG
  private playerGestureMoves: Map<string, GestureMove[]> = new Map();
  private gestureCooldowns: Map<string, number> = new Map(); // "sessionId:moveId" -> time until ready
  private readonly GESTURE_COOLDOWN_SEC = 1.2;

  maxClients = 2;

  onCreate(options: Record<string, unknown>): void {
    this.setState(new GameStateSchema());
    this.state.roomCode = (options.roomCode as string) || generateRoomCode();
    this.state.phase = "lobby";

    // Set metadata so clients can find this room
    this.setMetadata({ roomCode: this.state.roomCode });

    // Apply room config options
    if (options.inkBudget) this.state.inkBudget = options.inkBudget as number;
    if (options.drawingTimeLimit) this.state.drawingTimeLimit = options.drawingTimeLimit as number;
    if (options.battleInkMax) this.state.battleInkMax = options.battleInkMax as number;
    if (options.battleInkRegen) this.state.battleInkRegen = options.battleInkRegen as number;

    // Register message handlers
    this.onMessage("ready", (client) => this.handleReady(client));
    this.onMessage("submitDrawing", (client, data) => this.handleDrawingSubmit(client, data));
    this.onMessage("fighterConfig", (client, data) => this.handleFighterConfig(client, data));
    this.onMessage("move", (client, data) => this.handleMove(client, data));
    this.onMessage("ability", (client, data) => this.handleAbility(client, data));
    this.onMessage("gestureAttack", (client, data) => this.handleGestureAttack(client, data));
    this.onMessage("playAgain", () => this.resetToLobby());
    this.onMessage("strokeUpdate", (client, data) => this.relayToOpponent(client, "opponentStroke", data));
    this.onMessage("strokeUndo", (client) => this.relayToOpponent(client, "opponentStrokeUndo", {}));
    this.onMessage("strokeClear", (client) => this.relayToOpponent(client, "opponentStrokeClear", {}));

    console.log(`Room ${this.state.roomCode} created`);
  }

  onJoin(client: Client): void {
    const player = new PlayerSchema();
    player.id = client.sessionId;
    player.name = `Player ${this.state.players.size + 1}`;
    this.state.players.set(client.sessionId, player);

    console.log(`${client.sessionId} joined room ${this.state.roomCode}`);
  }

  onLeave(client: Client): void {
    this.state.players.delete(client.sessionId);
    console.log(`${client.sessionId} left room ${this.state.roomCode}`);

    if (this.clients.length < this.maxClients) {
      this.unlock();
    }

    if (this.state.phase === "battle" && this.state.players.size === 1) {
      const remaining = Array.from(this.state.players.keys())[0];
      this.endBattle(remaining);
    }
  }

  onDispose(): void {
    this.clearIntervals();
    console.log(`Room ${this.state.roomCode} disposed`);
  }

  private relayToOpponent(sender: Client, messageType: string, data: unknown): void {
    if (this.state.phase !== "drawing") return;
    for (const client of this.clients) {
      if (client.sessionId !== sender.sessionId) {
        client.send(messageType, data);
      }
    }
  }

  // ---- Message Handlers ----

  private handleReady(client: Client): void {
    const player = this.state.players.get(client.sessionId);
    if (!player) return;
    player.isReady = true;

    // Check if all players are ready (need exactly 2)
    if (this.state.phase === "lobby" && this.state.players.size === 2) {
      let allReady = true;
      this.state.players.forEach((p) => {
        if (!p.isReady) allReady = false;
      });
      if (allReady) {
        this.startDrawingPhase();
      }
    }
  }

  private handleDrawingSubmit(client: Client, data: { imageData: string; spriteData?: string }): void {
    const player = this.state.players.get(client.sessionId);
    if (!player) return;

    if (data.spriteData) {
      player.spriteData = data.spriteData;
    }

    if (this.state.phase !== "drawing") return;

    player.drawingSubmitted = true;
    this.playerDrawings.set(client.sessionId, data.imageData);

    let allSubmitted = true;
    this.state.players.forEach((p) => {
      if (!p.drawingSubmitted) allSubmitted = false;
    });
    if (allSubmitted) {
      this.startAnalyzingPhase();
    }
  }

  private handleFighterConfig(client: Client, config: FighterConfig): void {
    if (this.state.phase !== "analyzing") return;
    this.playerConfigs.set(client.sessionId, config);

    if (config.gestureMoves && Array.isArray(config.gestureMoves) && config.gestureMoves.length >= 2) {
      this.playerGestureMoves.set(
        client.sessionId,
        config.gestureMoves.slice(0, 3).map((m) => ({
          id: m.id,
          gesture: m.gesture,
          action: m.action,
          power: Math.max(5, Math.min(25, m.power)),
        }))
      );
    } else {
      this.playerGestureMoves.set(client.sessionId, [
        { id: "tap-1", gesture: "tap", action: "Pounce", power: 8 },
        { id: "swipe-1", gesture: "swipe", action: "Scratch", power: 14 },
      ]);
    }

    const player = this.state.players.get(client.sessionId);
    if (player) {
      player.fighterName = config.name;
      player.fighterDescription = config.description;
      player.maxHp = config.health.maxHp;
      player.hp = config.health.maxHp;
      const moves = this.playerGestureMoves.get(client.sessionId) ?? [];
      player.gestureMoveSummary = JSON.stringify(moves.map((m) => ({ action: m.action, power: m.power })));

      // Populate abilities
      player.abilities.clear();
      for (const ability of config.abilities) {
        const schema = new AbilitySchema();
        schema.abilityType = ability.type;
        schema.cooldownRemaining = 0;
        schema.cooldownMax = (ability.params.cooldown as number) || 1;
        schema.label = (ability.params.label as string) || ability.type;
        player.abilities.push(schema);
      }
    }

    if (this.playerConfigs.size === this.state.players.size) {
      this.clearIntervals();
      this.state.timer = 8;
      this.timerInterval = setInterval(() => {
        this.state.timer -= 1;
        if (this.state.timer <= 0) {
          this.startBattle();
        }
      }, 1000);
    }
  }

  private handleMove(client: Client, data: { targetX: number; targetY: number }): void {
    if (this.state.phase !== "battle" || !this.battleSim) return;
    this.battleSim.handleMove(client.sessionId, data.targetX, data.targetY);
  }

  private handleAbility(client: Client, data: { abilityType: string; targetX?: number; targetY?: number }): void {
    if (this.state.phase !== "battle" || !this.battleSim) return;
    this.battleSim.handleAbility(client.sessionId, data.abilityType, data.targetX, data.targetY);
  }

  private handleGestureAttack(client: Client, data: { moveId: string; drawingData?: string }): void {
    if (this.state.phase !== "battle" || !this.battleSim) return;
    const moves = this.playerGestureMoves.get(client.sessionId);
    if (!moves) return;
    const move = moves.find((m) => m.id === data.moveId);
    if (!move) return;

    const key = `${client.sessionId}:${move.id}`;
    const now = Date.now() / 1000;
    const readyAt = this.gestureCooldowns.get(key) ?? 0;
    if (now < readyAt) return;

    const targetId = Array.from(this.state.players.keys()).find((id) => id !== client.sessionId) ?? null;

    this.gestureCooldowns.set(key, now + this.GESTURE_COOLDOWN_SEC);
    this.battleSim.handleGestureAttack(client.sessionId, move.power);

    if (targetId) {
      this.broadcast("gestureAttackVisual", {
        playerId: client.sessionId,
        targetId,
        gesture: move.gesture,
        action: move.action,
        power: move.power,
        drawingData: move.gesture === "draw" ? data.drawingData : undefined,
      });
    }
  }

  // ---- Phase Transitions ----

  private startDrawingPhase(): void {
    this.state.phase = "drawing";
    this.state.timer = this.state.drawingTimeLimit;

    // Reset drawing state
    this.state.players.forEach((p) => {
      p.drawingSubmitted = false;
    });

    // Timer countdown
    this.timerInterval = setInterval(() => {
      this.state.timer -= 1;
      if (this.state.timer <= 0) {
        this.clearIntervals();
        // Force submit for anyone who hasn't
        this.state.players.forEach((p) => {
          p.drawingSubmitted = true;
        });
        this.startAnalyzingPhase();
      }
    }, 1000);

    console.log(`Room ${this.state.roomCode}: Drawing phase started`);
  }

  private startAnalyzingPhase(): void {
    this.clearIntervals();
    this.state.phase = "analyzing";
    this.state.timer = PHASE_DURATIONS.analyzing;

    // Set a timeout in case AI analysis takes too long
    this.timerInterval = setInterval(() => {
      this.state.timer -= 1;
      if (this.state.timer <= 0) {
        this.state.players.forEach((p) => {
          if (!this.playerConfigs.has(p.id)) {
            this.playerConfigs.set(p.id, this.fallbackConfig());
            p.fighterName = "Scribble Warrior";
            p.fighterDescription = "A brave scribble!";
            p.maxHp = 100;
            p.hp = 100;
          }
        });
        this.startBattle();
      }
    }, 1000);

    // Broadcast to clients that they should analyze their drawings
    this.broadcast("startAnalysis", {});

    console.log(`Room ${this.state.roomCode}: Analyzing phase started`);
  }

  private startRevealPhase(): void {
    this.clearIntervals();
    this.state.phase = "reveal";
    this.state.timer = PHASE_DURATIONS.reveal;

    this.timerInterval = setInterval(() => {
      this.state.timer -= 1;
      if (this.state.timer <= 0) {
        this.startBattle();
      }
    }, 1000);

    console.log(`Room ${this.state.roomCode}: Reveal phase started`);
  }

  private startBattle(): void {
    this.clearIntervals();
    this.state.phase = "battle";

    // Initialize battle simulation
    this.battleSim = new BattleSimulation();

    let playerIndex = 0;
    this.state.players.forEach((player, sessionId) => {
      const config = this.playerConfigs.get(sessionId) || this.fallbackConfig();
      const startX = playerIndex === 0 ? 150 : ARENA_WIDTH - 150;
      const facingRight = playerIndex === 0;

      this.battleSim!.addFighter(sessionId, startX, facingRight, {
        maxHp: config.health.maxHp,
        movementSpeed: config.movement.speed,
        abilities: config.abilities.map((a) => ({
          type: a.type,
          params: a.params as Record<string, number | string>,
        })),
        battleInkMax: this.state.battleInkMax,
        battleInkRegen: this.state.battleInkRegen,
      });

      // Set initial position
      player.x = startX;
      player.y = GROUND_Y;
      player.facingRight = facingRight;
      player.ink = this.state.battleInkMax;
      player.maxInk = this.state.battleInkMax;

      playerIndex++;
    });

    // Start game loop
    const tickDt = 1 / SERVER_TICK_RATE;
    let tickCount = 0;
    const sendEvery = Math.round(SERVER_TICK_RATE / NETWORK_SEND_RATE);

    this.battleInterval = setInterval(() => {
      if (!this.battleSim) return;

      const events = this.battleSim.tick(tickDt);

      // Broadcast events
      if (events.length > 0) {
        this.broadcast("battleEvents", events);
      }

      // Sync state at network rate
      tickCount++;
      if (tickCount % sendEvery === 0) {
        this.syncBattleState();
      }

      // Check for winner
      const winnerId = this.battleSim.getWinnerId();
      if (winnerId) {
        this.endBattle(winnerId);
      }
    }, tickDt * 1000);

    console.log(`Room ${this.state.roomCode}: Battle started!`);
  }

  private endBattle(winnerId: string): void {
    this.clearIntervals();
    this.state.phase = "result";
    this.state.winnerId = winnerId;
    this.state.timer = PHASE_DURATIONS.result;

    this.timerInterval = setInterval(() => {
      this.state.timer -= 1;
      if (this.state.timer <= 0) {
        this.resetToLobby();
      }
    }, 1000);

    console.log(`Room ${this.state.roomCode}: Battle ended! Winner: ${winnerId}`);
  }

  private resetToLobby(): void {
    this.clearIntervals();
    this.battleSim = null;
    this.playerConfigs.clear();
    this.playerDrawings.clear();
    this.playerGestureMoves.clear();
    this.gestureCooldowns.clear();

    this.state.phase = "lobby";
    this.state.timer = 0;
    this.state.winnerId = "";
    this.state.projectiles.clear();

    this.state.players.forEach((player) => {
      player.isReady = false;
      player.drawingSubmitted = false;
      player.hp = 100;
      player.maxHp = 100;
      player.x = 0;
      player.y = 0;
      player.vx = 0;
      player.vy = 0;
      player.ink = 100;
      player.isShielding = false;
      player.shieldHp = 0;
      player.fighterName = "";
      player.fighterDescription = "";
      player.spriteData = "";
      player.gestureMoveSummary = "";
      player.abilities.clear();
    });

    console.log(`Room ${this.state.roomCode}: Reset to lobby`);
  }

  /**
   * Sync the battle simulation state to the Colyseus schema.
   */
  private syncBattleState(): void {
    if (!this.battleSim) return;

    this.battleSim.fighters.forEach((fighter, id) => {
      const player = this.state.players.get(id);
      if (!player) return;

      player.x = fighter.x;
      player.y = fighter.y;
      player.vx = fighter.vx;
      player.vy = fighter.vy;
      player.hp = fighter.hp;
      player.ink = fighter.ink;
      player.facingRight = fighter.facingRight;
      player.isShielding = fighter.isShielding;
      player.shieldHp = fighter.shieldHp;

      // Sync ability cooldowns
      for (let i = 0; i < player.abilities.length && i < fighter.abilities.length; i++) {
        const playerAbility = player.abilities.at(i);
        const fighterAbility = fighter.abilities[i];
        if (playerAbility && fighterAbility) {
          playerAbility.cooldownRemaining = fighterAbility.cooldownRemaining;
        }
      }
    });

    // Sync projectiles
    this.state.projectiles.clear();
    for (const proj of this.battleSim.projectiles) {
      if (!proj.active) continue;
      const schema = new ProjectileSchema();
      schema.id = proj.id;
      schema.ownerId = proj.ownerId;
      schema.x = proj.x;
      schema.y = proj.y;
      schema.vx = proj.vx;
      schema.vy = proj.vy;
      schema.damage = proj.damage;
      schema.active = true;
      this.state.projectiles.push(schema);
    }
  }

  private clearIntervals(): void {
    if (this.battleInterval) {
      clearInterval(this.battleInterval);
      this.battleInterval = null;
    }
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  private fallbackConfig(): FighterConfig {
    return {
      name: "Scribble Warrior",
      description: "A brave scribble that fights with determination!",
      health: { maxHp: 100 },
      movement: { speed: 3, type: "walk" },
      abilities: [
        { type: "melee", params: { damage: 15, range: 40, cooldown: 0.8 } },
        { type: "fireProjectile", params: { damage: 10, cooldown: 1.5, speed: 5, label: "Ink Blast" } },
      ],
      spriteBounds: { x: 100, y: 50, width: 150, height: 150 },
      balanceScore: 5,
    };
  }
}
