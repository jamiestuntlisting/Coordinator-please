import Phaser from 'phaser';

export class VHSOverlay {
  private scene: Phaser.Scene;
  private scanlineGraphics: Phaser.GameObjects.Graphics;
  private vignetteGraphics: Phaser.GameObjects.Graphics;
  private grainGraphics: Phaser.GameObjects.Graphics;
  private grainTimer: number = 0;
  private width: number;
  private height: number;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.width = Number(scene.game.config.width);
    this.height = Number(scene.game.config.height);

    this.scanlineGraphics = scene.add.graphics().setDepth(9998);
    this.vignetteGraphics = scene.add.graphics().setDepth(9999);
    this.grainGraphics = scene.add.graphics().setDepth(9997);
  }

  drawScanlines(): void {
    const g = this.scanlineGraphics;
    g.clear();
    g.lineStyle(1, 0x000000, 0.04);
    for (let y = 0; y < this.height; y += 3) {
      g.lineBetween(0, y, this.width, y);
    }
  }

  drawVignette(): void {
    const g = this.vignetteGraphics;
    const w = this.width;
    const h = this.height;
    g.clear();

    // Draw concentric rectangles with increasing alpha toward edges
    const steps = 20;
    for (let i = 0; i < steps; i++) {
      const t = i / steps;
      const alpha = t * t * 0.5; // Quadratic falloff, max 0.5 at edges
      const inset = (1 - t) * 120; // 120px max inset from edge

      g.fillStyle(0x000000, alpha);
      // Top edge
      g.fillRect(0, 0, w, Math.max(1, inset - (i * 6)));
      // Bottom edge
      g.fillRect(0, h - Math.max(1, inset - (i * 6)), w, Math.max(1, inset - (i * 6)));
      // Left edge
      g.fillRect(0, 0, Math.max(1, inset - (i * 6)), h);
      // Right edge
      g.fillRect(w - Math.max(1, inset - (i * 6)), 0, Math.max(1, inset - (i * 6)), h);
    }

    // Corner darkening
    const cornerSize = 150;
    for (let i = 0; i < 8; i++) {
      const a = 0.02 + i * 0.015;
      const s = cornerSize - i * 15;
      if (s <= 0) continue;
      g.fillStyle(0x000000, a);
      // Top-left
      g.fillRect(0, 0, s, s);
      // Top-right
      g.fillRect(w - s, 0, s, s);
      // Bottom-left
      g.fillRect(0, h - s, s, s);
      // Bottom-right
      g.fillRect(w - s, h - s, s, s);
    }
  }

  updateGrain(delta: number): void {
    this.grainTimer += delta;
    if (this.grainTimer < 200) return;
    this.grainTimer = 0;

    const g = this.grainGraphics;
    g.clear();

    // Scatter random semi-transparent dots
    const dotCount = 120;
    for (let i = 0; i < dotCount; i++) {
      const x = Math.random() * this.width;
      const y = Math.random() * this.height;
      const brightness = Math.random() > 0.5 ? 0xffffff : 0x000000;
      const alpha = 0.01 + Math.random() * 0.025;
      g.fillStyle(brightness, alpha);
      g.fillRect(x, y, 1, 1);
    }
  }

  apply(): void {
    this.drawScanlines();
    this.drawVignette();
  }

  destroy(): void {
    this.scanlineGraphics.destroy();
    this.vignetteGraphics.destroy();
    this.grainGraphics.destroy();
  }
}
