import Phaser from 'phaser';
import GameStateManager from '../systems/GameStateManager';

export class TitleScene extends Phaser.Scene {
  private blinkTimer?: Phaser.Time.TimerEvent;
  private stars: { x: number; y: number; size: number; baseAlpha: number; gfx: Phaser.GameObjects.Graphics }[] = [];
  private glowCircles: Phaser.GameObjects.Graphics[] = [];
  private windowDots: { gfx: Phaser.GameObjects.Graphics; baseAlpha: number }[] = [];
  private vhsTrackingLine?: Phaser.GameObjects.Graphics;
  private trackingY: number = 0;
  private lastStarTwinkle: number = 0;
  private lastWindowFlicker: number = 0;
  private glowPhase: number = 0;

  constructor() {
    super({ key: 'TitleScene' });
  }

  create(): void {
    this.stars = [];
    this.glowCircles = [];
    this.windowDots = [];
    this.trackingY = 0;
    this.lastStarTwinkle = 0;
    this.lastWindowFlicker = 0;
    this.glowPhase = 0;

    const W = 800;
    const H = 900;

    // ===== BACKGROUND: Sky gradient =====
    const skyGfx = this.add.graphics();
    const skyColors = [0x0a0e18, 0x0c1020, 0x0e1228, 0x10142e, 0x0e1028, 0x0c0e22, 0x0a0c1c, 0x0a0814];
    const stripH = H / skyColors.length;
    for (let i = 0; i < skyColors.length; i++) {
      skyGfx.fillStyle(skyColors[i], 1);
      skyGfx.fillRect(0, i * stripH, W, stripH + 1);
    }

    // ===== STARS =====
    const starData = [
      { x: 45, y: 28, s: 1.5, a: 0.5 }, { x: 120, y: 15, s: 1, a: 0.3 },
      { x: 180, y: 55, s: 2, a: 0.55 }, { x: 210, y: 22, s: 1, a: 0.2 },
      { x: 250, y: 70, s: 1.5, a: 0.4 }, { x: 310, y: 18, s: 1, a: 0.35 },
      { x: 335, y: 42, s: 1.5, a: 0.45 }, { x: 340, y: 46, s: 1, a: 0.25 },
      { x: 390, y: 30, s: 2, a: 0.6 }, { x: 420, y: 65, s: 1, a: 0.2 },
      { x: 460, y: 12, s: 1.5, a: 0.5 }, { x: 500, y: 50, s: 1, a: 0.15 },
      { x: 520, y: 25, s: 2, a: 0.4 }, { x: 560, y: 72, s: 1, a: 0.3 },
      { x: 590, y: 35, s: 1.5, a: 0.55 }, { x: 620, y: 10, s: 1, a: 0.25 },
      { x: 650, y: 58, s: 2, a: 0.45 }, { x: 685, y: 20, s: 1, a: 0.35 },
      { x: 710, y: 68, s: 1.5, a: 0.4 }, { x: 740, y: 40, s: 1, a: 0.2 },
      { x: 770, y: 15, s: 1.5, a: 0.5 }, { x: 80, y: 80, s: 1, a: 0.15 },
      { x: 155, y: 90, s: 1.5, a: 0.35 }, { x: 440, y: 88, s: 1, a: 0.25 },
      { x: 580, y: 95, s: 2, a: 0.3 }, { x: 680, y: 85, s: 1, a: 0.2 },
      // Extended stars for taller sky
      { x: 70, y: 120, s: 1, a: 0.25 }, { x: 200, y: 140, s: 1.5, a: 0.35 },
      { x: 330, y: 110, s: 1, a: 0.2 }, { x: 480, y: 150, s: 2, a: 0.4 },
      { x: 560, y: 130, s: 1, a: 0.3 }, { x: 700, y: 105, s: 1.5, a: 0.25 },
      { x: 100, y: 180, s: 1, a: 0.2 }, { x: 250, y: 200, s: 1.5, a: 0.3 },
      { x: 400, y: 170, s: 1, a: 0.15 }, { x: 550, y: 190, s: 2, a: 0.35 },
      { x: 650, y: 160, s: 1, a: 0.2 }, { x: 750, y: 185, s: 1.5, a: 0.3 },
      { x: 50, y: 240, s: 1, a: 0.2 }, { x: 190, y: 260, s: 1.5, a: 0.25 },
      { x: 370, y: 230, s: 1, a: 0.15 }, { x: 520, y: 250, s: 2, a: 0.3 },
      { x: 670, y: 220, s: 1, a: 0.2 }, { x: 770, y: 270, s: 1.5, a: 0.25 },
      // Star clusters
      { x: 300, y: 32, s: 1, a: 0.3 }, { x: 303, y: 36, s: 1, a: 0.25 },
      { x: 297, y: 38, s: 1.5, a: 0.35 },
    ];
    for (const sd of starData) {
      const sg = this.add.graphics();
      sg.fillStyle(0xd4c5a0, sd.a);
      sg.fillCircle(sd.x, sd.y, sd.s);
      this.stars.push({ x: sd.x, y: sd.y, size: sd.s, baseAlpha: sd.a, gfx: sg });
    }

    // ===== CITY SKYLINE =====
    const cityGfx = this.add.graphics();
    const skylineY = 280; // skyline starts here
    // Buildings — varied heights and widths
    const buildings = [
      { x: 0, w: 60, h: 180 }, { x: 55, w: 40, h: 230 }, { x: 90, w: 55, h: 160 },
      { x: 140, w: 35, h: 280 }, { x: 170, w: 50, h: 200 }, { x: 215, w: 70, h: 250 },
      { x: 280, w: 40, h: 170 }, { x: 315, w: 55, h: 300 }, { x: 365, w: 45, h: 220 },
      { x: 405, w: 60, h: 260 }, { x: 460, w: 35, h: 190 }, { x: 490, w: 50, h: 310 },
      { x: 535, w: 45, h: 200 }, { x: 575, w: 65, h: 270 }, { x: 635, w: 40, h: 180 },
      { x: 670, w: 55, h: 240 }, { x: 720, w: 45, h: 210 }, { x: 760, w: 50, h: 190 },
    ];
    cityGfx.fillStyle(0x08080e, 1);
    for (const b of buildings) {
      const top = H - b.h;
      cityGfx.fillRect(b.x, top, b.w, b.h);
      // Roof details — small antenna or water tower silhouettes on some
      if (b.h > 250) {
        cityGfx.fillRect(b.x + b.w / 2 - 2, top - 15, 4, 15); // antenna
        cityGfx.fillRect(b.x + b.w / 2 - 5, top - 18, 10, 4); // crossbar
      }
      if (b.h > 220 && b.h <= 250) {
        // Water tower silhouette
        cityGfx.fillRect(b.x + b.w * 0.3, top - 8, 2, 8);
        cityGfx.fillRect(b.x + b.w * 0.6, top - 8, 2, 8);
        cityGfx.fillRect(b.x + b.w * 0.25, top - 14, b.w * 0.3, 6);
      }
    }

    // Lit windows on buildings
    for (const b of buildings) {
      const top = H - b.h;
      const winCols = Math.floor(b.w / 12);
      const winRows = Math.floor(b.h / 18);
      for (let r = 1; r < winRows; r++) {
        for (let c = 0; c < winCols; c++) {
          if (Math.random() < 0.18) {
            const wx = b.x + 6 + c * 12;
            const wy = top + 8 + r * 18;
            const wa = 0.25 + Math.random() * 0.25;
            const wg = this.add.graphics();
            wg.fillStyle(0xe8c36a, wa);
            wg.fillRect(wx, wy, 4, 4);
            this.windowDots.push({ gfx: wg, baseAlpha: wa });
          }
        }
      }
    }

    // ===== FOREGROUND: Film lot ground =====
    const groundGfx = this.add.graphics();
    groundGfx.fillStyle(0x111115, 1);
    groundGfx.fillRect(0, 780, W, 120);
    // Subtle asphalt texture lines
    groundGfx.fillStyle(0x151519, 0.5);
    for (let i = 0; i < 12; i++) {
      const lx = Math.random() * W;
      groundGfx.fillRect(lx, 790 + Math.random() * 80, 30 + Math.random() * 80, 1);
    }

    // ===== FILM EQUIPMENT SILHOUETTES =====
    const equipGfx = this.add.graphics();
    equipGfx.fillStyle(0x0c0c12, 1);

    // C-stand (far left)
    equipGfx.fillRect(35, 660, 5, 122); // pole
    // Turtle base — three legs radiating
    equipGfx.fillTriangle(20, 782, 55, 782, 37, 778);
    equipGfx.fillRect(18, 780, 8, 4);
    equipGfx.fillRect(50, 780, 8, 4);
    equipGfx.fillRect(34, 780, 8, 6);
    // Arm extending right
    equipGfx.fillRect(40, 665, 40, 3);
    // Knuckle
    equipGfx.fillCircle(40, 665, 4);
    // Flag/floppy
    equipGfx.fillRect(70, 650, 35, 25);

    // Light stand with barn doors (center-left)
    equipGfx.fillRect(175, 670, 6, 112);
    // Riser sections
    equipGfx.fillRect(173, 705, 10, 3);
    equipGfx.fillRect(173, 745, 10, 3);
    // Base legs
    equipGfx.fillTriangle(155, 782, 200, 782, 178, 775);
    equipGfx.fillRect(153, 780, 8, 4);
    equipGfx.fillRect(195, 780, 8, 4);
    // Light head with barn doors
    equipGfx.fillRect(158, 658, 40, 16);
    // Barn door flaps
    equipGfx.fillRect(156, 654, 4, 24);
    equipGfx.fillRect(196, 654, 4, 24);
    equipGfx.fillRect(160, 654, 36, 3); // top barn door
    equipGfx.fillRect(160, 675, 36, 3); // bottom barn door

    // Stacked road cases (center area, behind glow)
    equipGfx.fillRect(290, 748, 70, 34);
    equipGfx.fillRect(295, 732, 60, 18);
    equipGfx.fillRect(300, 722, 50, 12);
    // Handles on cases
    equipGfx.fillStyle(0x0f0f15, 0.8);
    equipGfx.fillRect(310, 755, 15, 3);
    equipGfx.fillRect(340, 755, 15, 3);
    equipGfx.fillRect(310, 738, 12, 3);
    equipGfx.fillStyle(0x0c0c12, 1);

    // Camera dolly (center-right)
    equipGfx.fillRect(500, 762, 80, 12); // platform
    equipGfx.fillRect(510, 774, 8, 8); // wheel housing
    equipGfx.fillRect(560, 774, 8, 8); // wheel housing
    equipGfx.fillCircle(514, 782, 5); // wheel
    equipGfx.fillCircle(564, 782, 5); // wheel
    // Dolly arm
    equipGfx.fillRect(535, 720, 6, 42);
    // Camera head
    equipGfx.fillRect(520, 708, 30, 16);
    equipGfx.fillRect(550, 712, 10, 8); // lens

    // Popup tent frame (far right)
    equipGfx.fillRect(650, 710, 4, 72);
    equipGfx.fillRect(740, 710, 4, 72);
    equipGfx.fillRect(648, 708, 100, 4);
    // Cross braces
    equipGfx.fillRect(648, 730, 100, 2);
    // Tent fabric suggestion
    equipGfx.fillStyle(0x0c0c12, 0.7);
    equipGfx.fillRect(650, 708, 96, 24);
    equipGfx.fillStyle(0x0c0c12, 1);
    // Legs
    equipGfx.fillRect(650, 780, 4, 4);
    equipGfx.fillRect(740, 780, 4, 4);

    // Additional C-stand (right side)
    equipGfx.fillRect(620, 725, 4, 57);
    equipGfx.fillTriangle(610, 782, 635, 782, 622, 778);
    equipGfx.fillRect(608, 780, 6, 4);
    equipGfx.fillRect(631, 780, 6, 4);

    // ===== WORK LIGHT GLOW (downward from under title) =====
    // Glow emanates from just below "PLEASE" and lights the city below
    const glowCenterY = 400;
    const glowContainer = this.add.graphics();
    const glowLayers = [
      { rx: 320, ry: 240, a: 0.015 },
      { rx: 270, ry: 210, a: 0.020 },
      { rx: 230, ry: 180, a: 0.025 },
      { rx: 190, ry: 150, a: 0.032 },
      { rx: 155, ry: 125, a: 0.04 },
      { rx: 120, ry: 100, a: 0.05 },
      { rx: 90, ry: 75, a: 0.06 },
      { rx: 60, ry: 50, a: 0.075 },
      { rx: 35, ry: 30, a: 0.09 },
      { rx: 15, ry: 15, a: 0.10 },
    ];
    for (const gl of glowLayers) {
      glowContainer.fillStyle(0xf5d799, gl.a);
      glowContainer.fillEllipse(400, glowCenterY, gl.rx * 2, gl.ry * 2);
    }
    // Warmer center — right at the light source
    glowContainer.fillStyle(0xe8c36a, 0.08);
    glowContainer.fillEllipse(400, glowCenterY, 50, 30);
    this.glowCircles.push(glowContainer);

    // ===== THE LIGHT STAND (just under "PLEASE") =====
    const lightGfx = this.add.graphics();
    // Stand pole — extends down from light to ground
    lightGfx.fillStyle(0x1a1a22, 1);
    lightGfx.fillRect(397, glowCenterY + 8, 6, 782 - (glowCenterY + 8)); // long pole to ground
    // Riser knuckles
    lightGfx.fillRect(394, glowCenterY + 60, 12, 3);
    lightGfx.fillRect(394, glowCenterY + 120, 12, 3);
    // Tripod base
    lightGfx.fillStyle(0x0c0c12, 1);
    lightGfx.fillTriangle(375, 782, 425, 782, 400, 775);
    lightGfx.fillRect(373, 780, 8, 4);
    lightGfx.fillRect(421, 780, 8, 4);
    lightGfx.fillRect(396, 780, 8, 5);
    // Light housing — rectangular with barn doors
    lightGfx.fillStyle(0x222230, 1);
    lightGfx.fillRect(375, glowCenterY - 8, 50, 18); // housing body
    // Barn door flaps
    lightGfx.fillStyle(0x1a1a24, 1);
    lightGfx.fillRect(370, glowCenterY - 12, 5, 26); // left barn door
    lightGfx.fillRect(425, glowCenterY - 12, 5, 26); // right barn door
    lightGfx.fillRect(377, glowCenterY - 11, 46, 3); // top barn door
    lightGfx.fillRect(377, glowCenterY + 10, 46, 3); // bottom barn door
    // Bright light face (the bulb glow)
    lightGfx.fillStyle(0xf5d799, 0.3);
    lightGfx.fillRect(380, glowCenterY - 4, 40, 10);

    // ===== TITLE TEXT =====
    // Drop shadow
    this.add.text(402, 162, 'COORDINATOR,\nPLEASE', {
      fontFamily: 'Courier New, monospace',
      fontSize: '56px',
      color: '#000000',
      align: 'center',
      lineSpacing: 8,
    }).setOrigin(0.5).setAlpha(0.35);
    // Main title
    this.add.text(400, 160, 'COORDINATOR,\nPLEASE', {
      fontFamily: 'Courier New, monospace',
      fontSize: '56px',
      color: '#d4c5a0',
      align: 'center',
      lineSpacing: 8,
    }).setOrigin(0.5);

    // Subtitle
    this.add.text(400, 490, 'A Stunt Coordination Game', {
      fontFamily: 'Courier New, monospace',
      fontSize: '20px',
      color: '#888070',
    }).setOrigin(0.5);

    // Year
    this.add.text(400, 520, '1995', {
      fontFamily: 'Courier New, monospace',
      fontSize: '18px',
      color: '#999080',
    }).setOrigin(0.5);

    // ===== CLICK TO START (blinking) =====
    const startText = this.add.text(400, 580, '[ CLICK TO START ]', {
      fontFamily: 'Courier New, monospace',
      fontSize: '22px',
      color: '#e8c36a',
    }).setOrigin(0.5);

    this.blinkTimer = this.time.addEvent({
      delay: 600,
      loop: true,
      callback: () => {
        startText.setAlpha(startText.alpha === 1 ? 0 : 1);
      },
    });

    // ===== VHS EFFECTS =====
    // Scanlines
    const scanGfx = this.add.graphics();
    scanGfx.fillStyle(0x000000, 0.04);
    for (let y = 0; y < H; y += 3) {
      scanGfx.fillRect(0, y, W, 1);
    }

    // Vignette — darkened edges
    const vigGfx = this.add.graphics();
    // Top edge
    for (let i = 0; i < 6; i++) {
      vigGfx.fillStyle(0x000000, 0.3 - i * 0.05);
      vigGfx.fillRect(0, i * 12, W, 12);
    }
    // Bottom edge
    for (let i = 0; i < 6; i++) {
      vigGfx.fillStyle(0x000000, 0.3 - i * 0.05);
      vigGfx.fillRect(0, H - (i + 1) * 12, W, 12);
    }
    // Left edge
    for (let i = 0; i < 6; i++) {
      vigGfx.fillStyle(0x000000, 0.25 - i * 0.04);
      vigGfx.fillRect(i * 14, 0, 14, H);
    }
    // Right edge
    for (let i = 0; i < 6; i++) {
      vigGfx.fillStyle(0x000000, 0.25 - i * 0.04);
      vigGfx.fillRect(W - (i + 1) * 14, 0, 14, H);
    }

    // VHS tracking line
    this.vhsTrackingLine = this.add.graphics();

    // ===== CLICK HANDLER =====
    this.input.once('pointerdown', () => {
      if (this.blinkTimer) this.blinkTimer.destroy();
      const gsm = GameStateManager.getInstance();
      gsm.reset();
      this.scene.start('EveningScene', { night: 1 });
    });
  }

