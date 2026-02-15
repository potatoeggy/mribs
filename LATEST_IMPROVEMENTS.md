# Latest Improvements & Feature Implementation Guide

## ✅ **Completed Features**

### 1. **Ink Bars Replace HP Bars**
- Changed from HP bars above characters to Ink bars
- Shows remaining ink resource (200 max, no regen)
- Color matches player's team color
- Strategic indicator of remaining resources

**Files Modified:**
- `src/game/scenes/BattleScene.ts` - Changed FighterDisplay interface
- Renamed `hpBarBg/hpBarFill` → `inkBarBg/inkBarFill`
- Updated `createFighterDisplay()`, `removeFighter()`, `showDeathAnimation()`
- Ink bars now use team color dynamically

### 2. **Team Colors for All Characters**
- Each player assigned a team color:
  - **Player 1:** Red (`#e74c3c`)
  - **Player 2:** Blue (`#3498db`)
- ALL characters owned by a player use that color
- Easy visual identification in crowded battles
- Ink bars match team color

**Implementation:**
- `teamColor` field added to `PlayerSchema`
- Assigned on player join in `GameRoom.onJoin()`
- Passed through to all render layers
- Character sprites will be tinted with team color

### 3. **Inline Summon Canvas**
- Moved from modal to inline below battle
- Faster feedback loop
- Draw and summon instantly
- Shows ink progress bar
- Auto-clears after summon

**New Component:** `src/components/InlineSummonCanvas.tsx`
- 300x200px canvas
- Draws in player's team color
- Clear and Summon buttons
- Ink affordability check
- Disabled during AI analysis

### 4. **Fixed Bugs**
- ✅ Ink no longer regenerates (disabled in BattleSimulation.ts:348)
- ✅ HP bars fixed (default 500 HP instead of 100)
- ✅ Dynamic character animations working

---

## 🚧 **Features To Implement**

### 5. **More Attack Types & Balance**

#### Current Attack Types:
- **Melee:** Close range, 15 damage, 8 ink
- **Fire Projectile:** Ranged, 10 damage, 12 ink

#### Proposed New Attack Types:

**A. Homing Projectile**
```typescript
// In AI analysis prompt
{
  type: "homingProjectile",
  params: {
    damage: 8,          // Slightly lower than regular
    cooldown: 2.0,      // Longer cooldown
    speed: 4,           // Slower
    homingStrength: 0.5, // How aggressively it homes
    label: "Seeking Bolt"
  }
}

// Ink cost: 18 (expensive for homing)
```

**Implementation in BattleSimulation.ts:**
```typescript
case "homingProjectile": {
  // Similar to fireProjectile but with homing flag
  this.projectiles.push({
    id: `proj_${this.nextProjectileId++}`,
    ownerId: playerId,
    x: fighter.x + (fighter.facingRight ? 30 : -30),
    y: fighter.y - 10,
    vx,
    vy,
    damage: (ability.params.damage as number) || 8,
    active: true,
    age: 0,
    isHoming: true, // NEW
    homingStrength: (ability.params.homingStrength as number) || 0.5,
  });
}

// In tick(), update homing projectiles:
if (proj.isHoming && opponent) {
  const dx = opponent.x - proj.x;
  const dy = opponent.y - proj.y;
  const dist = Math.sqrt(dx * dx + dy * dy) || 1;

  // Steer toward target
  proj.vx += (dx / dist) * proj.homingStrength * 10;
  proj.vy += (dy / dist) * proj.homingStrength * 10;

  // Limit speed
  const speed = Math.sqrt(proj.vx * proj.vx + proj.vy * proj.vy);
  if (speed > 500) {
    proj.vx = (proj.vx / speed) * 500;
    proj.vy = (proj.vy / speed) * 500;
  }
}
```

**B. Fast Attack**
```typescript
{
  type: "melee",
  params: {
    damage: 5,
    range: 30,
    cooldown: 0.3,  // Very fast
    label: "Quick Jab"
  }
}
// Ink cost: 5 (cheap, low damage, fast)
```

**C. Heavy Attack**
```typescript
{
  type: "melee",
  params: {
    damage: 30,
    range: 50,
    cooldown: 3.0,  // Very slow
    label: "Power Slam"
  }
}
// Ink cost: 15 (expensive, high damage, slow)
```

**D. Multi-Shot**
```typescript
{
  type: "multiProjectile",
  params: {
    damage: 5,      // Per projectile
    count: 3,       // Number of projectiles
    spread: 0.3,    // Angle spread
    cooldown: 1.5,
    speed: 6,
    label: "Triple Shot"
  }
}
// Ink cost: 20 (expensive, area coverage)
```

