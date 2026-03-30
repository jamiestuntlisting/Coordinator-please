import Phaser from 'phaser';
import GameStateManager from '../systems/GameStateManager';
import { NIGHT_CONFIGS } from '../config/nights';
import { VHSOverlay } from '../ui/VHSOverlay';
import type { NightConfig, RoleTemplate } from '../types/index';

function formatHeight(inches: number): string {
  const ft = Math.floor(inches / 12);
  const in_ = inches % 12;
  return `${ft}'${in_}"`;
}

export class CallSheetScene extends Phaser.Scene {
  private nightConfig!: NightConfig;
  private vhs!: VHSOverlay;
  private readyGlow!: Phaser.GameObjects.Graphics;
  private glowTween!: Phaser.Tweens.Tween;

  constructor() {
    super({ key: 'CallSheetScene' });
  }

  create(data: { night?: number; nightConfig?: NightConfig }): void {
    const night = data.night ?? 1;
    this.nightConfig = data.nightConfig ?? NIGHT_CONFIGS[night - 1] ?? NIGHT_CONFIGS[0];

    this.cameras.main.setBackgroundColor('#0a0a0f');
    const gsm = GameStateManager.getInstance();
    gsm.updateState({ currentPhase: 'callsheet' });

    const gfx = this.add.graphics();

    // Paper background
    gfx.fillStyle(0x1e1c18, 1);
    gfx.fillRect(20, 10, 760, 880);

    // Paper grain
    for (let i = 0; i < 300; i++) {
      const px = 22 + Math.random() * 756;
      const py = 12 + Math.random() * 876;
      const bright = Math.random() > 0.5 ? 0x2a2822 : 0x161410;
      gfx.fillStyle(bright, 0.4);
      gfx.fillRect(px, py, 1, 1);
    }

    // Paper border
    gfx.lineStyle(2, 0x3a352e, 1);
    gfx.strokeRect(20, 10, 760, 880);
    gfx.lineStyle(1, 0x3a352e, 0.5);
    gfx.strokeRect(24, 14, 752, 872);

    // Hole punches
    const holePunchX = 34;
    [120, 350, 580].forEach(py => {
      gfx.fillStyle(0x0a0a0f, 1);
      gfx.fillCircle(holePunchX, py, 6);
      gfx.lineStyle(1, 0x2a2520, 0.8);
      gfx.strokeCircle(holePunchX, py, 6);
    });

    // CONFIDENTIAL stamp
    this.add.text(700, 35, 'CONFIDENTIAL', {
      fontFamily: 'Courier New, monospace',
      fontSize: '14px',
      color: '#c4553a',
      fontStyle: 'bold',
    }).setOrigin(0.5).setAlpha(0.12).setRotation(-0.18);

    // Header box
    gfx.lineStyle(2, 0x4a453e, 0.8);
    gfx.strokeRect(55, 22, 690, 50);

    // Title
    this.add.text(400, 47, `CALL SHEET — NIGHT ${night}`, {
      fontFamily: 'Courier New, monospace',
      fontSize: '28px',
      color: '#d4c5a0',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    // Location / Date row
    this.add.text(70, 80, `LOCATION: Localville`, {
      fontFamily: 'Courier New, monospace',
      fontSize: '18px',
      color: '#888070',
    });
    this.add.text(730, 80, `March ${14 + night}, 1995`, {
      fontFamily: 'Courier New, monospace',
      fontSize: '18px',
      color: '#888070',
    }).setOrigin(1, 0);

    // Deadline — big and prominent
    const deadline = this.nightConfig.hiringDeadline;
    const deadlineStr = this.formatDeadline(deadline);
    this.add.text(400, 108, `MUST HIRE BY: ${deadlineStr}`, {
      fontFamily: 'Courier New, monospace',
      fontSize: '22px',
      color: '#e8c36a',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    // Separator
    gfx.lineStyle(1, 0x3a352e, 0.8);
    gfx.lineBetween(60, 132, 740, 132);

    // ---- Role Cards (stacked, not table columns) ----
    const roles = this.nightConfig.roles;
    const cardStartY = 140;
    const cardH = 130;
    const cardGap = 8;

    roles.forEach((role: RoleTemplate, i: number) => {
      const cy = cardStartY + i * (cardH + cardGap);

      // Card background
      const cardBg = i % 2 === 0 ? 0x141210 : 0x18160e;
      gfx.fillStyle(cardBg, 0.8);
      gfx.fillRoundedRect(55, cy, 690, cardH, 4);
      gfx.lineStyle(1, 0x2a261e, 0.6);
      gfx.strokeRoundedRect(55, cy, 690, cardH, 4);

      // Risk icon (left edge)
      const iconX = 72;
      const iconY = cy + 24;
      if (role.riskLevel === 'high') {
        gfx.fillStyle(0xc4553a, 0.9);
        gfx.fillCircle(iconX, iconY, 7);
      } else if (role.riskLevel === 'medium') {
        gfx.fillStyle(0xe8c36a, 0.9);
        gfx.fillTriangle(iconX, iconY - 7, iconX - 7, iconY + 5, iconX + 7, iconY + 5);
      } else {
        gfx.fillStyle(0x4a7a4f, 0.9);
        gfx.fillRect(iconX - 5, iconY - 5, 10, 10);
      }

      // Role title — BIG
      const riskColors: Record<string, string> = {
        high: '#c4553a',
        medium: '#e8c36a',
        nd: '#4a7a4f',
      };
      this.add.text(90, cy + 8, role.title, {
        fontFamily: 'Courier New, monospace',
        fontSize: '26px',
        color: '#d4c5a0',
        fontStyle: 'bold',
      });

      // Risk badge
      this.add.text(90, cy + 40, role.riskLevel.toUpperCase(), {
        fontFamily: 'Courier New, monospace',
        fontSize: '18px',
        color: riskColors[role.riskLevel] ?? '#888070',
        fontStyle: 'bold',
      });

      // Gender
      const genderStr = role.requiredGender === 'any' ? 'ANY GENDER' : role.requiredGender.toUpperCase();
      this.add.text(200, cy + 42, genderStr, {
        fontFamily: 'Courier New, monospace',
        fontSize: '20px',
        color: '#888070',
      });

      // Height/Weight on second line
      const heightStr = `${formatHeight(role.heightRange[0])} - ${formatHeight(role.heightRange[1])}`;
      const weightStr = `${role.weightRange[0]}-${role.weightRange[1]} lbs`;
      this.add.text(90, cy + 68, `Height: ${heightStr}    Weight: ${weightStr}`, {
        fontFamily: 'Courier New, monospace',
        fontSize: '20px',
        color: '#888070',
      });

      // Skills (if any)
      if (role.requiredSkills.length > 0) {
        this.add.text(90, cy + 96, `Skills: ${role.requiredSkills.map(s => s.replace(/_/g, ' ')).join(', ')}`, {
          fontFamily: 'Courier New, monospace',
          fontSize: '20px',
          color: '#6a9a6e',
        });
      }

      // SAG badge (top right)
      if (role.sagRequired) {
        const sagBg = this.add.graphics();
        sagBg.fillStyle(0x3a1515, 0.8);
        sagBg.fillRoundedRect(640, cy + 8, 90, 24, 3);
        sagBg.lineStyle(1, 0xc4553a, 0.6);
        sagBg.strokeRoundedRect(640, cy + 8, 90, 24, 3);

        this.add.text(685, cy + 13, 'SAG REQ', {
          fontFamily: 'Courier New, monospace',
          fontSize: '16px',
          color: '#c4553a',
          fontStyle: 'bold',
        }).setOrigin(0.5, 0);
      }

      // OPEN status (top right, below SAG if present)
      const statusY = role.sagRequired ? cy + 38 : cy + 12;
      this.add.text(720, statusY, 'OPEN', {
        fontFamily: 'Courier New, monospace',
        fontSize: '20px',
        color: '#e8c36a',
        fontStyle: 'bold',
      }).setOrigin(1, 0);
    });

    // Production note
    const noteY = cardStartY + roles.length * (cardH + cardGap) + 8;
    if (this.nightConfig.noteType !== 'none') {
      const noteW = 690;
      const noteH = 65;
      const noteX = 55;

      // Caution-tape border
      const stripeGfx = this.add.graphics();
      stripeGfx.fillStyle(0x000000, 1);
      stripeGfx.fillRect(noteX, noteY, noteW, noteH);

      const stripeWidth = 12;
      stripeGfx.fillStyle(0xe8c36a, 0.8);
      for (let sx = -noteH; sx < noteW + noteH; sx += stripeWidth * 2) {
        stripeGfx.fillTriangle(
          noteX + sx, noteY,
          noteX + sx + stripeWidth, noteY,
          noteX + sx + noteH + stripeWidth, noteY + noteH
        );
        stripeGfx.fillTriangle(
          noteX + sx, noteY,
          noteX + sx + noteH, noteY + noteH,
          noteX + sx + noteH + stripeWidth, noteY + noteH
        );
      }

      stripeGfx.fillStyle(0x1e1c18, 1);
      stripeGfx.fillRect(noteX + 6, noteY + 6, noteW - 12, noteH - 12);

      this.add.text(noteX + 16, noteY + 12, 'PRODUCTION NOTE:', {
        fontFamily: 'Courier New, monospace',
        fontSize: '18px',
        color: '#e8c36a',
        fontStyle: 'bold',
      });

      this.add.text(noteX + 16, noteY + 34, this.nightConfig.noteDescription, {
        fontFamily: 'Courier New, monospace',
        fontSize: '18px',
        color: '#d4c5a0',
        fontStyle: 'bold',
        wordWrap: { width: 650 },
      });
    }

    // Ready button
    const btnY = Math.min(noteY + (this.nightConfig.noteType !== 'none' ? 80 : 10), 820);
    const btnW = 260;
    const btnH = 54;
    const btnX = 400 - btnW / 2;

    this.readyGlow = this.add.graphics();
    this.drawReadyGlow(btnX, btnY, btnW, btnH, 0.3);

    const readyBg = this.add.graphics();
    readyBg.fillStyle(0x4a7a4f, 1);
    readyBg.fillRoundedRect(btnX, btnY, btnW, btnH, 6);
    readyBg.lineStyle(2, 0x5a9a5f, 1);
    readyBg.strokeRoundedRect(btnX, btnY, btnW, btnH, 6);

    this.add.text(400, btnY + btnH / 2, '[ READY ]', {
      fontFamily: 'Courier New, monospace',
      fontSize: '26px',
      color: '#d4c5a0',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    // Pulsing glow
    const glowObj = { alpha: 0.3 };
    this.glowTween = this.tweens.add({
      targets: glowObj,
      alpha: { from: 0.15, to: 0.5 },
      duration: 1200,
      yoyo: true,
      repeat: -1,
      onUpdate: () => {
        this.readyGlow.clear();
        this.drawReadyGlow(btnX, btnY, btnW, btnH, glowObj.alpha);
      },
    });

    const hitZone = this.add.zone(400, btnY + btnH / 2, btnW, btnH).setInteractive({ useHandCursor: true });

    hitZone.on('pointerover', () => {
      readyBg.clear();
      readyBg.fillStyle(0x5a9a5f, 1);
      readyBg.fillRoundedRect(btnX, btnY, btnW, btnH, 6);
      readyBg.lineStyle(2, 0x6aba6f, 1);
      readyBg.strokeRoundedRect(btnX, btnY, btnW, btnH, 6);
    });

    hitZone.on('pointerout', () => {
      readyBg.clear();
      readyBg.fillStyle(0x4a7a4f, 1);
      readyBg.fillRoundedRect(btnX, btnY, btnW, btnH, 6);
      readyBg.lineStyle(2, 0x5a9a5f, 1);
      readyBg.strokeRoundedRect(btnX, btnY, btnW, btnH, 6);
    });

    hitZone.on('pointerdown', () => {
      this.scene.start('DeskScene', {
        night: this.nightConfig.night,
        nightConfig: this.nightConfig,
      });
    });

    // VHS overlay
    this.vhs = new VHSOverlay(this);
    this.vhs.apply();
  }

  update(_time: number, delta: number): void {
    if (this.vhs) {
      this.vhs.updateGrain(delta);
    }
  }

  private formatDeadline(t: number): string {
    // Midnight = 24.0
    if (Math.floor(t) === 24 && (t - Math.floor(t)) < 0.01) return 'Midnight';
    let hour = Math.floor(t);
    const minutes = Math.floor((t - hour) * 60);
    if (hour >= 24) hour -= 24;
    const dh = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
    const ap = (Math.floor(t) >= 24) ? 'AM' : (hour >= 12 && hour < 24) ? 'PM' : 'AM';
    return `${dh}:${minutes.toString().padStart(2, '0')} ${ap}`;
  }

  private drawReadyGlow(x: number, y: number, w: number, h: number, alpha: number): void {
    const g = this.readyGlow;
    const pad = 8;
    g.fillStyle(0x4a7a4f, alpha * 0.4);
    g.fillRoundedRect(x - pad * 2, y - pad * 2, w + pad * 4, h + pad * 4, 10);
    g.fillStyle(0x5a9a5f, alpha * 0.6);
    g.fillRoundedRect(x - pad, y - pad, w + pad * 2, h + pad * 2, 8);
  }
}
