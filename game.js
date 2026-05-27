// 游戏配置
const CONFIG = {
    CANVAS_WIDTH: 1000,
    CANVAS_HEIGHT: 600,
    GRID_SIZE: 50,
    INITIAL_GOLD: 500,
    INITIAL_HEALTH: 20,
    MAX_WAVES: 10
};

// 游戏状态
const gameState = {
    gold: CONFIG.INITIAL_GOLD,
    health: CONFIG.INITIAL_HEALTH,
    wave: 0,
    totalWaves: CONFIG.MAX_WAVES,
    gameRunning: false,
    waveRunning: false,
    gameOver: false,
    gameWon: false,
    kills: 0,
    totalDamage: 0,
    gameSpeed: 1
};

// 塔类型定义
const TOWER_TYPES = {
    archer: {
        name: '弓箭塔',
        damage: 25,
        range: 150,
        fireRate: 1.5,
        cost: 100,
        emoji: '🏹',
        color: '#FFD700'
    },
    magic: {
        name: '魔法塔',
        damage: 40,
        range: 120,
        fireRate: 1.0,
        cost: 150,
        emoji: '✨',
        color: '#9370DB',
        splash: 60
    },
    slow: {
        name: '减速塔',
        damage: 10,
        range: 140,
        fireRate: 1.2,
        cost: 120,
        emoji: '❄️',
        color: '#87CEEB',
        slowEffect: 0.5
    },
    cannon: {
        name: '炮塔',
        damage: 60,
        range: 130,
        fireRate: 0.8,
        cost: 200,
        emoji: '💣',
        color: '#FF6347',
        splash: 80
    }
};

class Tower {
    constructor(x, y, type) {
        this.x = x;
        this.y = y;
        this.type = TOWER_TYPES[type];
        this.typeKey = type;
        this.level = 1;
        this.cooldown = 0;
        this.target = null;
    }

    update(enemies, dt) {
        this.cooldown = Math.max(0, this.cooldown - dt);

        if (this.cooldown <= 0) {
            const enemiesInRange = enemies.filter(e => 
                this.distance(e) <= this.type.range && !e.dead
            );

            if (enemiesInRange.length > 0) {
                const target = enemiesInRange[0];
                this.shoot(target);
                this.cooldown = 1 / this.type.fireRate;
            }
        }
    }

    shoot(target) {
        const damage = this.type.damage * (1 + (this.level - 1) * 0.5);
        target.takeDamage(damage);
        gameState.totalDamage += damage;

        // 溅射伤害
        if (this.type.splash) {
            const allEnemies = gameState.enemies || [];
            allEnemies.forEach(e => {
                if (e !== target && this.distance(e) <= this.type.splash && !e.dead) {
                    e.takeDamage(damage * 0.5);
                    gameState.totalDamage += damage * 0.5;
                }
            });
        }

        // 减速效果
        if (this.type.slowEffect) {
            target.speed *= this.type.slowEffect;
            target.slowTimer = 3;
        }
    }

    distance(enemy) {
        const dx = this.x - enemy.x;
        const dy = this.y - enemy.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    draw(ctx) {
        // 绘制塔身
        ctx.fillStyle = this.type.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, 20, 0, Math.PI * 2);
        ctx.fill();

        // 绘制范围（按住时显示）
        if (gameState.selectedTower === this) {
            ctx.strokeStyle = 'rgba(100, 200, 255, 0.3)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.type.range, 0, Math.PI * 2);
            ctx.stroke();
        }

        // 绘制塔的emoji
        ctx.font = 'bold 20px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.type.emoji, this.x, this.y);

        // 绘制等级
        ctx.fillStyle = '#333';
        ctx.font = 'bold 10px Arial';
        ctx.fillText('Lv' + this.level, this.x, this.y + 25);
    }
}

class Enemy {
    constructor(wave) {
        this.x = -30;
        this.y = CONFIG.CANVAS_HEIGHT / 2 + (Math.random() - 0.5) * 100;
        this.speed = 80 + wave * 10;
        this.baseSpeed = this.speed;
        this.health = 30 + wave * 15;
        this.maxHealth = this.health;
        this.dead = false;
        this.slowTimer = 0;
    }

