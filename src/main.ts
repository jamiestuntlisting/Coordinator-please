import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { TitleScene } from './scenes/TitleScene';
import { EveningScene } from './scenes/EveningScene';
import { CallSheetScene } from './scenes/CallSheetScene';
import { DeskScene } from './scenes/DeskScene';
import { ResultsScene } from './scenes/ResultsScene';
import { MoneyScene } from './scenes/MoneyScene';
import { EndingScene } from './scenes/EndingScene';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game-container',
  width: 800,
  height: 900,
  backgroundColor: '#0a0a0f',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [TitleScene, EveningScene, CallSheetScene, DeskScene, ResultsScene, MoneyScene, EndingScene],
};

const game = new Phaser.Game(config);
(window as any).__PHASER_GAME__ = game;
