Scribble Fighters - Draw, Animate, Fight

Architecture Overview

Greenfield project. Monorepo with a Next.js frontend and a Colyseus game server, connected via WebSocket.

graph LR
  subgraph clientSide [Client - Next.js + Phaser]
    DrawCanvas[Drawing Canvas]
    BattleView[Battle Renderer]
    Lobby[Lobby UI]
  end
  subgraph serverSide [Server - Colyseus + Matter.js]
    GameRoom[Game Room]
    Physics[Physics Sim]
    StateSync[State Sync]
  end
  subgraph ai [OpenAI]
    GPT4o[GPT-4o Vision]
  end
  DrawCanvas -->|WebSocket| GameRoom
  GameRoom -->|drawing PNG| GPT4o
  GPT4o -->|component config JSON| GameRoom
  GameRoom -->|state updates| BattleView
  BattleView -->|player input| GameRoom
  Physics --> StateSync
  StateSync -->|delta patches| BattleView

Tech Stack







Layer



Technology



Why





Frontend framework



Next.js 14 (App Router) + TypeScript



Modern React, SSR for lobby, easy API routes





Drawing



HTML5 Canvas API (raw)



Lightweight, full control over stroke tracking and ink measurement





Battle rendering



Phaser 3



Complete 2D game framework with built-in physics (Matter.js), game loop, sprite management





Real-time multiplayer



Colyseus 0.15+



Room-based architecture, automatic state sync with delta compression, reconnection support





AI analysis



OpenAI GPT-4o Vision (structured outputs / function calling)



Best image understanding; can analyze scribbles + text annotations and return structured JSON





Styling



Tailwind CSS



Fast to build; will customize for hand-drawn/scribble aesthetic





Physics (server)



Matter.js



Lightweight 2D physics for server-authoritative collision detection

Game Flow

stateDiagram-v2
  [*] --> Lobby
  Lobby --> DrawingPhase: Both players ready
  DrawingPhase --> AIAnalysis: Timer expires or both submit
  AIAnalysis --> Reveal: Components assigned
  Reveal --> Battle: Countdown
  Battle --> Result: HP reaches 0
  Result --> Lobby: Play again
  Result --> [*]: Leave

Phase 1: Lobby





Create or join a room (shareable room code)



Configure: ink amount (controls game length), time limit for drawing phase



Ready-up system

Phase 2: Drawing Phase (60-90s, configurable)





Full-screen canvas, white background, scribble with trackpad/mouse



Ink system: total stroke length is metered. An ink bar depletes as the player draws. Configurable total ink budget.



Players draw:





Their creature/champion (the main body)



Attack shapes near the creature (e.g., a fireball, a sword, lightning bolt)



Annotations: draw an arrow from an attack to the creature, or write text like "+fire", "+fly", "+shield"



Movement modifiers: draw wings for flying, wheels for speed, etc.



Canvas tools: pen (variable thickness), eraser (refunds partial ink), color picker (limited palette), undo



The entire canvas is a single drawing - the AI will parse it holistically

Phase 3: AI Analysis (~3-5s)





Canvas exported as PNG (transparent background for sprite extraction)



Sent to OpenAI GPT-4o Vision via server-side API route



Prompt instructs the AI to return structured JSON using function calling:

{
  "name": "Fire Dragon",
  "description": "A winged dragon breathing fire",
  "health": { "maxHp": 75 },
  "movement": { "speed": 3, "type": "walk" },
  "abilities": [
    { "type": "flying", "params": { "speed": 3 } },
    { "type": "fireProjectile", "params": { "damage": 18, "cooldown": 1.5, "speed": 5, "label": "Fireball" } }
  ],
  "spriteBounds": { "x": 50, "y": 30, "width": 200, "height": 150 },
  "balanceScore": 7
}





AI balances the creature: more abilities = lower HP, bigger/tougher looking = more HP



The spriteBounds tells us where the main creature body is on the canvas so we can crop it as the sprite

Phase 4: Reveal (3-5s)





Both creatures shown side by side with their assigned abilities listed



Dramatic "VS" screen in scribble style

Phase 5: Battle (real-time)





Server-authoritative: Colyseus server runs the game loop at 60fps, broadcasts state at 20fps with interpolation on client



Arena: 2D side-view platform (think simple Smash Bros stage, but scribble-drawn)



Rendering: Phaser 3 on the client renders the battle. The player's actual drawings are used as sprite textures.



