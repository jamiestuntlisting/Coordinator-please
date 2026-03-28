import Phaser from 'phaser';
import GameStateManager from '../systems/GameStateManager';
import { NIGHT_CONFIGS } from '../config/nights';
import type { NightConfig } from '../types/index';

export class EveningScene extends Phaser.Scene {
  private nightConfig!: NightConfig;
  private charIndex: number = 0;
  private monologueText!: Phaser.GameObjects.Text;
  private fullMonologue: string = '';
  private canAdvance: boolean = false;
  private continueShown: boolean = false;

  // Wake-up state
  private wakeElapsed: number = 0;
  private focusDuration: number = 1000;
  private wakeupDone: boolean = false;
  private wakeOverlay!: Phaser.GameObjects.Graphics;

  // Typewriter state
  private typeElapsed: number = 0;
  private typeDelay: number = 40;
  private typeStarted: boolean = false;

  // Continue blink
  private continueText: Phaser.GameObjects.Text | null = null;
  private blinkElapsed: number = 0;

  constructor() {
    super({ key: 'EveningScene' });
  }

  create(data: { night?: number }): void {
    const night = data.night ?? 1;
    this.nightConfig = NIGHT_CONFIGS[night - 1] ?? NIGHT_CONFIGS[0];
    this.charIndex = 0;
    this.canAdvance = false;
    this.continueShown = false;
    this.wakeElapsed = 0;
    this.wakeupDone = false;
    this.typeElapsed = 0;
    this.typeDelay = 40;
    this.typeStarted = false;
    this.continueText = null;
    this.blinkElapsed = 0;

    const gsm = GameStateManager.getInstance();
    gsm.updateState({
      night,
      currentPhase: 'evening',
      timeOfNight: 17.25,
    });

    const W = 800;
    const H = 600;
    this.cameras.main.setBackgroundColor('#0a0a0f');

    // Focus takes longer each night (1s Night 1, up to 4s Night 7)
    this.focusDuration = 1000 + (night - 1) * 500;

    // ===== ROOM GRAPHICS =====
    this.drawRoom(W, H, night);

    // ===== TEXT ELEMENTS =====
    this.drawTextElements(W, night);

    // ===== SINGLE WAKE-UP OVERLAY (just one layer!) =====
    this.wakeOverlay = this.add.graphics();
    this.wakeOverlay.fillStyle(0x000000, 1);
    this.wakeOverlay.fillRect(0, 0, W, H);
    this.wakeOverlay.setAlpha(1);
    this.wakeOverlay.setDepth(100);

    // ===== VHS EFFECTS =====
    const scanGfx = this.add.graphics();
    scanGfx.setDepth(200);
    scanGfx.fillStyle(0x000000, 0.04);
    for (let y = 0; y < H; y += 3) {
      scanGfx.fillRect(0, y, W, 1);
    }

    // ===== CLICK HANDLER =====
    this.input.on('pointerdown', () => {
      if (!this.wakeupDone) {
        this.wakeupDone = true;
        this.wakeOverlay.setAlpha(0);
        this.typeStarted = true;
        return;
      }
      if (this.charIndex < this.fullMonologue.length) {
        this.charIndex = this.fullMonologue.length;
        this.monologueText.setText(this.fullMonologue);
        if (!this.continueShown) this.showContinue();
      } else if (this.canAdvance) {
        this.goToCallSheet();
      }
    });
  }

