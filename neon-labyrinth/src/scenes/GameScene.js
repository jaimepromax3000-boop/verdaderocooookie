/**
 * GameScene: orquestador del bucle principal. Gestiona la mazmorra (plantas, salas y puertas), el jugador,
 * los enemigos, los proyectiles (ObjectPool), las zonas de fuego, las recompensas, la tienda y el fin de la partida.
 * La interfaz vive en UIScene (otra escena en paralelo) y se comunica por el EventBus.
 */
/** Tablas de aparición por tramos de profundidad (más variedad y más peligro cuanto más abajo). */
const SPAWN_TABLES = [
  { grunt: 40, shooter: 30, bomber: 12, splitter: 10, turret: 8 },
  { grunt: 20, shooter: 16, summoner: 8, sniper: 10, bomber: 9, splitter: 9, tank: 7, blinker: 9, dasher: 8, shielder: 6 },
  { grunt: 10, shooter: 12, summoner: 9, sniper: 10, bomber: 8, splitter: 8, tank: 11, blinker: 10, turret: 5, dasher: 8, shielder: 9, mortar: 8, healer: 6, spinner: 6 },
  { grunt: 6, shooter: 9, summoner: 8, sniper: 10, bomber: 7, splitter: 7, tank: 12, blinker: 10, turret: 5, dasher: 8, shielder: 11, mortar: 10, healer: 8, spinner: 9 },
  { grunt: 4, shooter: 8, summoner: 8, sniper: 10, bomber: 6, splitter: 6, tank: 13, blinker: 10, turret: 5, dasher: 8, shielder: 12, mortar: 12, healer: 9, spinner: 11 },
];
const SPAWN_COST = { grunt: 1, shooter: 1, bomber: 0.8, splitter: 1.4, turret: 1.5, summoner: 2, sniper: 1.6, tank: 3, blinker: 1.6, dasher: 1.3, shielder: 2.4, mortar: 2, healer: 1.8, spinner: 2.2 };
const spawnTier = f => (f <= 2 ? 0 : f <= 5 ? 1 : f <= 12 ? 2 : f <= 20 ? 3 : 4);
const ELITE_TYPES = ['grunt', 'shooter', 'tank', 'sniper', 'splitter', 'blinker', 'dasher', 'shielder'];

class GameScene extends Phaser.Scene {
  constructor() { super('GameScene'); }

  init(data) {
    this.charId = (data && data.character) || 'hacker';
    this.seedBase = (data && data.seed) || ((Math.random() * 1e9) | 0);
    this.autoFire = !!(data && data.autoFire);
    this.skinId = (data && data.skin) || Meta.data.skin;
    const di = data && data.difficulty !== undefined ? data.difficulty : Meta.data.difficulty;
    this.diff = DIFFICULTIES[Math.max(0, Math.min(2, di === undefined ? 1 : di))];
  }

  create() {
    const { W, H, OX, OY, RW, RH, T } = CFG;
    this.rng = makeRng(this.seedBase ^ 0x9e3779b9);
    this.floor = 1;
    this.roomsCleared = 0;
    this.bossesKilled = 0;
    this.paused = false;
    this.inputLocked = false;
    this.runOver = false;
    this.weaponChosen = false;
    this.enemies = [];
    this.items = [];
    this.fires = [];
    this.blocked = new Uint8Array(RW * RH);
    this.sealed = false;
    this.lockedDoors = {};
    this.doorSprites = [];

    this.cameras.main.setBackgroundColor(0x03040c);
    this.bgGrid = this.add.tileSprite(0, 0, W, H, 'bg_grid').setOrigin(0).setDepth(-5).setAlpha(0.5);
    this.rt = this.add.renderTexture(OX, OY, RW * T, RH * T).setOrigin(0, 0).setDepth(0);
    this.overGfx = this.add.graphics().setDepth(31);               // barras de vida y avisos láser
    this.hazards = []; this.barrels = []; this.mines = []; this.hazT = 0; this.novaKills = 0;
    if (this.renderer.type === Phaser.WEBGL && !/[?&]nofx/.test(location.search)) {   // brillo y viñeta (solo WebGL)
      try {
        const cam = this.cameras.main;
        cam.postFX.addBloom(0xffffff, 1, 1, 1.1, 1.05, 4);
        cam.postFX.addVignette(0.5, 0.5, 0.92, 0.3);
      } catch (e) { /* sin postFX */ }
    }
    this.doorLayer = this.add.layer().setDepth(2);
    this.fxGfx = this.add.graphics().setDepth(30);

    // pools: proyectiles y partículas
    this.bulletPool = new ObjectPool(() => new Projectile(this), 80);
    this.sparkPool = new ObjectPool(() => {
      const s = this.add.image(0, 0, 'spark').setBlendMode(Phaser.BlendModes.ADD).setDepth(25);
      s.setActive(false).setVisible(false); return s;
    }, 120);
    this.particles = [];

    const ch = CHARACTERS.find(c => c.id === this.charId);
    this.player = new Player(this, W / 2, OY + (RH * T) / 2, ch, 'pulse', this.skinId);
    this.runKills = 0; this.creditsEarned = 0; this.upgradesPicked = 0; this.choosing = false; this.chestOpen = false;
    this.hookOffs = Modules.install(this);
    this.busOffs = [
      Bus.on('player:dead', () => this.endRun(false)),
      Bus.on('player:hit', e => { this.cameras.main.shake(e.crit ? 220 : 110, e.crit ? 0.008 : 0.004); this.sfx('hurt'); }),
      Bus.on('enemy:killed', e => this.onEnemyKilled(e.enemy)),
      Bus.on('enemy:killed', e => { this.runKills++; Meta.data.totals.kills++; Missions.track('kill', 1, { type: e.enemy.type, elite: !!e.enemy.elite }); }),
      Bus.on('room:clear', () => { Meta.data.totals.rooms++; Missions.track('room'); }),
      Bus.on('player:ability', () => Missions.track('ability')),
    ];

    this.keyE = this.input.keyboard.addKey('E');
    this.keyEsc = this.input.keyboard.addKey('ESC');
    this.travelling = false; this.slowmo = 1;
    this.touch = { mx: 0, my: 0, ax: 0, ay: 0, dash: false, ability: false, interact: false, pause: false, map: false };   // controles táctiles
    this.input.mouse && this.input.mouse.disableContextMenu();

    this.scene.launch('UIScene', { game: this });
    this.events.once('shutdown', () => this.cleanup());

    this.newFloor(1);

    // ganchos de depuración/pruebas
    window.__nl = this;
  }

  cleanup() {
    if (this.hookOffs) this.hookOffs.forEach(f => f());
    if (this.busOffs) this.busOffs.forEach(f => f());
    this.scene.stop('UIScene');
    if (window.__nl === this) window.__nl = null;
  }

  // ===================================================================================
  //  Plantas y salas
  // ===================================================================================
  newFloor(n) {
    this.floor = n;
    this.theme = n >= CFG.FLOORS ? THEMES[THEMES.length - 1] : THEMES[(n - 1) % (THEMES.length - 1)];
    this.cameras.main.setBackgroundColor(this.theme.bg);
    this.bgGrid.setTint(this.theme.edge);
    const gen = new DungeonGenerator(this.seedBase + n * 977);
    this.dungeon = gen.generate(n);
    this.lockedDoors = {};
    // la puerta de la sala vecina hacia el tesoro se cierra con llave
    const tr = this.dungeon.treasure;
    if (tr) for (const [name, d] of Object.entries(DIRS)) {
      if (!tr.doors[name]) continue;
      const nb = this.dungeon.get(tr.gx + d.dx, tr.gy + d.dy);
      if (nb) this.lockedDoors[DungeonGenerator.key(nb.gx, nb.gy) + ':' + d.opp] = true;
    }
    Missions.track('floor', n);
    Bus.emit('floor:new', { floor: n, dungeon: this.dungeon, theme: this.theme });
    this.enterRoom(this.dungeon.start, null);
  }

  /** Entra en una sala: dibuja el plano, restaura objetos y, si hay enemigos, sella las puertas. */
  enterRoom(room, fromDir) {
    this.saveRoomItems();
    this.clearTransient();
    this.room = room;
    room.visited = true;
    this.markDiscovered(room);
    this.rebuildBlocked();
    this.drawRoom();

    // posición del jugador al entrar
    if (fromDir) {
      const d = DIRS[fromDir];            // vienes de la dirección opuesta: apareces junto a la puerta
      const c = this.roomCenter();
      this.player.x = c.x - d.dx * ((CFG.RW / 2 - 2.2) * CFG.T);
      this.player.y = c.y - d.dy * ((CFG.RH / 2 - 2.2) * CFG.T);
    } else {
      const c = this.roomCenter();
      this.player.x = c.x; this.player.y = c.y + 60;
    }

    // contenido de la sala
    if (room.items) {
      for (const it of room.items) this.addItem(it.kind, it.x, it.y, it.data);
      room.items = null;
    } else if (!room.contentDone) {
      room.contentDone = true;
      this.populateRoom(room);
    }
    this.sealed = this.enemies.some(e => !e.dead);
    this.rebuildBlocked();
    this.drawDoors();
    this.buildExtras(room);
    if (room.type === 'boss' && !room.cleared) Bus.emit('boss:intro', { name: BOSS_INFO[bossKindFor(this.floor)].name + bossSuffix(this.floor) });
    Bus.emit('room:enter', { room });
  }

