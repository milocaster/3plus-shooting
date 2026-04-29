import * as Phaser from 'phaser';
import { GameConfig } from './config/GameConfig';

(window as any).game = new Phaser.Game(GameConfig);
(window as any).game.sound.volume = 0.4;