    update(dt) {
        if (this.dead) return;

        this.x += this.speed * dt;

        // 减速效果
        if (this.slowTimer > 0) {
            this.slowTimer -= dt;
        } else {
            this.speed = this.baseSpeed;
        }

        // 检查是否超出边界
        if (this.x > CONFIG.CANVAS_WIDTH + 50) {
            return true; // 返回true表示敌人逃脱
        }

        return false;
    }

    takeDamage(damage) {
        this.health -= damage;
        if (this.health <= 0) {
            this.dead = true;
            gameState.kills++;
            gameState.gold += 20 + Math.floor(gameState.wave * 5);
        }
    }

    draw(ctx) {
        if (this.dead) return;

        // 绘制敌人
        ctx.fillStyle = '#FF4444';
        ctx.fillRect(this.x - 12, this.y - 12, 24, 24);

        // 绘制血条
        const healthPercent = this.health / this.maxHealth;
        ctx.fillStyle = '#00CC00';
        ctx.fillRect(this.x - 12, this.y - 20, 24 * healthPercent, 4);
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 1;
        ctx.strokeRect(this.x - 12, this.y - 20, 24, 4);

        // 绘制敌人标志
        ctx.font = '14px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#fff';
        ctx.fillText('👾', this.x, this.y);
    }
}

class Game {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.towers = [];
        this.projectiles = [];
        this.enemies = [];
        this.selectedTowerType = null;
        this.lastTime = Date.now();
        this.waveEnemiesSpawned = 0;
        this.waveEnemiesTotal = 0;
        this.spawnTimer = 0;
        this.spawnInterval = 0.5;

