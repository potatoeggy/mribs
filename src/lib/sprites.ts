/**
 * Sprite extraction utilities.
 * Crops the main creature from the canvas for use as a Phaser texture.
 */

interface SpriteBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Extract a sprite from a canvas image data URL using the given bounds.
 * Returns a new data URL of just the cropped region with transparent background.
 */
export function extractSprite(
  canvasDataUrl: string,
  bounds: SpriteBounds,
  maxSize: number = 200
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");

      // Scale to fit within maxSize while preserving aspect ratio
      const scale = Math.min(maxSize / bounds.width, maxSize / bounds.height, 1);
      canvas.width = Math.round(bounds.width * scale);
      canvas.height = Math.round(bounds.height * scale);

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Failed to get canvas context"));
        return;
      }

      // Draw the cropped region
      ctx.drawImage(
        img,
        bounds.x,
        bounds.y,
        bounds.width,
        bounds.height,
        0,
        0,
        canvas.width,
        canvas.height
      );

      // Make the background transparent (remove the paper color)
      makeBackgroundTransparent(ctx, canvas.width, canvas.height);

      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = canvasDataUrl;
  });
}

/**
 * Remove the background color and make it transparent.
 * Detects near-white pixels and makes them transparent.
 */
function makeBackgroundTransparent(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number
) {
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;

  // Background color is #fefef6 (254, 254, 246) — also handle grid lines
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    // If pixel is close to the background color or grid line color, make transparent
    if (r > 220 && g > 220 && b > 210) {
      data[i + 3] = 0; // set alpha to 0
    }
  }

  ctx.putImageData(imageData, 0, 0);
}

/**
 * Auto-detect the bounding box of non-background content in a canvas.
 * Useful as a fallback when AI doesn't provide good bounds.
 */
export function autoDetectBounds(canvasDataUrl: string): Promise<SpriteBounds> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Failed to get canvas context"));
        return;
      }
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      let minX = canvas.width;
      let minY = canvas.height;
      let maxX = 0;
      let maxY = 0;

      for (let y = 0; y < canvas.height; y++) {
        for (let x = 0; x < canvas.width; x++) {
          const i = (y * canvas.width + x) * 4;
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];

          // Check if pixel is NOT background (dark enough to be a drawing)
          if (!(r > 220 && g > 220 && b > 210)) {
            minX = Math.min(minX, x);
            minY = Math.min(minY, y);
            maxX = Math.max(maxX, x);
            maxY = Math.max(maxY, y);
          }
        }
      }

      if (minX > maxX || minY > maxY) {
        resolve({ x: 0, y: 0, width: canvas.width, height: canvas.height });
        return;
      }

      const padding = 10;
      const bx = Math.max(0, minX - padding);
      const by = Math.max(0, minY - padding);
      resolve({
        x: bx,
        y: by,
        width: Math.min(canvas.width - bx, maxX - minX + padding * 2),
        height: Math.min(canvas.height - by, maxY - minY + padding * 2),
      });
    };
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = canvasDataUrl;
  });
}
