// =============================================
//  TANK BATTLE - game.js
//  Todas las constantes, clases y lógica del juego
// =============================================

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

// ── Constantes de mapa ──────────────────────
const TILE = 26;
const COLS = 20;
const ROWS = 20;
const W = COLS * TILE;
const H = ROWS * TILE;
canvas.width = W;
canvas.height = H;

// Tipos de tile
const EMPTY = 0, BRICK = 1, STEEL = 2, WATER = 3, BUSH = 4, BASE = 5;

// ── Estado global ───────────────────────────
let gameState = 'menu';
let twoPlayer = false;
let score = 0;
let gameOver = false;
let gameWon = false;
let reviveAvailable = false;
let reviveTimer = 0;
let map;

// ── Mapa ────────────────────────────────────
function makeMap() {
    const m = Array.from({ length: ROWS }, () => Array(COLS).fill(EMPTY));
    // Borde de acero
    for (let i = 0; i < COLS; i++) { m[0][i] = STEEL; m[ROWS - 1][i] = STEEL; }
    for (let i = 0; i < ROWS; i++) { m[i][0] = STEEL; m[i][COLS - 1] = STEEL; }
    // Base en la parte inferior central
    m[ROWS - 2][10] = BASE; m[ROWS - 2][9] = BRICK; m[ROWS - 2][11] = BRICK;
    m[ROWS - 3][9] = BRICK; m[ROWS - 3][10] = BRICK; m[ROWS - 3][11] = BRICK;

    const bricks = [
        [2, 2], [2, 3], [2, 4], [3, 2], [4, 2], [4, 3], [4, 4],
        [2, 7], [2, 8], [3, 7], [4, 7], [4, 8],
        [2, 12], [2, 13], [3, 12], [4, 12], [4, 13],
        [2, 16], [2, 17], [3, 16], [4, 16], [4, 17],
        [7, 2], [7, 3], [8, 2], [9, 2], [9, 3],
        [7, 7], [7, 8], [8, 7], [9, 7], [9, 8],
        [7, 12], [7, 13], [8, 12], [9, 12], [9, 13],
        [7, 16], [7, 17], [8, 16], [9, 16], [9, 17],
        [12, 2], [12, 3], [13, 2], [14, 2], [14, 3],
        [12, 7], [12, 8], [13, 7], [14, 7], [14, 8],
        [12, 12], [12, 13], [13, 12], [14, 12], [14, 13],
        [12, 16], [12, 17], [13, 16], [14, 16], [14, 17],
        [17, 5], [17, 6], [17, 7], [16, 5], [18, 5],
        [17, 13], [17, 14], [17, 15], [16, 13], [18, 13],
        [5, 10], [6, 10], [7, 10], [5, 9], [5, 11],
        [13, 10], [14, 10], [15, 10], [15, 9], [15, 11],
    ];
    bricks.forEach(([r, c]) => { if (r > 0 && r < ROWS - 1 && c > 0 && c < COLS - 1) m[r][c] = BRICK; });

    const steels = [
        [5, 5], [5, 6], [6, 5],
        [5, 14], [5, 15], [6, 15],
        [10, 3], [10, 4], [11, 3],
        [10, 16], [10, 17], [11, 17],
        [14, 5], [15, 5], [15, 6],
        [14, 14], [15, 14], [15, 15],
    ];
    steels.forEach(([r, c]) => { if (r > 0 && r < ROWS - 1 && c > 0 && c < COLS - 1) m[r][c] = STEEL; });

    const waters = [
        [3, 9], [3, 10], [3, 11], [4, 9], [4, 10], [4, 11],
        [9, 4], [9, 5], [10, 4], [10, 5],
        [9, 14], [9, 15], [10, 14], [10, 15],
    ];
    waters.forEach(([r, c]) => { if (r > 0 && r < ROWS - 1 && c > 0 && c < COLS - 1) m[r][c] = WATER; });

    const bushes = [
        [6, 7], [6, 8], [7, 9], [8, 9],
        [6, 11], [6, 12], [7, 10], [8, 10],
        [11, 6], [12, 6], [13, 7], [12, 8],
        [11, 13], [12, 13], [13, 12], [12, 11],
        [16, 8], [16, 9], [17, 8], [17, 9],
        [16, 11], [16, 12], [17, 11], [17, 12],
    ];
    bushes.forEach(([r, c]) => { if (r > 0 && r < ROWS - 1 && c > 0 && c < COLS - 1) m[r][c] = BUSH; });

    return m;
}