        this.setupEventListeners();
        this.gameLoop();
    }

    setupEventListeners() {
        // 塔按钮
        document.querySelectorAll('.tower-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.selectedTowerType = e.currentTarget.dataset.tower;
                document.querySelectorAll('.tower-btn').forEach(b => b.style.opacity = '0.7');
                e.currentTarget.style.opacity = '1';
            });
        });

        // 开始波次
        document.getElementById('startWaveBtn').addEventListener('click', () => {
            if (!gameState.waveRunning) {
                this.startWave();
            }
        });

        // 加速
        document.getElementById('speedBtn').addEventListener('click', (e) => {
            gameState.gameSpeed = gameState.gameSpeed === 1 ? 2 : 1;
            e.target.textContent = '加速 ' + gameState.gameSpeed + 'x';
        });

        // 清空选择
        document.getElementById('clearBtn').addEventListener('click', () => {
            this.selectedTowerType = null;
            document.querySelectorAll('.tower-btn').forEach(b => b.style.opacity = '1');
        });

        // 画布点击
        this.canvas.addEventListener('click', (e) => {
            if (this.selectedTowerType && !gameState.waveRunning) {
                const rect = this.canvas.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;

                const cost = TOWER_TYPES[this.selectedTowerType].cost;
                if (gameState.gold >= cost) {
                    this.towers.push(new Tower(x, y, this.selectedTowerType));
                    gameState.gold -= cost;
                } else {
                    alert('金币不足！');
                }
            }
        });

        // 画布悬停显示范围
        this.canvas.addEventListener('mousemove', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            gameState.selectedTower = null;
            for (const tower of this.towers) {
                if (Math.hypot(tower.x - x, tower.y - y) < 30) {
                    gameState.selectedTower = tower;
                    break;
                }
            }
        });

        // 重新开始
        document.getElementById('restartBtn').addEventListener('click', () => {
            location.reload();
        });
    }

    startWave() {
        gameState.wave++;
        gameState.waveRunning = true;
        this.waveEnemiesSpawned = 0;
        this.waveEnemiesTotal = 5 + gameState.wave * 2;
        this.spawnTimer = 0;

        document.getElementById('wave').textContent = gameState.wave;
    }

    spawnEnemy() {
        if (this.waveEnemiesSpawned < this.waveEnemiesTotal) {
            this.enemies.push(new Enemy(gameState.wave));
            this.waveEnemiesSpawned++;
        }
    }

    update(dt) {
        if (gameState.gameOver) return;

        dt *= gameState.gameSpeed;

        // 生成敌人
        if (gameState.waveRunning) {
            this.spawnTimer += dt;
            if (this.spawnTimer >= this.spawnInterval) {
                this.spawnEnemy();
                this.spawnTimer = 0;
            }
        }

        // 更新敌人
        this.enemies = this.enemies.filter(e => {
            const escaped = e.update(dt);
            if (escaped) {
                gameState.health--;
                if (gameState.health <= 0) {
                    this.endGame(false);
                }
                return false;
            }
            return !e.dead;
        });

        gameState.enemies = this.enemies;

        // 更新塔
        this.towers.forEach(tower => {
            tower.update(dt, this.enemies);
        });

        // 检查波次是否完成
        if (gameState.waveRunning && this.waveEnemiesSpawned >= this.waveEnemiesTotal && 
            this.enemies.length === 0) {
            gameState.waveRunning = false;
            if (gameState.wave >= CONFIG.MAX_WAVES) {
                this.endGame(true);
            }
        }

        this.updateUI();
    }

    draw() {
        // 清空画布
        this.ctx.fillStyle = '#ffffff';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // 绘制网格
        this.ctx.strokeStyle = '#f0f0f0';
        this.ctx.lineWidth = 1;
        for (let i = 0; i < this.canvas.width; i += CONFIG.GRID_SIZE) {
            this.ctx.beginPath();
            this.ctx.moveTo(i, 0);
            this.ctx.lineTo(i, this.canvas.height);
            this.ctx.stroke();
        }
        for (let i = 0; i < this.canvas.height; i += CONFIG.GRID_SIZE) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, i);
            this.ctx.lineTo(this.canvas.width, i);
            this.ctx.stroke();
        }

        // 绘制起点和终点
        this.ctx.fillStyle = 'rgba(0, 255, 0, 0.2)';
        this.ctx.fillRect(0, 0, 50, this.canvas.height);
        this.ctx.fillStyle = 'rgba(255, 0, 0, 0.2)';
        this.ctx.fillRect(this.canvas.width - 50, 0, 50, this.canvas.height);

        // 绘制敌人
        this.enemies.forEach(e => e.draw(this.ctx));

        // 绘制塔
        this.towers.forEach(t => t.draw(this.ctx));

        // 显示选中状态
        if (this.selectedTowerType) {
            this.ctx.font = 'bold 16px Arial';
            this.ctx.fillStyle = '#667eea';
            this.ctx.textAlign = 'left';
            this.ctx.fillText('已选择: ' + TOWER_TYPES[this.selectedTowerType].name, 20, 30);
        }
    }

    updateUI() {
        document.getElementById('health').textContent = gameState.health;
        document.getElementById('gold').textContent = gameState.gold;
        document.getElementById('kills').textContent = gameState.kills;
        document.getElementById('damage').textContent = Math.floor(gameState.totalDamage);
    }

    endGame(won) {
        gameState.gameOver = true;
        gameState.gameWon = won;
        const modal = document.getElementById('gameOverModal');
        const title = document.getElementById('gameOverTitle');
        const message = document.getElementById('gameOverMessage');

        if (won) {
            title.textContent = '🎉 胜利！';
            message.textContent = `恭喜！你成功守卫了迷城！\n最终得分: ${gameState.kills * 10 + Math.floor(gameState.totalDamage)}`;
        } else {
            title.textContent = '💀 游戏结束';
            message.textContent = `敌人攻破了防线！\n消灭了 ${gameState.kills} 个敌人，造成伤害 ${Math.floor(gameState.totalDamage)}`;
        }

        modal.classList.remove('hidden');
    }

    gameLoop = () => {
        const currentTime = Date.now();
        const dt = (currentTime - this.lastTime) / 1000;
        this.lastTime = currentTime;

        this.update(dt);
        this.draw();

        requestAnimationFrame(this.gameLoop);
    }
}

// 初始化游戏
let game;
document.addEventListener('DOMContentLoaded', () => {
    game = new Game('gameCanvas');
});