import Phaser from 'phaser';
import GameStateManager from '../systems/GameStateManager';

export class IntroScene extends Phaser.Scene {
  private lines: { text: string; delay: number }[] = [];
  private currentLine: number = 0;
  private lineTexts: Phaser.GameObjects.Text[] = [];
  private elapsed: number = 0;
  private currentDelay: number = 1500;
  private allRevealed: boolean = false;
  private continueText: Phaser.GameObjects.Text | null = null;

  constructor() {
    super({ key: 'IntroScene' });
  }

  create(): void {
    this.currentLine = 0;
    this.lineTexts = [];
    this.elapsed = 0;
    this.allRevealed = false;
    this.continueText = null;

    this.cameras.main.setBackgroundColor('#0a0a0f');

    // Draw city skyline background
    this.drawSkyline();

    // Each line has its own pacing delay (ms before NEXT line appears)
    this.lines = [
      { text: "It's 1995.", delay: 2000 },
      { text: "", delay: 800 },
      { text: "I'm down to my last dime.", delay: 1500 },
      { text: "Then this show called.", delay: 2200 },
      { text: "It's seven nights of overnights.", delay: 1500 },
      { text: "Stunt coordinating on some low-budget thing", delay: 1200 },
      { text: "shooting in Localville.", delay: 1800 },
      { text: "", delay: 1000 },
      { text: "Working in Localville, you need to know one thing.", delay: 2200 },
      { text: "In this town there are truth tellers,", delay: 1400 },
      { text: "and there are liars.", delay: 1800 },
      { text: "", delay: 800 },
      { text: "Everybody wants a job around here.", delay: 1400 },
      { text: "Some of them will lie through their teeth", delay: 1000 },
      { text: "to get it.", delay: 1800 },
      { text: "", delay: 1000 },
      { text: "But I need stunt people I can trust.", delay: 1800 },
      { text: "The producer will come down on me hard", delay: 1200 },
      { text: "if my performers screw up.", delay: 2000 },
      { text: "", delay: 1000 },
      { text: "I need this job to survive.", delay: 2000 },
    ];

    // Tap to speed up text reveal
    this.input.on('pointerdown', () => {
      if (!this.allRevealed) {
        this.elapsed = this.currentDelay;
      }
    });

    // Start revealing lines
    this.revealNextLine();
  }

  update(_time: number, delta: number): void {
    if (this.allRevealed) return;

    this.elapsed += delta;
    if (this.elapsed >= this.currentDelay) {
      this.elapsed = 0;
      this.revealNextLine();
    }
  }