  update(_time: number, delta: number): void {
    // Wake-up: fade from black
    if (!this.wakeupDone) {
      this.wakeElapsed += delta;
      const progress = Math.min(1, this.wakeElapsed / this.focusDuration);
      this.wakeOverlay.setAlpha(1 - progress);
      if (progress >= 1) {
        this.wakeupDone = true;
        this.wakeOverlay.setAlpha(0);
        this.typeStarted = true;
      }
      return;
    }

    // Typewriter
    if (this.typeStarted && this.charIndex < this.fullMonologue.length) {
      this.typeElapsed += delta;
      if (this.typeElapsed >= this.typeDelay) {
        this.typeElapsed = 0;
        this.charIndex++;
        this.monologueText.setText(this.fullMonologue.substring(0, this.charIndex));

        const cur = this.fullMonologue[this.charIndex - 1];
        const next = this.fullMonologue[this.charIndex];
        const prev = this.fullMonologue[this.charIndex - 2];
        // Dramatic beat: long pause after "..." before next word
        if (cur === '.' && prev === '.' && next === ' ') this.typeDelay = 1200;
        else if (cur === '.' && next === '.') this.typeDelay = 350;
        else if (cur === '.' && prev === '.') this.typeDelay = 350;
        else this.typeDelay = 40;

        if (this.charIndex >= this.fullMonologue.length && !this.continueShown) {
          this.showContinue();
        }
      }
    }

    // Continue blink
    if (this.continueText) {
      this.blinkElapsed += delta;
      if (this.blinkElapsed >= 600) {
        this.blinkElapsed = 0;
        this.continueText.setAlpha(this.continueText.alpha === 1 ? 0 : 1);
      }
    }
  }

  private drawRoom(W: number, H: number, night: number): void {
    const gfx = this.add.graphics();

    // Ceiling
    gfx.fillStyle(0x141420, 1);
    gfx.fillRect(0, 0, W, 40);

    // Back wall
    gfx.fillStyle(0x1a1a24, 1);
    gfx.fillRect(0, 40, W, 380);
    for (let x = 0; x < W; x += 40) {
      gfx.fillStyle(0x1c1c28, 0.4);
      gfx.fillRect(x, 40, 2, 380);
    }

    // Floor
    gfx.fillStyle(0x13131a, 1);
    gfx.fillRect(0, 424, W, 176);
    gfx.fillStyle(0x2a2a34, 1);
    gfx.fillRect(0, 420, W, 5);

    // Window
    const skyColor = night <= 2 ? 0x2a1a3a : night <= 5 ? 0x1a0a2a : 0x0a0a1a;
    gfx.fillStyle(0x4a4540, 1);
    gfx.fillRect(260, 70, 280, 4);
    gfx.fillCircle(260, 72, 5);
    gfx.fillCircle(540, 72, 5);
    gfx.fillStyle(0x3a352e, 1);
    gfx.fillRect(280, 78, 240, 190);
    gfx.fillStyle(0x2e2a24, 1);
    gfx.fillRect(284, 82, 232, 182);
    gfx.fillStyle(skyColor, 1);
    gfx.fillRect(288, 86, 108, 82);
    gfx.fillRect(404, 86, 108, 82);
    gfx.fillRect(288, 176, 108, 82);
    gfx.fillRect(404, 176, 108, 82);
    gfx.fillStyle(0x3a352e, 1);
    gfx.fillRect(396, 86, 8, 172);
    gfx.fillRect(288, 168, 224, 8);
    gfx.fillStyle(0xd4c5a0, 0.5);
    gfx.fillCircle(310, 105, 1.5);
    gfx.fillCircle(340, 130, 1);
    gfx.fillCircle(365, 100, 1.5);
    gfx.fillCircle(440, 195, 1);
    gfx.fillCircle(475, 185, 1.5);
    if (night >= 3) {
      gfx.fillStyle(0xd4c5a0, 0.6);
      gfx.fillCircle(470, 115, 12);
      gfx.fillStyle(skyColor, 1);
      gfx.fillCircle(475, 111, 11);
    }
    gfx.fillStyle(0x3a352e, 1);
    gfx.fillRect(276, 268, 248, 8);

    // Curtains
    gfx.fillStyle(0x2a2520, 0.85);
    gfx.fillRect(264, 76, 22, 200);
    gfx.fillRect(514, 76, 22, 200);

    // Light fixture
    gfx.fillStyle(0x2a2a34, 1);
    gfx.fillCircle(400, 42, 6);
    gfx.fillRect(399, 42, 2, 20);
    gfx.fillStyle(0xf5d799, 0.4);
    gfx.fillCircle(400, 66, 5);
    gfx.fillStyle(0xf5d799, 0.2);
    gfx.fillCircle(400, 66, 8);

    // Light glow
    gfx.fillStyle(0xf5d799, 0.03);
    gfx.fillEllipse(400, 200, 400, 300);
    gfx.fillStyle(0xf5d799, 0.04);
    gfx.fillEllipse(400, 200, 250, 200);

    // Clock
    gfx.fillStyle(0x3a352e, 1);
    gfx.fillCircle(170, 140, 18);
    gfx.fillStyle(0x222230, 1);
    gfx.fillCircle(170, 140, 15);
    gfx.fillStyle(0xd4c5a0, 0.5);
    gfx.fillRect(170, 133, 2, 9);
    gfx.fillRect(170, 140, 10, 1.5);
    gfx.fillCircle(170, 140, 2);

    // Jacket
    gfx.fillStyle(0x1e1e28, 1);
    gfx.fillRect(25, 192, 40, 8);
    gfx.fillRect(28, 200, 34, 50);

    // Table
    gfx.fillStyle(0x222230, 1);
    gfx.fillRect(150, 355, 500, 14);
    gfx.fillStyle(0x1e1e2a, 1);
    gfx.fillRect(165, 369, 8, 52);
    gfx.fillRect(450, 369, 8, 52);
    gfx.fillRect(630, 369, 8, 52);

    // Items on table
    gfx.fillStyle(0xd4c5a0, 0.25);
    gfx.fillRect(203, 340, 42, 6);
    gfx.fillStyle(0xd4c5a0, 0.3);
    gfx.fillRect(206, 337, 38, 5);
    gfx.fillStyle(0x2a2018, 1);
    gfx.fillRect(470, 340, 16, 16);

    // Chair
    gfx.fillStyle(0x1e1e2a, 1);
    gfx.fillRect(330, 340, 50, 6);
    gfx.fillRect(328, 395, 54, 8);
    gfx.fillRect(334, 365, 4, 56);
    gfx.fillRect(372, 365, 4, 56);

    // Fridge
    gfx.fillStyle(0x222230, 1);
    gfx.fillRect(680, 140, 80, 280);
    gfx.fillStyle(0x1a1a26, 1);
    gfx.fillRect(682, 230, 76, 3);
    gfx.fillStyle(0x3a3a48, 0.8);
    gfx.fillRect(690, 250, 3, 40);
    gfx.fillStyle(0x8a4040, 0.4);
    gfx.fillRect(710, 260, 18, 14);
    gfx.fillStyle(0x405080, 0.35);
    gfx.fillRect(735, 275, 14, 12);
    gfx.fillStyle(0x408050, 0.3);
    gfx.fillRect(715, 300, 20, 16);
  }

