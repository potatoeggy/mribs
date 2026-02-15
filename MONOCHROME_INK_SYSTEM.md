# Monochrome Team Colors & Strategic Ink System

## Overview
Complete overhaul of the drawing and ink systems to create team-based monochrome gameplay with strategic trade-offs.

## 1. 🎨 Monochrome Team Colors

### Team Assignment
- **Player 1 (Red Team):** `#e74c3c` (red)
- **Player 2 (Blue Team):** `#3498db` (blue)
- Colors assigned automatically on room join

### Drawing Restrictions
- Players can ONLY draw in their team color
- Color picker removed from UI
- Team color badge shown instead
- Eraser still available
- All strokes automatically use team color

### Visual Identity
- **Drawing phase:** Players see their team color in canvas
- **Battle phase:** Fighters appear in team colors
- **Sprites:** Rendered in team color
- **Projectiles:** Match team color
- **Clear visual distinction:** Easy to identify which fighter belongs to which player

### Implementation Details

**Server (`server/src/schema/GameState.ts`):**
- Added `teamColor` field to `PlayerSchema`
- Assigned on join: first player = red, second = blue

**Client (`src/components/DrawingCanvas.tsx`):**
- Accepts `teamColor` prop
- Removed color selection UI
- All strokes use `teamColor` instead of `selectedColor`
- Shows team color badge in toolbar

---

## 2. 💧 Strategic Ink System

### Core Concept
**Trade-off: Detailed/Strong Characters vs Saving Ink for Summons**

Players start with a **fixed ink pool (200 ink)** that does NOT regenerate during battle.

### Drawing Phase Mechanics

**Ink Consumption:**
- Every line drawn costs ink
- Cost = line length × line width
- More detailed drawings = more ink spent
- Simple drawings = less ink spent

**Real-Time Feedback:**
- Ink meter shows remaining ink
- Display: `"150 / 200 ink"` format
- Bar color changes: black → orange → red as ink depletes
- Drawing stops when ink runs out

**Strategic Decision:**
- **High ink investment (120-200):** Strong fighter with high HP/damage
- **Medium ink investment (60-120):** Balanced fighter
- **Low ink investment (20-60):** Weak fighter BUT saves ink for summons

### Battle Phase Mechanics

**No Regeneration:**
- Ink does NOT regenerate during battle
- `battleInkRegen` set to `0`
- Starting ink: `200` (was 100)

**Ink Usage:**
- Abilities cost ink (melee: 8, projectile: 12, etc.)
- **Summoning costs 50 ink**
- Players must manage finite resource

**Strategic Depth:**
- Strong starting fighter = less ink for summons
- Weak starting fighter = more summons possible
- Risk/reward balance throughout game

### AI Stat Scaling

**Based on Ink Investment:**

```javascript
// Low ink (20-60): Weak fighter
- HP: 250-350
- Damage: 5-10
- Gesture power: 5-12

// Medium ink (60-120): Balanced fighter
- HP: 350-500
- Damage: 10-20
- Gesture power: 12-18

// High ink (120-200): Strong fighter
- HP: 500-750
- Damage: 20-30
- Gesture power: 18-25
```

**AI Prompt Updated:**
- Receives exact ink spent value
- Scales ALL stats proportionally
- Creates fair reward for ink investment
- Encourages strategic thinking

### Implementation Details

**Schema Changes:**
```typescript
// GameStateSchema
battleInkMax: 200     // Starting ink (was 100)
battleInkRegen: 0     // No regen (was 8)
```

**Drawing Canvas:**
- Tracks total ink used via `totalInkUsed(strokes)`
- Calculates remaining: `inkBudget - inkUsed`
- Prevents drawing when ink depleted
- Passes `inkSpent` to submit callback

**AI Analysis:**
```typescript
analyzeDrawing(imageData, inkSpent)
// Receives ink spent value
// Scales stats accordingly
// Returns FighterConfig with appropriate power level
```

---

## 3. 🔊 Battle Sound Effects

### Procedural Audio
Using Web Audio API for retro-style sound effects:

**Sound Types:**
- **Melee Hit:** Low frequency (200 Hz), punchy
- **Projectile:** Mid frequency (400 Hz), quick
- **Damage:** Low frequency (150 Hz), impact
- **Summon:** High frequency (600 Hz), magical

**Triggers:**
- `playAutoMeleeEffect()` → melee sound
- `playAutoProjectileEffect()` → projectile sound
- `showDamageNumber()` → damage sound
- `showSummonEffect()` → summon sound

**Benefits:**
- No audio file dependencies
- Instant playback
- Lightweight
- Retro game feel

**Future Enhancement:**
Can easily replace with audio files:
```typescript
// In preload():
this.load.audio('melee', '/sounds/melee-hit.mp3');

// In create():
this.sounds.melee = this.sound.add('melee');

// In playSound():
this.sounds.melee.play({ volume: 0.3 });
```