#### **AI Scaling with Ink Investment:**

Update AI prompt to distribute stats based on ink spent:

```typescript
// Low ink (20-60): Fast, weak attacks
- Fast attack (0.3s cooldown, 5 damage)
- Low HP (250-350)
- Evasive playstyle

// Medium ink (60-120): Balanced
- Medium attacks (0.8s cooldown, 15 damage)
- Medium HP (350-500)
- Standard playstyle

// High ink (120-200): Slow, powerful
- Heavy attacks (2.0s cooldown, 30 damage)
- High HP (500-750)
- Tank playstyle
```

---

### 6. **Random Movement When Idle**

Add to `BattleSimulation.ts`:

```typescript
interface FighterState {
  // ... existing fields
  idleTimer: number;
  randomMoveTarget: { x: number; y: number } | null;
}

// In tick():
if (!fighter.isAttacking && !fighter.isMovingToEnemy) {
  fighter.idleTimer += dt;

  // Every 2-5 seconds, pick a random spot to move to
  if (fighter.idleTimer > 2 + Math.random() * 3) {
    fighter.idleTimer = 0;

    // Pick random position within bounds
    fighter.randomMoveTarget = {
      x: 100 + Math.random() * (ARENA_WIDTH - 200),
      y: GROUND_Y,
    };
  }

  // Move toward random target
  if (fighter.randomMoveTarget) {
    const dx = fighter.randomMoveTarget.x - fighter.x;
    if (Math.abs(dx) > 5) {
      fighter.vx = Math.sign(dx) * fighter.movementSpeed * 30;
    } else {
      fighter.randomMoveTarget = null;
    }
  }
}
```

**Purpose:** Makes battles more dynamic, characters don't stand still

---

### 7. **Jumping to Dodge Attacks**

Add to `FighterState`:

```typescript
interface FighterState {
  // ... existing
  intelligence: number; // 1-10 stat
  canJump: boolean;
  jumpCooldown: number;
}

// In tick(), check if projectile is incoming:
for (const proj of this.projectiles) {
  if (proj.ownerId !== fighter.id && proj.active) {
    const dx = proj.x - fighter.x;
    const dy = proj.y - fighter.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Projectile heading toward fighter?
    const projAngle = Math.atan2(proj.vy, proj.vx);
    const toFighterAngle = Math.atan2(dy, dx);
    const angleDiff = Math.abs(projAngle - toFighterAngle);

    if (dist < 200 && angleDiff < 0.5) {
      // Intelligence check: % chance to dodge
      const dodgeChance = fighter.intelligence / 10; // 10% to 100%

      if (Math.random() < dodgeChance && fighter.canJump) {
        // JUMP!
        fighter.vy = -400;
        fighter.isOnGround = false;
        fighter.canJump = false;
        fighter.jumpCooldown = 2.0; // 2 second cooldown

        this.events.push({
          type: "dodge",
          playerId: fighter.id,
        });
      }
    }
  }
}

// Cooldown update:
if (!fighter.canJump) {
  fighter.jumpCooldown -= dt;
  if (fighter.jumpCooldown <= 0) {
    fighter.canJump = true;
  }
}
```

