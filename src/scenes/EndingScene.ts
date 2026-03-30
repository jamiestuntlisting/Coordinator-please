import Phaser from 'phaser';
import GameStateManager from '../systems/GameStateManager';
import { BALANCE } from '../config/balance';
import { VHSOverlay } from '../ui/VHSOverlay';
import type { EndingTier } from '../types/index';

export class EndingScene extends Phaser.Scene {
  private vhs!: VHSOverlay;

  constructor() {
    super({ key: 'EndingScene' });
  }

  create(): void {
    const gsm = GameStateManager.getInstance();
    const state = gsm.getCurrentState();

    const tier = this.calculateEndingTier(state.reputation, state.strikes, state.money, state.fired);
    const isFired = tier === 'fired';

    const gfx = this.add.graphics();

    // Tier-specific backgrounds
    if (isFired) {
      // Dawn/daylight feeling — lighter warm tones
      this.cameras.main.setBackgroundColor('#2a2520');
      gfx.fillStyle(0x2a2520, 1);
      gfx.fillRect(0, 0, 800, 900);

      // Gradient to lighter at top (dawn sky)
      gfx.fillStyle(0x3a352e, 0.5);
      gfx.fillRect(0, 0, 800, 100);
      gfx.fillStyle(0x4a4538, 0.3);
      gfx.fillRect(0, 0, 800, 50);

      // Sun rising
      gfx.fillStyle(0xe8c36a, 0.12);
      gfx.fillCircle(650, 80, 70);
      gfx.fillStyle(0xe8c36a, 0.06);
      gfx.fillCircle(650, 80, 110);

      // Ground plane
      gfx.fillStyle(0x3a3830, 1);
      gfx.fillRect(0, 580, 800, 320);

      // Construction site silhouettes — concrete blocks
      gfx.fillStyle(0x2a2820, 0.9);
      gfx.fillRect(50, 380, 80, 40);
      gfx.fillRect(60, 350, 60, 30);
      gfx.fillRect(150, 390, 60, 30);

      // Steel beam silhouettes
      gfx.fillStyle(0x222018, 1);
      gfx.fillRect(300, 300, 8, 120);
      gfx.fillRect(280, 300, 50, 6);
      gfx.fillRect(380, 340, 8, 80);
      gfx.fillRect(300, 300, 88, 4);

      // Hard hat on ground
      gfx.fillStyle(0xe8c36a, 0.6);
      gfx.fillEllipse(520, 414, 30, 12);
      gfx.fillStyle(0xe8c36a, 0.5);
      gfx.fillRect(508, 404, 24, 10);

      // Generic Stunt Team hat in a box
      gfx.lineStyle(1, 0x3a352e, 0.6);
      gfx.strokeRect(580, 395, 40, 25);
      gfx.fillStyle(0x1a1816, 0.8);
      gfx.fillRect(581, 396, 38, 23);
      // Small cap shape inside
      gfx.fillStyle(0x4a4538, 0.7);
      gfx.fillEllipse(600, 410, 20, 8);
      gfx.fillRect(593, 402, 14, 8);

      // Sunglasses on car dashboard
      gfx.fillStyle(0x1a1816, 0.9);
      gfx.fillRect(650, 440, 120, 60); // Car interior rectangle
      gfx.lineStyle(1, 0x2a2520, 0.5);
      gfx.strokeRect(650, 440, 120, 60);
      // Dashboard
      gfx.fillStyle(0x2a2820, 1);
      gfx.fillRect(655, 460, 110, 8);
      // Sunglasses shape
      gfx.fillStyle(0x111118, 0.9);
      gfx.fillEllipse(690, 462, 16, 8);
      gfx.fillEllipse(710, 462, 16, 8);
      gfx.lineStyle(1, 0x3a352e, 0.7);
      gfx.lineBetween(698, 462, 702, 462);

    } else if (tier === 's') {
      // Night set but golden-lit
      this.cameras.main.setBackgroundColor('#0a0a0f');
      gfx.fillStyle(0x0a0a0f, 1);
      gfx.fillRect(0, 0, 800, 900);

      // Golden ambient glow
      gfx.fillStyle(0xe8c36a, 0.04);
      gfx.fillCircle(400, 250, 350);
      gfx.fillStyle(0xe8c36a, 0.06);
      gfx.fillCircle(400, 250, 200);
      gfx.fillStyle(0xffd700, 0.03);
      gfx.fillCircle(400, 250, 120);

      // Coordinator silhouette (simple figure with sunglasses)
      gfx.fillStyle(0x0a0a0f, 1);
      // Head
      gfx.fillCircle(400, 210, 18);
      // Body
      gfx.fillRect(388, 228, 24, 50);
      // Shoulders
      gfx.fillRect(370, 232, 60, 8);
      // Sunglasses
      gfx.fillStyle(0x1a1a2a, 1);
      gfx.fillRect(391, 206, 8, 4);
      gfx.fillRect(401, 206, 8, 4);
      gfx.lineBetween(399, 208, 401, 208);
      // Glint of light on lens
      gfx.fillStyle(0xffffff, 0.9);
      gfx.fillRect(406, 206, 2, 2);

      // Gold particles/sparkles
      this.addGoldParticles();

    } else {
      // Tiers A through D — varying atmosphere
      this.cameras.main.setBackgroundColor('#0a0a0f');
      gfx.fillStyle(0x0a0a0f, 1);
      gfx.fillRect(0, 0, 800, 900);

      // Atmosphere varies by tier
      const tierAtmosphere: Record<string, { color: number; alpha: number; radius: number }> = {
        a: { color: 0xe8c36a, alpha: 0.04, radius: 300 },  // Warm golden
        b: { color: 0xd4c5a0, alpha: 0.03, radius: 250 },  // Neutral warm
        c: { color: 0x888070, alpha: 0.02, radius: 200 },   // Cool neutral
        d: { color: 0x4a4538, alpha: 0.02, radius: 180 },   // Cold dark
      };

      const atm = tierAtmosphere[tier] ?? tierAtmosphere.c;
      gfx.fillStyle(atm.color, atm.alpha);
      gfx.fillCircle(400, 300, atm.radius);

      // Work lights — more for higher tiers
      if (tier === 'a') {
        gfx.fillStyle(0xf5d799, 0.04);
        gfx.fillCircle(200, 200, 150);
        gfx.fillCircle(600, 200, 150);
        gfx.fillStyle(0xf5d799, 0.02);
        gfx.fillCircle(400, 150, 200);
      } else if (tier === 'b') {
        gfx.fillStyle(0xf5d799, 0.03);
        gfx.fillCircle(300, 250, 150);
      } else if (tier === 'c') {
        gfx.fillStyle(0x888070, 0.02);
        gfx.fillCircle(400, 300, 120);
      }
      // D tier gets nothing extra — dark and cold
    }

    // Title
    const tierColors: Record<string, string> = {
      fired: '#c4553a',
      d: '#888070',
      c: '#999080',
      b: '#d4c5a0',
      a: '#e8c36a',
      s: '#ffd700',
    };

    const tierLabels: Record<string, string> = {
      fired: 'FIRED',
      d: 'ULTRA-LOW BUDGET — One step from a student film',
      c: 'MODIFIED LOW BUDGET — Barely professional',
      b: 'LOW BUDGET — Steady work',
      a: 'THEATRICAL — The real deal',
      s: 'MAJOR STUDIO — Legend',
    };

    const titleColor = tierColors[tier] ?? '#d4c5a0';
    const titleText = tierLabels[tier] ?? 'THE END';

    if (tier === 's') {
      // Gold glow text behind (blurred effect via larger, dimmer text)
      this.add.text(400, 55, titleText, {
        fontFamily: 'Courier New, monospace',
        fontSize: '40px',
        color: '#ffd700',
        fontStyle: 'bold',
      }).setOrigin(0.5).setAlpha(0.3);
    }

    this.add.text(400, 55, titleText, {
      fontFamily: 'Courier New, monospace',
      fontSize: tier === 's' ? '28px' : '24px',
      color: titleColor,
      fontStyle: 'bold',
      wordWrap: { width: 700 },
      align: 'center',
    }).setOrigin(0.5);

    // Ending text
    const endingText = this.getEndingText(tier);
    const textStyle = isFired ? '#b8a888' : '#d4c5a0';
    this.add.text(400, 110, endingText, {
      fontFamily: 'Courier New, monospace',
      fontSize: '16px',
      color: textStyle,
      wordWrap: { width: 580 },
      align: 'center',
      lineSpacing: 6,
    }).setOrigin(0.5, 0);

    // Stats panel — clean bordered panel
    const statsY = 450;
    const statsW = 520;
    const statsH = 150;
    const statsX = 400 - statsW / 2;

    // Panel background
    gfx.fillStyle(0x1a1816, 0.92);
    gfx.fillRect(statsX, statsY, statsW, statsH);

    // Double border
    gfx.lineStyle(2, 0x3a352e, 1);
    gfx.strokeRect(statsX, statsY, statsW, statsH);
    gfx.lineStyle(1, 0x3a352e, 0.4);
    gfx.strokeRect(statsX + 3, statsY + 3, statsW - 6, statsH - 6);

    // Stats header
    this.add.text(400, statsY + 14, 'FINAL STATS', {
      fontFamily: 'Courier New, monospace',
      fontSize: '16px',
      color: '#888070',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    // Separator under header
    gfx.lineStyle(1, 0x3a352e, 0.6);
    gfx.lineBetween(statsX + 15, statsY + 30, statsX + statsW - 15, statsY + 30);

    const totalInjuries = state.injuryLog.length;
    const totalBribes = state.totalBribes;

    const statItems = [
      { label: 'Money', value: `$${state.money}`, color: state.money >= 0 ? '#e8c36a' : '#c4553a' },
      { label: 'Mistakes', value: `${state.strikes}`, color: state.strikes > 0 ? '#c4553a' : '#4a7a4f' },
      { label: 'Injuries', value: `${totalInjuries}`, color: totalInjuries > 0 ? '#c4553a' : '#4a7a4f' },
      { label: 'Bribes taken', value: `${totalBribes}`, color: totalBribes > 0 ? '#7a6a3a' : '#888070' },
      { label: 'Nights completed', value: `${Math.min(state.night, 7)}`, color: '#d4c5a0' },
    ];

    statItems.forEach((item, i) => {
      const sy = statsY + 40 + i * 21;
      // Label on left
      this.add.text(statsX + 25, sy, item.label, {
        fontFamily: 'Courier New, monospace',
        fontSize: '15px',
        color: '#888070',
      });
      // Dot leaders
      const dots = '.'.repeat(Math.max(2, 30 - item.label.length - item.value.length));
      this.add.text(statsX + 25 + item.label.length * 9.2 + 5, sy, dots, {
        fontFamily: 'Courier New, monospace',
        fontSize: '15px',
        color: '#3a352e',
      });
      // Value on right
      this.add.text(statsX + statsW - 25, sy, item.value, {
        fontFamily: 'Courier New, monospace',
        fontSize: '15px',
        color: item.color,
        fontStyle: 'bold',
      }).setOrigin(1, 0);
    });

    // Play Again button — with hover effect
    const btnY = 730;
    const btnW = 260;
    const btnH = 48;
    const btnX = 400 - btnW / 2;

    const playAgainBg = this.add.graphics();
    playAgainBg.fillStyle(0x3a352e, 1);
    playAgainBg.fillRoundedRect(btnX, btnY, btnW, btnH, 6);
    playAgainBg.lineStyle(2, 0x4a453e, 1);
    playAgainBg.strokeRoundedRect(btnX, btnY, btnW, btnH, 6);

    this.add.text(400, btnY + btnH / 2, '[ PLAY AGAIN ]', {
      fontFamily: 'Courier New, monospace',
      fontSize: '22px',
      color: '#e8c36a',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    const hitZone = this.add.zone(400, btnY + btnH / 2, btnW, btnH).setInteractive({ useHandCursor: true });

    hitZone.on('pointerover', () => {
      playAgainBg.clear();
      playAgainBg.fillStyle(0x4a453e, 1);
      playAgainBg.fillRoundedRect(btnX, btnY, btnW, btnH, 6);
      playAgainBg.lineStyle(2, 0x5a554e, 1);
      playAgainBg.strokeRoundedRect(btnX, btnY, btnW, btnH, 6);
    });

    hitZone.on('pointerout', () => {
      playAgainBg.clear();
      playAgainBg.fillStyle(0x3a352e, 1);
      playAgainBg.fillRoundedRect(btnX, btnY, btnW, btnH, 6);
      playAgainBg.lineStyle(2, 0x4a453e, 1);
      playAgainBg.strokeRoundedRect(btnX, btnY, btnW, btnH, 6);
    });

    hitZone.on('pointerdown', () => {
      gsm.reset();
      this.scene.start('TitleScene');
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

  private addGoldParticles(): void {
    // 25+ gold dots that float upward with fade
    for (let i = 0; i < 28; i++) {
      const x = Phaser.Math.Between(80, 720);
      const startY = Phaser.Math.Between(100, 500);
      const size = Phaser.Math.Between(2, 5);

      const dot = this.add.graphics();
      dot.fillStyle(0xe8c36a, 1);
      dot.fillCircle(0, 0, size);
      dot.setPosition(x, startY);
      dot.setAlpha(0);

      this.tweens.add({
        targets: dot,
        alpha: { from: 0, to: Phaser.Math.FloatBetween(0.3, 0.8) },
        y: startY - Phaser.Math.Between(40, 120),
        duration: Phaser.Math.Between(2000, 4000),
        delay: Phaser.Math.Between(0, 2500),
        repeat: -1,
        yoyo: true,
        ease: 'Sine.easeInOut',
      });
    }
  }

  private calculateEndingTier(rep: number, strikes: number, money: number, fired: boolean): EndingTier {
    if (fired) return 'fired';
    const t = BALANCE.endingThresholds;
    if (rep >= t.s.minRep && strikes <= t.s.maxStrikes && money >= t.s.minMoney) return 's';
    if (rep >= t.a.minRep && strikes <= t.a.maxStrikes) return 'a';
    if (rep >= t.b.minRep && strikes <= t.b.maxStrikes) return 'b';
    if (rep >= t.c.minRep) return 'c';
    return 'd';
  }

  private getEndingText(tier: EndingTier): string {
    const texts: Record<string, string> = {
      fired: [
        'You got fired.',
        '',
        'Too many injuries. Too many bad calls.',
        'The Producer walked you to your car at 3 AM.',
        '',
        "Your cousin says he can get you on at the HVAC company.",
        'Benefits. Regular hours. No one falls off a building.',
        '...usually.',
        '',
        "Maybe that's not so bad.",
      ].join('\n'),

      d: [
        'Ultra-low budget. One mistake away from a student film.',
        '',
        'Seven nights of bad coffee, worse decisions,',
        'and people who definitely lied on their resumes.',
        '',
        "Next week you're coordinating a car commercial",
        "in a grocery store parking lot. Non-union.",
        "At least it's work.",
      ].join('\n'),

      c: [
        'Modified low budget. You got through it.',
        '',
        'Not your best work, not your worst.',
        "Some good calls, some bad ones. The usual.",
        '',
        "The next gig is a cable movie in Localville.",
        "Twelve-hour days, SAG modified low.",
        "The phone rang. You answered.",
      ].join('\n'),

      b: [
        'Low budget. Steady, reliable work.',
        '',
        'You kept people safe. Mostly.',
        'You made good calls under pressure.',
        "The AD said you're welcome back.",
        '',
        "Next month it's a low-budget feature.",
        "Real stunts. Real pay. Real SAG contract.",
        "You're building something.",
      ].join('\n'),

      a: [
        'Theatrical. You made it to the show.',
        '',
        'Seven nights, no catastrophes.',
        'People trust you. Coordinators remember your name.',
        "You're getting calls for the next gig before",
        "this one wraps.",
        '',
        "Full theatrical SAG contract. Studio lot.",
        "In this town, that's everything.",
      ].join('\n'),

      s: [
        'Major studio. They\'ll talk about this one.',
        '',
        'Seven nights. No injuries. Every role filled right.',
        'The performers trust you with their lives.',
        'The coordinators want you on speed dial.',
        '',
        "You just got a call from a major studio.",
        "They want you for their summer tentpole.",
        "Full rate. First position. Your name on the call sheet.",
        '',
        "Legend.",
      ].join('\n'),
    };

    return texts[tier] ?? texts.c;
  }
}