// ── Clases ───────────────────────────────────
class Tank {
    constructor(x, y, color, type) {
        this.x = x; // pixel x (centro)
        this.y = y;
        this.color = color;
        this.type = type; // 'p1','p2','fast','defender','attacker'
        this.dir = 0; // 0=arriba, 1=derecha, 2=abajo, 3=izquierda
        this.speed = type === 'fast' ? 1.8 : type === 'attacker' ? 1.3 : 1.1; // 🔧 velocidad: fast/attacker/resto
        this.fireRate = type === 'attacker' ? 70 : 100; // 🔧 cadencia enemigos (frames entre disparos)
        this.fireCooldown = Math.random() * 80;
        this.alive = true;
        this.shield = false;
        this.shieldTimer = 0;
        this.powerups = {};
        this.size = 20;
        this.moveTimer = 0;
        this.moveInterval = type === 'fast' ? 40 : type === 'defender' ? 90 : 60;
        this.targetDir = 0;
        this.spawnInvincible = (type === 'p1' || type === 'p2') ? 180 : 0;
        this.canBreakSteel = false;
    }
    get col() { return Math.round((this.x - TILE / 2) / TILE); }
    get row() { return Math.round((this.y - TILE / 2) / TILE); }
    get tileX() { return Math.floor(this.x / TILE); }
    get tileY() { return Math.floor(this.y / TILE); }
}

class Bullet {
    constructor(x, y, dx, dy, owner, powerful) {
        this.x = x; this.y = y;
        this.dx = dx; this.dy = dy;
        this.owner = owner;
        this.powerful = powerful || false;
        this.speed = 3.5; // 🔧 velocidad de bala
        this.alive = true;
        this.size = 4;
    }
    update() {
        this.x += this.dx * this.speed;
        this.y += this.dy * this.speed;
    }
}

class PowerUp {
    constructor(x, y, type) {
        this.x = x; this.y = y;
        this.type = type; // 'speed','shield','rapid','powerful','life'
        this.alive = true;
        this.timer = 600;
        this.blink = 0;
    }
}

// ── Variables de juego ───────────────────────
let p1, p2, enemies = [], bullets = [], powerups = [];
let baseAlive = true;
let enemiesKilled = 0;
const TOTAL_ENEMIES = 6;

const dirs = [[0, -1], [1, 0], [0, 1], [-1, 0]];
const PU_TYPES = ['speed', 'shield', 'rapid', 'powerful', 'life'];
const PU_COLORS = { speed: '#f0c040', shield: '#40a0f0', rapid: '#f04040', powerful: '#ffffff', life: '#40f080' };
const PU_LABELS = { speed: 'VEL', shield: 'ESC', rapid: 'RAP', powerful: 'POT', life: 'VID' };

// ── Inicialización ───────────────────────────
function initGame(two) {
    twoPlayer = two;
    map = makeMap();
    score = 0;
    gameOver = false;
    gameWon = false;
    baseAlive = true;
    enemiesKilled = 0;
    bullets = [];
    powerups = [];
    reviveAvailable = false;
    reviveTimer = 0;

    p1 = new Tank(TILE * 7.5, TILE * 18.5, '#f0c040', 'p1');
    p1.dir = 0;
    p1.lives = 3;

    if (twoPlayer) {
        p2 = new Tank(TILE * 12.5, TILE * 18.5, '#b0c4de', 'p2');
        p2.dir = 0;
        p2.lives = 3;
        document.getElementById('panelP2').style.display = '';
    } else {
        p2 = null;
        document.getElementById('panelP2').style.display = 'none';
    }

    spawnEnemies();
    gameState = 'playing';
    updateSidebar();
}

function spawnEnemies() {
    enemies = [];
    const positions = [
        [TILE * 2.5, TILE * 2.5],
        [TILE * 10.5, TILE * 1.5],
        [TILE * 17.5, TILE * 2.5],
        [TILE * 4.5, TILE * 10.5],
        [TILE * 15.5, TILE * 10.5],
        [TILE * 10.5, TILE * 5.5],
    ];
    const types = ['fast', 'defender', 'attacker', 'fast', 'defender', 'attacker'];
    for (let i = 0; i < TOTAL_ENEMIES; i++) {
        let [ex, ey] = positions[i];
        // Si la posición está bloqueada, buscar celda libre cercana
        if (!canMoveTo(ex, ey, 20)) {
            outer: for (let dr = -3; dr <= 3; dr++) {
                for (let dc = -3; dc <= 3; dc++) {
                    const tx = ex + dc * TILE, ty = ey + dr * TILE;
                    if (canMoveTo(tx, ty, 20)) { ex = tx; ey = ty; break outer; }
                }
            }
        }
        const e = new Tank(ex, ey, '#e44444', types[i]);
        e.dir = 2;
        enemies.push(e);
    }
}