  private drawTextElements(W: number, night: number): void {
    // Monologue panel
    const panelGfx = this.add.graphics();
    panelGfx.fillStyle(0x0a0a10, 0.75);
    panelGfx.fillRect(60, 430, 680, 140);
    panelGfx.fillStyle(0x2a2a34, 0.3);
    panelGfx.fillRect(60, 430, 680, 1);

    // Night number
    this.add.text(402, 302, `NIGHT ${night} / 7`, {
      fontFamily: 'Courier New, monospace',
      fontSize: '36px',
      color: '#000000',
      fontStyle: 'bold',
    }).setOrigin(0.5).setAlpha(0.3);
    this.add.text(400, 300, `NIGHT ${night} / 7`, {
      fontFamily: 'Courier New, monospace',
      fontSize: '36px',
      color: '#d4c5a0',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    this.add.text(400, 340, '5:15 PM — Call Time', {
      fontFamily: 'Courier New, monospace',
      fontSize: '18px',
      color: '#888070',
    }).setOrigin(0.5);

    // Monologue text
    this.fullMonologue = this.nightConfig.openingMonologue;
    this.monologueText = this.add.text(90, 445, '', {
      fontFamily: 'Courier New, monospace',
      fontSize: '18px',
      color: '#d4c5a0',
      wordWrap: { width: 620 },
      lineSpacing: 4,
    });
  }

  private showContinue(): void {
    this.continueShown = true;
    this.canAdvance = true;
    this.continueText = this.add.text(400, 555, '[ CONTINUE ]', {
      fontFamily: 'Courier New, monospace',
      fontSize: '20px',
      color: '#e8c36a',
    }).setOrigin(0.5);
  }

  private goToCallSheet(): void {
    this.input.removeAllListeners();
    this.scene.start('CallSheetScene', {
      night: this.nightConfig.night,
      nightConfig: this.nightConfig,
    });
  }
}
