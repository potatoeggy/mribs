# Dynamic Character Animations System

## Overview
Complete procedural animation system that brings hand-drawn characters to life with squash-stretch principles and dynamic reactions.

---

## 🎭 Animation Types

### 1. **Idle Animation** (Breathing/Bobbing)
**When:** Character is not attacking or moving
**Effects:**
- Gentle breathing (scale pulses 96%-104%)
- Subtle vertical bobbing (±1.5px)
- Slight rotation wobble (±0.02 radians)
- Frequency: 3-4 second cycles

**Purpose:** Makes characters feel alive even when stationary

```typescript
// Breathing cycle
breatheScale = 1 + sin(time * 0.003) * 0.04
breatheY = sin(time * 0.002) * 1.5
wobble = sin(time * 0.004) * 0.02
```

---

### 2. **Movement Animation** (Squash/Stretch)
**When:** Character is moving toward enemy or repositioning
**Effects:**
- Horizontal squash based on velocity
- Lean in direction of movement
- Bouncing motion while moving
- Faster movement = more squash

**Purpose:** Classic animation principle - gives weight and momentum

```typescript
// Moving
scaleX = 1 - squashAmount  // Narrower
scaleY = 1 + squashAmount  // Taller
rotation = leanAngle  // Lean forward/backward
bounceY = sin(time * 0.015) * 3
```

**Visual:**
```
    O       →     |        (squashed)
   /|\            |O|
   / \            / \
```

---

### 3. **Melee Attack Animation** (Anticipation → Strike → Recovery)
**When:** Character performs melee attack
**Phases:**

#### Phase 1: Anticipation (50ms)
- Squash down (85% width, 115% height)
- Pull back slightly
- Builds tension

#### Phase 2: Strike (80ms)
- Stretch forward (130% width, 80% height)
- Lunge toward target
- Rotate toward enemy (±0.15 rad)

#### Phase 3: Impact
- Particle burst (8 particles)
- Red energy explosion
- Screen shake on target

#### Phase 4: Recovery (200ms)
- Return to position with bounce
- Elastic ease-out
- Settle to normal scale

**Purpose:** Classic "wind-up and release" animation gives attacks weight and impact

```
Phase 1:    Phase 2:     Phase 3:
   O          O——→         *BOOM*
  /|\        /|            (particles)
  / \       / \
(squash)  (stretch)
```

---

### 4. **Projectile Attack Animation** (Charge → Fire → Recoil)
**When:** Character fires projectile
**Phases:**

#### Phase 1: Charge (100ms)
- Pull back (90% width, 110% height)
- Rotate away from target
- Energy gathering

#### Phase 2: Fire (80ms)
- Lean forward (110% width, 90% height)
- Rotate toward target
- Release energy

#### Phase 3: Recoil (150ms)
- Bounce back to normal
- Elastic recovery
- Settle pose

**Visual Effects:**
- Blue charge sphere (8px → 14px)
- Energy ring expansion
- Character recoil animation

**Purpose:** Shows effort and power of ranged attack

---

### 5. **Damage Animation** (Flash → Shake → Recoil)
**When:** Character takes damage
**Effects:**
- White flash (50ms)
- Horizontal shake (±10px, 3 times)
- Squash on impact (90% width, 110% height)
- Red tint briefly

**Purpose:** Clear visual feedback that damage occurred

```
Before:  Hit:     After:
  O      ⚡O⚡     O
 /|\    ←/|\→    /|\
 / \     / \     / \
       (shake)
```

---

### 6. **Death Animation** (Freeze → Expand → Dramatic Fall)
**When:** Character HP reaches 0
**Phases:**

#### Phase 1: Freeze (80ms)
- White flash
- Brief pause (dramatic moment)

#### Phase 2: Shock (200ms)
- Expand/contract rapidly
- Shake violently
- Yoyo effect

#### Phase 3: Defeat (800ms)
- Fall downward (+150px)
- Shrink to 20% size
- 3 full rotations (spinning)
- Fade to transparent

**Extra Effects:**
- 5 afterimage ghosts trailing
- Red tint on ghosts
- Ghosts fade quickly
- Staggered timing (120ms apart)

**Purpose:** Dramatic, memorable defeat that feels impactful

---

### 7. **Victory Animation** (Celebration Loop)
**When:** Character wins the battle
**Effects:**
- Victory jump (±60px, 3 times)
- Scale increase to 110%
- Golden spinning stars (8 stars)
- Continuous bounce loop

