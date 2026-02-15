# Autoattack System Implementation

## Overview
Converted the combat system from manual gesture-based attacks to an automatic attack system similar to League of Legends or Teamfight Tactics. Each entity now automatically attacks enemies with cool AI-designed animations.

## Key Changes

### 1. Server-Side Autoattack Logic (`server/src/game/BattleSimulation.ts`)

**New Fields:**
- `autoAttackCooldown`: Time remaining until the fighter can autoattack again
- `primaryAttackType`: The fighter's primary attack type (melee or fireProjectile)

**Autoattack System:**
- Automatically triggers attacks when:
  - Enemy is in range
  - Attack cooldown is ready
  - Fighter has enough ink
- Each fighter uses their first offensive ability (melee or projectile) as their primary attack
- Melee fighters automatically move toward enemies when out of range
- Attack cooldown of 0.3s between autoattacks for smooth gameplay

**AI Movement:**
- Melee fighters automatically chase opponents when out of range
- Stop moving when within attack range
- Ranged fighters can attack from any distance

### 2. Enhanced Visual Effects (`src/game/scenes/BattleScene.ts`)

**New Animation Methods:**

#### `playAutoMeleeEffect(attackerId, targetId)`
- Quick lunge animation toward target
- Energy burst impact effect with particles
- 8-particle radial burst on hit
- Target shake effect
- Smooth return to position

#### `playAutoProjectileEffect(attackerId)`
- Charge-up visual at spawn point
- Glowing energy ring expansion
- Blue energy particles

**Enhanced Projectile Visuals:**
- Glowing projectiles with white stroke outline
- 5-particle trail system following each projectile
- Smooth interpolated trail movement
- Pulsing scale animation on main projectile
- Increased size and visibility (8px radius, was 6px)

### 3. UI Updates (`src/components/BattleWrapper.tsx`)

**Removed:**
- Manual gesture controls (tap/swipe/draw)
- Gesture control overlay
- Attack cooldown UI for manual attacks

**Added:**
- "⚔️ Autoattacking" indicator during battle
- Automatic triggering of visual effects on battleEvents
- Enhanced event handlers for meleeHit and projectileSpawn events

**Event Handling:**
- `meleeHit` events now trigger `playAutoMeleeEffect()` with smooth animations
- `projectileSpawn` events trigger `playAutoProjectileEffect()` with charge visuals
- Commentary system updated to work with autoattacks

### 4. Battle Events

**Events Generated:**
- `meleeHit`: When a melee autoattack hits
  - Includes: playerId, targetId, amount
- `projectileSpawn`: When a projectile is fired
  - Includes: playerId, x, y
- `damage`: When projectile hits target
  - Includes: playerId, targetId, amount, x, y

## Visual Design

### Melee Attack Animation
1. **Lunge Phase** (100ms): Fighter dashes toward target
2. **Impact**: Red energy burst with 12px radius expanding to 2.5x
3. **Particles**: 8 particles explode outward in all directions
4. **Shake**: Target shakes horizontally (±8px, 3 times)
5. **Return** (180ms): Fighter smoothly returns to starting position

### Projectile Attack Animation
1. **Charge** (200ms): Blue energy sphere forms at spawn point
2. **Ring**: Expanding blue ring (15px → 30px radius)
3. **Projectile**: Glowing blue sphere with white outline
4. **Trail**: 5-particle smooth trail following projectile
5. **Pulse**: Continuous scale pulse (1.0 ↔ 1.2)

## Gameplay Balance

- **Autoattack Cooldown**: 0.3s global cooldown between attacks
- **Ability Cooldowns**: Preserved from original config (varies by ability)
- **Ink Costs**:
  - Melee: 8 ink
  - Projectile: 12 ink
- **Movement**: Melee fighters automatically close distance
- **Range**: Melee ~40-50px, Projectiles unlimited

## Technical Notes

- Autoattack logic runs in `BattleSimulation.tick()` at 60 FPS
- Visual effects are client-side with server-authoritative damage
- Trail system uses cascading interpolation for smooth motion
- All animations use Phaser tweens with easing functions
- Battle events broadcast to all clients for synchronized effects

## Future Enhancements (Optional)

- Add attack variety based on fighter type
- Implement special abilities that can be manually triggered
- Add critical hit animations
- Include attack range indicators
- Add combo system for consecutive hits
