import Phaser from 'phaser';
import GameStateManager from '../systems/GameStateManager';
import { BALANCE } from '../config/balance';
import { VHSOverlay } from '../ui/VHSOverlay';
import type { NightResult, HireResult } from '../types/index';

export class ResultsScene extends Phaser.Scene {
  private nightResult!: NightResult;
  private night: number = 1;
  private vhs!: VHSOverlay;

  constructor() {
    super({ key: 'ResultsScene' });
  }

  create(data: { night?: number; nightResult?: NightResult }): void {
    this.night = data.night ?? 1;
    this.nightResult = data.nightResult ?? this.createPlaceholderResult();

    const gsm = GameStateManager.getInstance();
    gsm.updateState({ currentPhase: 'results' });

    this.cameras.main.setBackgroundColor('#0a0a0f');
    const gfx = this.add.graphics();

    // Paper-textured background panel (incident report style)
    gfx.fillStyle(0x1e1c18, 1);
    gfx.fillRect(40, 15, 720, 870);

    // Paper grain texture
    for (let i = 0; i < 250; i++) {
      const px = 42 + Math.random() * 716;
      const py = 17 + Math.random() * 866;
      const bright = Math.random() > 0.5 ? 0x2a2822 : 0x161410;
      gfx.fillStyle(bright, 0.35);
      gfx.fillRect(px, py, 1, 1);
    }

    // Double-line border
    gfx.lineStyle(2, 0x3a352e, 1);
    gfx.strokeRect(40, 15, 720, 870);
    gfx.lineStyle(1, 0x3a352e, 0.4);
    gfx.strokeRect(44, 19, 712, 862);

    // Header area with border
    gfx.lineStyle(2, 0x4a453e, 0.8);
    gfx.strokeRect(60, 25, 680, 48);

    // Title — large bold with night number
    this.add.text(400, 49, `INCIDENT REPORT — NIGHT ${this.night}`, {
      fontFamily: 'Courier New, monospace',
      fontSize: '28px',
      color: '#d4c5a0',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    // "RESULTS" subheading
    gfx.lineStyle(1, 0x3a352e, 0.6);
    gfx.lineBetween(80, 78, 720, 78);

    // Hire outcomes — only show people who were actually cast (filter out rejections)
    let y = 88;
    const hires = this.nightResult.hires.filter((h: HireResult) =>
      h.outcome !== 'passed_legit' && h.outcome !== 'passed_faker'
    );

    hires.forEach((hire: HireResult) => {
      if (y > 400) return; // overflow guard

      const isGood = hire.outcome === 'correct_right_role' || hire.outcome === 'correct_slight_mismatch';
      const isUnfilled = hire.outcome === 'unfilled_role';
      const outcomeLabel = this.getOutcomeLabel(hire.outcome);

      // Row background
      gfx.fillStyle(isGood ? 0x1a2a1a : (isUnfilled ? 0x1a1a1a : 0x2a1a1a), 0.3);
      gfx.fillRect(65, y, 670, isGood ? 40 : (hire.wasInjured ? 70 : 50));

      // Checkmark or X icon
      const iconGfx = this.add.graphics();
      const iconX = 82;
      const iconY = y + 12;
      if (isGood) {
        // Green checkmark drawn with lines
        iconGfx.lineStyle(3, 0x4a7a4f, 1);
        iconGfx.lineBetween(iconX - 5, iconY, iconX - 1, iconY + 5);
        iconGfx.lineBetween(iconX - 1, iconY + 5, iconX + 6, iconY - 4);
      } else if (isUnfilled) {
        // Gray dash
        iconGfx.lineStyle(3, 0x888070, 0.6);
        iconGfx.lineBetween(iconX - 4, iconY, iconX + 4, iconY);
      } else {
        // Red X
        iconGfx.lineStyle(3, 0xc4553a, 1);
        iconGfx.lineBetween(iconX - 4, iconY - 4, iconX + 4, iconY + 4);
        iconGfx.lineBetween(iconX + 4, iconY - 4, iconX - 4, iconY + 4);
      }

      // Name -> Role
      const nameColor = isGood ? '#4a7a4f' : isUnfilled ? '#888070' : '#c4553a';
      this.add.text(100, y + 4, `${hire.visitorName}  →  ${hire.roleTitle}`, {
        fontFamily: 'Courier New, monospace',
        fontSize: '16px',
        color: nameColor,
        fontStyle: 'bold',
      });

      // Outcome description
      this.add.text(110, y + 22, outcomeLabel, {
        fontFamily: 'Courier New, monospace',
        fontSize: '14px',
        color: '#888070',
      });

      // Rep change on right side
      const repSign = hire.repChange >= 0 ? '+' : '';
      this.add.text(690, y + 4, `${repSign}${hire.repChange}`, {
        fontFamily: 'Courier New, monospace',
        fontSize: '14px',
        color: hire.repChange >= 0 ? '#4a7a4f' : '#c4553a',
        fontStyle: 'bold',
      }).setOrigin(1, 0);

      y += 40;

      // Injury panel
      if (hire.wasInjured && hire.injury) {
        // Red injury panel
        gfx.fillStyle(0x3a1515, 0.6);
        gfx.fillRect(95, y - 2, 610, 26);
        gfx.lineStyle(1, 0xc4553a, 0.4);
        gfx.strokeRect(95, y - 2, 610, 26);

        // Red cross symbol
        const crossGfx = this.add.graphics();
        const cx = 110;
        const cy = y + 10;
        crossGfx.fillStyle(0xc4553a, 0.9);
        crossGfx.fillRect(cx - 5, cy - 2, 10, 4);
        crossGfx.fillRect(cx - 2, cy - 5, 4, 10);

        this.add.text(125, y + 2, `INJURY: ${hire.injury.description}`, {
          fontFamily: 'Courier New, monospace',
          fontSize: '14px',
          color: '#c4553a',
          fontStyle: 'bold',
        });
        y += 28;
      }

      y += 4;
    });

    // UPM handwritten note for unfilled roles
    const unfilledRoles = hires.filter(h => h.outcome === 'unfilled_role');
    if (unfilledRoles.length > 0) {
      y += 8;
      // Sticky note / handwritten note background
      const noteGfx = this.add.graphics();
      noteGfx.fillStyle(0xd8c870, 0.9); // yellow sticky note
      noteGfx.fillRect(85, y, 630, 46 + unfilledRoles.length * 20);
      // Slight shadow
      noteGfx.fillStyle(0x000000, 0.15);
      noteGfx.fillRect(88, y + 3, 630, 46 + unfilledRoles.length * 20);
      // Tape at top
      noteGfx.fillStyle(0xc8c0a0, 0.5);
      noteGfx.fillRect(350, y - 6, 60, 14);

      // Handwritten-style text (italic courier to simulate)
      this.add.text(105, y + 8, 'NOTE FROM UPM:', {
        fontFamily: 'Courier New, monospace',
        fontSize: '14px',
        color: '#2a2a10',
        fontStyle: 'bold',
      });

      let noteY = y + 26;
      unfilledRoles.forEach((hire: HireResult) => {
        const msgs = [
          `"${hire.roleTitle}" went unfilled. We need to talk.`,
          `Where's my ${hire.roleTitle.toLowerCase()}? Come see me.`,
          `Nobody for "${hire.roleTitle}"? Seriously?`,
          `I'm hearing "${hire.roleTitle}" had no one. My office. Tomorrow.`,
        ];
        const msg = msgs[Math.floor(Math.random() * msgs.length)];
        this.add.text(115, noteY, msg, {
          fontFamily: 'Courier New, monospace',
          fontSize: '14px',
          color: '#1a1a08',
          fontStyle: 'italic',
          wordWrap: { width: 580 },
        });
        noteY += 20;
      });

      y += 54 + unfilledRoles.length * 20;
    }

    // Summary section — separator
    y = Math.max(y + 5, 350);
    gfx.lineStyle(2, 0x3a352e, 0.8);
    gfx.lineBetween(80, y, 720, y);
    gfx.lineStyle(1, 0x3a352e, 0.3);
    gfx.lineBetween(80, y + 3, 720, y + 3);
    y += 15;

    const totalRepChange = this.nightResult.repChange;
    const state = gsm.getCurrentState();

    // Reputation bar — animate from old to new
    const oldRep = state.reputation - totalRepChange;
    const newRep = state.reputation;
    const barX = 80;
    const barW = 300;

    this.add.text(barX, y, 'REPUTATION', {
      fontFamily: 'Courier New, monospace',
      fontSize: '18px',
      color: '#888070',
      fontStyle: 'bold',
    });

    // Rep change indicator
    this.add.text(barX + 150, y, `(${totalRepChange >= 0 ? '+' : ''}${totalRepChange})`, {
      fontFamily: 'Courier New, monospace',
      fontSize: '18px',
      color: totalRepChange >= 0 ? '#4a7a4f' : '#c4553a',
      fontStyle: 'bold',
    });

    y += 20;
    // Bar background
    gfx.fillStyle(0x111118, 0.8);
    gfx.fillRect(barX, y, barW, 16);
    gfx.lineStyle(1, 0x3a352e, 0.6);
    gfx.strokeRect(barX, y, barW, 16);

    // Animated bar fill
    const maxRep = 100;
    const barFill = this.add.graphics();
    const startFill = Math.max(0, (oldRep / maxRep) * barW);
    const endFill = Math.max(0, (newRep / maxRep) * barW);
    const barColor = newRep >= 50 ? 0x4a7a4f : (newRep >= 25 ? 0xe8c36a : 0xc4553a);

    barFill.fillStyle(barColor, 0.8);
    barFill.fillRect(barX + 1, y + 1, startFill, 14);

    // Tween the bar
    const fillObj = { width: startFill };
    this.tweens.add({
      targets: fillObj,
      width: endFill,
      duration: 800,
      delay: 300,
      ease: 'Power2',
      onUpdate: () => {
        barFill.clear();
        barFill.fillStyle(barColor, 0.8);
        barFill.fillRect(barX + 1, y + 1, fillObj.width, 14);
      },
    });

    // Rep number
    this.add.text(barX + barW + 10, y, `${newRep}`, {
      fontFamily: 'Courier New, monospace',
      fontSize: '16px',
      color: '#d4c5a0',
      fontStyle: 'bold',
    });

    y += 30;

    // Strikes — drawn as X marks
    this.add.text(barX, y, 'STRIKES:', {
      fontFamily: 'Courier New, monospace',
      fontSize: '16px',
      color: state.strikes >= BALANCE.strikesForWarning ? '#c4553a' : '#d4c5a0',
      fontStyle: 'bold',
    });

    const strikeStartX = barX + 110;
    for (let s = 0; s < BALANCE.maxStrikes; s++) {
      const sx = strikeStartX + s * 28;
      const strikeGfx = this.add.graphics();
      if (s < state.strikes) {
        // Filled strike — red X
        strikeGfx.lineStyle(3, 0xc4553a, 1);
        strikeGfx.lineBetween(sx - 6, y + 2, sx + 6, y + 14);
        strikeGfx.lineBetween(sx + 6, y + 2, sx - 6, y + 14);
      } else {
        // Empty strike — dim outline
        strikeGfx.lineStyle(1, 0x3a352e, 0.5);
        strikeGfx.strokeRect(sx - 6, y + 2, 12, 12);
      }
    }

    y += 28;

    // Strike warnings — bordered warning panel
    if (state.strikes >= BALANCE.strikesForFinalWarning) {
      gfx.fillStyle(0x3a1515, 0.6);
      gfx.fillRect(75, y, 650, 36);
      gfx.lineStyle(2, 0xc4553a, 0.8);
      gfx.strokeRect(75, y, 650, 36);

      // Warning triangle
      const warnGfx = this.add.graphics();
      warnGfx.fillStyle(0xc4553a, 1);
      warnGfx.fillTriangle(90, y + 28, 100, y + 8, 110, y + 28);
      this.add.text(92, y + 14, '!', {
        fontFamily: 'Courier New, monospace',
        fontSize: '14px',
        color: '#1e1c18',
        fontStyle: 'bold',
      });

      this.add.text(120, y + 8, 'UPM: "One more screw-up and you\'re done."', {
        fontFamily: 'Courier New, monospace',
        fontSize: '16px',
        color: '#c4553a',
        fontStyle: 'bold',
        wordWrap: { width: 580 },
      });
      y += 42;
    } else if (state.strikes >= BALANCE.strikesForWarning) {
      gfx.fillStyle(0x2a2510, 0.5);
      gfx.fillRect(75, y, 650, 36);
      gfx.lineStyle(2, 0xe8c36a, 0.6);
      gfx.strokeRect(75, y, 650, 36);

      this.add.text(90, y + 8, 'Line Producer: "We\'re watching you, coordinator."', {
        fontFamily: 'Courier New, monospace',
        fontSize: '16px',
        color: '#e8c36a',
        wordWrap: { width: 610 },
      });
      y += 42;
    }

    // Injuries summary
    if (this.nightResult.injuries.length > 0) {
      this.add.text(barX, y, `Injuries tonight: ${this.nightResult.injuries.length}`, {
        fontFamily: 'Courier New, monospace',
        fontSize: '16px',
        color: '#c4553a',
        fontStyle: 'bold',
      });
      y += 24;
    }

    // Continue button
    const btnY = 830;
    const btnW = 200;
    const btnH = 42;
    const btnX = 400 - btnW / 2;

    const continueBg = this.add.graphics();
    continueBg.fillStyle(0x3a352e, 1);
    continueBg.fillRoundedRect(btnX, btnY, btnW, btnH, 5);
    continueBg.lineStyle(1, 0x4a453e, 1);
    continueBg.strokeRoundedRect(btnX, btnY, btnW, btnH, 5);

    this.add.text(400, btnY + btnH / 2, '[ CONTINUE ]', {
      fontFamily: 'Courier New, monospace',
      fontSize: '20px',
      color: '#d4c5a0',
    }).setOrigin(0.5);

    const hitZone = this.add.zone(400, btnY + btnH / 2, btnW, btnH).setInteractive({ useHandCursor: true });

    hitZone.on('pointerover', () => {
      continueBg.clear();
      continueBg.fillStyle(0x4a453e, 1);
      continueBg.fillRoundedRect(btnX, btnY, btnW, btnH, 5);
      continueBg.lineStyle(1, 0x5a554e, 1);
      continueBg.strokeRoundedRect(btnX, btnY, btnW, btnH, 5);
    });

    hitZone.on('pointerout', () => {
      continueBg.clear();
      continueBg.fillStyle(0x3a352e, 1);
      continueBg.fillRoundedRect(btnX, btnY, btnW, btnH, 5);
      continueBg.lineStyle(1, 0x4a453e, 1);
      continueBg.strokeRoundedRect(btnX, btnY, btnW, btnH, 5);
    });

    hitZone.on('pointerdown', () => {
      this.scene.start('MoneyScene', {
        night: this.night,
        nightResult: this.nightResult,
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

  private getOutcomeLabel(outcome: string): string {
    const labels: Record<string, string> = {
      correct_right_role: 'Good hire. Nailed it.',
      correct_slight_mismatch: 'Decent hire. Close enough.',
      wrong_hire_nd_no_injury: 'Wrong call, but no harm done.',
      wrong_hire_nd_minor_injury: 'Wrong call. Minor scrapes.',
      wrong_hire_medium_injury: 'Bad hire. Someone got hurt.',
      wrong_hire_high_serious_injury: 'Terrible hire. Serious injury.',
      wrong_hire_upgraded_nd_injury: 'The upgrade got someone hurt.',
      non_sag_on_sag_night: 'Non-SAG on a SAG call. Strike.',
      passed_legit: 'You turned away a good one.',
      passed_faker: 'Good call sending them away.',
      unfilled_role: 'Role went unfilled.',
      caught_duplicate_reel: 'Caught a duplicate reel.',
      caught_returning_visitor: 'Caught a returning visitor.',
    };
    return labels[outcome] ?? outcome;
  }

  private createPlaceholderResult(): NightResult {
    return {
      night: this.night,
      hires: [],
      rejections: [],
      injuries: [],
      repChange: 0,
      moneyEarned: BALANCE.dayRateBase,
      moneySpent: 0,
      bribesTaken: 0,
      bribeMoney: 0,
      sagRepVisit: false,
      sagRepCost: 0,
      ndUpgraded: false,
      kidExpense: null,
    };
  }
}