  roomCenter() { return { x: CFG.OX + (CFG.RW * CFG.T) / 2, y: CFG.OY + (CFG.RH * CFG.T) / 2 }; }

  markDiscovered(room) {
    room.discovered = true;
    for (const [name, d] of Object.entries(DIRS)) {
      if (!room.doors[name]) continue;
      const nb = this.dungeon.get(room.gx + d.dx, room.gy + d.dy);
      if (nb && nb.type !== 'treasure') nb.discovered = true;     // el tesoro sigue oculto hasta abrirlo
    }
  }

  populateRoom(room) {
    const f = this.floor, rng = this.rng;
    const c = this.roomCenter();
    switch (room.type) {
      case 'start':
        if (this.floor === 1 && !this.weaponChosen) {
          ['pulse', 'scatter', 'rail'].forEach((id, i) => this.addItem('weapon', c.x + (i - 1) * 110, c.y - 20, { id }));
        }
        break;
      case 'shop': {
        const mods = Modules.roll(rng, this.player, 2);
        const stock = [['heart', {}, 12], ['key', {}, 18]];
        mods.forEach(id => stock.push(['module', { id }, 25 + rng.int(0, 15)]));
        stock.forEach((s, i) => this.addItem(s[0], c.x + (i - (stock.length - 1) / 2) * 150, c.y, Object.assign({ price: s[2] }, s[1])));
        break;
      }
      case 'treasure': {
        const mods = Modules.roll(rng, this.player, 2);
        mods.forEach((id, i) => this.addItem('module', c.x + (i - 0.5) * 120, c.y, { id, group: 'treasure' }));
        break;
      }
      case 'boss':
        this.spawnEnemy('boss', c.x, c.y - 40);
        break;
      default: {
        // cada sala de combate nueva tiene UN enemigo más que la anterior (cuenta las ya limpiadas en esta planta)
        const k = this.dungeon.list.filter(r => r.type === 'combat' && r.cleared).length;
        const N = Math.max(3, Math.min(32, Math.round((3 + Math.floor(f / 3) + k) * this.diff.count)));
        room.totalEnemies = N;
        room.wavesTotal = N > 26 ? 3 : N > 12 ? 2 : 1;                              // las salas con muchos enemigos se reparten en oleadas
        room.wave = 1;
        room.waveCounts = room.wavesTotal === 3 ? [Math.round(N * 0.4), Math.round(N * 0.35)] : room.wavesTotal === 2 ? [Math.ceil(N * 0.55)] : [];
        room.waveCounts.push(N - room.waveCounts.reduce((a, b) => a + b, 0));
        this.spawnWave(room, 1);
      }
    }
  }

  /** Genera una oleada de la sala con un presupuesto de "coste" y una tabla de pesos por planta. */
  spawnWave(room, wave) {
    const f = this.floor, rng = this.rng;
    const COST = SPAWN_COST, W = SPAWN_TABLES[spawnTier(f)];
    const total = Object.values(W).reduce((a, b) => a + b, 0);
    const target = room.waveCounts[wave - 1];
    let n = 0, healers = 0;
    let eliteLeft = (wave === 1 ? 1 : (f >= 6 ? 1 : 0)) + (f >= 10 ? 1 : 0) + (f >= 18 ? 1 : 0);     // más élites por sala cuanto más profundo
    while (n < target) {
      let r = rng() * total, type = 'grunt';
      for (const [k, w] of Object.entries(W)) { if ((r -= w) <= 0) { type = k; break; } }
      if (type === 'healer' && healers >= 2) type = 'grunt';
      if (type === 'healer') healers++;
      n++;
      const p = this.randomFreePoint(14, type === 'turret' ? 110 : 150);
      let elite = null;
      if (eliteLeft > 0 && room.dist >= 2 && ELITE_TYPES.includes(type) && rng() < Math.min(0.6, 0.1 + 0.04 * (f - 1)) * this.diff.elite) {
        elite = rng.pick(['fast', 'volatile', 'armored']); eliteLeft--;
      }
      this.spawnEnemy(type, p.x, p.y, false, elite);
    }
    if (wave > 1) Bus.emit('wave:start', { wave, total: room.wavesTotal });
  }

  spawnEnemy(type, x, y, minion = false, elite = null) {
    const f = this.floor;
    const scale = (type === 'boss' ? depthBossHp(f) : depthHp(f)) * this.diff.hp;
    let variant = null;
    if (type === 'shooter' && f >= 2) variant = this.rng() < 0.5 ? 'cryo' : (f >= 3 ? 'toxic' : null);
    const e = new Enemy(this, x, y, type, scale, variant, elite);
    e.minion = minion;
    this.enemies.push(e);
    if (minion) this.spawnBurst(x, y, 0xffe94d, 6);
    return e;
  }

  onEnemyKilled(e) {
    this.enemies = this.enemies.filter(x => x !== e);
    if (!this.room) return;
    // créditos sueltos con cierta probabilidad
    if (!e.minion && this.rng() < 0.4 + 0.1 * this.player.luck) this.addItem('coin', e.x, e.y, {});
    if (e.elite && !e.minion) {                                 // los élites sueltan botín extra (y, con poca probabilidad, un corazón o una llave)
      for (let i = 0; i < 3; i++) this.addItem('coin', e.x + (this.rng() - 0.5) * 40, e.y + (this.rng() - 0.5) * 40, {});
      if (this.rng() < 0.18 + 0.04 * this.player.luck) this.addItem(this.rng() < 0.55 ? 'heart' : 'key', e.x, e.y, {});
      this.floatText(e.x, e.y - 24, 'ÉLITE ELIMINADO', ELITE_AFFIX[e.elite].color);
    }
    if (this.sealed && !this.enemies.some(x => !x.dead)) {
      const room = this.room;
      if (room.wavesTotal > 1 && room.wave < room.wavesTotal) {      // siguiente oleada
        room.wave++;
        this.time.delayedCall(900, () => { if (this.room === room && !this.runOver) this.spawnWave(room, room.wave); });
      } else this.clearRoom();
    }
  }

  clearRoom() {
    const room = this.room;
    this.sealed = false;
    room.cleared = true;
    this.roomsCleared++;
    this.rebuildBlocked();
    this.drawDoors();
    this.sfx('open');
    if (room.type === 'combat' && this.bossUnlocked()) Bus.emit('boss:unlocked', {});
    this.clearHazards();
    const c = this.roomCenter();
    if (room.type === 'boss') {
      this.bossesKilled++;
      Meta.data.totals.bosses++; Missions.track('boss');
      const tier = Math.max(1, Math.min(3, Math.ceil(this.floor / 8) + this.diff.chest));       // calidad del cofre: jefe + dificultad
      this.dropBossLoot((this.bossDeathPos || c).x, (this.bossDeathPos || c).y, tier);
      this.floatText(c.x, c.y - 60, 'SERVIDOR PURGADO', 0x00f0ff);
      this.cameras.main.flash(300, 0, 240, 255);
    } else {
      this.dropReward(c.x, c.y);
    }
    Bus.emit('room:clear', { room });
    if (room.type === 'combat' || room.type === 'boss') this.time.delayedCall(room.type === 'boss' ? 2600 : 650, () => this.offerUpgrades());   // en el jefe, primero se ve caer el generador
  }

  /** Recompensa visible al limpiar una sala: créditos, salud, llave o módulo de software. */
  dropReward(x, y) {
    const rng = this.rng, luck = this.player.luck;
    const r = rng() * 100;
    this.spawnBurst(x, y, 0x00f0ff, 18);
    if (r < 30) {
      this.addItem('heart', x, y, {});
    } else if (r < 42 + 3 * luck) {
      this.addItem('key', x, y, {});
    } else {
      const n = rng.int(3, 6) + luck;
      for (let i = 0; i < n; i++) this.addItem('coin', x + (rng() - 0.5) * 70, y + (rng() - 0.5) * 50, {});
    }
  }

  // ===================================================================================
  //  Rejilla, puertas y colisiones
  // ===================================================================================
  rebuildBlocked() {
    const { RW, RH } = CFG, room = this.room;
    this.blocked.set(room.layout);
    for (const [name, open] of Object.entries(room.doors)) {
      if (!open) continue;
      const locked = !!this.lockedDoors[DungeonGenerator.key(room.gx, room.gy) + ':' + name];
      if (this.sealed || locked || this.doorToBoss(room, name)) for (const [x, y] of DOOR_TILES[name]) this.blocked[y * RW + x] = 1;
    }
  }