Controls (trackpad/mouse-centric, since that is the input device):





Click + drag on the arena to set creature movement direction (creature walks/flies toward where you drag)



Quick draw gestures on the battle canvas to trigger abilities:





Horizontal swipe/slash from your creature toward enemy = melee attack



Draw a small shape (circle, squiggle) and flick toward enemy = fire projectile



Draw a circle around your creature = activate shield



Swipe upward = jump / fly up



Simple gesture recognition (client-side, no AI needed): detect stroke direction, speed, and shape using basic heuristics (angle of start-to-end, curvature, enclosed area)



Each ability has a cooldown shown on a scribble-style HUD



Each action costs a small amount of battle ink (separate from drawing ink)



Ink in battle: players have a battle ink pool. Every action (move command, attack) costs ink. Ink slowly regenerates. When empty, creature is defenseless briefly. This adds resource management.



HP system: scribble-style HP bar at the top. Taking damage causes "scribble shake" effects. At 0 HP, creature "erases" (dissolves animation).

Phase 6: Result





Winner/loser screen with stats (damage dealt, abilities used)



"Play Again" returns to lobby; "Rematch" keeps same room

Component System (ECS-inspired)

All game behaviors are composed from reusable components attached to a Fighter entity. The AI selects which components to attach based on the drawing.

Available components:





MovementComponent - Ground movement (speed: 1-5). Every entity gets this.



FlyingComponent - Aerial movement (speed: 1-5, maxAltitude). Grants ability to move vertically.



