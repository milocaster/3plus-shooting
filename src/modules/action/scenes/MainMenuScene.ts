import * as Phaser from 'phaser';

export class MainMenuScene extends Phaser.Scene {
    private bg!: Phaser.GameObjects.Image;

    constructor() {
        super('MainMenuScene');
    }

    preload() {
        // Preload all game assets here
        this.load.image('bg_stage1', '/assets/themes/default/images/bg.png');
        this.load.image('bg_stage2', '/assets/themes/default/images/bg_stage2.png');
        this.load.image('enemy_aiming', '/assets/themes/default/images/enemy_aiming.png');
        this.load.image('enemy_aiming_2', '/assets/themes/default/images/enemy_aiming_2.png');
        this.load.image('enemy_aiming_3', '/assets/themes/default/images/enemy_aiming_3.png');
        this.load.image('hostage', '/assets/themes/default/images/hostage.png');
        this.load.image('boss', '/assets/themes/default/images/boss.png');
        this.load.image('fpv_gun', '/assets/themes/default/images/fpv_gun.png');
        this.load.audio('gunshot', '/assets/themes/default/sounds/gunshot.wav');
        this.load.audio('empty', '/assets/themes/default/sounds/empty.wav');
        this.load.audio('reload', '/assets/themes/default/sounds/reload.wav');
        this.load.audio('voice_reload', '/assets/themes/default/sounds/voice_reload.wav');
        this.load.audio('bgm_title', '/assets/themes/default/sounds/Title Game.wav?v=2');
        this.load.audio('bgm_stage1', '/assets/themes/default/sounds/Stage1.wav?v=2');
        this.load.audio('bgm_stage2', '/assets/themes/default/sounds/Stage2.wav?v=2');
        this.load.audio('bgm_stage3', '/assets/themes/default/sounds/Stage3.wav?v=2');
        this.load.audio('bgm_boss', '/assets/themes/default/sounds/BOSS FIGHT.wav?v=2');
        this.load.image('coin', '/assets/themes/default/images/coin.png');
    }

    create() {
        this.sound.stopAll();
        this.sound.play('bgm_title', { loop: true, volume: 0.5 });

        // Background
        this.bg = this.add.image(512, 384, 'bg_stage1');
        this.bg.setDisplaySize(1024, 768);
        this.bg.setTint(0x8888ff); // Night time tint for menu

        // Title
        const titleText = this.add.text(512, 200, `ANIME
VIRTUA COP`, {
            fontSize: '80px',
            fontFamily: 'Arial Black',
            color: '#ffff00',
            stroke: '#ff0000',
            strokeThickness: 10,
            align: 'center',
            shadow: { offsetX: 5, offsetY: 5, color: '#000000', blur: 5, stroke: true, fill: true }
        }).setOrigin(0.5);

        // Blinking Prompt
        const startText = this.add.text(512, 600, 'CLICK TO START', {
            fontSize: '40px',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 4
        }).setOrigin(0.5);

        this.tweens.add({
            targets: startText,
            alpha: 0.2,
            duration: 500,
            yoyo: true,
            repeat: -1
        });

        // Input to Start
        this.input.once('pointerdown', () => {
            this.cameras.main.fadeOut(500, 0, 0, 0);
            this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
                this.scene.start('ActionGameScene');
            });
        });
    }
}
