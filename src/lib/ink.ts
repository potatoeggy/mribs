/**
 * Ink calculation utilities.
 * Ink is measured by total stroke length in pixels.
 */

export interface Stroke {
  points: { x: number; y: number }[];
  color: string;
  lineWidth: number;
  isEraser: boolean;
}

/**
 * Calculate the length of a single stroke in pixels.
 */
export function strokeLength(stroke: Stroke): number {
  let length = 0;
  for (let i = 1; i < stroke.points.length; i++) {
    const dx = stroke.points[i].x - stroke.points[i - 1].x;
    const dy = stroke.points[i].y - stroke.points[i - 1].y;
    length += Math.sqrt(dx * dx + dy * dy);
  }
  return length;
}

/**
 * Calculate total ink used across all strokes.
 * Eraser strokes refund 50% of their length.
 */
export function totalInkUsed(strokes: Stroke[]): number {
  let used = 0;
  for (const stroke of strokes) {
    const len = strokeLength(stroke);
    if (stroke.isEraser) {
      used -= len * 0.5; // partial refund
    } else {
      used += len;
    }
  }
  return Math.max(0, used);
}

/**
 * Check if there is enough ink remaining for a given stroke.
 */
export function hasInkRemaining(strokes: Stroke[], budget: number): boolean {
  return totalInkUsed(strokes) < budget;
}

/**
 * Get ink remaining as a fraction (0-1).
 */
export function inkRemainingFraction(strokes: Stroke[], budget: number): number {
  const used = totalInkUsed(strokes);
  return Math.max(0, Math.min(1, 1 - used / budget));
}