ProjectileComponent - Ranged attack. Spawns a projectile sprite (cropped from the player's drawing) that travels toward target. Params: damage, speed, cooldown.



MeleeComponent - Close-range attack. Params: damage, range, cooldown.



ShieldComponent - Blocks incoming damage for a duration. Params: blockAmount, duration, cooldown.



DashComponent - Quick burst movement. Params: distance, cooldown.



HealthComponent - HP pool. Every entity gets this. Params: maxHp (50-150).

Each component is a class that implements update(dt) and activate(). The Fighter entity holds an array of components and delegates to them.

// src/game/components/BaseComponent.ts
abstract class BaseComponent {
  abstract type: string;
  cooldownRemaining = 0;
  abstract activate(fighter: Fighter, target?: Fighter): void;
  abstract update(dt: number): void;
}

AI Prompt Design

The GPT-4o Vision prompt will use function calling with a strict JSON schema to get deterministic, parseable output. Key prompt elements:





System prompt establishes the game rules, available components, and balance constraints



The drawing image is passed as a base64-encoded PNG



The AI must identify: what the drawing represents, which components to assign, stat values within defined ranges



Balance rules: total "power budget" is fixed (e.g., 100 points). More attack = less HP. AI must stay within budget.



Text annotations ("+fire", "+fly") override AI judgment - if the player wrote it, include it



The AI also identifies bounding boxes for the main creature body and any separate attack drawings (for sprite extraction)

Project Structure

mribs/
├── package.json                    # Workspace root
├── tsconfig.json
├── .env.local                      # OPENAI_API_KEY
├── .gitignore
├── next.config.ts
├── tailwind.config.ts
├── postcss.config.js
│
├── public/
│   ├── fonts/                      # Hand-drawn style fonts (e.g., Caveat, Patrick Hand)
│   └── assets/                     # Arena backgrounds, UI elements (scribble-style)
│
├── src/
│   ├── app/                        # Next.js App Router
│   │   ├── layout.tsx              # Root layout (fonts, global styles)
│   │   ├── page.tsx                # Home / lobby page
│   │   ├── room/
│   │   │   └── [code]/
│   │   │       └── page.tsx        # Game room (drawing + battle)
│   │   └── api/
│   │       └── analyze/
│   │           └── route.ts        # POST: send drawing to GPT-4o, return components
│   │
│   ├── components/                 # React components
│   │   ├── Lobby.tsx               # Room creation/joining UI
│   │   ├── DrawingCanvas.tsx       # Freehand drawing canvas with ink tracking
│   │   ├── InkMeter.tsx            # Visual ink remaining indicator
│   │   ├── BattleWrapper.tsx       # Phaser game mount point
│   │   ├── HealthBar.tsx           # Scribble-style HP bar
│   │   ├── AbilityHUD.tsx          # Cooldown indicators for abilities
│   │   ├── RevealScreen.tsx        # VS reveal animation
│   │   └── ResultScreen.tsx        # Win/lose screen
│   │
│   ├── game/                       # Phaser game code (runs client-side only)
│   │   ├── config.ts               # Phaser game config
│   │   ├── scenes/
│   │   │   ├── BattleScene.ts      # Main battle scene
│   │   │   └── PreloadScene.ts     # Asset loading
│   │   ├── entities/
│   │   │   └── Fighter.ts          # Fighter entity with component system
│   │   ├── components/
│   │   │   ├── BaseComponent.ts
│   │   │   ├── MovementComponent.ts
│   │   │   ├── FlyingComponent.ts
│   │   │   ├── ProjectileComponent.ts
│   │   │   ├── MeleeComponent.ts
│   │   │   ├── ShieldComponent.ts
│   │   │   ├── DashComponent.ts
│   │   │   └── HealthComponent.ts
│   │   ├── input/
│   │   │   └── GestureRecognizer.ts  # Simple gesture detection for battle controls
│   │   └── rendering/
│   │       └── ScribbleEffects.ts    # Shake, erase, spawn animations
│   │
│   ├── lib/
│   │   ├── ai.ts                   # OpenAI Vision integration + prompt
│   │   ├── ink.ts                  # Ink calculation (stroke length measurement)
│   │   ├── sprites.ts              # Canvas-to-sprite extraction (crop, transparency)
│   │   ├── gestures.ts             # Gesture recognition utilities
│   │   └── colyseus.ts             # Colyseus client wrapper
│   │
│   ├── types/
│   │   └── game.ts                 # Shared types (ComponentConfig, FighterState, etc.)
│   │
│   └── styles/
│       └── globals.css             # Tailwind + scribble aesthetic overrides
│
├── server/                         # Colyseus game server (separate process)
│   ├── package.json
│   ├── tsconfig.json
│   ├── src/
│   │   ├── index.ts                # Server entry point
│   │   ├── rooms/
│   │   │   └── GameRoom.ts         # Room logic: phases, state transitions, battle loop
│   │   ├── schema/
│   │   │   ├── GameState.ts        # Colyseus schema: room state
│   │   │   ├── PlayerState.ts      # Per-player state (HP, position, ink, cooldowns)
│   │   │   └── ProjectileState.ts  # Active projectile state
│   │   ├── game/
│   │   │   ├── BattleSimulation.ts # Server-side game loop + Matter.js physics
│   │   │   ├── ComponentRunner.ts  # Executes component logic server-side
│   │   │   └── BalanceConfig.ts    # Balance constants and power budget
│   │   └── utils/
│   │       └── collision.ts        # Collision detection helpers
│   └── .env                        # Server config (port, etc.)
│
└── shared/                         # Shared between client and server
    └── types.ts                    # Component types, message types, constants

Scribble Aesthetic

The entire UI should feel hand-drawn:





Font: Google Fonts "Caveat" or "Patrick Hand" for all text



Borders: Use SVG filters or CSS to make borders look sketchy/wobbly



HP bars: Animated like they're being drawn/erased in real time



Backgrounds: Light paper texture or grid paper



Buttons: Look like they're drawn with marker



Animations: Slight wobble on all game entities (like stop-motion)



Color palette: mostly black/white with accent colors (like a notebook doodle)

Stretch Goals (post-MVP)





Multiplayer (2+): Colyseus rooms already support N players. Add free-for-all or team modes.



Game mode variants: "Castle Defense" - each player draws a castle AND attackers. Destroy the enemy castle to win.



Spectator mode: Watch battles in progress.



Drawing gallery: Save and share your best creatures.



Sound effects: Generated scribble/scratch sounds for drawing, whoosh for attacks.

Key Implementation Risks and Mitigations





AI latency: GPT-4o Vision takes 2-5s. Mitigated by having a "loading" reveal phase with animation. Pre-warm the API connection.



AI inconsistency: Function calling with strict JSON schema ensures parseable output. Add validation layer with fallback defaults.



Gesture recognition accuracy in battle: Keep gestures simple (4-5 distinct gestures max). Use direction + speed heuristics, not ML. Provide visual feedback so players learn.



Phaser + React integration: Use useEffect to mount Phaser into a div. Communicate via events (Phaser EventEmitter + React state).



Server-side physics performance: Matter.js is lightweight. For 1v1 with few entities, performance is not a concern.