---

## 4. 📊 Strategic Gameplay Loop

### Opening Strategy

**Option A: Power Start**
1. Draw detailed, complex fighter (150+ ink)
2. Get strong fighter (600+ HP, 25+ damage)
3. Dominate early game
4. **Trade-off:** Only 50 ink left → max 1 summon

**Option B: Swarm Strategy**
1. Draw simple fighter (50 ink)
2. Get weak fighter (300 HP, 10 damage)
3. **Advantage:** 150 ink left → 3 summons possible!
4. Overwhelm with numbers

**Option C: Balanced**
1. Draw medium complexity (100 ink)
2. Get decent fighter (450 HP, 15 damage)
3. 100 ink left → 2 summons
4. Flexible mid-game

### Mid-Battle Decisions

**When Winning:**
- Save ink for insurance
- Don't need summons yet
- Conserve for abilities

**When Losing:**
- Summon reinforcements (50 ink each)
- Turn tide with numbers
- Strategic counter-picks

**Resource Management:**
- Every ability costs ink
- Summons are expensive (50 ink)
- Must balance attack/defense/summoning

---

## 5. 🎮 Player Experience

### Visual Clarity
- **Red vs Blue:** Instant team identification
- **Monochrome sprites:** Clean, readable battlefield
- **Ink meter:** Always visible, clear feedback

### Strategic Depth
- **Pre-battle:** Ink investment decision
- **During battle:** Resource management
- **Summoning:** Timing and fighter choice
- **Long-term:** Army composition

### Fairness
- **AI scales with ink:** Fair reward for effort
- **No RNG:** Deterministic outcomes
- **Player skill matters:** Drawing quality + strategy

### Feedback Loop
1. **Draw:** See ink depleting in real-time
2. **Analyze:** AI evaluates ink investment
3. **Battle:** Use remaining ink strategically
4. **Summon:** Create reinforcements
5. **Repeat:** Multiple fighters, managed resources

---

## 6. 🔧 Technical Summary

### Files Modified

**Server:**
- `server/src/schema/GameState.ts` - Added teamColor, updated ink values
- `server/src/rooms/GameRoom.ts` - Assign team colors, handle inkSpent

**Client:**
- `src/lib/ai.ts` - Updated AI to scale with inkSpent
- `src/components/DrawingCanvas.tsx` - Team color only, ink tracking
- `src/components/InkMeter.tsx` - Custom label support
- `src/app/room/[code]/page.tsx` - Pass teamColor, track inkSpent
- `src/app/api/analyze/route.ts` - Accept inkSpent parameter
- `src/game/scenes/BattleScene.ts` - Procedural sound effects

### Key Parameters

```typescript
// Ink System
STARTING_INK = 200
INK_REGEN = 0 (no regen)
SUMMON_COST = 50

// Team Colors
RED_TEAM = "#e74c3c"
BLUE_TEAM = "#3498db"

// AI Scaling
LOW_INK = 20-60 → HP 250-350
MED_INK = 60-120 → HP 350-500
HIGH_INK = 120-200 → HP 500-750
```

---

## 7. 🎯 Balance Considerations

### Ink Costs
- **Melee:** 8 ink
- **Projectile:** 12 ink
- **Shield:** 15 ink
- **Summon:** 50 ink

### Fighter Strength
Balanced to reward ink investment without being unfair:
- 2x ink → ~1.5x power (diminishing returns)
- Encourages variety in strategies
- Numbers can overcome individual strength

### Summon Economics
- 1 summon = ~4 projectile attacks
- Summons have independent ink pools (50 each)
- Multiple weak summons can overwhelm one strong fighter

---

## 8. 🚀 Future Enhancements

### Potential Additions:
1. **Team color customization** (more than 2 players)
2. **Ink pickups** during battle (rare resource drops)
3. **Special abilities** that cost extra ink but are powerful
4. **Ink regeneration power-up** (temporary buff)
5. **Color-coded damage numbers** (match team color)
6. **Team color effects/particles** (projectile trails, etc.)

### Audio Improvements:
1. Replace procedural sounds with professional SFX
2. Add background music
3. Voiceovers for summons
4. Impact sounds vary by fighter size
5. Volume control in settings

---

## Result

A strategic, team-based drawing combat game where:
- ✅ **Clear visual identity** with red vs blue teams
- ✅ **Meaningful choices** in ink investment
- ✅ **Resource management** during battle
- ✅ **Risk/reward balance** between strength and quantity
- ✅ **Audio feedback** for all actions
- ✅ **Fair AI scaling** based on effort
- ✅ **Deep strategy** with multiple viable approaches

Players must think ahead, manage resources, and make strategic decisions at every stage of the game!
