/**
 * Maps gesture types to game abilities.
 * Used to translate user gestures into game commands.
 */

import type { ComponentType, GestureType } from "@shared/types";

interface AbilityMapping {
  abilityType: ComponentType;
  requiresTarget: boolean;
}

/**
 * Map a gesture to an ability based on the fighter's available abilities.
 */
export function mapGestureToAbility(
  gesture: GestureType,
  availableAbilities: string[]
): AbilityMapping | null {
  switch (gesture) {
    case "swipeRight":
    case "swipeLeft":
      // Horizontal swipe = melee attack (if available) or move
      if (availableAbilities.includes("melee")) {
        return { abilityType: "melee", requiresTarget: true };
      }
      return null; // Just move

    case "slash":
      // Fast slash = melee or projectile
      if (availableAbilities.includes("melee")) {
        return { abilityType: "melee", requiresTarget: true };
      }
      if (availableAbilities.includes("fireProjectile")) {
        return { abilityType: "fireProjectile", requiresTarget: true };
      }
      return null;

    case "tap":
      // Tap = fire projectile (if available)
      if (availableAbilities.includes("fireProjectile")) {
        return { abilityType: "fireProjectile", requiresTarget: true };
      }
      if (availableAbilities.includes("melee")) {
        return { abilityType: "melee", requiresTarget: true };
      }
      return null;

    case "circle":
      // Circle = shield (if available)
      if (availableAbilities.includes("shield")) {
        return { abilityType: "shield", requiresTarget: false };
      }
      return null;

    case "swipeUp":
      // Swipe up = fly (if available) or dash upward
      if (availableAbilities.includes("flying")) {
        return { abilityType: "flying", requiresTarget: false };
      }
      if (availableAbilities.includes("dash")) {
        return { abilityType: "dash", requiresTarget: false };
      }
      return null;

    default:
      return null;
  }
}

/**
 * Get a user-friendly description for each gesture -> ability mapping.
 */
export function getGestureHelp(availableAbilities: string[]): { gesture: string; action: string }[] {
  const help: { gesture: string; action: string }[] = [];

  help.push({ gesture: "Click & drag", action: "Move" });

  if (availableAbilities.includes("fireProjectile")) {
    help.push({ gesture: "Tap", action: "Fire projectile" });
  }
  if (availableAbilities.includes("melee")) {
    help.push({ gesture: "Swipe left/right", action: "Melee attack" });
  }
  if (availableAbilities.includes("shield")) {
    help.push({ gesture: "Draw circle", action: "Shield" });
  }
  if (availableAbilities.includes("flying")) {
    help.push({ gesture: "Swipe up", action: "Fly" });
  }
  if (availableAbilities.includes("dash")) {
    help.push({ gesture: "Swipe up", action: "Dash" });
  }

  return help;
}
