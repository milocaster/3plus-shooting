import * as Phaser from 'phaser';
import { MainMenuScene } from '../modules/action/scenes/MainMenuScene';
import { ActionGameScene } from '../modules/action/scenes/ActionGameScene';
import { ShopScene } from '../modules/action/scenes/ShopScene';

export const GameConfig: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    parent: 'app',
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        width: 1024,
        height: 768
    },
    backgroundColor: '#000000',
    scene: [MainMenuScene, ActionGameScene, ShopScene],
    physics: {
        default: 'arcade',
        arcade: {
            debug: false
        }
    }
};