// ── Colisiones ───────────────────────────────
function tileAt(px, py) {
    const tc = Math.floor(px / TILE);
    const tr = Math.floor(py / TILE);
    if (tc < 0 || tc >= COLS || tr < 0 || tr >= ROWS) return STEEL;
    return map[tr][tc];
}

function canMoveTo(nx, ny, size) {
    const half = size / 2;
    const corners = [
        [nx - half + 1, ny - half + 1], [nx + half - 1, ny - half + 1],
        [nx - half + 1, ny + half - 1], [nx + half - 1, ny + half - 1]
    ];
    for (const [cx, cy] of corners) {
        const t = tileAt(cx, cy);
        if (t === BRICK || t === STEEL || t === WATER || t === BASE) return false;
    }
    return true;
}

function tankCanMove(tank, nx, ny) {
    if (!canMoveTo(nx, ny, tank.size)) return false;
    const allTanks = [p1, p2, ...enemies].filter(t => t && t.alive && t !== tank);
    for (const o of allTanks) {
        const dx = Math.abs(o.x - nx), dy = Math.abs(o.y - ny);
        if (dx < tank.size - 1 && dy < tank.size - 1) return false;
    }
    return true;
}

function fireBullet(tank) {
    if (!tank || !tank.alive) return;
    const [dx, dy] = dirs[tank.dir];
    const powerful = tank.powerups && tank.powerups.powerful;
    const b = new Bullet(tank.x + dx * 12, tank.y + dy * 12, dx, dy, tank, powerful);
    if (powerful) b.speed = 5; // 🔧 velocidad bala potente
    bullets.push(b);
}

// ── Input ────────────────────────────────────
const keys = {};
document.addEventListener('keydown', e => { keys[e.code] = true; });
document.addEventListener('keyup', e => { keys[e.code] = false; });

let p1FireCooldown = 0;
let p2FireCooldown = 0;
let mouseX = 0, mouseY = 0;
let mouseDown = false;

canvas.addEventListener('mousemove', e => {
    const r = canvas.getBoundingClientRect();
    mouseX = e.clientX - r.left;
    mouseY = e.clientY - r.top;
});
canvas.addEventListener('mousedown', e => { if (e.button === 0) mouseDown = true; });
canvas.addEventListener('mouseup', e => { if (e.button === 0) mouseDown = false; });

// Resucitar J1
document.addEventListener('keydown', e => {
    if (e.code === 'Space' && reviveAvailable && twoPlayer && p2 && p2.alive && p1 && !p1.alive) {
        if (p2.lives > 1) {
            p2.lives--;
            p1.alive = true;
            p1.x = TILE * 7.5; p1.y = TILE * 18.5;
            p1.lives = 1;
            p1.spawnInvincible = 180;
            p1.shield = false;
            p1.powerups = {};
            reviveAvailable = false;
            reviveTimer = 0;
            document.getElementById('reviveMsg').style.display = 'none';
            updateSidebar();
        }
    }
});

// ── Lógica de jugadores ──────────────────────
function processPlayerInput() {
    if (!p1 || !p1.alive) return;
    let moved = false;
    const up    = keys['KeyW'] || (!twoPlayer && keys['ArrowUp']);
    const down  = keys['KeyS'] || (!twoPlayer && keys['ArrowDown']);
    const left  = keys['KeyA'] || (!twoPlayer && keys['ArrowLeft']);
    const right = keys['KeyD'] || (!twoPlayer && keys['ArrowRight']);

    if (up) {
        p1.dir = 0;
        const nx = p1.x + dirs[0][0] * p1.speed, ny = p1.y + dirs[0][1] * p1.speed;
        if (tankCanMove(p1, nx, ny)) { p1.x = nx; p1.y = ny; moved = true; }
    } else if (down) {
        p1.dir = 2;
        const nx = p1.x + dirs[2][0] * p1.speed, ny = p1.y + dirs[2][1] * p1.speed;
        if (tankCanMove(p1, nx, ny)) { p1.x = nx; p1.y = ny; moved = true; }
    } else if (left) {
        p1.dir = 3;
        const nx = p1.x + dirs[3][0] * p1.speed, ny = p1.y + dirs[3][1] * p1.speed;
        if (tankCanMove(p1, nx, ny)) { p1.x = nx; p1.y = ny; moved = true; }
    } else if (right) {
        p1.dir = 1;
        const nx = p1.x + dirs[1][0] * p1.speed, ny = p1.y + dirs[1][1] * p1.speed;
        if (tankCanMove(p1, nx, ny)) { p1.x = nx; p1.y = ny; moved = true; }
    }
    p1FireCooldown--;
    const fr = p1.powerups && p1.powerups.rapid ? 30 : 55; // 🔧 cadencia jugador (frames entre disparos)
    if (keys['Space'] && p1FireCooldown <= 0) {
        fireBullet(p1);
        p1FireCooldown = fr;
    }

    if (p1.spawnInvincible > 0) p1.spawnInvincible--;
    if (p1.shield) { p1.shieldTimer--; if (p1.shieldTimer <= 0) p1.shield = false; }
    if (p1.powerups && p1.powerups.speedTimer) {
        p1.powerups.speedTimer--;
        if (p1.powerups.speedTimer <= 0) { p1.speed = 1.1; delete p1.powerups.speedTimer; delete p1.powerups.speed; }
    }
    if (p1.powerups && p1.powerups.rapidTimer) {
        p1.powerups.rapidTimer--;
        if (p1.powerups.rapidTimer <= 0) { delete p1.powerups.rapidTimer; delete p1.powerups.rapid; }
    }
    if (p1.powerups && p1.powerups.powerfulTimer) {
        p1.powerups.powerfulTimer--;
        if (p1.powerups.powerfulTimer <= 0) { p1.canBreakSteel = false; delete p1.powerups.powerfulTimer; delete p1.powerups.powerful; }
    }
}

