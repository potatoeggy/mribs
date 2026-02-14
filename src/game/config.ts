import Phaser from "phaser";
import { ARENA_WIDTH, ARENA_HEIGHT } from "@shared/types";

export function createPhaserConfig(
  parent: HTMLElement,
  scene: Phaser.Types.Scenes.SceneType[]
): Phaser.Types.Core.GameConfig {
  return {
    type: Phaser.AUTO,
    width: ARENA_WIDTH,
    height: ARENA_HEIGHT,
    parent,
    backgroundColor: "#fefef6",
    physics: {
      default: "arcade",
      arcade: {
        gravity: { x: 0, y: 0 }, // We handle gravity in the server sim
        debug: false,
      },
    },
    audio: {
      noAudio: true,
    },
    scene,
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    render: {
      pixelArt: false,
      antialias: true,
    },
  };
}
