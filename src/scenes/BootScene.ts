import Phaser from 'phaser';

export class BootScene extends Phaser.Scene {
  private elapsed: number = 0;
  private transitioned: boolean = false;

  constructor() {
    super({ key: 'BootScene' });
  }

  create(): void {
    this.elapsed = 0;
    this.transitioned = false;
    this.cameras.main.setBackgroundColor('#0a0a0f');

    const title = this.add.text(400, 300, 'COORDINATOR PLEASE', {
      fontFamily: 'Courier New, monospace',
      fontSize: '28px',
      color: '#d4c5a0',
    }).setOrigin(0.5);

    title.setAlpha(0);
    this.tweens.add({
      targets: title,
      alpha: 1,
      duration: 400,
      ease: 'Power2',
    });
  }

  update(_time: number, delta: number): void {
    this.elapsed += delta;
    if (this.elapsed >= 1500 && !this.transitioned) {
      this.transitioned = true;
      this.scene.start('TitleScene');
    }
  }
}
