import Phaser from 'phaser';
import GameStateManager from '../systems/GameStateManager';

export class IntroScene extends Phaser.Scene {
  private lines: string[] = [];
  private currentLine: number = 0;
  private lineTexts: Phaser.GameObjects.Text[] = [];
  private elapsed: number = 0;
  private revealInterval: number = 2200;
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

    this.lines = [
      "It's 1995.",
      "The rate sucks, but work is work.",
      "",
      "I was down to my last dime.",
      "Rent past due. Pager about to get cut off.",
      "Then this show called.",
      "",
      "Seven nights of overnights.",
      "Stunt coordinating on some low-budget thing",
      "shooting in Localville.",
      "",
      "I'll take it.",
      "",
      "I need this job to survive.",
    ];

    // Start revealing lines
    this.revealNextLine();
  }

  update(_time: number, delta: number): void {
    if (this.allRevealed) return;

    this.elapsed += delta;
    if (this.elapsed >= this.revealInterval) {
      this.elapsed = 0;
      this.revealNextLine();
    }
  }

  private revealNextLine(): void {
    if (this.currentLine >= this.lines.length) {
      this.allRevealed = true;
      this.showContinue();
      return;
    }

    const line = this.lines[this.currentLine];
    const y = 120 + this.currentLine * 38;

    if (line === '') {
      // Empty line — just a spacer
      this.currentLine++;
      this.elapsed = this.revealInterval - 400; // short pause for blank lines
      return;
    }

    // Determine styling — first line and last line are bigger/bolder
    const isFirstLine = this.currentLine === 0;
    const isLastLine = this.currentLine === this.lines.length - 1;
    const isIllTakeIt = line === "I'll take it.";

    let fontSize = '22px';
    let color = '#d4c5a0';
    let fontStyle = 'normal';

    if (isFirstLine) {
      fontSize = '32px';
      color = '#e8c36a';
      fontStyle = 'bold';
    } else if (isLastLine) {
      fontSize = '28px';
      color = '#d4c5a0';
      fontStyle = 'bold';
    } else if (isIllTakeIt) {
      fontSize = '26px';
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

    // Fade in
    this.tweens.add({
      targets: text,
      alpha: 1,
      duration: 600,
    });

    this.currentLine++;
  }

  private showContinue(): void {
    this.continueText = this.add.text(400, 820, '[ TAP TO CONTINUE ]', {
      fontFamily: 'Courier New, monospace',
      fontSize: '18px',
      color: '#6a6050',
    }).setOrigin(0.5).setAlpha(0);

    this.tweens.add({
      targets: this.continueText,
      alpha: 1,
      duration: 800,
      delay: 500,
    });

    this.input.once('pointerdown', () => {
      this.scene.start('EveningScene', { night: 1 });
    });
  }
}