  update(time: number, delta: number): void {
    // Star twinkle — every 2 seconds, change 3-4 random stars
    if (time - this.lastStarTwinkle > 2000) {
      this.lastStarTwinkle = time;
      const count = 3 + Math.floor(Math.random() * 2);
      for (let i = 0; i < count && i < this.stars.length; i++) {
        const idx = Math.floor(Math.random() * this.stars.length);
        const star = this.stars[idx];
        const newAlpha = star.baseAlpha + (Math.random() - 0.5) * 0.3;
        star.gfx.clear();
        star.gfx.fillStyle(0xd4c5a0, Math.max(0.05, Math.min(0.7, newAlpha)));
        star.gfx.fillCircle(star.x, star.y, star.size);
      }
    }

    // Window flicker — every 3-5 seconds
    if (time - this.lastWindowFlicker > 3000 + Math.random() * 2000) {
      this.lastWindowFlicker = time;
      for (let i = 0; i < 2; i++) {
        if (this.windowDots.length > 0) {
          const idx = Math.floor(Math.random() * this.windowDots.length);
          const wd = this.windowDots[idx];
          const on = Math.random() > 0.5;
          wd.gfx.setAlpha(on ? wd.baseAlpha : 0);
        }
      }
    }

    // Glow pulse — subtle alpha oscillation
    this.glowPhase += delta * 0.001;
    const pulseAlpha = 1 + Math.sin(this.glowPhase * (2 * Math.PI / 3)) * 0.04;
    for (const gc of this.glowCircles) {
      gc.setAlpha(pulseAlpha);
    }

    // VHS tracking line
    if (this.vhsTrackingLine) {
      this.trackingY += delta * 0.015;
      if (this.trackingY > 920) this.trackingY = -20;
      this.vhsTrackingLine.clear();
      this.vhsTrackingLine.fillStyle(0xffffff, 0.02);
      this.vhsTrackingLine.fillRect(0, this.trackingY, 800, 3);
      this.vhsTrackingLine.fillStyle(0xffffff, 0.015);
      this.vhsTrackingLine.fillRect(0, this.trackingY + 3, 800, 5);
    }
  }
}
