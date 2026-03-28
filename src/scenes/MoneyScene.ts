import Phaser from 'phaser';
import GameStateManager from '../systems/GameStateManager';
import { BALANCE } from '../config/balance';
import { VHSOverlay } from '../ui/VHSOverlay';
import type { NightResult } from '../types/index';

interface LineItem {
  label: string;
  amount: number;
  color: string;
  isSeparator?: boolean;
  isSubItem?: boolean;
  isBribe?: boolean;
  isTotalLine?: boolean;
  isRunningTotal?: boolean;
}

export class MoneyScene extends Phaser.Scene {
  private night: number = 1;
  private nightResult!: NightResult;
  private lineItems: LineItem[] = [];
  private currentLine: number = 0;
  private lineTexts: Phaser.GameObjects.Text[] = [];
  private continueBtn: Phaser.GameObjects.Text | null = null;
  private vhs!: VHSOverlay;
  private ledgerGfx!: Phaser.GameObjects.Graphics;

  constructor() {
    super({ key: 'MoneyScene' });
  }

  create(data: { night?: number; nightResult?: NightResult }): void {
    this.night = data.night ?? 1;
    this.nightResult = data.nightResult ?? this.createPlaceholderResult();
    this.currentLine = 0;
    this.lineTexts = [];
    this.continueBtn = null;

    const gsm = GameStateManager.getInstance();
    gsm.updateState({ currentPhase: 'money' });

    this.cameras.main.setBackgroundColor('#0a0a0f');
    const gfx = this.add.graphics();

    // Dark green accounting paper background
    gfx.fillStyle(0x0e1810, 1);
    gfx.fillRect(80, 15, 640, 870);

    // Faint vertical column lines (accounting paper style)
    gfx.lineStyle(1, 0x1a2a1c, 0.3);
    const colPositions = [200, 350, 500, 580];
    colPositions.forEach(cx => {
      gfx.lineBetween(cx, 20, cx, 880);
    });

    // Red vertical margin line (like accounting paper)
    gfx.lineStyle(1, 0x4a2020, 0.25);
    gfx.lineBetween(140, 20, 140, 880);

    // Double-line border
    gfx.lineStyle(2, 0x2a3a2c, 1);
    gfx.strokeRect(80, 15, 640, 870);
    gfx.lineStyle(1, 0x2a3a2c, 0.4);
    gfx.strokeRect(84, 19, 632, 862);

    // Paper texture dots
    for (let i = 0; i < 200; i++) {
      const px = 82 + Math.random() * 636;
      const py = 17 + Math.random() * 866;
      const bright = Math.random() > 0.5 ? 0x142018 : 0x0a120c;
      gfx.fillStyle(bright, 0.4);
      gfx.fillRect(px, py, 1, 1);
    }

    // Faint horizontal ruled lines
    gfx.lineStyle(1, 0x1a2a1c, 0.15);
    for (let ry = 90; ry < 870; ry += 30) {
      gfx.lineBetween(85, ry, 715, ry);
    }

    // Title — in dark ink
    this.add.text(400, 42, `NIGHT ${this.night} — LEDGER`, {
      fontFamily: 'Courier New, monospace',
      fontSize: '28px',
      color: '#7a9a7c',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    // Header separator — double line
    gfx.lineStyle(1, 0x2a3a2c, 0.8);
    gfx.lineBetween(120, 62, 680, 62);
    gfx.lineBetween(120, 65, 680, 65);

    // Column headers
    this.add.text(150, 72, 'ITEM', {
      fontFamily: 'Courier New, monospace',
      fontSize: '14px',
      color: '#5a7a5c',
    });
    this.add.text(600, 72, 'AMOUNT', {
      fontFamily: 'Courier New, monospace',
      fontSize: '14px',
      color: '#5a7a5c',
    }).setOrigin(1, 0);

    // Store ledger graphics for later drawing
    this.ledgerGfx = this.add.graphics();

    // Build line items
    this.buildLineItems();

    // Start typewriter reveal
    this.revealNextLine();
  }

  update(_time: number, delta: number): void {
    if (this.vhs) {
      this.vhs.updateGrain(delta);
    }
  }

  private buildLineItems(): void {
    const gsm = GameStateManager.getInstance();
    const state = gsm.getCurrentState();
    this.lineItems = [];

    const dayRate = this.nightResult.moneyEarned > 0 ? this.nightResult.moneyEarned : BALANCE.dayRateBase;
    const bribes = this.nightResult.bribeMoney;
    const gross = dayRate + bribes;

    // Income section
    this.lineItems.push({ label: 'Day rate', amount: dayRate, color: '#c8b888' });
    if (bribes > 0) {
      this.lineItems.push({ label: 'Bribes', amount: bribes, color: '#6a5a3a', isBribe: true });
    }
    this.lineItems.push({ label: 'GROSS', amount: gross, color: '#c8b888', isTotalLine: true });
    this.lineItems.push({ label: '', amount: 0, color: '', isSeparator: true });

    // Expenses
    const expenses: { label: string; amount: number }[] = [
      { label: 'Rent',             amount: state.rent },
      { label: 'Car payment',      amount: state.carPayment },
      { label: 'Physical therapy', amount: state.physicalTherapy },
      { label: 'Gym',              amount: state.gym },
      { label: 'Pager',            amount: state.pager },
    ];

    let totalExpenses = 0;
    expenses.forEach(exp => {
      this.lineItems.push({ label: exp.label, amount: -exp.amount, color: '#c45040', isSubItem: true });
      totalExpenses += exp.amount;
    });

    // Kid expense
    if (this.nightResult.kidExpense) {
      this.lineItems.push({
        label: this.nightResult.kidExpense.description,
        amount: -this.nightResult.kidExpense.cost,
        color: '#c45040',
        isSubItem: true,
      });
      totalExpenses += this.nightResult.kidExpense.cost;
    }

    // SAG rep cost
    if (this.nightResult.sagRepVisit) {
      this.lineItems.push({ label: 'SAG rep visit', amount: -this.nightResult.sagRepCost, color: '#c45040', isSubItem: true });
      totalExpenses += this.nightResult.sagRepCost;
    }

    this.lineItems.push({ label: 'EXPENSES', amount: -totalExpenses, color: '#c45040', isTotalLine: true });
    this.lineItems.push({ label: '', amount: 0, color: '', isSeparator: true });

    // Net
    const net = gross - totalExpenses;
    this.lineItems.push({ label: 'NET TONIGHT', amount: net, color: net >= 0 ? '#4a7a4f' : '#c45040', isTotalLine: true });

    // Update actual money
    const newMoney = state.money + dayRate - totalExpenses;
    gsm.updateState({ money: newMoney, dayRate });

    this.lineItems.push({
      label: 'RUNNING TOTAL',
      amount: newMoney,
      color: newMoney >= 0 ? '#e8c36a' : '#c45040',
      isRunningTotal: true,
    });
  }

  private revealNextLine(): void {
    if (this.currentLine >= this.lineItems.length) {
      this.showContinue();
      return;
    }

    const item = this.lineItems[this.currentLine];
    const y = 95 + this.currentLine * 30;
    const leftX = item.isSubItem ? 165 : 150;

    if (item.isSeparator) {
      const sepGfx = this.add.graphics();
      sepGfx.lineStyle(1, 0x2a3a2c, 0.4);
      sepGfx.lineBetween(150, y + 12, 650, y + 12);
      sepGfx.setAlpha(0);
      this.tweens.add({ targets: sepGfx, alpha: 1, duration: 100 });
    } else {
      const amountStr = this.formatAmount(item.amount);
      const prefix = item.isSubItem ? '  ' : '';

      const isBold = item.isTotalLine || item.isRunningTotal;
      const fontSize = item.isRunningTotal ? '22px' : (isBold ? '20px' : '18px');

      // Double underline before NET and RUNNING TOTAL
      if (item.isTotalLine && (item.label === 'NET TONIGHT')) {
        const underGfx = this.add.graphics();
        underGfx.lineStyle(1, 0x2a3a2c, 0.6);
        underGfx.lineBetween(150, y - 2, 650, y - 2);
        underGfx.lineBetween(150, y - 5, 650, y - 5);
      }
      if (item.isRunningTotal) {
        const underGfx = this.add.graphics();
        underGfx.lineStyle(2, 0x2a3a2c, 0.8);
        underGfx.lineBetween(150, y - 2, 650, y - 2);
        underGfx.lineStyle(1, 0x2a3a2c, 0.5);
        underGfx.lineBetween(150, y - 6, 650, y - 6);
      }

      let lineColor = item.color;
      if (item.isBribe) {
        lineColor = '#8a7a4a';
      }

      // Label on left
      const labelText = this.add.text(leftX, y, `${prefix}${item.label}`, {
        fontFamily: 'Courier New, monospace',
        fontSize: fontSize,
        color: lineColor,
        fontStyle: isBold ? 'bold' : 'normal',
      }).setAlpha(0);

      // Amount right-aligned in fixed column
      const amountText = this.add.text(620, y, amountStr, {
        fontFamily: 'Courier New, monospace',
        fontSize: fontSize,
        color: lineColor,
        fontStyle: isBold ? 'bold' : 'normal',
      }).setOrigin(1, 0).setAlpha(0);

      this.tweens.add({ targets: labelText, alpha: 1, duration: 150 });
      this.tweens.add({ targets: amountText, alpha: 1, duration: 150 });
      this.lineTexts.push(labelText);
      this.lineTexts.push(amountText);
    }

    this.currentLine++;
    this.time.delayedCall(180, () => this.revealNextLine());
  }

  private formatAmount(amount: number): string {
    if (amount >= 0) {
      return `$${amount}`;
    } else {
      return `-$${Math.abs(amount)}`;
    }
  }

  private showContinue(): void {
    const gsm = GameStateManager.getInstance();

    // Check if net is negative — shift atmosphere redder
    const state = gsm.getCurrentState();
    if (state.money < 0) {
      const redOverlay = this.add.graphics();
      redOverlay.fillStyle(0x3a0000, 0.08);
      redOverlay.fillRect(80, 15, 640, 870);
    }

    // VHS overlay (applied after all content)
    this.vhs = new VHSOverlay(this);
    this.vhs.apply();

    const btnY = 830;
    const btnW = 200;
    const btnH = 42;
    const btnX = 400 - btnW / 2;

    const continueBg = this.add.graphics().setDepth(9990);
    continueBg.fillStyle(0x2a3a2c, 1);
    continueBg.fillRoundedRect(btnX, btnY, btnW, btnH, 5);
    continueBg.lineStyle(1, 0x3a4a3c, 1);
    continueBg.strokeRoundedRect(btnX, btnY, btnW, btnH, 5);

    this.continueBtn = this.add.text(400, btnY + btnH / 2, '[ CONTINUE ]', {
      fontFamily: 'Courier New, monospace',
      fontSize: '20px',
      color: '#d4c5a0',
    }).setOrigin(0.5).setDepth(9991);

    const hitZone = this.add.zone(400, btnY + btnH / 2, btnW, btnH).setInteractive({ useHandCursor: true }).setDepth(9992);

    hitZone.on('pointerover', () => {
      continueBg.clear();
      continueBg.fillStyle(0x3a4a3c, 1);
      continueBg.fillRoundedRect(btnX, btnY, btnW, btnH, 5);
      continueBg.lineStyle(1, 0x4a5a4c, 1);
      continueBg.strokeRoundedRect(btnX, btnY, btnW, btnH, 5);
    });

    hitZone.on('pointerout', () => {
      continueBg.clear();
      continueBg.fillStyle(0x2a3a2c, 1);
      continueBg.fillRoundedRect(btnX, btnY, btnW, btnH, 5);
      continueBg.lineStyle(1, 0x3a4a3c, 1);
      continueBg.strokeRoundedRect(btnX, btnY, btnW, btnH, 5);
    });

    hitZone.on('pointerdown', () => {
      // Check if game over
      if (gsm.isGameOver()) {
        this.scene.start('EndingScene');
      } else if (this.night < 7) {
        this.scene.start('EveningScene', { night: this.night + 1 });
      } else {
        this.scene.start('EndingScene');
      }
    });
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