function processP2Input() {
    if (!p2 || !p2.alive) return;
    if (keys['ArrowUp']) {
        p2.dir = 0;
        const nx = p2.x + dirs[0][0] * p2.speed, ny = p2.y + dirs[0][1] * p2.speed;
        if (tankCanMove(p2, nx, ny)) { p2.x = nx; p2.y = ny; }
    } else if (keys['ArrowDown']) {
        p2.dir = 2;
        const nx = p2.x + dirs[2][0] * p2.speed, ny = p2.y + dirs[2][1] * p2.speed;
        if (tankCanMove(p2, nx, ny)) { p2.x = nx; p2.y = ny; }
    } else if (keys['ArrowLeft']) {
        p2.dir = 3;
        const nx = p2.x + dirs[3][0] * p2.speed, ny = p2.y + dirs[3][1] * p2.speed;
        if (tankCanMove(p2, nx, ny)) { p2.x = nx; p2.y = ny; }
    } else if (keys['ArrowRight']) {
        p2.dir = 1;
        const nx = p2.x + dirs[1][0] * p2.speed, ny = p2.y + dirs[1][1] * p2.speed;
        if (tankCanMove(p2, nx, ny)) { p2.x = nx; p2.y = ny; }
    }

    p2FireCooldown--;
    const fr2 = p2.powerups && p2.powerups.rapid ? 30 : 55;
    if (mouseDown && p2FireCooldown <= 0) {
        fireBullet(p2);
        p2FireCooldown = fr2;
    }

    if (p2.spawnInvincible > 0) p2.spawnInvincible--;
    if (p2.shield) { p2.shieldTimer--; if (p2.shieldTimer <= 0) p2.shield = false; }
    if (p2.powerups && p2.powerups.speedTimer) {
        p2.powerups.speedTimer--;
        if (p2.powerups.speedTimer <= 0) { p2.speed = 1.1; delete p2.powerups.speedTimer; delete p2.powerups.speed; }
    }
    if (p2.powerups && p2.powerups.rapidTimer) {
        p2.powerups.rapidTimer--;
        if (p2.powerups.rapidTimer <= 0) { delete p2.powerups.rapidTimer; delete p2.powerups.rapid; }
    }
    if (p2.powerups && p2.powerups.powerfulTimer) {
        p2.powerups.powerfulTimer--;
        if (p2.powerups.powerfulTimer <= 0) { p2.canBreakSteel = false; delete p2.powerups.powerfulTimer; delete p2.powerups.powerful; }
    }
}

