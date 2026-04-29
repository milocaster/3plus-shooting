import * as Phaser from 'phaser';

type EnemyType = 'stand' | 'runner' | 'charger' | 'boss' | 'hostage';

interface EntityData {
    sprite: Phaser.GameObjects.Image;
    type: EnemyType;
    hp?: number;
    ringGraphics?: Phaser.GameObjects.Graphics;
    ringObj?: { radius: number, progress: number };
    ringTween?: Phaser.Tweens.Tween;
    moveTween?: Phaser.Tweens.Tween;
    bobTween?: Phaser.Tweens.Tween;
    isWeakpointActive?: boolean;
    weakpointBounds?: Phaser.Geom.Rectangle;
    isReadyToShoot: boolean;
}

interface WaveConfig {
    triggerDistance: number;
    enemies: {
        type: EnemyType;
        x: number;
        y?: number;
        scale?: number;
    }[];
}

interface StageConfig {
    bgKey: string;
    tint: number;
    waves: WaveConfig[];
}

export class ActionGameScene extends Phaser.Scene {
    private bg!: Phaser.GameObjects.TileSprite;
    private crosshair!: Phaser.GameObjects.Graphics;
    private gunSprite!: Phaser.GameObjects.Image;
    
    
    private coinsText!: Phaser.GameObjects.Text;
    private coins: Phaser.GameObjects.Image[] = [];

    private playerStats: any = { health: 100, maxHealth: 100, coins: 0, armor: 0, shield: 0, score: 0 };

    init(data: any) {
        if (data && data.stats) {
            this.playerStats = data.stats;
            this.currentStageIndex = data.currentStageIndex || 0;
            if (this.currentStageIndex >= this.MAX_STAGES) this.currentStageIndex = 0; // Loop game
        }
    }
    private currentStageIndex: number = 0;
    
    private distanceWalked: number = 0;
    private isCombatActive: boolean = false;
    private currentWaveIndex: number = 0;
    private isBossActive: boolean = false;
    
    private currentAmmo: number = 6;
    private maxAmmo: number = 6;
    private ammoIcons: Phaser.GameObjects.Arc[] = [];
    
    private scoreText!: Phaser.GameObjects.Text;
    private healthText!: Phaser.GameObjects.Text;
    private stageText!: Phaser.GameObjects.Text;
    
    private entities: EntityData[] = [];
    private bullets: Phaser.GameObjects.Arc[] = [];

    private stages: StageConfig[] = [];

    private readonly MAX_STAGES = 10;

    constructor() {
        super('ActionGameScene');
        this.generateStages();
    }

    generateStages() {
        const bgKeys = ['bg_stage1', 'bg_stage2'];
        const tints = [0xffffff, 0xffcccc, 0xccccff, 0xccffcc, 0xffaacc, 0xffffff, 0xbbbbbb, 0xff8888, 0x88ff88, 0x5555ff]; 
        
        for (let i = 0; i < this.MAX_STAGES; i++) {
            const isAlley = i % 2 === 0;
            
            // Generate scripted waves for each stage
            const waves: WaveConfig[] = [
                { triggerDistance: 100, enemies: [{ type: 'stand', x: 200, scale: 0.6 }, { type: 'stand', x: 800, scale: 0.6 }] },
                { triggerDistance: 300, enemies: [{ type: 'runner', x: 300 }, { type: 'stand', x: 512, scale: 0.3 }] },
                { triggerDistance: 500, enemies: [{ type: 'charger', x: 512 }, { type: 'hostage', x: 800, scale: 0.5 }] },
                { triggerDistance: 700, enemies: [{ type: 'runner', x: 200 }, { type: 'runner', x: 800 }] },
                { triggerDistance: 900, enemies: [{ type: 'charger', x: 300 }, { type: 'charger', x: 700 }] }
            ];

            this.stages.push({
                bgKey: isAlley ? bgKeys[0] : bgKeys[1],
                tint: tints[i % tints.length],
                waves: waves
            });
        }
    }