  drawRoom() {
    const { RW, RH, T } = CFG;
    const th = this.theme, ti = THEMES.indexOf(th), room = this.room, L = room.layout;
    const rng = makeRng((this.seedBase * 31 + room.gx * 97 + room.gy * 13 + this.floor) >>> 0);
    this.rt.clear();
    this.rt.beginDraw();
    for (let y = 0; y < RH; y++) for (let x = 0; x < RW; x++) {
      const v = L[y * RW + x];
      if (v === 1) this.rt.batchDraw('tile_wall_' + ti, x * T, y * T);
      else if (v === 2) this.rt.batchDraw('tile_obs_' + ti, x * T, y * T);
      else { const r = rng(); this.rt.batchDraw('tile_floor_' + ti + '_' + (r < 0.6 ? 0 : r < 0.78 ? 1 : r < 0.9 ? 2 : 3), x * T, y * T); }
    }
    const cx = (RW * T) / 2, cy = (RH * T) / 2;                  // símbolo del suelo según el tipo de sala
    const sig = { boss: 'sigil_boss', shop: 'sigil_shop', treasure: 'sigil_treasure', start: 'sigil_' + ti }[room.type];
    if (sig) this.rt.batchDraw(sig, cx - 144, cy - 144, 0.9);
    for (let i = 0; i < 16; i++) {                               // decoración: cables, grietas y nodos
      const x = rng.int(1, RW - 2), y = rng.int(1, RH - 2);
      if (L[y * RW + x] === 0) this.rt.batchDraw('decal_' + ti + '_' + rng.int(0, 3), x * T, y * T, 0.7);
    }
    this.rt.endDraw();
    // resplandor de neón en el borde de paredes y obstáculos
    const g = this.make.graphics({ add: false });
    const at = (x, y) => (x < 0 || y < 0 || x >= RW || y >= RH) ? 1 : L[y * RW + x];
    for (let y = 0; y < RH; y++) for (let x = 0; x < RW; x++) {
      const v = L[y * RW + x];
      if (!v) continue;
      const col = v === 2 ? th.obsEdge : th.edge2;
      for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
        if (at(x + dx, y + dy)) continue;
        const x0 = x * T + (dx === 1 ? T : 0), y0 = y * T + (dy === 1 ? T : 0);
        const x1 = dx ? x0 : x0 + T, y1 = dy ? y0 : y0 + T;
        g.lineStyle(7, col, 0.12); g.lineBetween(x0, y0, x1, y1);
        g.lineStyle(2, col, 0.9); g.lineBetween(x0, y0, x1, y1);
      }
    }
    this.rt.draw(g, 0, 0);
    g.destroy();
  }

  drawDoors() {
    this.doorSprites.forEach(s => s.destroy());
    this.doorSprites = [];
    const { RW, T, OX, OY } = CFG, room = this.room;
    for (const [name, open] of Object.entries(room.doors)) {
      if (!open) continue;
      const locked = !!this.lockedDoors[DungeonGenerator.key(room.gx, room.gy) + ':' + name];
      const bossDoor = this.doorToBoss(room, name);
      if (!(this.sealed || locked || bossDoor)) continue;
      for (const [x, y] of DOOR_TILES[name]) {
        const s = this.add.image(OX + x * T + T / 2, OY + y * T + T / 2, locked ? 'door_locked' : bossDoor ? 'door_boss' : 'door_closed').setDepth(2);
        if (bossDoor) this.tweens.add({ targets: s, alpha: 0.55, duration: 500, yoyo: true, repeat: -1, delay: (x + y) * 60 });
        this.doorLayer.add(s);
        this.doorSprites.push(s);
      }
    }
  }

  /** La puerta del jefe se abre cuando todas las salas de combate de la planta están limpias. */
  bossUnlocked() { return this.dungeon.list.every(r => r.type !== 'combat' || r.cleared); }

  combatProgress() { const l = this.dungeon.list.filter(r => r.type === 'combat'); return { done: l.filter(r => r.cleared).length, total: l.length }; }

  doorToBoss(room, name) {
    const d = DIRS[name], nb = this.dungeon.get(room.gx + d.dx, room.gy + d.dy);
    return !!(nb && nb.type === 'boss' && !this.bossUnlocked());
  }

  /** Velocidad a la que los enemigos recargan sus ataques: aumenta con la profundidad. */
  attackRate() { return Math.min(1.7, 1 + 0.022 * (this.floor - 1)); }

  /** El jefe llama refuerzos: 2·N élites y 3+N enemigos normales (N = planta), con un tope. */
  bossHorde(boss, frac = 1) {
    const f = this.floor, rng = this.rng;
    const nElite = Math.max(1, Math.round(Math.min(14, 2 * f) * frac)), nNorm = Math.max(2, Math.round(Math.min(16, 3 + f) * frac));
    const W = Object.entries(SPAWN_TABLES[spawnTier(f)]).filter(([k]) => k !== 'turret' && k !== 'healer');
    const total = W.reduce((a, b) => a + b[1], 0);
    Bus.emit('boss:horde', { elites: nElite, normals: nNorm });
    this.cameras.main.shake(280, 0.008); this.sfx('boom');
    const spawn = (type, elite, i) => this.time.delayedCall(i * 75, () => {
      if (this.runOver || this.room.type !== 'boss' || this.enemies.filter(e => !e.dead).length > 38) return;
      const p = this.randomFreePoint(14, 90);
      this.ringFx(p.x, p.y, elite ? 54 : 36, elite ? ELITE_AFFIX[elite].color : 0xffe94d);
      this.spawnBurst(p.x, p.y, elite ? ELITE_AFFIX[elite].color : 0xffe94d, 10);
      this.spawnEnemy(type, p.x, p.y, true, elite);
    });
    let i = 0;
    for (let k = 0; k < nElite; k++) spawn(rng.pick(ELITE_TYPES), rng.pick(['fast', 'volatile', 'armored']), i++);
    for (let k = 0; k < nNorm; k++) { let r = rng() * total, type = 'grunt'; for (const [t, w] of W) { if ((r -= w) <= 0) { type = t; break; } } spawn(type, null, i++); }
  }

  /** Círculo (x,y,r) contra baldosas sólidas y el borde de la sala. */
  collides(x, y, r) {
    const { RW, RH, T, OX, OY } = CFG;
    const x0 = Math.floor((x - r - OX) / T), x1 = Math.floor((x + r - OX) / T);
    const y0 = Math.floor((y - r - OY) / T), y1 = Math.floor((y + r - OY) / T);
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
      if (tx < 0 || ty < 0 || tx >= RW || ty >= RH) continue;            // fuera de la sala: lo gestiona el cambio de sala
      if (!this.blocked[ty * RW + tx]) continue;
      const rx = OX + tx * T, ry = OY + ty * T;
      const cx = Math.max(rx, Math.min(x, rx + T)), cy = Math.max(ry, Math.min(y, ry + T));
      if ((x - cx) ** 2 + (y - cy) ** 2 < r * r) return true;
    }
    return false;
  }

  solidAt(x, y) {
    const { RW, RH, T, OX, OY } = CFG;
    const tx = Math.floor((x - OX) / T), ty = Math.floor((y - OY) / T);
    if (tx < 0 || ty < 0 || tx >= RW || ty >= RH) return true;
    return this.blocked[ty * RW + tx] !== 0;
  }

  randomFreePoint(radius = 12, minDistPlayer = 0) {
    const { RW, RH, T, OX, OY } = CFG;
    for (let i = 0; i < 60; i++) {
      const tx = this.rng.int(2, RW - 3), ty = this.rng.int(2, RH - 3);
      if (this.blocked[ty * RW + tx]) continue;
      const x = OX + tx * T + T / 2, y = OY + ty * T + T / 2;
      if (this.collides(x, y, radius)) continue;
      if (minDistPlayer && Math.hypot(x - this.player.x, y - this.player.y) < minDistPlayer) continue;
      return { x, y };
    }
    return this.roomCenter();
  }

  // ===================================================================================
  //  Objetos
  // ===================================================================================
  addItem(kind, x, y, data) {
    const it = new Item(this, x, y, kind, data);
    this.items.push(it);
    return it;
  }

  saveRoomItems() {
    if (!this.room) return;
    this.room.items = this.items.filter(i => !i.collected).map(i => ({ kind: i.kind, x: i.x, y: i.baseY, data: i.data2 }));
  }

  clearTransient() {
    this.items.forEach(i => { if (!i.collected) i.remove(); });
    this.items = [];
    this.enemies.forEach(e => { if (!e.dead) e.destroy(); });
    this.enemies = [];
    this.bulletPool.releaseAll(b => { b.setActive(false).setVisible(false); });
    this.fires.forEach(f => f.sprite.destroy());
    this.fires = [];
    this.mines.forEach(m => m.sprite.destroy());
    this.mines = [];
    this.clearHazards();
    this.barrels.forEach(b => b.sprite.destroy());
    this.barrels = [];
  }

  updateItems(dt) {
    const p = this.player;
    const press = Phaser.Input.Keyboard.JustDown(this.keyE) || this.touch.interact;
    this.touch.interact = false;
    for (const it of this.items.slice()) {
      if (it.collected) continue;
      it.update(dt);
      const d = Math.hypot(it.x - p.x, it.baseY - p.y);
      const mag = p.stack('magnet');
      if (mag && it.auto && !(it.kind === 'heart' && p.hp >= p.maxHp) && d < 70 + 70 * mag && d > 1) {   // imán
        it.x += (p.x - it.x) / d * 260 * dt; it.baseY += (p.y - it.baseY) / d * 260 * dt;
      }
      if (it.kind === 'portal') {                               // se atraviesa caminando hacia él
        if (this.time.now % 3 === 0 && !this.travelling) { const a = this.rng() * 6.283, rr = (it.enterR || 30) * 1.5; this.spark(it.x + Math.cos(a) * rr, it.baseY + Math.sin(a) * rr, this.rng() < 0.5 ? 0x00f0ff : 0xff2bd6, 0.9); }
        if (d < (it.enterR || 30) && !this.travelling && this.time.now > (it.lock || 0)) this.tryEnterPortal(it);
        continue;
      }
      if (it.auto && d < 24) { this.collect(it); continue; }
      if (!it.auto) {
        const near = d < 36;
        if (it.label) it.label.setColor(near ? '#ffe94d' : '#cffcff');
        if (near && press) this.collect(it);
      }
    }
    this.items = this.items.filter(i => !i.collected);
  }

  collect(it) {
    const p = this.player;
    if (it.price) {
      if (p.credits < it.price) { this.floatText(it.x, it.y - 22, 'Créditos insuficientes', 0xff4466); this.sfx('deny'); return; }
      p.credits -= it.price;
    }
    switch (it.kind) {
      case 'coin': p.credits += 1; this.creditsEarned++; Missions.track('coins'); this.sfx('coin'); break;
      case 'chest': this.openChest(it.data2.tier || 1, it); return;
      case 'heart':
        if (!it.price && p.hp >= p.maxHp) { it.baseY -= 0; return; }      // no se desperdicia con la vida llena
        p.heal(1); this.sfx('heal'); break;
      case 'key': p.keys++; this.sfx('coin'); break;
      case 'module':
        if (!p.addModule(it.data2.id)) { if (it.price) p.credits += it.price; return; }
        this.floatText(it.x, it.y - 26, Modules.defs[it.data2.id].name, Modules.defs[it.data2.id].color);
        this.sfx('module');
        if (it.data2.group) this.items.filter(o => o !== it && o.data2.group === it.data2.group).forEach(o => o.remove());
        break;
      case 'weapon':
        p.weapon = WEAPONS[it.data2.id]; this.weaponChosen = true;
        this.items.filter(o => o !== it && o.kind === 'weapon').forEach(o => o.remove());
        this.floatText(it.x, it.y - 26, WEAPONS[it.data2.id].name, WEAPONS[it.data2.id].color);
        this.sfx('module');
        Bus.emit('player:weapon', { weapon: p.weapon });
        break;
    }
    Bus.emit('player:inventory', {});
    it.remove();
  }

  nextFloor() {
    if (this.floor >= CFG.FLOORS) { this.endRun(true); return; }
    this.floatText(this.player.x, this.player.y - 40, 'PLANTA ' + (this.floor + 1), 0x00f0ff);
    this.newFloor(this.floor + 1);
  }

  // ===================================================================================
  //  Combate: proyectiles, fuego, explosiones
  // ===================================================================================
  fireBullet(spec, x, y, angle) {
    if (this.bulletPool.size > 260) return null;
    const b = this.bulletPool.get().init(spec, x, y, angle);
    Bus.emit('bullet:fire', { bullet: b });
    return b;
  }

  /** Daño base de lo que hacen los enemigos: dificultad x profundidad. */
  enemyDmg() { return this.diff.dmg * depthDmg(this.floor); }

  fireEnemyBullet(x, y, angle, speed, color, status, size = 1) {
    return this.fireBullet({ owner: 'enemy', damage: this.enemyDmg(), speed, life: 3.2, pierce: 0, bounces: 0, size, color, homing: 0, tags: [], status }, x, y, angle);
  }

  updateBullets(dt) {
    const p = this.player;
    this.bulletPool.forEach(b => {
      if (!b.step(dt * this.bulletTimeScale(b))) { this.releaseBullet(b); return; }
      for (const br of this.barrels) {                         // los barriles explosivos reciben balas de cualquiera
        if ((br.x - b.x) ** 2 + (br.y - b.y) ** 2 < 17 * 17) { br.hp -= b.spec.damage; this.spark(b.x, b.y, 0xff9a3c, 1); if (br.hp <= 0) this.blowBarrel(br); this.releaseBullet(b); return; }
      }
      if (b.owner === 'player') {
        for (const e of this.enemies) {
          if (e.dead || e.spawnT > 0 || b.hitSet.has(e)) continue;
          if ((e.x - b.x) ** 2 + (e.y - b.y) ** 2 > (e.radius + b.radius) ** 2) continue;
          b.hitSet.add(e);
          let dmg = b.spec.damage, crit = false;
          if (e.hasStatus('slow') && b.spec.tags.includes('explosion')) dmg *= 1.5;
          if (b.spec.crit && this.rng() < b.spec.crit) { dmg *= 2; crit = true; this.floatText(e.x, e.y - e.radius - 20, '¡CRÍTICO!', 0xffe94d); this.spawnBurst(b.x, b.y, 0xffe94d, 6); }
          e.takeDamage(dmg, 'player', { color: crit ? 0xffe94d : b.spec.color, dir: Math.atan2(b.vy, b.vx) });
          e.knock(Math.atan2(b.vy, b.vx), 90);
          this.spark(b.x, b.y, b.spec.color, 1);
          Bus.emit('bullet:hit', { bullet: b, target: e });
          if (e.hp <= 0) Bus.emit('bullet:kill', { bullet: b, target: e });
          if (b.pierceLeft > 0) b.pierceLeft--; else { this.releaseBullet(b); break; }
        }
      } else if (!p.dead && (p.x - b.x) ** 2 + (p.y - b.y) ** 2 < (p.radius + b.radius) ** 2) {
        if (p.takeDamage(b.spec.damage, 'bullet') && b.spec.status) p.addStatus(b.spec.status.name, b.spec.status.duration, b.spec.status.power);
        this.releaseBullet(b);
      }
    });
  }

  releaseBullet(b) {
    b.setActive(false).setVisible(false);
    this.bulletPool.release(b);
  }

  /** Zona de fuego en el suelo: el daño se hereda de la bala que la creó. */
  spawnFire(x, y, damage, duration, tags = [], color = 0xff9a3c) {
    if (this.fires.length > 40) return;
    const sprite = this.add.image(x, y, 'fire').setBlendMode(Phaser.BlendModes.ADD).setDepth(3).setTint(color).setAlpha(0.9);
    this.tweens.add({ targets: sprite, scale: { from: 0.7, to: 1.15 }, duration: 380, yoyo: true, repeat: -1 });
    this.fires.push({ x, y, damage, t: duration, tick: 0, sprite, color });
  }

  updateFires(dt) {
    for (const f of this.fires) {
      f.t -= dt; f.tick -= dt;
      f.sprite.setAlpha(Math.min(0.9, f.t));
      if (f.tick <= 0) {
        f.tick = 0.4;
        for (const e of this.enemies) {
          if (!e.dead && e.spawnT <= 0 && (e.x - f.x) ** 2 + (e.y - f.y) ** 2 < (26 + e.radius) ** 2) e.takeDamage(f.damage, 'player', { color: f.color });
        }
      }
    }
    this.fires = this.fires.filter(f => { if (f.t <= 0) { f.sprite.destroy(); return false; } return true; });
  }

  explode(x, y, radius, damage, source) {
    const ring = this.add.circle(x, y, 8, 0xff4466, 0.35).setStrokeStyle(2, 0xffe94d).setDepth(26).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: ring, radius: radius, alpha: 0, duration: 260, onComplete: () => ring.destroy() });
    this.spawnBurst(x, y, 0xff9a3c, 12);
    this.sfx('boom');
    for (const e of this.enemies.slice()) {
      if (e.dead || e.spawnT > 0) continue;
      if ((e.x - x) ** 2 + (e.y - y) ** 2 < (radius + e.radius) ** 2) e.takeDamage(damage * (e.hasStatus('slow') ? 1.5 : 1), source, { color: 0xff9a3c });
    }
    Bus.emit('explosion', { x, y, damage, radius, source });
  }

  spawnLightning(x1, y1, x2, y2, color) {
    const g = this.fxGfx;
    g.lineStyle(3, color, 1);
    g.beginPath(); g.moveTo(x1, y1);
    for (let i = 1; i < 5; i++) g.lineTo(x1 + (x2 - x1) * i / 5 + (this.rng() - 0.5) * 14, y1 + (y2 - y1) * i / 5 + (this.rng() - 0.5) * 14);
    g.lineTo(x2, y2); g.strokePath();
    this.time.delayedCall(90, () => g.clear());
  }

  // ===================================================================================
  //  Muerte del jefe
  // ===================================================================================
  /** Secuencia: cámara lenta, el jefe tiembla y parpadea, explosiones en cadena y estallido final. */
  bossDeath(e) {
    const x0 = e.x, y0 = e.y, col = e.color, cam = this.cameras.main;
    this.bossDeathPos = { x: x0, y: y0 };
    this.bulletPool.forEach(b => { if (b.owner === 'enemy') { this.spark(b.x, b.y, 0xffffff, 1.2); this.releaseBullet(b); } });
    Bus.emit('boss:dead', { name: e.bossName });
    this.slowmo = 0.3;
    cam.pan(x0, y0, 700, 'Sine.easeInOut'); cam.zoomTo(1.28, 900, 'Sine.easeInOut');                    // la cámara se acerca al jefe
    cam.flash(260, 255, 40, 160);
    this.tweens.addCounter({ from: 0.3, to: 1, duration: 2200, ease: 'Quad.easeIn', onUpdate: tw => { this.slowmo = tw.getValue(); }, onComplete: () => { this.slowmo = 1; } });
    cam.shake(2200, 0.005);
    this.sfx('boom');
    this.time.addEvent({ delay: 40, repeat: 52, callback: () => {                       // temblor y parpadeo
      if (!e.active) return;
      e.setPosition(x0 + (this.rng() - 0.5) * 9, y0 + (this.rng() - 0.5) * 9);
      e.setTint(this.rng() < 0.5 ? 0xffffff : col);
    } });
    for (let k = 0; k < 6; k++) this.time.delayedCall(300 + k * 330, () => {                // rayos de energía que escapan del cuerpo
      if (!e.active) return;
      for (let n = 0; n < 4; n++) { const a = this.rng() * 6.283, r = 70 + this.rng() * 90; this.spawnLightning(x0 + Math.cos(a) * 12, y0 + Math.sin(a) * 12, x0 + Math.cos(a) * r, y0 + Math.sin(a) * r, k % 2 ? 0xffe94d : col); }
    });
    for (let i = 0; i < 16; i++) {                                                       // explosiones en cadena sobre el cuerpo
      this.time.delayedCall(i * 135, () => {
        if (!e.active) return;
        const a = this.rng() * 6.283, r = this.rng() * 40, ex = x0 + Math.cos(a) * r, ey = y0 + Math.sin(a) * r;
        this.ringFx(ex, ey, 30 + this.rng() * 34, this.rng() < 0.5 ? col : 0xffe94d);
        this.spawnBurst(ex, ey, this.rng() < 0.5 ? 0xff9a3c : col, 9);
        this.sfx('boom');
        if (i % 3 === 0) cam.flash(90, 255, 200, 120);
      });
    }
    this.time.delayedCall(2200, () => {                                                  // gran estallido final
      if (!e.active) return;
      cam.flash(520, 255, 255, 255); cam.shake(800, 0.022);
      [60, 100, 150, 200].forEach((r, k) => this.time.delayedCall(k * 90, () => this.ringFx(x0, y0, r, k % 2 ? 0xffe94d : col)));
      this.spawnBurst(x0, y0, col, 40); this.spawnBurst(x0, y0, 0xffe94d, 40); this.spawnBurst(x0, y0, 0xffffff, 24);
      this.sfx('boom'); this.sfx('kill');
      this.shatter(e);                                                                  // el cuerpo se rompe en fragmentos
      cam.pan(CFG.W / 2, CFG.H / 2, 900, 'Sine.easeInOut'); cam.zoomTo(1, 900, 'Sine.easeInOut');
      this.time.delayedCall(1000, () => { cam.setZoom(1); cam.setScroll(0, 0); });
      this.tweens.add({ targets: [e, e.glowImg], scaleX: e.scaleX * 1.7, scaleY: e.scaleY * 1.7, alpha: 0, duration: 380, ease: 'Cubic.easeOut',
        onComplete: () => { if (e.active) e.destroy(); Bus.emit('enemy:killed', { enemy: e }); } });
    });
  }

  /** Rompe un sprite en una rejilla de fragmentos que salen despedidos (se usa con jefes y élites). */
  shatter(e, grid = 5, power = 1) {
    const key = e.texture.key, fw = e.frame.width, fh = e.frame.height;
    for (let r = 0; r < grid; r++) for (let c = 0; c < grid; c++) {
      const img = this.add.image(e.x, e.y, key).setScale(e.scaleX, e.scaleY).setDepth(28).setRotation(e.rotation);
      img.setCrop((c * fw) / grid, (r * fh) / grid, fw / grid, fh / grid);
      const dx = (c - (grid - 1) / 2) * 22 * e.scaleX * 2 * power, dy = (r - (grid - 1) / 2) * 22 * e.scaleY * 2 * power;
      this.tweens.add({ targets: img, x: e.x + dx + (this.rng() - 0.5) * 40, y: e.y + dy + 30 + this.rng() * 50, rotation: img.rotation + (this.rng() - 0.5) * 3.2, alpha: 0, duration: 900 + this.rng() * 600, ease: 'Quad.easeOut', onComplete: () => img.destroy() });
    }
  }

  // ===================================================================================
  //  Generador de portal, portal y viaje entre pisos
  // ===================================================================================
  /** Punto libre más cercano a (x,y) (el cofre aparece donde murió el jefe). */
  freeNear(x, y) {
    for (let r = 0; r < 240; r += 20) for (let k = 0; k < (r ? 10 : 1); k++) {
      const a = (k / 10) * 6.283, px = x + Math.cos(a) * r, py = y + Math.sin(a) * r;
      if (!this.collides(px, py, 22)) return { x: px, y: py };
    }
    return this.roomCenter();
  }

  /** Botín del jefe: el cofre cae donde murió y se abre un portal grande en un lado aleatorio de la sala (lejos del cofre). */
  dropBossLoot(x, y, tier) {
    const spot = this.freeNear(x, y), { OX, OY, RW, RH, T } = CFG, c = this.roomCenter();
    const chest = this.addItem('chest', spot.x, spot.y, { tier });
    chest.setAlpha(0); chest.baseY = spot.y - 150;
    chest.lid.setAlpha(0);
    this.tweens.add({ targets: chest, baseY: spot.y, alpha: 1, duration: 650, ease: 'Bounce.easeOut', delay: 150 });
    this.tweens.add({ targets: chest.lid, alpha: 1, duration: 300, delay: 150 });
    const beam = this.add.rectangle(spot.x, spot.y - 90, 30, 200, CHEST_TIERS[tier - 1].color, 0.5).setBlendMode(Phaser.BlendModes.ADD).setDepth(7);
    this.tweens.add({ targets: beam, alpha: 0, scaleX: 0.15, duration: 900, onComplete: () => beam.destroy() });
    this.time.delayedCall(800, () => { this.ringFx(spot.x, spot.y, 70, CHEST_TIERS[tier - 1].color); this.spawnBurst(spot.x, spot.y, CHEST_TIERS[tier - 1].color, 20); this.cameras.main.shake(140, 0.005); this.sfx('boom'); });
    // portal: lado aleatorio, nunca el del cofre
    const m = 96, sides = [{ x: OX + m, y: c.y }, { x: OX + RW * T - m, y: c.y }, { x: c.x, y: OY + m }, { x: c.x, y: OY + RH * T - m }]
      .filter(s => Math.hypot(s.x - spot.x, s.y - spot.y) > 240 && !this.collides(s.x, s.y, 30));
    const pos = (sides.length ? this.rng.pick(sides) : { x: c.x + (spot.x < c.x ? 280 : -280), y: c.y });
    this.time.delayedCall(1000, () => {
      if (this.room.type !== 'boss') return;
      const portal = this.addItem('portal', pos.x, pos.y, { big: true });
      const full = portal.scaleX;
      portal.setScale(0).setAlpha(0.2); portal.lock = this.time.now + 1800;
      this.tweens.add({ targets: portal, scale: full, alpha: 1, duration: 900, ease: 'Back.easeOut' });
      this.cameras.main.flash(300, 150, 240, 255); this.cameras.main.shake(500, 0.006);
      this.ringFx(pos.x, pos.y, 150, 0x00f0ff); this.ringFx(pos.x, pos.y, 100, 0xff2bd6); this.spawnBurst(pos.x, pos.y, 0x00f0ff, 36); this.sfx('open'); this.sfx('boom');
      Bus.emit('portal:open', {});
    });
  }

  /** Si queda un cofre sin abrir se abre primero; si no, empieza el viaje. */
  tryEnterPortal(it) {
    const chest = this.items.find(o => o.kind === 'chest' && !o.collected);
    if (chest) {
      it.lock = this.time.now + 2500;
      const p = this.player, a = Math.atan2(p.y - it.baseY, p.x - it.x);
      p.knock(a, 260);
      this.floatText(it.x, it.y - 56, '¡Abre antes el cofre!', 0xffd23c);
      this.collect(chest);
      return;
    }
    this.enterPortal(it);
  }

  /** Viaje: el jugador gira y se encoge hacia el portal, la cámara se acerca y se funde a negro. */
  enterPortal(it) {
    this.travelling = true;
    const p = this.player, cam = this.cameras.main, dur = 720;
    this.sfx('open'); this.sfx('module');
    this.floatText(it.x, it.y - 50, '', 0xffffff);
    this.tweens.add({ targets: p, x: it.x, y: it.baseY, duration: 380, ease: 'Cubic.easeIn' });
    this.tweens.add({ targets: p, rotation: p.rotation + Math.PI * 5, duration: dur, ease: 'Cubic.easeIn' });
    this.tweens.add({ targets: [p, p.wpImg, p.glowImg, p.legImg], scaleX: 0, scaleY: 0, alpha: 0, duration: dur, ease: 'Cubic.easeIn' });
    this.tweens.add({ targets: it, scale: it.scaleX * 1.35, duration: dur, ease: 'Sine.easeIn' });
    cam.pan(it.x, it.baseY, dur, 'Cubic.easeInOut'); cam.zoomTo(1.7, dur, 'Cubic.easeIn');
    this.ringFx(it.x, it.baseY, 90, 0x00f0ff); this.spawnBurst(it.x, it.baseY, 0xff2bd6, 22);
    this.time.delayedCall(dur - 180, () => cam.fadeOut(260, 0, 0, 0));
    this.time.delayedCall(dur + 120, () => {
      cam.setZoom(1); cam.setScroll(0, 0);
      p.setScale(Art.scaleOf(p.texture.key)).setAlpha(1).setRotation(0);
      p.wpImg.setScale(1).setAlpha(1); p.glowImg.setScale(1.7).setAlpha(0.45); p.legImg.setScale(Art.scaleOf(p.legImg.texture.key)).setAlpha(1);
      this.travelling = false;
      this.nextFloor();
      cam.fadeIn(650, 0, 0, 0);
    });
  }

  // ===================================================================================
  //  Mejoras de sala (elige 1 de 3), cofre de jefe y campo de fuerza
  // ===================================================================================
  /** Tras limpiar una sala: 3 mejoras temporales distintas y aleatorias; el juego se detiene hasta elegir. */
  offerUpgrades() {
    if (this.runOver || this.choosing || this.player.dead) return;
    const ids = Modules.roll(this.rng, this.player, 3);
    if (!ids.length) return;
    this.choosing = true;
    Bus.emit('upgrade:offer', { cards: ids.map(id => Modules.card(id, this.player)) });
  }

  pickUpgrade(id) {
    if (!this.choosing) return;
    if (this.player.addModule(id)) {
      const d = Modules.defs[id];
      this.floatText(this.player.x, this.player.y - 30, `${d.name} Nv ${this.player.stack(id)}`, d.color);
      this.spawnBurst(this.player.x, this.player.y, d.color, 18);
      this.ringFx(this.player.x, this.player.y, 60, d.color);
      this.upgradesPicked++; Missions.track('upgrade');
      this.sfx('module');
    }
    this.choosing = false;
    Bus.emit('upgrade:picked', { id });
  }

  /** Apertura del cofre virtual: sacude, la tapa se levanta, rayos de luz, los premios salen volando y luego se muestra el botín. */
  openChest(tier, it) {
    const items = Chests.open(tier, () => this.rng());
    this.chestOpen = true;
    it.collected = true; it.opening = true;
    const x = it.x, y = it.baseY, col = CHEST_TIERS[tier - 1].color, cam = this.cameras.main;
    this.sfx('module');
    this.tweens.add({ targets: it, x: { from: x - 3, to: x + 3 }, duration: 55, yoyo: true, repeat: 5, onComplete: () => it.setX(x) });       // vibra
    this.tweens.add({ targets: it.glowFx, alpha: 1, scale: 4.2, duration: 500 });
    this.time.delayedCall(420, () => {                                                                                                              // tapa fuera
      this.sfx('open'); cam.shake(260, 0.006);
      this.tweens.add({ targets: it.lid, y: y - 52, angle: -26, x: x - 10, duration: 360, ease: 'Back.easeOut' });
      for (let k = 0; k < 4; k++) {                                                                                                                 // columnas de luz
        const b = this.add.rectangle(x + (k - 1.5) * 9, y - 40, 9 - k, 150, k % 2 ? 0xffffff : col, 0.75).setBlendMode(Phaser.BlendModes.ADD).setDepth(30).setScale(1, 0).setOrigin(0.5, 1);
        b.y = y - 10;
        this.tweens.add({ targets: b, scaleY: 1, alpha: 0, duration: 900, delay: k * 50, ease: 'Cubic.easeOut', onComplete: () => b.destroy() });
      }
      this.ringFx(x, y, 90, col); this.ringFx(x, y - 10, 140, 0x00f0ff);
      this.spawnBurst(x, y - 20, col, 30); this.spawnBurst(x, y - 20, 0xffffff, 14);
      items.forEach((r, i) => {                                                                                                                    // los premios salen disparados
        const tex = r.kind === 'skin' ? 'skin_' + r.id : r.kind === 'upgrade' ? 'module' : r.kind === 'frag' ? 'module' : 'coin';
        const ic = this.add.image(x, y - 14, tex).setDepth(31).setScale(Art.sc(tex, r.kind === 'skin' ? 0.9 : 1.2)).setAlpha(0);
        if (r.kind === 'upgrade') ic.setTint(0x5dff8a); else if (r.kind === 'frag') ic.setTint(0x00f0ff);
        const a = -Math.PI / 2 + (i - (items.length - 1) / 2) * 0.55;
        this.tweens.add({ targets: ic, alpha: 1, x: x + Math.cos(a) * 84, y: y - 14 + Math.sin(a) * 96, duration: 520, delay: 120 + i * 90, ease: 'Cubic.easeOut' });
        this.tweens.add({ targets: ic, y: '+=8', scale: ic.scaleX * 1.12, duration: 380, yoyo: true, repeat: 1, delay: 700 + i * 90 });
        this.tweens.add({ targets: ic, alpha: 0, scale: 0.2, x: x, y: y - 30, duration: 320, delay: 1260 + i * 40, ease: 'Cubic.easeIn', onComplete: () => ic.destroy() });
      });
    });
    this.time.delayedCall(1750, () => {
      cam.flash(240, 255, 240, 180); this.sfx('module');
      it.remove();
      Bus.emit('chest:open', { tier, items });
    });
  }

  closeChest() { this.chestOpen = false; }

  /** Campo de fuerza: zona eléctrica alrededor del jugador que daña (y ralentiza) a los enemigos que la tocan. */
  updateForcefield(dt) {
    const p = this.player, n = p.stack('forcefield');
    if (!this.ffGfx) {
      this.ffGfx = this.add.graphics().setDepth(7).setBlendMode(Phaser.BlendModes.ADD);
      this.ffGlow = this.add.image(0, 0, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(0x2ab4ff).setDepth(6).setVisible(false);
      this.ffT = 0; this.ffArcT = 0; this.ffArcs = [];
    }
    const g = this.ffGfx;
    g.clear();
    if (!n || p.dead) { this.ffGlow.setVisible(false); return; }
    const R = 52 + 24 * n, dps = 2 + 1.8 * n, t = this.time.now / 1000;
    this.ffGlow.setVisible(true).setPosition(p.x, p.y).setScale(R / 22).setAlpha(0.32 + 0.1 * Math.sin(t * 9));
    g.fillStyle(0x1a8cff, 0.1 + 0.025 * n); g.fillCircle(p.x, p.y, R);
    g.fillStyle(0x9ff6ff, 0.07); g.fillCircle(p.x, p.y, R * 0.62);
    // borde ondulante (ruido eléctrico)
    const N = 40;
    for (let pass = 0; pass < 2; pass++) {
      g.lineStyle(pass ? 1.5 : 4, pass ? 0xffffff : 0x34b8ff, pass ? 0.95 : 0.55);
      g.beginPath();
      for (let i = 0; i <= N; i++) {
        const a = (i / N) * 6.283, w = 1 + 0.03 * Math.sin(t * 14 + i * 2.3) + (Math.random() - 0.5) * (pass ? 0.05 : 0.03);
        const x = p.x + Math.cos(a) * R * w, y = p.y + Math.sin(a) * R * w;
        if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
      }
      g.strokePath();
    }
    // rayos internos que cambian ~14 veces por segundo
    this.ffArcT -= dt;
    if (this.ffArcT <= 0) {
      this.ffArcT = 0.07;
      this.ffArcs = [];
      const count = 3 + n;
      for (let k = 0; k < count; k++) {
        const a0 = this.rng() * 6.283, pts = [], steps = 7, r0 = R * (0.15 + this.rng() * 0.25);
        for (let s = 0; s <= steps; s++) { const rr = r0 + (R - r0) * (s / steps), aa = a0 + (this.rng() - 0.5) * 0.55 * (s / steps); pts.push([Math.cos(aa) * rr, Math.sin(aa) * rr]); }
        this.ffArcs.push(pts);
      }
    }
    for (const pts of this.ffArcs) {
      for (const [lw, col, al] of [[5, 0x2a8cff, 0.35], [2, 0xcff6ff, 0.95]]) {
        g.lineStyle(lw, col, al); g.beginPath(); g.moveTo(p.x + pts[0][0], p.y + pts[0][1]);
        for (let s = 1; s < pts.length; s++) g.lineTo(p.x + pts[s][0] + (Math.random() - 0.5) * 3, p.y + pts[s][1] + (Math.random() - 0.5) * 3);
        g.strokePath();
      }
    }
    if (Math.random() < 0.5) this.spark(p.x + (Math.random() - 0.5) * R * 1.6, p.y + (Math.random() - 0.5) * R * 1.6, 0x9ff6ff, 0.8);
    this.ffT -= dt;
    if (this.ffT > 0) return;
    this.ffT = 0.25;
    for (const e of this.enemies) {
      if (e.dead || e.spawnT > 0 || (e.x - p.x) ** 2 + (e.y - p.y) ** 2 > (R + e.radius) ** 2) continue;
      e.takeDamage(dps * 0.25 * p.damageMult, 'player', { color: 0x9ff6ff });
      this.spawnLightning(p.x + (Math.random() - 0.5) * 8, p.y + (Math.random() - 0.5) * 8, e.x, e.y, 0x9ff6ff);     // el rayo salta hasta el enemigo
      if (n >= 3 && !e.dead) e.addStatus('slow', 0.6, 0.7);
      this.spark(e.x, e.y, 0xffffff, 1.2);
    }
  }

  /** Campo temporal: las balas enemigas cercanas al jugador van más lentas. */
  bulletTimeScale(b) {
    const p = this.player, n = p.stack('timefield');
    if (!n || b.owner !== 'enemy') return 1;
    return (b.x - p.x) ** 2 + (b.y - p.y) ** 2 < (110 + 30 * n) ** 2 ? Math.max(0.3, 1 - 0.25 * n) : 1;
  }

  // ===================================================================================
  //  Trampas, barriles, minas y ondas de choque
  // ===================================================================================
  tileOf(p) { return { x: Math.floor((p.x - CFG.OX) / CFG.T), y: Math.floor((p.y - CFG.OY) / CFG.T) }; }

  /** Crea los pinchos y barriles de la sala (solo en salas de combate aún sin limpiar). */
  buildExtras(room) {
    const { T, OX, OY } = CFG;
    this.hazards = []; this.barrels = [];
    if (room.type !== 'combat') return;
    if (!room.cleared) for (const h of room.hazards || []) {
      const sprite = this.add.image(OX + h.tx * T + T / 2, OY + h.ty * T + T / 2, 'spike_off').setDepth(1);
      this.hazards.push({ tx: h.tx, ty: h.ty, g: h.g, sprite, state: 'off' });
    }
    for (const b of room.barrels || []) {
      const sprite = this.add.image(OX + b.tx * T + T / 2, OY + b.ty * T + T / 2, 'barrel').setDepth(8);
      this.barrels.push({ x: sprite.x, y: sprite.y, hp: 2, sprite, src: b });
    }
  }

  clearHazards() {
    this.hazards.forEach(h => h.sprite.destroy());
    this.hazards = [];
  }

  updateHazards(dt) {
    if (!this.hazards.length) return;
    this.hazT += dt;
    const p = this.player, T = CFG.T;
    for (const h of this.hazards) {
      const ph = (this.hazT + h.g * 0.8) % 3.2;
      const st = ph < 1.5 ? 'off' : ph < 2.2 ? 'warn' : ph < 2.9 ? 'on' : 'off';
      if (st !== h.state) { h.state = st; h.sprite.setTexture('spike_' + st); }
      if (st === 'warn') h.sprite.setAlpha(0.6 + 0.4 * Math.sin(this.time.now / 45));
      else h.sprite.setAlpha(1);
      if (st === 'on' && !p.dead && Math.abs(p.x - h.sprite.x) < T / 2 + p.radius - 4 && Math.abs(p.y - h.sprite.y) < T / 2 + p.radius - 4) {
        if (p.takeDamage(1, 'spike')) this.spawnBurst(p.x, p.y, 0xff4466, 8);
      }
    }
  }

  blowBarrel(br) {
    if (br.dead) return;
    br.dead = true;
    this.barrels = this.barrels.filter(b => b !== br);
    if (this.room.barrels) this.room.barrels = this.room.barrels.filter(b => b !== br.src);
    br.sprite.destroy();
    this.ringFx(br.x, br.y, 80, 0xff9a3c);
    this.spawnBurst(br.x, br.y, 0xff9a3c, 16);
    this.sfx('boom'); this.cameras.main.shake(160, 0.006);
    for (const e of this.enemies.slice()) if (!e.dead && e.spawnT <= 0 && (e.x - br.x) ** 2 + (e.y - br.y) ** 2 < (80 + e.radius) ** 2) e.takeDamage(4, 'player', { color: 0xff9a3c });
    const p = this.player;
    if (!p.dead && (p.x - br.x) ** 2 + (p.y - br.y) ** 2 < (80 + p.radius) ** 2) { if (p.takeDamage(1, 'barrel')) p.knock(Math.atan2(p.y - br.y, p.x - br.x), 300); }
    for (const o of this.barrels.slice()) if ((o.x - br.x) ** 2 + (o.y - br.y) ** 2 < 90 * 90) this.time.delayedCall(120, () => this.blowBarrel(o));
  }

  spawnMine(x, y, damage) {
    if (this.mines.length > 8) return;
    const sprite = this.add.image(x, y, 'mine').setDepth(5).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.6);
    this.mines.push({ x, y, damage, sprite, arm: 0.6, life: 14 });
  }

  updateMines(dt) {
    for (const m of this.mines) {
      m.arm -= dt; m.life -= dt;
      m.sprite.setAlpha(m.arm > 0 ? 0.35 : 0.65 + 0.3 * Math.sin(this.time.now / 120));
      if (m.arm > 0) continue;
      if (this.enemies.some(e => !e.dead && e.spawnT <= 0 && (e.x - m.x) ** 2 + (e.y - m.y) ** 2 < (30 + e.radius) ** 2)) { m.life = 0; this.explode(m.x, m.y, 74, m.damage, 'player'); }
    }
    this.mines = this.mines.filter(m => { if (m.life <= 0) { m.sprite.destroy(); return false; } return true; });
  }

  /** Onda circular: daña (y opcionalmente aturde) a los enemigos y puede borrar balas enemigas. */
  shockwave(x, y, r, dmg, stunT, color, clearBullets) {
    this.ringFx(x, y, r, color);
    this.ringFx(x, y, r * 0.65, color);
    this.spawnBurst(x, y, color, 18);
    for (const e of this.enemies.slice()) {
      if (e.dead || e.spawnT > 0 || (e.x - x) ** 2 + (e.y - y) ** 2 > (r + e.radius) ** 2) continue;
      e.takeDamage(dmg, 'player', { color });
      if (stunT > 0 && !e.dead) e.addStatus('stun', stunT, 0);
      if (!e.dead) e.knock(Math.atan2(e.y - y, e.x - x), 260);
    }
    if (clearBullets) this.bulletPool.forEach(b => { if (b.owner === 'enemy' && (b.x - x) ** 2 + (b.y - y) ** 2 < r * r) { this.spark(b.x, b.y, color, 1.2); this.releaseBullet(b); } });
  }

  /** Explosión enemiga (bombas, blindados, élites volátiles): daña al jugador. */
  enemyExplosion(x, y, radius, dmg, color) {
    this.ringFx(x, y, radius, color);
    this.spawnBurst(x, y, color, 16);
    this.sfx('boom'); this.cameras.main.shake(150, 0.006);
    const p = this.player;
    if (!p.dead && (p.x - x) ** 2 + (p.y - y) ** 2 < (radius + p.radius) ** 2) { if (p.takeDamage(dmg * this.enemyDmg(), 'explosion')) p.knock(Math.atan2(p.y - y, p.x - x), 320); }
  }

  ringFx(x, y, r, color) {
    const ring = this.add.circle(x, y, 6, color, 0.12).setStrokeStyle(3, color, 1).setDepth(26).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: ring, radius: r, alpha: 0, duration: 320, onComplete: () => ring.destroy() });
  }

  rayEnd(x, y, ang) {
    const dx = Math.cos(ang) * 6, dy = Math.sin(ang) * 6;
    let px = x, py = y;
    for (let i = 0; i < 160; i++) { if (this.solidAt(px + dx, py + dy)) break; px += dx; py += dy; }
    return { x: px, y: py };
  }

  /** Barras de vida de enemigos y avisos láser de los francotiradores. */
  drawOver() {
    const g = this.overGfx;
    g.clear();
    for (const e of this.enemies) {
      if (e.dead) continue;
      if (e.telegraph !== null && e.telegraph !== undefined) {
        const end = this.rayEnd(e.x, e.y, e.telegraph);
        const a = 0.35 + 0.35 * Math.sin(this.time.now / 40);
        g.lineStyle(5, 0xb6ff3c, 0.12 + a * 0.2); g.lineBetween(e.x, e.y, end.x, end.y);
        g.lineStyle(1.5, 0xe6ffb0, a + 0.3); g.lineBetween(e.x, e.y, end.x, end.y);
      }
      if (e.mortarTarget) {                                                     // zona de impacto del mortero
        const pr = Math.min(1, e.attackTime / 1.15), pulse = 0.5 + 0.5 * Math.sin(this.time.now / 60);
        g.fillStyle(0xff4a1c, 0.1 + 0.22 * pr); g.fillCircle(e.mortarTarget.x, e.mortarTarget.y, 66 * pr);
        g.lineStyle(2.5, 0xff8a3c, 0.5 + 0.4 * pulse); g.strokeCircle(e.mortarTarget.x, e.mortarTarget.y, 66);
      }
      if (e.type === 'boss' || e.spawnT > 0) continue;
      if (e.hp >= e.maxHp && !e.elite) continue;
      const w = Math.max(24, e.radius * 2 + 8), x = e.x - w / 2, y = e.y - e.radius - 14;
      g.fillStyle(0x000000, 0.7); g.fillRect(x - 1, y - 1, w + 2, 5);
      g.fillStyle(e.elite ? ELITE_AFFIX[e.elite].color : 0xff4466, 1); g.fillRect(x, y, w * Math.max(0, e.hp / e.maxHp), 3);
    }
  }

  // ===================================================================================
  //  Efectos visuales y sonido
  // ===================================================================================
  spark(x, y, color, life = 1) {
    if (this.sparkPool.size > 110) return;
    const s = this.sparkPool.get();
    s.setPosition(x, y).setTint(color).setScale(0.6 + this.rng() * 0.6).setAlpha(0.9).setActive(true).setVisible(true);
    this.particles.push({ s, vx: (this.rng() - 0.5) * 60, vy: (this.rng() - 0.5) * 60, t: 0.25 * life });
  }

  spawnBurst(x, y, color, n) {
    for (let i = 0; i < n; i++) {
      if (this.sparkPool.size > 110) return;
      const s = this.sparkPool.get();
      const a = this.rng() * 6.283, v = 60 + this.rng() * 200;
      s.setPosition(x, y).setTint(color).setScale(0.8 + this.rng()).setAlpha(1).setActive(true).setVisible(true);
      this.particles.push({ s, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: 0.35 + this.rng() * 0.3 });
    }
  }

  updateParticles(dt) {
    for (const p of this.particles) {
      p.t -= dt;
      p.s.x += p.vx * dt; p.s.y += p.vy * dt;
      p.s.alpha = Math.max(0, p.t * 3);
    }
    this.particles = this.particles.filter(p => { if (p.t <= 0) { p.s.setActive(false).setVisible(false); this.sparkPool.release(p.s); return false; } return true; });
  }

  afterimage(spr) {
    if (this.rng() < 0.5) return;
    const a = this.add.image(spr.x, spr.y, spr.texture.key).setScale(spr.scaleX).setTint(spr.character ? spr.character.color : 0xffffff).setRotation(spr.rotation).setAlpha(0.5).setDepth(15).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: a, alpha: 0, duration: 220, onComplete: () => a.destroy() });
  }

  floatText(x, y, text, color) {
    if (!text) return;
    const t = this.add.text(x, y, text, { fontFamily: 'monospace', fontSize: '13px', color: '#' + (color || 0xffffff).toString(16).padStart(6, '0'), stroke: '#000', strokeThickness: 3 }).setOrigin(0.5).setDepth(40);
    this.tweens.add({ targets: t, y: y - 26, alpha: 0, duration: 750, onComplete: () => t.destroy() });
  }

  /** Efectos de sonido sintetizados con WebAudio (sin archivos). */
  sfx(kind) {
    const ctx = this.sound && this.sound.context;
    if (!ctx || ctx.state === 'suspended') return;
    const now = this.time.now;
    this._sfxT = this._sfxT || {};
    if (now - (this._sfxT[kind] || 0) < 45) return;
    this._sfxT[kind] = now;
    const P = {
      shoot: [520, 'square', 0.04, 0.05, -200], dash: [300, 'sawtooth', 0.05, 0.15, 500], kill: [180, 'square', 0.06, 0.12, -100],
      hurt: [120, 'sawtooth', 0.08, 0.2, -60], coin: [880, 'square', 0.04, 0.07, 300], heal: [660, 'sine', 0.06, 0.2, 400],
      module: [440, 'triangle', 0.07, 0.3, 600], open: [330, 'triangle', 0.06, 0.25, 400], deny: [140, 'square', 0.05, 0.12, 0], boom: [90, 'sawtooth', 0.09, 0.3, -50],
    }[kind];
    if (!P) return;
    try {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = P[1]; o.frequency.setValueAtTime(P[0], ctx.currentTime);
      o.frequency.linearRampToValueAtTime(Math.max(40, P[0] + P[4]), ctx.currentTime + P[3]);
      g.gain.setValueAtTime(Math.max(0.0001, P[2] * Settings.volume * 1.4), ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + P[3]);
      o.connect(g); g.connect(ctx.destination); o.start(); o.stop(ctx.currentTime + P[3] + 0.02);
    } catch (e) { /* sin audio */ }
  }

  // ===================================================================================
  //  Bucle principal
  // ===================================================================================
  update(time, delta) {
    if (this.runOver) return;
    if (Phaser.Input.Keyboard.JustDown(this.keyEsc) || this.touch.pause) { this.touch.pause = false; this.paused = !this.paused; Bus.emit('game:pause', { paused: this.paused }); }
    if (this.paused || this.choosing || this.chestOpen) return;
    const dt = Math.min(0.05, delta / 1000) * this.slowmo;
    if (this.travelling) { this.updateParticles(dt); this.drawOver(); return; }

    this.player.update(dt);
    for (const e of this.enemies.slice()) if (!e.dead) e.update(dt);
    this.updateBullets(dt);
    this.updateFires(dt);
    this.updateItems(dt);
    this.updateParticles(dt);
    this.updateHazards(dt);
    this.updateMines(dt);
    this.updateForcefield(dt);
    this.drawOver();
    this.bgGrid.tilePositionX += dt * 8; this.bgGrid.tilePositionY += dt * 5;
    this.contactDamage();
    this.checkDoors();
    Bus.emit('tick', { dt });
  }

  contactDamage() {
    const p = this.player;
    if (p.dead) return;
    for (const e of this.enemies) {
      if (e.dead || e.spawnT > 0 || !e.contact) continue;
      if (e.type === 'grunt' && !e.charging && e.fsm.name !== 'chase') continue;
      if ((e.x - p.x) ** 2 + (e.y - p.y) ** 2 < (e.radius + p.radius) ** 2) {
        if (p.takeDamage(this.enemyDmg(), 'contact')) { p.knock(Math.atan2(p.y - e.y, p.x - e.x), 320); e.knock(Math.atan2(e.y - p.y, e.x - p.x), 120); }
      }
    }
  }

  /** Cambio de sala al cruzar una puerta abierta + apertura de puertas con llave. */
  checkDoors() {
    const p = this.player, room = this.room, { OX, OY, RW, RH, T } = CFG;
    if (this.transition) return;
    for (const [name, open] of Object.entries(room.doors)) {                     // pista de la puerta del jefe cerrada
      if (!open || !this.doorToBoss(room, name)) continue;
      const tl = DOOR_TILES[name];
      const dx = OX + (tl.reduce((s, t) => s + t[0], 0) / tl.length + 0.5) * T, dy = OY + (tl.reduce((s, t) => s + t[1], 0) / tl.length + 0.5) * T;
      if (Math.hypot(dx - p.x, dy - p.y) < 90 && (!this.bossHint || this.time.now - this.bossHint > 2500)) {
        this.bossHint = this.time.now;
        const pr = this.combatProgress();
        this.floatText(dx, dy - 24, `Puerta del jefe cerrada: salas ${pr.done}/${pr.total}`, 0xff2bd6);
      }
    }
    // puertas con llave de salas vecinas
    for (const [name, open] of Object.entries(room.doors)) {
      const id = DungeonGenerator.key(room.gx, room.gy) + ':' + name;
      if (!open || !this.lockedDoors[id]) continue;
      const tiles = DOOR_TILES[name];
      const cx = OX + (tiles.reduce((s, t) => s + t[0], 0) / tiles.length + 0.5) * T;
      const cy = OY + (tiles.reduce((s, t) => s + t[1], 0) / tiles.length + 0.5) * T;
      if (Math.hypot(cx - p.x, cy - p.y) < 56) {
        if (p.keys > 0) {
          p.keys--; delete this.lockedDoors[id];
          this.rebuildBlocked(); this.drawDoors(); this.sfx('open');
          this.floatText(cx, cy - 20, 'Puerta abierta', 0xffe94d);
          Bus.emit('player:inventory', {});
        } else if (!this.keyHint || this.time.now - this.keyHint > 1500) {
          this.keyHint = this.time.now; this.floatText(cx, cy - 20, 'Necesitas una llave', 0xff4466);
        }
      }
    }
    if (this.sealed) return;
    let dir = null;
    if (p.x < OX - 2 && room.doors.W) dir = 'W';
    else if (p.x > OX + RW * T + 2 && room.doors.E) dir = 'E';
    else if (p.y < OY - 2 && room.doors.N) dir = 'N';
    else if (p.y > OY + RH * T + 2 && room.doors.S) dir = 'S';
    if (dir) {
      const d = DIRS[dir];
      const next = this.dungeon.get(room.gx + d.dx, room.gy + d.dy);
      if (next) this.enterRoom(next, dir);
    }
  }

  endRun(win) {
    if (this.runOver) return;
    this.runOver = true;
    const d = this.diff;
    const baseFrag = this.roomsCleared * 2 + (this.floor - 1) * 6 + this.bossesKilled * 12 + (win ? 25 : 0);
    const frag = Math.round(baseFrag * d.reward);
    const coins = Math.round((this.player.credits * 0.5 + this.roomsCleared * 2 + this.bossesKilled * 15 + (win ? 60 : 0)) * d.reward);
    Meta.addFragments(frag);
    Meta.data.coins += coins;
    Meta.data.runs++; if (win) { Meta.data.wins++; Missions.track('win', 1, { diff: DIFFICULTIES.indexOf(d) }); }
    Meta.data.bestFloor = Math.max(Meta.data.bestFloor, this.floor);
    Meta.data.bestRooms = Math.max(Meta.data.bestRooms, this.roomsCleared);
    Meta.save();
    Bus.emit('run:end', { win, fragments: frag, coins, rooms: this.roomsCleared, floor: this.floor, kills: this.runKills, diff: d.name });
  }
}