// ── IA enemiga ───────────────────────────────
function updateEnemyAI(e) {
    if (!e.alive) return;
    e.fireCooldown--;
    if (e.fireCooldown <= 0) {
        fireBullet(e);
        e.fireCooldown = e.fireRate + Math.floor(Math.random() * 40);
    }

    e.moveTimer--;
    if (e.moveTimer <= 0) {
        e.moveTimer = e.moveInterval;
        if (e.type === 'attacker') {
            const baseX = TILE * 10.5, baseY = TILE * (ROWS - 2);
            const dx = baseX - e.x, dy = baseY - e.y;
            if (Math.abs(dx) > Math.abs(dy)) e.targetDir = dx > 0 ? 1 : 3;
            else e.targetDir = dy > 0 ? 2 : 0;
            if (Math.random() < 0.25) e.targetDir = Math.floor(Math.random() * 4);
        } else if (e.type === 'defender') {
            if (p1 && p1.alive) {
                const dx = p1.x - e.x, dy = p1.y - e.y;
                if (Math.abs(dx) < TILE * 3) e.targetDir = dx > 0 ? 1 : 3;
                else if (Math.abs(dy) < TILE * 3) e.targetDir = dy > 0 ? 2 : 0;
                else e.targetDir = Math.floor(Math.random() * 4);
            } else e.targetDir = Math.floor(Math.random() * 4);
        } else {
            e.targetDir = Math.floor(Math.random() * 4);
        }
        e.dir = e.targetDir;
    }

    const [dx, dy] = dirs[e.dir];
    const nx = e.x + dx * e.speed, ny = e.y + dy * e.speed;
    if (tankCanMove(e, nx, ny)) { e.x = nx; e.y = ny; }
    else {
        e.dir = Math.floor(Math.random() * 4);
        e.moveTimer = 10;
    }
}

// ── Balas ────────────────────────────────────
function updateBullets() {
    for (const b of bullets) {
        if (!b.alive) continue;
        b.update();

        if (b.x < 0 || b.x > W || b.y < 0 || b.y > H) { b.alive = false; continue; }

        const tc = Math.floor(b.x / TILE);
        const tr = Math.floor(b.y / TILE);
        if (tc >= 0 && tc < COLS && tr >= 0 && tr < ROWS) {
            const t = map[tr][tc];
            if (t === BRICK) {
                map[tr][tc] = EMPTY;
                if (b.powerful) {
                    const ns = [[tr - 1, tc], [tr + 1, tc], [tr, tc - 1], [tr, tc + 1]];
                    for (const [nr, nc] of ns) {
                        if (nr > 0 && nr < ROWS - 1 && nc > 0 && nc < COLS - 1 && (map[nr][nc] === BRICK || map[nr][nc] === STEEL)) map[nr][nc] = EMPTY;
                    }
                    if (Math.random() < 0.5) spawnPowerUp(b.x, b.y);
                } else {
                    if (Math.random() < 0.15) spawnPowerUp(b.x, b.y);
                }
                b.alive = false; continue;
            } else if (t === STEEL) {
                if (b.owner && b.owner.canBreakSteel) map[tr][tc] = EMPTY;
                b.alive = false; continue;
            } else if (t === BASE) {
                baseAlive = false;
                b.alive = false;
                triggerGameOver(false);
                continue;
            }
        }

        const players = [p1, p2].filter(t => t && t.alive);
        for (const pl of players) {
            if (b.owner === pl) continue;
            if (Math.abs(b.x - pl.x) < pl.size && Math.abs(b.y - pl.y) < pl.size) {
                if (pl.spawnInvincible > 0 || pl.shield) { b.alive = false; break; }
                b.alive = false;
                pl.lives--;
                if (pl.lives <= 0) {
                    pl.alive = false;
                    pl.powerups = {};
                    if (twoPlayer) {
                        const other = pl === p1 ? p2 : p1;
                        if (other && other.alive && other.lives > 1 && pl === p1) {
                            reviveAvailable = true;
                            reviveTimer = 600;
                            document.getElementById('reviveMsg').style.display = 'block';
                        }
                    }
                    checkGameOver();
                } else {
                    if (pl === p1) { pl.x = TILE * 7.5; pl.y = TILE * 18.5; }
                    else { pl.x = TILE * 12.5; pl.y = TILE * 18.5; }
                    pl.spawnInvincible = 180;
                    pl.shield = false;
                    pl.powerups = {};
                    pl.speed = 1.1;
                    pl.canBreakSteel = false;
                }
                updateSidebar();
                break;
            }
        }

        if (b.owner === p1 || b.owner === p2) {
            for (const e of enemies) {
                if (!e.alive) continue;
                if (Math.abs(b.x - e.x) < e.size && Math.abs(b.y - e.y) < e.size) {
                    b.alive = false;
                    e.alive = false;
                    score += e.type === 'attacker' ? 300 : e.type === 'defender' ? 200 : 150;
                    enemiesKilled++;
                    if (Math.random() < 0.3) spawnPowerUp(e.x, e.y);
                    if (enemiesKilled >= TOTAL_ENEMIES) triggerGameOver(true);
                    updateSidebar();
                    break;
                }
            }
        }
    }
    bullets = bullets.filter(b => b.alive);
}

