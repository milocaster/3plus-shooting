import * as Phaser from 'phaser';

export class ShopScene extends Phaser.Scene {
    private stats: any;
    private currentStageIndex: number = 0;
    private coinsText!: Phaser.GameObjects.Text;
    private statsText!: Phaser.GameObjects.Text;

    constructor() {
        super('ShopScene');
    }

    init(data: any) {
        this.stats = data.stats || { health: 100, maxHealth: 100, coins: 0, armor: 0, shield: 0, score: 0 };
        this.currentStageIndex = data.currentStageIndex || 0;
    }

    create() {
        this.input.setDefaultCursor('default');
        this.sound.stopAll();
        this.sound.play('bgm_title', { loop: true, volume: 0.3 });

        this.add.image(512, 384, 'bg_stage1').setDisplaySize(1024, 768).setTint(0x444444);
        
        this.add.text(512, 100, 'BLACK MARKET UPGRADES', { fontSize: '64px', color: '#ffff00', stroke: '#000', strokeThickness: 6 }).setOrigin(0.5);

        this.coinsText = this.add.text(512, 180, 'COINS: ' + this.stats.coins, { fontSize: '48px', color: '#ffd700', stroke: '#000', strokeThickness: 4 }).setOrigin(0.5);
        
        this.statsText = this.add.text(512, 250, this.getStatsString(), { fontSize: '24px', color: '#ffffff', align: 'center' }).setOrigin(0.5);

        // Shop Items
        this.createShopItem(300, 400, 'HEAL (+20 HP)', 'Cost: 2 Coins', 2, () => {
            if (this.stats.health >= this.stats.maxHealth) { this.cameras.main.shake(100, 0.01); return false; }
            this.stats.health = Math.min(this.stats.maxHealth, this.stats.health + 20);
            return true;
        });

        this.createShopItem(724, 400, 'MAX HP (+20)', 'Cost: 5 Coins', 5, () => {
            this.stats.maxHealth += 20;
            this.stats.health += 20;
            return true;
        });

        this.createShopItem(300, 550, 'KEVLAR ARMOR', 'Reduce Dmg 20%\nCost: 10 Coins', 10, () => {
            if (this.stats.armor >= 0.8) { this.cameras.main.shake(100, 0.01); return false; } // max 80%
            this.stats.armor += 0.2;
            return true;
        });

        this.createShopItem(724, 550, 'ENERGY SHIELD', '+1 Block Hit\nCost: 8 Coins', 8, () => {
            this.stats.shield += 1;
            return true;
        });

        // Next Stage Button
        const nextBtn = this.add.text(512, 700, 'NEXT STAGE >>', { fontSize: '40px', color: '#00ff00', backgroundColor: '#000', padding: {x:20, y:10} }).setOrigin(0.5).setInteractive({ useHandCursor: true });
        nextBtn.on('pointerdown', () => {
            this.cameras.main.fadeOut(500);
            this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
                this.scene.start('ActionGameScene', { stats: this.stats, currentStageIndex: this.currentStageIndex + 1 });
            });
        });
    }

    getStatsString() {
        return `HP: ${this.stats.health} / ${this.stats.maxHealth} | Armor: ${this.stats.armor * 100}% | Shields: ${this.stats.shield}`;
    }

    createShopItem(x: number, y: number, title: string, desc: string, cost: number, onBuy: () => boolean) {
        const bg = this.add.rectangle(x, y, 350, 120, 0x222222).setStrokeStyle(4, 0xaaaaaa).setInteractive({ useHandCursor: true });
        this.add.text(x, y - 20, title, { fontSize: '28px', color: '#ffffff' }).setOrigin(0.5);
        this.add.text(x, y + 20, desc, { fontSize: '20px', color: '#ffd700', align: 'center' }).setOrigin(0.5);

        bg.on('pointerdown', () => {
            if (this.stats.coins >= cost) {
                if (onBuy()) {
                    this.stats.coins -= cost;
                    this.sound.play('reload'); // Use reload sound for buy for now
                    this.updateUI();
                }
            } else {
                this.cameras.main.shake(100, 0.01);
                this.sound.play('empty');
            }
        });
    }

    updateUI() {
        this.coinsText.setText('COINS: ' + this.stats.coins);
        this.statsText.setText(this.getStatsString());
    }
}