  private drawSkyline(): void {
    const gfx = this.add.graphics();
    const W = 800;
    const H = 900;

    // Night sky gradient
    const skyColors = [0x08091a, 0x0a0c1e, 0x0c0e22, 0x0e1026, 0x0c0e20, 0x0a0c1a];
    const stripH = 150;
    for (let i = 0; i < skyColors.length; i++) {
      gfx.fillStyle(skyColors[i], 1);
      gfx.fillRect(0, i * stripH, W, stripH + 1);
    }

    // Stars
    const starPositions = [
      [30, 20], [90, 45], [150, 15], [220, 55], [280, 25], [340, 40],
      [410, 10], [460, 50], [530, 30], [590, 18], [650, 48], [720, 22],
      [50, 70], [180, 80], [310, 65], [440, 75], [570, 60], [700, 85],
    ];
    starPositions.forEach(([sx, sy]) => {
      const alpha = 0.15 + Math.random() * 0.3;
      gfx.fillStyle(0xccccdd, alpha);
      gfx.fillRect(sx, sy, Math.random() > 0.6 ? 2 : 1, 1);
    });

    // City skyline — dark silhouette buildings at bottom
    const skylineY = 650;
    const buildingColor = 0x0a0a12;

    // Far background buildings (dimmer, shorter)
    gfx.fillStyle(0x0e0e18, 0.8);
    gfx.fillRect(0, skylineY + 40, W, H - skylineY);

    // Buildings — varying heights and widths
    const buildings = [
      { x: 0, w: 60, h: 180 },
      { x: 55, w: 40, h: 120 },
      { x: 90, w: 70, h: 220 },
      { x: 155, w: 35, h: 140 },
      { x: 185, w: 55, h: 190 },
      { x: 235, w: 80, h: 250 },    // tall tower
      { x: 310, w: 45, h: 160 },
      { x: 350, w: 65, h: 200 },
      { x: 410, w: 50, h: 170 },
      { x: 455, w: 75, h: 230 },    // another tall one
      { x: 525, w: 40, h: 130 },
      { x: 560, w: 60, h: 185 },
      { x: 615, w: 45, h: 150 },
      { x: 655, w: 70, h: 210 },
      { x: 720, w: 80, h: 175 },
    ];

    buildings.forEach(b => {
      const by = skylineY + 80 - b.h;
      gfx.fillStyle(buildingColor, 1);
      gfx.fillRect(b.x, by, b.w, b.h + 200);

      // Rooftop detail — antenna or water tower
      if (b.h > 200) {
        gfx.fillRect(b.x + b.w / 2 - 1, by - 20, 2, 20); // antenna
        gfx.fillRect(b.x + b.w / 2 - 4, by - 22, 8, 3);  // tip
      } else if (b.h > 170) {
        // Water tower
        gfx.fillRect(b.x + b.w / 2 - 6, by - 12, 12, 10);
        gfx.fillRect(b.x + b.w / 2 - 1, by - 2, 2, 4);
      }

      // Windows — scattered lit windows (yellow dots)
      const windowRows = Math.floor(b.h / 16);
      const windowCols = Math.floor(b.w / 12);
      for (let row = 0; row < windowRows; row++) {
        for (let col = 0; col < windowCols; col++) {
          if (Math.random() < 0.25) { // 25% of windows lit
            const wx = b.x + 4 + col * 12;
            const wy = by + 8 + row * 16;
            const brightness = Math.random() * 0.3 + 0.1;
            const windowColor = Math.random() > 0.8 ? 0xf5d799 : 0xe8c36a;
            gfx.fillStyle(windowColor, brightness);
            gfx.fillRect(wx, wy, 4, 5);
          }
        }
      }
    });

    // Ground level — dark
    gfx.fillStyle(0x080810, 1);
    gfx.fillRect(0, skylineY + 80, W, H - skylineY);

    // Subtle city glow at horizon
    gfx.fillStyle(0xe8a040, 0.015);
    gfx.fillEllipse(400, skylineY + 80, 800, 60);
    gfx.fillStyle(0xe8a040, 0.025);
    gfx.fillEllipse(400, skylineY + 80, 500, 30);

    // Semi-transparent overlay so text is readable
    gfx.fillStyle(0x0a0a0f, 0.65);
    gfx.fillRect(0, 0, W, H);
  }

  private revealNextLine(): void {
    if (this.currentLine >= this.lines.length) {
      this.allRevealed = true;
      this.showContinue();
      return;
    }

    const lineObj = this.lines[this.currentLine];
    const line = lineObj.text;
    this.currentDelay = lineObj.delay;
    const y = 40 + this.currentLine * 34;

    if (line === '') {
      this.currentLine++;
      return;
    }

    // Styling
    const isFirstLine = this.currentLine === 0;
    const isLastLine = this.currentLine === this.lines.length - 1;
    const isTrustLine = line === 'But I need stunt people I can trust.';

    let fontSize = '20px';
    let color = '#d4c5a0';
    let fontStyle = 'normal';

    if (isFirstLine) {
      fontSize = '30px';
      color = '#e8c36a';
      fontStyle = 'bold';
    } else if (isLastLine) {
      fontSize = '26px';
      color = '#d4c5a0';
      fontStyle = 'bold';
    } else if (isTrustLine) {
      fontSize = '24px';
      color = '#e8c36a';
      fontStyle = 'bold';
    }

    const text = this.add.text(400, y, line, {
      fontFamily: 'Courier New, monospace',
      fontSize: fontSize,
      color: color,
      fontStyle: fontStyle,
      wordWrap: { width: 650 },
      align: 'center',
    }).setOrigin(0.5, 0).setAlpha(0);

    this.lineTexts.push(text);

    this.tweens.add({
      targets: text,
      alpha: 1,
      duration: 500,
    });

    this.currentLine++;
  }

  private showContinue(): void {
    this.continueText = this.add.text(400, 860, '[ TAP TO CONTINUE ]', {
      fontFamily: 'Courier New, monospace',
      fontSize: '18px',
      color: '#6a6050',
    }).setOrigin(0.5).setAlpha(0);

    this.tweens.add({
      targets: this.continueText,
      alpha: 1,
      duration: 800,
      delay: 400,
    });

    this.input.once('pointerdown', () => {
      this.scene.start('EveningScene', { night: 1 });
    });
  }
}
