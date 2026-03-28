import Phaser from 'phaser';
import GameStateManager from '../systems/GameStateManager';
import { NIGHT_CONFIGS } from '../config/nights';
import { VHSOverlay } from '../ui/VHSOverlay';
import type { NightConfig, RoleTemplate } from '../types/index';

function formatHeight(inches: number): string {
  const ft = Math.floor(inches / 12);
  const in_ = inches % 12;
  return `${ft}'${in_}`;
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

    // Paper background — slightly off-white dark parchment
    gfx.fillStyle(0x1e1c18, 1);
    gfx.fillRect(40, 20, 720, 560);

    // Subtle paper grain (faint noise dots)
    for (let i = 0; i < 300; i++) {
      const px = 42 + Math.random() * 716;
      const py = 22 + Math.random() * 556;
      const bright = Math.random() > 0.5 ? 0x2a2822 : 0x161410;
      gfx.fillStyle(bright, 0.4);
      gfx.fillRect(px, py, 1, 1);
    }

    // Paper border — double line
    gfx.lineStyle(2, 0x3a352e, 1);
    gfx.strokeRect(40, 20, 720, 560);
    gfx.lineStyle(1, 0x3a352e, 0.5);
    gfx.strokeRect(44, 24, 712, 552);

    // Hole punches — 3 small circles along left edge
    const holePunchX = 54;
    const holePunchPositions = [120, 300, 480];
    holePunchPositions.forEach(py => {
      gfx.fillStyle(0x0a0a0f, 1);
      gfx.fillCircle(holePunchX, py, 8);
      gfx.lineStyle(1, 0x2a2520, 0.8);
      gfx.strokeCircle(holePunchX, py, 8);
    });

    // "CONFIDENTIAL" stamp — rotated faint red text in top-right
    const confText = this.add.text(660, 50, 'CONFIDENTIAL', {
      fontFamily: 'Courier New, monospace',
      fontSize: '16px',
      color: '#c4553a',
      fontStyle: 'bold',
    }).setOrigin(0.5).setAlpha(0.12).setRotation(-0.18);

    // Header area with double-line border
    gfx.lineStyle(2, 0x4a453e, 0.8);
    gfx.strokeRect(75, 32, 650, 52);
    gfx.lineStyle(1, 0x4a453e, 0.4);
    gfx.strokeRect(78, 35, 644, 46);

    // Title
    this.add.text(400, 58, `CALL SHEET — NIGHT ${night}`, {
      fontFamily: 'Courier New, monospace',
      fontSize: '26px',
      color: '#d4c5a0',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    // Column headers
    const headerY = 94;
    const headerStyle = { fontFamily: 'Courier New, monospace', fontSize: '14px', color: '#888070' };
    this.add.text(80, headerY, 'ROLE', headerStyle);
    this.add.text(230, headerY, 'STUNT', headerStyle);
    this.add.text(370, headerY, 'RISK', headerStyle);
    this.add.text(440, headerY, 'GENDER', headerStyle);
    this.add.text(520, headerY, 'SIZE', headerStyle);
    this.add.text(680, headerY, 'STATUS', headerStyle);

    // Horizontal rule under headers
    gfx.lineStyle(1, 0x3a352e, 0.8);
    gfx.lineBetween(85, 112, 730, 112);
    gfx.lineStyle(1, 0x3a352e, 0.3);
    gfx.lineBetween(85, 114, 730, 114);

    // Role rows
    const roles = this.nightConfig.roles;
    const rowHeight = 62;
    const startY = 120;

    roles.forEach((role: RoleTemplate, i: number) => {
      const y = startY + i * rowHeight;

      // Alternating row bg
      if (i % 2 === 0) {
        gfx.fillStyle(0x111118, 0.5);
        gfx.fillRect(75, y - 2, 660, rowHeight - 4);
      }

      // Horizontal rule between rows (like lined paper)
      if (i > 0) {
        gfx.lineStyle(1, 0x2a2520, 0.3);
        gfx.lineBetween(85, y - 2, 730, y - 2);
      }

      // Risk level icon
      const iconX = 70;
      const iconY = y + 10;
      if (role.riskLevel === 'high') {
        // Red filled circle
        gfx.fillStyle(0xc4553a, 0.9);
        gfx.fillCircle(iconX, iconY, 5);
      } else if (role.riskLevel === 'medium') {
        // Yellow triangle
        gfx.fillStyle(0xe8c36a, 0.9);
        gfx.fillTriangle(iconX, iconY - 5, iconX - 5, iconY + 4, iconX + 5, iconY + 4);
      } else {
        // Green square (nd)
        gfx.fillStyle(0x4a7a4f, 0.9);
        gfx.fillRect(iconX - 4, iconY - 4, 8, 8);
      }

      // Role title
      this.add.text(80, y + 4, role.title, {
        fontFamily: 'Courier New, monospace',
        fontSize: '18px',
        color: '#d4c5a0',
        fontStyle: 'bold',
      });

      // Stunt type
      this.add.text(230, y + 4, role.stuntType.replace(/_/g, ' ').toUpperCase(), {
        fontFamily: 'Courier New, monospace',
        fontSize: '12px',
        color: '#888070',
        wordWrap: { width: 130 },
      });

      // Risk level text with color
      const riskColors: Record<string, string> = {
        high: '#c4553a',
        medium: '#e8c36a',
        nd: '#4a7a4f',
      };
      this.add.text(370, y + 4, role.riskLevel.toUpperCase(), {
        fontFamily: 'Courier New, monospace',
        fontSize: '16px',
        color: riskColors[role.riskLevel] ?? '#888070',
        fontStyle: 'bold',
      });

      // Gender
      this.add.text(440, y + 4, role.requiredGender.toUpperCase(), {
        fontFamily: 'Courier New, monospace',
        fontSize: '14px',
        color: '#888070',
      });

      // Height/Weight range
      const sizeStr = `${formatHeight(role.heightRange[0])}-${formatHeight(role.heightRange[1])} ${role.weightRange[0]}-${role.weightRange[1]}`;
      this.add.text(520, y + 4, sizeStr, {
        fontFamily: 'Courier New, monospace',
        fontSize: '14px',
        color: '#888070',
      });

      // SAG badge
      if (role.sagRequired) {
        this.add.text(80, y + 26, 'SAG REQ', {
          fontFamily: 'Courier New, monospace',
          fontSize: '12px',
          color: '#c4553a',
        });
      }

      // Skills
      if (role.requiredSkills.length > 0) {
        this.add.text(230, y + 26, `Skills: ${role.requiredSkills.join(', ')}`, {
          fontFamily: 'Courier New, monospace',
          fontSize: '12px',
          color: '#888070',
        });
      }

      // Status
      this.add.text(680, y + 4, 'OPEN', {
        fontFamily: 'Courier New, monospace',
        fontSize: '14px',
        color: '#e8c36a',
        fontStyle: 'bold',
      });
    });

    // Production note
    const noteY = startY + roles.length * rowHeight + 20;
    if (this.nightConfig.noteType !== 'none') {
      // Caution-tape style border (yellow/black diagonal stripes)
      const noteW = 640;
      const noteH = 65;
      const noteX = 80;
      const stripeGfx = this.add.graphics();

      // Black base for the stripe border
      stripeGfx.fillStyle(0x000000, 1);
      stripeGfx.fillRect(noteX, noteY, noteW, noteH);

      // Yellow diagonal stripes on border
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

      // Inner fill (paper color) — inset 6px for the stripe border effect
      stripeGfx.fillStyle(0x1e1c18, 1);
      stripeGfx.fillRect(noteX + 6, noteY + 6, noteW - 12, noteH - 12);

      this.add.text(noteX + 20, noteY + 12, 'PRODUCTION NOTE:', {
        fontFamily: 'Courier New, monospace',
        fontSize: '16px',
        color: '#e8c36a',
        fontStyle: 'bold',
      });

      this.add.text(noteX + 20, noteY + 32, this.nightConfig.noteDescription, {
        fontFamily: 'Courier New, monospace',
        fontSize: '16px',
        color: '#d4c5a0',
        fontStyle: 'bold',
        wordWrap: { width: 590 },
      });
    }

    // Ready button — larger with pulsing glow
    const btnY = Math.min(noteY + 90, 540);
    const btnW = 220;
    const btnH = 50;
    const btnX = 400 - btnW / 2;

    // Glow behind button (pulsing)
    this.readyGlow = this.add.graphics();
    this.drawReadyGlow(btnX, btnY, btnW, btnH, 0.3);

    const readyBg = this.add.graphics();
    readyBg.fillStyle(0x4a7a4f, 1);
    readyBg.fillRoundedRect(btnX, btnY, btnW, btnH, 6);
    readyBg.lineStyle(2, 0x5a9a5f, 1);
    readyBg.strokeRoundedRect(btnX, btnY, btnW, btnH, 6);

    const readyText = this.add.text(400, btnY + btnH / 2, '[ READY ]', {
      fontFamily: 'Courier New, monospace',
      fontSize: '24px',
      color: '#d4c5a0',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    // Pulsing glow tween
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

    // Interactive zone
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

  private drawReadyGlow(x: number, y: number, w: number, h: number, alpha: number): void {
    const g = this.readyGlow;
    const pad = 8;
    g.fillStyle(0x4a7a4f, alpha * 0.4);
    g.fillRoundedRect(x - pad * 2, y - pad * 2, w + pad * 4, h + pad * 4, 10);
    g.fillStyle(0x5a9a5f, alpha * 0.6);
    g.fillRoundedRect(x - pad, y - pad, w + pad * 2, h + pad * 2, 8);
  }
}