// ── Power-ups ────────────────────────────────
function spawnPowerUp(x, y) {
    const type = PU_TYPES[Math.floor(Math.random() * PU_TYPES.length)];
    const tc = Math.floor(x / TILE), tr = Math.floor(y / TILE);
    let sx = x, sy = y;
    for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) {
        const r = tr + dr, c = tc + dc;
        if (r > 1 && r < ROWS - 2 && c > 1 && c < COLS - 2 && map[r][c] === EMPTY) {
            sx = (c + 0.5) * TILE; sy = (r + 0.5) * TILE; break;
        }
    }
    powerups.push(new PowerUp(sx, sy, type));
}

function updatePowerUps() {
    for (const pu of powerups) {
        if (!pu.alive) continue;
        pu.timer--;
        pu.blink++;
        if (pu.timer <= 0) { pu.alive = false; continue; }
        const players = [p1, p2].filter(t => t && t.alive);
        for (const pl of players) {
            if (Math.abs(pu.x - pl.x) < TILE && Math.abs(pu.y - pl.y) < TILE) {
                applyPowerUp(pl, pu.type);
                pu.alive = false;
                break;
            }
        }
    }
    powerups = powerups.filter(p => p.alive);
}

function applyPowerUp(tank, type) {
    if (type === 'speed') {
        tank.speed = 3.2; tank.powerups.speed = true; tank.powerups.speedTimer = 600;
    } else if (type === 'shield') {
        tank.shield = true; tank.shieldTimer = 400;
    } else if (type === 'rapid') {
        tank.powerups.rapid = true; tank.powerups.rapidTimer = 600;
    } else if (type === 'powerful') {
        tank.powerups.powerful = true; tank.canBreakSteel = true; tank.powerups.powerfulTimer = 600;
    } else if (type === 'life') {
        tank.lives = Math.min(tank.lives + 1, 5);
    }
    updateSidebar();
}

// ── Game Over ────────────────────────────────
function checkGameOver() {
    if (!p1.alive) {
        if (!twoPlayer) { triggerGameOver(false); return; }
        if (!p2 || !p2.alive) { triggerGameOver(false); return; }
    }
    if (twoPlayer && p2 && !p2.alive && !p1.alive) { triggerGameOver(false); }
}

function triggerGameOver(won) {
    gameOver = true; gameWon = won;
    setTimeout(() => showEndScreen(won), 800);
}

function showEndScreen(won) {
    const ov = document.getElementById('overlay');
    ov.innerHTML = '';
    const h = document.createElement('h1');
    h.style.color = won ? '#40f080' : '#f04040';
    h.textContent = won ? '¡VICTORIA!' : 'GAME OVER';
    ov.appendChild(h);
    const p = document.createElement('p');
    p.textContent = `Puntuación: ${score}`;
    p.style.fontSize = '20px'; p.style.marginBottom = '12px';
    ov.appendChild(p);
    const p2txt = document.createElement('p');
    if (won) {
        p2txt.textContent = '¡Destruiste todos los tanques enemigos!';
        p2txt.style.color = '#40f080';
    } else {
        p2txt.textContent = !baseAlive ? 'Tu base fue destruida.' : 'Todos los jugadores fueron eliminados.';
        p2txt.style.color = '#f08080';
    }
    ov.appendChild(p2txt);
    const btn = document.createElement('button');
    btn.className = 'btn'; btn.textContent = '↩ REINTENTAR';
    btn.onclick = () => { ov.style.display = 'flex'; resetMenu(); };
    ov.appendChild(btn);
    ov.style.display = 'flex';
}

function resetMenu() {
    const ov = document.getElementById('overlay');
    ov.innerHTML = `
    <h1>TANK BATTLE</h1>
    <p>Destruye los 6 tanques enemigos para ganar</p>
    <p>Protege tu base (la bandera en el centro inferior)</p>
    <br>
    <p><b>J1:</b> WASD para mover | ESPACIO para disparar</p>
    <p><b>J2:</b> Flechas para mover | Click izq para disparar</p>
    <br>
    <p>🟡 Más velocidad &nbsp; 🔵 Escudo &nbsp; 🔴 Disparo rápido</p>
    <p>⚪ Disparo potente &nbsp; 💚 Vida extra</p>
    <button class="btn" id="btnStart1">▶ 1 JUGADOR</button>
    <button class="btn p2btn" id="btnStart2">▶▶ 2 JUGADORES</button>
  `;
    document.getElementById('btnStart1').onclick = () => { ov.style.display = 'none'; initGame(false); };
    document.getElementById('btnStart2').onclick = () => { ov.style.display = 'none'; initGame(true); };
}