    preload() {
        // Assets are preloaded in MainMenuScene
    }

    create() {
        this.input.mouse.disableContextMenu();
        
        // Use TileSprite for panning
        this.bg = this.add.tileSprite(512, 384, 1024, 768, this.stages[this.currentStageIndex].bgKey);
        this.bg.setTint(this.stages[this.currentStageIndex].tint);

        this.playerStats.scoreText = this.add.text(16, 16, 'Score: 0', { fontSize: '32px', color: '#ffffff', backgroundColor: '#000000', padding: { x: 10, y: 5 } }).setDepth(100);
        this.playerStats.healthText = this.add.text(16, 60, 'Health: 100', { fontSize: '32px', color: '#ff0000', backgroundColor: '#000000', padding: { x: 10, y: 5 } }).setDepth(100);
        this.stageText = this.add.text(512, 30, 'STAGE ' + (this.currentStageIndex + 1), { fontSize: '48px', color: '#ffff00', stroke: '#000000', strokeThickness: 6 }).setOrigin(0.5).setDepth(100);

        this.createAmmoUI();

        this.gunSprite = this.add.image(512, 950, 'fpv_gun');
        this.gunSprite.setOrigin(0.5, 1);
        this.gunSprite.setScale(0.6);
        this.gunSprite.setDepth(90);

        this.crosshair = this.add.graphics();
        this.crosshair.lineStyle(2, 0xff0000, 1);
        this.crosshair.strokeCircle(0, 0, 15);
        this.crosshair.beginPath();
        this.crosshair.moveTo(-20, 0); this.crosshair.lineTo(-10, 0);
        this.crosshair.moveTo(20, 0); this.crosshair.lineTo(10, 0);
        this.crosshair.moveTo(0, -20); this.crosshair.lineTo(0, -10);
        this.crosshair.moveTo(0, 20); this.crosshair.lineTo(0, 10);
        this.crosshair.strokePath();
        this.crosshair.setDepth(100);

        this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
            this.crosshair.x = pointer.x;
            this.crosshair.y = pointer.y;
            const swayX = (pointer.x - 512) * 0.05;
            this.gunSprite.x = 512 - swayX;
        });

        this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
            if (this.playerStats.health <= 0) return;

            if (pointer.rightButtonDown() || pointer.button === 2) {
                this.reload();
                return;
            }

            if (this.currentAmmo <= 0) {
                this.sound.play('voice_reload', { volume: 1.0 });
                return;
            }

            this.currentAmmo--;
            this.updateAmmoUI();
            this.sound.play('gunshot', { volume: 0.5 });
            this.shoot(pointer.x, pointer.y);
            this.tweens.add({ targets: this.gunSprite, y: 980, duration: 50, yoyo: true });
        });

        if(this.input.keyboard) {
            this.input.keyboard.on('keydown-SPACE', () => {
                this.reload();
            });
        }

        this.input.setDefaultCursor('none');
        
        this.resetRailSystem();
    }

    resetRailSystem() {
        this.distanceWalked = 0;
        this.currentWaveIndex = 0;
        this.isCombatActive = false;
        this.isBossActive = false;
    }

    update(time: number, delta: number) {
        if (this.playerStats.health <= 0) return;

        // Rail Camera Panning
        if (!this.isCombatActive && !this.isBossActive) {
            const speed = 0.2 * delta;
            this.distanceWalked += speed;
            this.bg.tilePositionX += speed; // Scroll background

            const stage = this.stages[this.currentStageIndex];
            if (this.currentWaveIndex < stage.waves.length) {
                const nextWave = stage.waves[this.currentWaveIndex];
                if (this.distanceWalked >= nextWave.triggerDistance) {
                    this.triggerWave(nextWave);
                    this.currentWaveIndex++;
                }
            } else if (this.distanceWalked >= 1100 && !this.isBossActive && this.entities.length === 0) {
                this.spawnBoss();
            }
        }
    }

    triggerWave(wave: WaveConfig) {
        this.isCombatActive = true;
        // 30% chance to spawn a coin in a wave
        if (Math.random() < 0.8) {
            const coin = this.add.image(Phaser.Math.Between(100, 900), Phaser.Math.Between(500, 700), 'coin').setScale(0.08).setDepth(5);
            this.coins.push(coin);
            this.tweens.add({ targets: coin, y: coin.y - 20, yoyo: true, repeat: -1, duration: 500 });
            // Coin disappears after 3 seconds
            this.time.delayedCall(3000, () => {
                if (coin.active) {
                    this.coins = this.coins.filter(c => c !== coin);
                    coin.destroy();
                }
            });
        }
        
        const warningText = this.add.text(512, 384, 'ACTION!', { fontSize: '64px', color: '#ff0000', stroke: '#ffffff', strokeThickness: 4 }).setOrigin(0.5).setDepth(200);
        this.tweens.add({ targets: warningText, alpha: 0, scale: 2, duration: 800, onComplete: () => warningText.destroy() });

        wave.enemies.forEach(enemyConfig => {
            this.spawnEntity(enemyConfig);
        });
    }

    spawnEntity(config: any) {
        const type: EnemyType = config.type;
        const texture = type === 'hostage' ? 'hostage' : Phaser.Utils.Array.GetRandom(['enemy_aiming', 'enemy_aiming_2', 'enemy_aiming_3']);
        
        let sprite: Phaser.GameObjects.Image;
        let entity: EntityData = { sprite: null as any, type, isReadyToShoot: false };

        const reactionTime = Math.max(600, 1500 - (this.currentStageIndex * 80));

        if (type === 'stand' || type === 'hostage') {
            const scale = config.scale || 0.5;
            const y = config.y || 650;
            sprite = this.add.image(config.x, y + 100, texture).setOrigin(0.5, 1).setScale(scale).setDepth(10);
            entity.sprite = sprite;
            
            this.tweens.add({
                targets: sprite,
                y: y,
                duration: 200,
                ease: 'Power2',
                onComplete: () => {
                    entity.isReadyToShoot = true;
                    if (type !== 'hostage') this.createTargetRing(entity, reactionTime, false);
                }
            });

            if (type === 'hostage') {
                this.time.delayedCall(3000, () => {
                    if (sprite.active) this.removeEntity(sprite, true);
                });
            }

        } else if (type === 'runner') {
            const startX = config.x > 512 ? 1100 : -100; // Spawn offscreen
            sprite = this.add.image(startX, 650, texture).setOrigin(0.5, 1).setScale(0.5).setDepth(10);
            entity.sprite = sprite;

            // Run Tween
            entity.moveTween = this.tweens.add({
                targets: sprite,
                x: config.x,
                duration: 1000,
                ease: 'Linear',
                onComplete: () => {
                    if(entity.bobTween) entity.bobTween.stop();
                    sprite.y = 650; // Reset Y
                    entity.isReadyToShoot = true;
                    this.createTargetRing(entity, reactionTime, false);
                }
            });

            // Bobbing Tween (fake animation)
            entity.bobTween = this.tweens.add({
                targets: sprite,
                y: 630,
                duration: 150,
                yoyo: true,
                repeat: -1
            });

        } else if (type === 'charger') {
            sprite = this.add.image(config.x, 450, texture).setOrigin(0.5, 1).setScale(0.1).setDepth(5);
            entity.sprite = sprite;

            entity.moveTween = this.tweens.add({
                targets: sprite,
                y: 750,
                scale: 1.0,
                duration: 1500,
                ease: 'Quad.easeIn',
                onComplete: () => {
                    entity.isReadyToShoot = true;
                    this.createTargetRing(entity, reactionTime * 0.5, false); // Fast reaction when close
                }
            });
        }

        this.entities.push(entity);
    }

    createAmmoUI() {
        for (let i = 0; i < this.maxAmmo; i++) {
            const bullet = this.add.circle(800 + i * 30, 700, 12, 0xffff00).setDepth(200);
            bullet.setStrokeStyle(2, 0xffaa00);
            this.ammoIcons.push(bullet);
        }
        this.add.text(780, 650, 'RELOAD (Space/Right-Click)', { fontSize: '20px', color: '#ff0000', backgroundColor: '#000000', padding: { x: 5, y: 5 } }).setDepth(200).setAlpha(0).setName('reloadText');
    }

    updateAmmoUI() {
        for (let i = 0; i < this.maxAmmo; i++) {
            this.ammoIcons[i].setAlpha(i < this.currentAmmo ? 1 : 0.2);
        }
        const reloadText = this.children.getByName('reloadText') as Phaser.GameObjects.Text;
        if (this.currentAmmo <= 0) {
            reloadText.setAlpha(1);
            if (!this.tweens.isTweening(reloadText)) {
                this.tweens.add({ targets: reloadText, alpha: 0, duration: 300, yoyo: true, repeat: -1 });
            }
        } else {
            reloadText.setAlpha(0);
            this.tweens.killTweensOf(reloadText);
        }
    }

    reload() {
        if (this.currentAmmo === this.maxAmmo) return;
        this.sound.play('reload', { volume: 1.0 });
        this.currentAmmo = this.maxAmmo;
        this.updateAmmoUI();
    }

    createTargetRing(entity: EntityData, duration: number, isBossWeakpoint: boolean) {
        const ringObj = { radius: 100, progress: 0 };
        const ringGraphics = this.add.graphics().setDepth(20);
        
        entity.ringObj = ringObj;
        entity.ringGraphics = ringGraphics;

        entity.ringTween = this.tweens.add({
            targets: ringObj,
            radius: 20,
            progress: 1,
            duration: duration,
            onUpdate: () => {
                if (!entity.sprite.active) return;
                ringGraphics.clear();
                
                let color = 0x00ff00;
                if (ringObj.progress > 0.5) color = 0xffff00;
                if (ringObj.progress > 0.8) color = 0xff0000;

                ringGraphics.lineStyle(6, color, 1);
                
                let targetX = entity.sprite.x;
                let targetY = entity.sprite.y - (entity.sprite.displayHeight * 0.6); 
                if (isBossWeakpoint && entity.weakpointBounds) {
                    targetX = entity.weakpointBounds.centerX;
                    targetY = entity.weakpointBounds.centerY;
                }
                
                const r = ringObj.radius;
                ringGraphics.beginPath();
                ringGraphics.arc(targetX, targetY, r, 0, Math.PI/4); ringGraphics.strokePath();
                ringGraphics.beginPath();
                ringGraphics.arc(targetX, targetY, r, Math.PI/2, Math.PI*3/4); ringGraphics.strokePath();
                ringGraphics.beginPath();
                ringGraphics.arc(targetX, targetY, r, Math.PI, Math.PI*5/4); ringGraphics.strokePath();
                ringGraphics.beginPath();
                ringGraphics.arc(targetX, targetY, r, Math.PI*3/2, Math.PI*7/4); ringGraphics.strokePath();
            },
            onComplete: () => {
                if (entity.sprite.active && this.playerStats.health > 0) {
                    if (isBossWeakpoint) {
                        entity.isWeakpointActive = false;
                        ringGraphics.clear();
                        this.enemyFiresProjectile(entity.sprite, true);
                        this.time.delayedCall(500, () => this.startBossAction(entity));
                    } else {
                        this.enemyFiresProjectile(entity.sprite);
                    }
                }
            }
        });
    }

    spawnBoss() {
        this.isBossActive = true;
        this.isCombatActive = true;
        // 30% chance to spawn a coin in a wave
        if (Math.random() < 0.8) {
            const coin = this.add.image(Phaser.Math.Between(100, 900), Phaser.Math.Between(500, 700), 'coin').setScale(0.08).setDepth(5);
            this.coins.push(coin);
            this.tweens.add({ targets: coin, y: coin.y - 20, yoyo: true, repeat: -1, duration: 500 });
            // Coin disappears after 3 seconds
            this.time.delayedCall(3000, () => {
                if (coin.active) {
                    this.coins = this.coins.filter(c => c !== coin);
                    coin.destroy();
                }
            });
        }

        
        this.sound.stopAll();
        this.sound.play('bgm_boss', { loop: true, volume: 0.5 });
        const warningText = this.add.text(512, 384, 'WARNING: BOSS APPROACHING!', { fontSize: '48px', color: '#ff0000', stroke: '#ffffff', strokeThickness: 4 }).setOrigin(0.5).setDepth(200);
        this.tweens.add({ targets: warningText, alpha: 0, duration: 2000, onComplete: () => warningText.destroy() });

        this.time.delayedCall(2000, () => {
            if (this.playerStats.health <= 0) return;
            
            const sprite = this.add.image(512, 800, 'boss'); 
            sprite.setOrigin(0.5, 1);
            sprite.setScale(0.6);
            sprite.setDepth(15);

            this.tweens.add({
                targets: sprite,
                y: 650, 
                duration: 500,
                ease: 'Back.easeOut'
            });

            const bossHp = 5 + this.currentStageIndex * 2;
            
            const bossEntity: EntityData = { 
                sprite, 
                type: 'boss',
                isReadyToShoot: true,
                hp: bossHp 
            };
            this.entities.push(bossEntity);

            this.time.delayedCall(1000, () => this.startBossAction(bossEntity));
        });
    }

    startBossAction(boss: EntityData) {
        if (!boss.sprite.active || this.playerStats.health <= 0) return;

        boss.isWeakpointActive = false;
        if (boss.ringGraphics) boss.ringGraphics.clear();
        if (boss.ringTween) boss.ringTween.remove();

        const positions = [250, 512, 750];
        const newX = Phaser.Utils.Array.GetRandom(positions);
        
        this.tweens.add({
            targets: boss.sprite,
            x: newX,
            duration: 400,
            ease: 'Power2',
            onComplete: () => {
                const reactionTime = Math.max(600, 1200 - (this.currentStageIndex * 50));
                boss.isWeakpointActive = true;
                
                boss.weakpointBounds = new Phaser.Geom.Rectangle(
                    boss.sprite.x - 30,
                    boss.sprite.y - (boss.sprite.displayHeight * 0.6) - 30,
                    60, 60
                );

                this.createTargetRing(boss, reactionTime, true);
            }
        });
    }

    enemyFiresProjectile(sprite: Phaser.GameObjects.Image, isBoss: boolean = false) {
        this.sound.play('gunshot', { volume: 0.8 });
        
        const gunBarrelY = sprite.y - (sprite.displayHeight * (isBoss ? 0.7 : 0.6)); 
        const muzzleFlash = this.add.circle(sprite.x, gunBarrelY, 20, 0xffff00).setDepth(11);
        this.time.delayedCall(50, () => muzzleFlash.destroy());

        const bullet = this.add.circle(sprite.x, gunBarrelY, isBoss ? 12 : 8, isBoss ? 0xff0000 : 0xffaa00).setDepth(80);
        this.bullets.push(bullet);

        this.tweens.add({
            targets: bullet,
            x: 512,
            y: 768,
            scale: 5,
            duration: isBoss ? 400 : 500, 
            onComplete: () => {
                if (bullet.active) {
                    this.takeDamage(isBoss ? 30 : 20); 
                    bullet.destroy();
                }
            }
        });

        if (!isBoss) {
            if (sprite.active) this.removeEntity(sprite, true);
        }
    }

    takeDamage(amount: number) {
        this.cameras.main.flash(200, 255, 0, 0);
        this.cameras.main.shake(200, 0.02);
        this.playerStats.health -= amount;
        if (this.playerStats.health <= 0) {
            this.playerStats.health = 0;
            this.add.text(512, 384, 'GAME OVER', { fontSize: '64px', color: '#ff0000', stroke: '#000', strokeThickness: 5 }).setOrigin(0.5).setDepth(200);
            
            const retryBtn = this.add.text(512, 500, 'RETRY', { fontSize: '48px', color: '#ffffff', backgroundColor: '#333', padding: {x: 20, y: 10} }).setOrigin(0.5).setDepth(200).setInteractive({ useHandCursor: true });
            retryBtn.on('pointerdown', () => {
                this.scene.start('ActionGameScene', { stats: { health: 100, maxHealth: 100, coins: 0, armor: 0, shield: 0, score: 0 }, currentStageIndex: 0 });
            });
        }
        this.playerStats.healthText.setText('Health: ' + this.playerStats.health);
    }

    shoot(x: number, y: number) {
        // Check Coins
        for (let i = this.coins.length - 1; i >= 0; i--) {
            const coin = this.coins[i];
            const cb = coin.getBounds();
            const hitArea = new Phaser.Geom.Rectangle(cb.x - 40, cb.y - 40, cb.width + 80, cb.height + 80);
            if (coin.active && Phaser.Geom.Rectangle.Contains(hitArea, x, y)) {
                this.playerStats.coins += 1;
                this.playerStats.score += 100;
                this.scoreText.setText('Score: ' + this.playerStats.score);
                this.coinsText.setText('Coins: ' + this.playerStats.coins);
                
                const pickup = this.add.text(coin.x, coin.y, '+1 COIN', { fontSize: '24px', color: '#ffd700', stroke: '#000', strokeThickness: 3 }).setDepth(100);
                this.tweens.add({ targets: pickup, y: pickup.y - 50, alpha: 0, duration: 800, onComplete: () => pickup.destroy() });
                
                coin.destroy();
                this.coins.splice(i, 1);
                return; // Stop checking enemies if we shot a coin
            }
        }

        for (let i = this.entities.length - 1; i >= 0; i--) {
            const entity = this.entities[i];
            const bounds = entity.sprite.getBounds();
            
            if (entity.type === 'boss') {
                if (entity.isWeakpointActive && entity.weakpointBounds && Phaser.Geom.Rectangle.Contains(entity.weakpointBounds, x, y)) {
                    entity.hp! -= 1;
                    entity.isWeakpointActive = false;
                    if (entity.ringGraphics) entity.ringGraphics.clear();
                    if (entity.ringTween) entity.ringTween.remove();

                    entity.sprite.setTintFill(0xff0000);
                    this.time.delayedCall(100, () => entity.sprite.clearTint());

                    const hitEffect = this.add.circle(x, y, 20, 0xff0000).setScale(0.5).setDepth(100);
                    this.tweens.add({ targets: hitEffect, scale: 3, alpha: 0, duration: 300, onComplete: () => hitEffect.destroy() });

                    if (entity.hp! <= 0) {
                        this.playerStats.score += 1000;
                        this.playerStats.scoreText.setText('Score: ' + this.playerStats.score);
                        this.removeEntity(entity.sprite, false);
                        this.isBossActive = false;
                        this.checkStageProgression(true); 
                    } else {
                        this.startBossAction(entity);
                    }
                    break;
                }
            } else {
                const paddingX = bounds.width * 0.25; 
                const paddingTop = bounds.height * 0.1; 
                const paddingBottom = bounds.height * 0.1; 

                const hitArea = new Phaser.Geom.Rectangle(
                    bounds.x + paddingX, 
                    bounds.y + paddingTop, 
                    bounds.width - (paddingX * 2), 
                    bounds.height - (paddingTop + paddingBottom)
                );
                
                // Only allow shooting if they are ready (finished running/charging) or if they are charging (can shoot mid-air)
                if (Phaser.Geom.Rectangle.Contains(hitArea, x, y)) {
                    if (entity.type === 'hostage') {
                        const penaltyText = this.add.text(x, y - 100, '-20 HEALTH!', { fontSize: '40px', color: '#ff0000', stroke: '#ffffff', strokeThickness: 4 }).setOrigin(0.5).setDepth(100);
                        this.tweens.add({ targets: penaltyText, y: y - 200, alpha: 0, duration: 1000, onComplete: () => penaltyText.destroy() });
                        this.takeDamage(20);
                        this.removeEntity(entity.sprite, false);
                    } else {
                        this.playerStats.score += 100;
                        this.playerStats.scoreText.setText('Score: ' + this.playerStats.score);
                        
                        const hitEffect = this.add.circle(x, y, 20, 0xffaa00).setScale(0.5).setDepth(100);
                        this.tweens.add({ targets: hitEffect, scale: 2, alpha: 0, duration: 300, onComplete: () => hitEffect.destroy() });
                        
                        this.removeEntity(entity.sprite, false);
                    }
                    break; 
                }
            }
        }
    }

    checkStageProgression(bossDefeated: boolean) {
        if (!bossDefeated && this.entities.length === 0 && !this.isBossActive) {
            // Cleared the wave, resume panning
            this.isCombatActive = false;
        } else if (bossDefeated) {
            if (this.currentStageIndex < this.MAX_STAGES - 1) {
                this.cameras.main.fadeOut(1000, 0, 0, 0);
        this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
            this.scene.start('ShopScene', { stats: this.playerStats, currentStageIndex: this.currentStageIndex });
        });
            } else {
                this.add.text(512, 384, 'YOU WIN!', { fontSize: '64px', color: '#00ff00', stroke: '#000', strokeThickness: 5 }).setOrigin(0.5).setDepth(200);
            }
        }
    }

    transitionToNextStage() {
        this.entities.forEach(e => {
            if (e.ringTween) e.ringTween.remove();
            if (e.moveTween) e.moveTween.remove();
            if (e.bobTween) e.bobTween.remove();
            if (e.ringGraphics) e.ringGraphics.destroy();
            e.sprite.destroy();
        });
        this.entities = [];
        this.bullets.forEach(b => b.destroy());
        this.bullets = [];

        this.cameras.main.fadeOut(1000, 0, 0, 0);
        
        this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
            this.currentStageIndex++;
            const newStage = this.stages[this.currentStageIndex];
            
            this.bg.setTexture(newStage.bgKey);
            this.bg.setTint(newStage.tint); 
            
            this.stageText.setText('STAGE ' + (this.currentStageIndex + 1));
            this.resetRailSystem();

            this.cameras.main.fadeIn(1000, 0, 0, 0);
        });
    }

    removeEntity(sprite: Phaser.GameObjects.Image, animateHide: boolean) {
        const entityObj = this.entities.find(e => e.sprite === sprite);
        if (entityObj) {
            if (entityObj.ringTween) entityObj.ringTween.remove();
            if (entityObj.moveTween) entityObj.moveTween.remove();
            if (entityObj.bobTween) entityObj.bobTween.remove();
            if (entityObj.ringGraphics) entityObj.ringGraphics.destroy();
        }
        this.entities = this.entities.filter(e => e.sprite !== sprite);

        if (animateHide && sprite.active) {
            this.tweens.add({
                targets: sprite,
                y: sprite.y + 100,
                duration: 200,
                onComplete: () => {
                    sprite.destroy();
                    this.checkStageProgression(false);
                }
            });
        } else if (sprite.active) {
            sprite.destroy();
            this.checkStageProgression(false);
        } else {
            this.checkStageProgression(false);
        }
    }
}