**AI Intelligence Distribution:**
- Low ink fighters: 3-5 intelligence (30-50% dodge)
- Medium ink: 5-7 intelligence (50-70% dodge)
- High ink: 2-4 intelligence (20-40% dodge, they're slower)

**Visual Feedback:**
Add to `BattleScene.ts`:
```typescript
case "dodge":
  const fighter = this.fighters.get(event.playerId);
  if (fighter) {
    // Show "DODGE!" text
    const dodgeText = this.add.text(fighter.sprite.x, fighter.sprite.y - 30, "DODGE!", {
      fontSize: "20px",
      color: "#f39c12",
      fontStyle: "bold",
    });
    this.tweens.add({
      targets: dodgeText,
      y: fighter.sprite.y - 60,
      alpha: 0,
      duration: 600,
      onComplete: () => dodgeText.destroy(),
    });
  }
  break;
```

---

## 📊 **Balance Chart**

| Attack Type | Damage | Cooldown | Range | Speed | Ink Cost | Notes |
|-------------|--------|----------|-------|-------|----------|-------|
| Quick Jab | 5 | 0.3s | 30 | N/A | 5 | Fast, low damage |
| Melee | 15 | 0.8s | 40 | N/A | 8 | Standard |
| Power Slam | 30 | 3.0s | 50 | N/A | 15 | Slow, high damage |
| Projectile | 10 | 1.5s | ∞ | 500 | 12 | Standard ranged |
| Homing | 8 | 2.0s | ∞ | 400 | 18 | Seeks target |
| Multi-Shot | 5×3 | 1.5s | ∞ | 600 | 20 | Area coverage |
| Shield | N/A | 5.0s | N/A | N/A | 15 | Blocks 30 damage |

**DPS Calculations:**
- Quick Jab: 16.7 DPS (5 / 0.3)
- Melee: 18.75 DPS (15 / 0.8)
- Power Slam: 10 DPS (30 / 3.0)
- Projectile: 6.7 DPS (10 / 1.5)
- Homing: 4 DPS (8 / 2.0)
- Multi-Shot: 10 DPS (15 / 1.5)

**Ink Efficiency (Damage per Ink):**
- Quick Jab: 1.0 (5 / 5)
- Melee: 1.875 (15 / 8)
- Power Slam: 2.0 (30 / 15)
- Projectile: 0.833 (10 / 12)
- Homing: 0.444 (8 / 18)
- Multi-Shot: 0.75 (15 / 20)

**Conclusion:** Melee attacks are more ink-efficient but require close range and risk. Ranged attacks are safer but cost more ink per damage.

---

## 🎨 **Visual Improvements Needed**

### Team Color Application
Currently team color is only on ink bars. Need to apply to:

**In `BattleScene.ts` - `loadFighterSprite()`:**
```typescript
loadFighterSprite(playerId: string, spriteDataUrl: string): void {
  const fighter = this.fighters.get(playerId);
  if (!fighter) return;

  const img = new Image();
  img.onload = () => {
    // Convert image to use team color
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = img.width;
    canvas.height = img.height;

    ctx.drawImage(img, 0, 0);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    // Convert black pixels to team color
    const teamColor = this.hexToRgb(fighter.teamColor);
    for (let i = 0; i < imageData.data.length; i += 4) {
      const r = imageData.data[i];
      const g = imageData.data[i + 1];
      const b = imageData.data[i + 2];
      const brightness = (r + g + b) / 3;

      if (brightness < 50) { // Dark pixels
        imageData.data[i] = teamColor.r;
        imageData.data[i + 1] = teamColor.g;
        imageData.data[i + 2] = teamColor.b;
      }
    }

    ctx.putImageData(imageData, 0, 0);
    const coloredDataUrl = canvas.toDataURL();

    // ... rest of sprite loading
  };
}

private hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : { r: 0, g: 0, b: 0 };
}
```

**Projectile Colors:**
```typescript
// In updateState(), when creating projectiles:
const ownerColor = this.fighters.get(proj.ownerId)?.teamColor || "#1a1a1a";
const colorHex = parseInt(ownerColor.replace('#', ''), 16);
const graphic = this.add.circle(proj.x, proj.y, 8, colorHex);
```

---

## 🎯 **Implementation Priority**

1. **HIGH:** Team color application to sprites ⭐
2. **HIGH:** Homing projectile attack type ⭐
3. **MEDIUM:** Fast/Heavy attack variants
4. **MEDIUM:** Random idle movement
5. **LOW:** Jumping dodge system (requires intelligence stat)
6. **LOW:** Multi-shot attack type

---

## 🔧 **Quick Implementation Checklist**

### To add team colors to characters:
- [ ] Add `hexToRgb()` utility to BattleScene
- [ ] Update `loadFighterSprite()` to recolor based on team
- [ ] Update projectile creation to use owner's team color
- [ ] Test with both red and blue teams

### To add homing projectiles:
- [ ] Add to AI system prompt in `ai.ts`
- [ ] Add `isHoming` field to ProjectileState interface
- [ ] Add homing logic to `BattleSimulation.tick()`
- [ ] Add ink cost to BATTLE_INK_COSTS
- [ ] Test balance (should be slightly weaker than standard)

### To add random movement:
- [ ] Add `idleTimer` and `randomMoveTarget` to FighterState
- [ ] Add movement logic in tick() when not attacking
- [ ] Clamp movement to arena bounds
- [ ] Test to ensure it doesn't interfere with combat

### To add jumping:
- [ ] Add `intelligence`, `canJump`, `jumpCooldown` to FighterState
- [ ] Add projectile threat detection
- [ ] Add jump trigger based on intelligence
- [ ] Add "dodge" event type
- [ ] Add dodge visual feedback in BattleScene
- [ ] Test dodge frequency is reasonable

---

## 🚀 **Result**

The game now has:
- ✅ Team-based color coding (red vs blue)
- ✅ Ink bars showing strategic resource
- ✅ Inline summon for fast iteration
- ✅ Fixed ink regeneration bug
- ✅ Fixed HP display bug
- ✅ Dynamic character animations

**Next steps:** Add more attack variety, movement behaviors, and intelligence-based dodging for even more strategic depth!