// ── Sidebar ──────────────────────────────────
function updateSidebar() {
    document.getElementById('scoreDisplay').textContent = score;

    const lp1 = document.getElementById('livesP1');
    lp1.innerHTML = '';
    if (p1) for (let i = 0; i < p1.lives; i++) { const d = document.createElement('div'); d.className = 'life-icon'; lp1.appendChild(d); }

    if (twoPlayer && p2) {
        const lp2 = document.getElementById('livesP2');
        lp2.innerHTML = '';
        for (let i = 0; i < p2.lives; i++) { const d = document.createElement('div'); d.className = 'life-icon p2'; lp2.appendChild(d); }
    }

    const el = document.getElementById('enemiesLeft');
    el.innerHTML = '';
    for (let i = 0; i < TOTAL_ENEMIES - enemiesKilled; i++) { const d = document.createElement('div'); d.className = 'enemy-icon'; el.appendChild(d); }

    const pu = document.getElementById('powerupDisplay');
    pu.innerHTML = '';
    const pus = [];
    if (p1) Object.keys(p1.powerups || {}).filter(k => !k.endsWith('Timer')).forEach(k => pus.push('J1:' + PU_LABELS[k]));
    if (p2) Object.keys(p2.powerups || {}).filter(k => !k.endsWith('Timer')).forEach(k => pus.push('J2:' + PU_LABELS[k]));
    if (p1 && p1.shield) pus.push('J1:ESC');
    if (p2 && p2.shield) pus.push('J2:ESC');
    [...new Set(pus)].forEach(label => {
        const s = document.createElement('span'); s.className = 'pu-badge'; s.textContent = label; pu.appendChild(s);
    });
}

// ── Dibujo ───────────────────────────────────
function drawTile(tc, tr, type) {
    const x = tc * TILE, y = tr * TILE;
    if (type === BRICK) {
        ctx.fillStyle = '#8B4513';
        ctx.fillRect(x, y, TILE, TILE);
        ctx.fillStyle = '#A0522D';
        for (let by = 0; by < TILE; by += 4) for (let bx = 0; bx < TILE; bx += 8) {
            ctx.fillRect(x + bx + (by % 8 ? 0 : 4), y + by, 6, 3);
        }
    } else if (type === STEEL) {
        ctx.fillStyle = '#888';
        ctx.fillRect(x, y, TILE, TILE);
        ctx.fillStyle = '#aaa';
        ctx.fillRect(x + 2, y + 2, TILE - 4, TILE - 4);
        ctx.fillStyle = '#666';
        ctx.fillRect(x, y, TILE, 2); ctx.fillRect(x, y, 2, TILE);
    } else if (type === WATER) {
        ctx.fillStyle = '#1a5f8a';
        ctx.fillRect(x, y, TILE, TILE);
        ctx.fillStyle = '#2a7fbf';
        for (let wy = 2; wy < TILE; wy += 6) ctx.fillRect(x + 2, y + wy, TILE - 4, 3);
    } else if (type === BUSH) {
        ctx.fillStyle = '#2d6a2d';
        ctx.fillRect(x, y, TILE, TILE);
        ctx.fillStyle = '#3a8a3a';
        for (let i = 0; i < 6; i++) {
            ctx.beginPath();
            ctx.arc(x + TILE * 0.3 + Math.sin(i * 2.1) * TILE * 0.2, y + TILE * 0.3 + Math.cos(i * 1.7) * TILE * 0.2, TILE * 0.15, 0, Math.PI * 2);
            ctx.fill();
        }
    } else if (type === BASE) {
        ctx.fillStyle = '#c8c800';
        ctx.fillRect(x, y, TILE, TILE);
        ctx.fillStyle = '#ffff00';
        ctx.fillRect(x + TILE / 2 - 1, y + 2, 2, TILE - 8);
        ctx.fillStyle = '#ff4444';
        ctx.fillRect(x + TILE / 2 + 1, y + 4, 8, 6);
    }
}