**Star Effect:**
- Spawn in circle around winner
- Expand and fade
- Staggered timing (100ms)
- Golden color (#ffd700)

**Purpose:** Celebrate the winner with satisfying animation

```
   ★
 ★ O ★    (jumping)
★ /|\ ★
  / \
   ★
```

---

### 8. **Spawn Animation** (Materialize)
**When:** Character first appears or is summoned
**Effects:**
- Start at 10% scale, 0% alpha
- Grow to 120% with bounce
- Settle to 100% scale
- Fade in simultaneously

**Duration:** 450ms total
- Grow: 300ms
- Settle: 150ms

**Purpose:** Magical entrance, draws attention to new fighter

---

## 🎯 Animation Principles Applied

### 1. **Squash and Stretch**
- All movement uses squash/stretch
- Preserves volume (wider = shorter)
- Adds life and flexibility
- Classic Disney principle

### 2. **Anticipation**
- Wind-up before attacks
- Pull back before strike
- Builds energy
- Makes actions predictable

### 3. **Follow-Through**
- Actions don't stop instantly
- Elastic recovery
- Bounce-back effects
- Natural momentum

### 4. **Timing**
- Fast attacks: 80-100ms
- Slow movements: 200-300ms
- Dramatic moments: 800ms+
- Varied for interest

### 5. **Exaggeration**
- 130% stretch on attacks
- 3-spin death animation
- Obvious visual changes
- Readable from distance

### 6. **Secondary Action**
- Particles during attacks
- Stars on victory
- Ghosts on death
- Adds richness

---

## 🔧 Technical Implementation

### Animation System Architecture

```typescript
// Main update loop
update() {
  for (fighter in fighters) {
    if (attacking) {
      // Skip procedural animations
      fighter.ignoreLerpUntil = now + duration
    } else if (moving) {
      // Apply movement squash/stretch
      applyMovementAnimation()
    } else {
      // Apply idle breathing
      applyIdleAnimation()
    }
  }
}
```

### Key Parameters

```typescript
// Idle
BREATHE_FREQUENCY = 0.003
BREATHE_AMPLITUDE = 0.04
BOB_AMPLITUDE = 1.5px

// Movement
SQUASH_MAX = 0.15
LEAN_MAX = 0.15rad
BOUNCE_FREQUENCY = 0.015

// Attacks
ANTICIPATION_DURATION = 50ms
STRIKE_DURATION = 80ms
RECOVERY_DURATION = 200ms

// Death
DEATH_DURATION = 800ms
GHOST_COUNT = 5
GHOST_INTERVAL = 120ms
```

### Phaser Tweens

All animations use Phaser's tween system:
```typescript
this.tweens.add({
  targets: sprite,
  scaleX: 1.3,
  duration: 100,
  ease: "Cubic.Out",
  onComplete: () => { /* next phase */ }
});
```

**Common Easing Functions:**
- `Cubic.Out` - Attack strikes
- `Quad.InOut` - Smooth movements
- `Back.easeOut` - Bouncy returns
- `Cubic.easeIn` - Falling/death

---

## 🎨 Visual Feedback System

### Color Coding
- **Red particles:** Melee hits
- **Blue effects:** Projectiles
- **Golden stars:** Victory
- **White flash:** Damage/spawn
- **Purple circle:** Summon

### Particle Systems
- **Impact burst:** 8 particles radial
- **Sparkles:** 12 particles on summon
- **Stars:** 8 rotating around victor
- **Ghosts:** 5 trailing on death

### Sound Integration
Every animation triggers appropriate sound:
- Melee → Low frequency thud
- Projectile → Mid frequency zap
- Damage → Impact sound
- Summon → High frequency chime

---

## 🎮 Player Experience

### Readability
- Attacks are telegraphed (anticipation)
- Damage is obvious (flash + shake)
- Death is dramatic (can't be missed)
- Victory is celebratory

### Juice & Polish
- Every action has multiple effects
- Layered animations (primary + particles)
- Sound + visual synchronization
- Smooth transitions

### Performance
- All procedural (no sprite sheets needed)
- Phaser GPU-accelerated tweens
- Particles cleaned up automatically
- ~60 FPS on most devices

---

## 🚀 Future Enhancements

### Potential Additions:
1. **Attack variety** - Different animations per ability
2. **Personality traits** - Aggressive vs defensive animations
3. **Charge attacks** - Hold and release mechanics
4. **Combo effects** - Chain attack animations
5. **Weather effects** - Environmental animations
6. **Emotes** - Player-triggered poses
7. **Team synergy** - Coordinated animations
8. **Special moves** - Ultimate ability animations

### Advanced Techniques:
1. **Bone-based deformation** - More complex squash/stretch
2. **Particle trails** - Follow movement paths
3. **Motion blur** - Fast attack effects
4. **Impact frames** - Freeze on hit
5. **Camera shake** - Screen shake on big hits
6. **Slow-motion** - Dramatic finishes

---

## 📊 Animation Reference Chart

| Animation | Duration | Ease | Squash | Particles | Sound |
|-----------|----------|------|--------|-----------|-------|
| Idle | Continuous | Sin wave | 4% | None | None |
| Move | Continuous | Linear | 15% | None | None |
| Melee | 330ms | Cubic | 30% | 8 red | Melee |
| Projectile | 330ms | Quad | 20% | Ring | Projectile |
| Damage | 120ms | Quad | 10% | None | Damage |
| Death | 1000ms | Cubic | N/A | 5 ghosts | None |
| Victory | 800ms loop | Quad | 15% | 8 stars | None |
| Spawn | 450ms | Back | 120→100% | None | Summon |

---

## Result

Every hand-drawn character now has:
- ✅ **Personality** through constant movement
- ✅ **Weight** through squash/stretch
- ✅ **Impact** through dramatic effects
- ✅ **Readability** through clear tells
- ✅ **Polish** through layered animations
- ✅ **Juice** through particles and sounds

The characters feel **alive** and **responsive**, making the battles much more engaging to watch!