function drawTank(t) {
    if (!t || !t.alive) return;
    ctx.save();
    ctx.translate(t.x, t.y);
    ctx.rotate(t.dir * Math.PI / 2);

    const c = t.color;
    const s = t.size;
    const half = s / 2;

    ctx.fillStyle = c;
    ctx.fillRect(-half + 2, -half + 2, s - 4, s - 4);

    ctx.fillStyle = darken(c, 0.6);
    ctx.fillRect(-half, -half + 2, 4, s - 4);
    ctx.fillRect(half - 4, -half + 2, 4, s - 4);

    ctx.fillStyle = darken(c, 0.8);
    for (let i = 0; i < 3; i++) {
        ctx.fillRect(-half, -half + 4 + i * 5, 4, 3);
        ctx.fillRect(half - 4, -half + 4 + i * 5, 4, 3);
    }

    ctx.fillStyle = darken(c, 0.85);
    ctx.beginPath();
    ctx.arc(0, 0, half * 0.55, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = darken(c, 0.7);
    ctx.fillRect(-2, -half - 4, 4, half + 4);

    ctx.restore();

    if (t.shield || t.spawnInvincible > 0) {
        if (Math.floor(Date.now() / 100) % 2 === 0) {
            ctx.strokeStyle = t.shield ? '#40a0ff' : '#ffffff';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(t.x, t.y, t.size, 0, Math.PI * 2);
            ctx.stroke();
        }
    }

    if (t.type === 'fast') {
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 8px Courier New';
        ctx.textAlign = 'center';
        ctx.fillText('F', t.x, t.y + 3);
    } else if (t.type === 'attacker') {
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 8px Courier New';
        ctx.textAlign = 'center';
        ctx.fillText('A', t.x, t.y + 3);
    }
}

function darken(hex, factor) {
    let r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
    if (isNaN(r)) {
        const tmp = document.createElement('canvas').getContext('2d');
        tmp.fillStyle = hex; tmp.fillRect(0, 0, 1, 1);
        const d = tmp.getImageData(0, 0, 1, 1).data;
        r = d[0]; g = d[1]; b = d[2];
    }
    return `rgb(${Math.floor(r * factor)},${Math.floor(g * factor)},${Math.floor(b * factor)})`;
}

function drawBullet(b) {
    ctx.fillStyle = b.owner === p1 ? '#ffff00' : b.owner === p2 ? '#aaddff' : b.powerful ? '#ff8800' : '#ff4444';
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.powerful ? 5 : 3, 0, Math.PI * 2);
    ctx.fill();
    if (b.powerful) {
        ctx.strokeStyle = '#ffaa00';
        ctx.lineWidth = 1.5;
        ctx.stroke();
    }
}

function drawPowerUp(pu) {
    if (!pu.alive) return;
    if (pu.timer < 120 && Math.floor(pu.blink / 5) % 2 === 0) return;
    const c = PU_COLORS[pu.type];
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.arc(pu.x, pu.y, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#000';
    ctx.font = 'bold 8px Courier New';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(PU_LABELS[pu.type].slice(0, 1), pu.x, pu.y);
}

function draw() {
    ctx.fillStyle = '#111122';
    ctx.fillRect(0, 0, W, H);

    // Pantalla de espera mientras no hay mapa iniciado
    if (!map) {
        ctx.fillStyle = '#f0c040';
        ctx.font = 'bold 32px Courier New';
        ctx.textAlign = 'center';
        ctx.fillText('TANK BATTLE', W / 2, H / 2 - 20);
        ctx.fillStyle = '#888';
        ctx.font = '14px Courier New';
        ctx.fillText('Pulsa un botón para empezar', W / 2, H / 2 + 20);
        return;
    }

    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
        const t = map[r][c];
        if (t !== EMPTY && t !== BUSH) drawTile(c, r, t);
    }

    powerups.forEach(drawPowerUp);
    bullets.forEach(drawBullet);

    enemies.forEach(drawTank);
    if (p1 && p1.alive) drawTank(p1);
    if (p2 && p2.alive) drawTank(p2);

    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
        if (map[r][c] === BUSH) drawTile(c, r, BUSH);
    }

    if (gameOver) {
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(0, 0, W, H);
        ctx.font = 'bold 48px Courier New';
        ctx.textAlign = 'center';
        ctx.fillStyle = gameWon ? '#40f080' : '#f04040';
        ctx.fillText(gameWon ? 'VICTORIA!' : 'GAME OVER', W / 2, H / 2);
    }
}

// ── Bucle principal ──────────────────────────
function update() {
    if (gameState !== 'playing' || gameOver) return;
    processPlayerInput();
    if (twoPlayer) processP2Input();
    enemies.forEach(updateEnemyAI);
    updateBullets();
    updatePowerUps();

    if (reviveAvailable) {
        reviveTimer--;
        if (reviveTimer <= 0) {
            reviveAvailable = false;
            document.getElementById('reviveMsg').style.display = 'none';
        }
    }
}

let lastSidebarUpdate = 0;
function gameLoop() {
    update();
    draw();
    lastSidebarUpdate++;
    if (lastSidebarUpdate > 30) { updateSidebar(); lastSidebarUpdate = 0; }
    requestAnimationFrame(gameLoop);
}

// ── Botones de inicio ────────────────────────
document.getElementById('btnStart1').onclick = () => {
    document.getElementById('overlay').style.display = 'none';
    initGame(false);
};
document.getElementById('btnStart2').onclick = () => {
    document.getElementById('overlay').style.display = 'none';
    initGame(true);
};

// Arrancar el loop
gameLoop();
