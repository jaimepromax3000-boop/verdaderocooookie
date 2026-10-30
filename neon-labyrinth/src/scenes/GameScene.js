/**
 * GameScene: orquestador del bucle principal. Gestiona la mazmorra (plantas, salas y puertas), el jugador,
 * los enemigos, los proyectiles (ObjectPool), las zonas de fuego, las recompensas, la tienda y el fin de la partida.
 * La interfaz vive en UIScene (otra escena en paralelo) y se comunica por el EventBus.
 */
class GameScene extends Phaser.Scene {
  constructor() { super('GameScene'); }

  init(data) {
    this.charId = (data && data.character) || 'hacker';
    this.seedBase = (data && data.seed) || ((Math.random() * 1e9) | 0);
    this.autoFire = !!(data && data.autoFire);
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
    this.player = new Player(this, W / 2, OY + (RH * T) / 2, ch, 'pulse');
    this.hookOffs = Modules.install(this);
    this.busOffs = [
      Bus.on('player:dead', () => this.endRun(false)),
      Bus.on('player:hit', e => { this.cameras.main.shake(e.crit ? 220 : 110, e.crit ? 0.008 : 0.004); this.sfx('hurt'); }),
      Bus.on('enemy:killed', e => this.onEnemyKilled(e.enemy)),
    ];

    this.keyE = this.input.keyboard.addKey('E');
    this.keyEsc = this.input.keyboard.addKey('ESC');
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
    this.theme = THEMES[(n - 1) % THEMES.length];
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
    if (room.type === 'boss' && !room.cleared) Bus.emit('boss:intro', { name: BOSS_INFO[Math.min(3, this.floor)].name });
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
        const budget = 4 + f * 1.4 + room.dist * 0.35 + rng() * 2;
        room.wavesTotal = budget > 7.5 ? 2 : 1;
        room.wave = 1;
        room.waveBudget = room.wavesTotal === 2 ? [budget * 0.55, budget * 0.5] : [budget];
        this.spawnWave(room, 1);
      }
    }
  }

  /** Genera una oleada de la sala con un presupuesto de "coste" y una tabla de pesos por planta. */
  spawnWave(room, wave) {
    const f = this.floor, rng = this.rng;
    const COST = { grunt: 1, shooter: 1, bomber: 0.8, splitter: 1.4, turret: 1.5, summoner: 2, sniper: 1.6, tank: 3, blinker: 1.6 };
    const W = [
      { grunt: 40, shooter: 30, bomber: 12, splitter: 10, turret: 8 },
      { grunt: 22, shooter: 18, summoner: 10, sniper: 12, bomber: 10, splitter: 10, tank: 8, blinker: 10 },
      { grunt: 12, shooter: 14, summoner: 10, sniper: 12, bomber: 10, splitter: 10, tank: 14, blinker: 12, turret: 6 },
    ][Math.min(2, f - 1)];
    const total = Object.values(W).reduce((a, b) => a + b, 0);
    let budget = room.waveBudget[wave - 1], spent = 0, n = 0, eliteDone = wave > 1;
    while (n < 10 && (spent < budget || n < 2)) {
      let r = rng() * total, type = 'grunt';
      for (const [k, w] of Object.entries(W)) { if ((r -= w) <= 0) { type = k; break; } }
      if (spent + COST[type] > budget + 0.9 && n >= 2) break;
      spent += COST[type]; n++;
      const p = this.randomFreePoint(14, type === 'turret' ? 110 : 150);
      let elite = null;
      if (!eliteDone && room.dist >= 2 && ['grunt', 'shooter', 'tank', 'sniper', 'splitter', 'blinker'].includes(type) && rng() < [0.1, 0.2, 0.3][Math.min(2, f - 1)]) {
        elite = rng.pick(['fast', 'volatile', 'armored']); eliteDone = true;
      }
      this.spawnEnemy(type, p.x, p.y, false, elite);
    }
    if (wave > 1) Bus.emit('wave:start', { wave, total: room.wavesTotal });
  }

  spawnEnemy(type, x, y, minion = false, elite = null) {
    const f = this.floor;
    const scale = (type === 'boss' ? 1 + 0.4 * (f - 1) : 1 + 0.28 * (f - 1));
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
    if (e.elite) {                                              // los élites sueltan botín extra
      for (let i = 0; i < 3; i++) this.addItem('coin', e.x + (this.rng() - 0.5) * 40, e.y + (this.rng() - 0.5) * 40, {});
      if (this.rng() < 0.4) this.addItem('heart', e.x, e.y, {});
      else if (this.rng() < 0.3 && Modules.roll(this.rng, this.player, 1).length) this.addItem('module', e.x, e.y, { id: Modules.roll(this.rng, this.player, 1)[0] });
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
    this.clearHazards();
    const c = this.roomCenter();
    if (room.type === 'boss') {
      this.bossesKilled++;
      const id = Modules.roll(this.rng, this.player, 1)[0];
      if (id) this.addItem('module', c.x - 60, c.y, { id, group: 'bossreward' });
      this.addItem('portal', c.x + 60, c.y, {});
      this.floatText(c.x, c.y - 60, 'SERVIDOR PURGADO', 0x00f0ff);
      this.cameras.main.flash(300, 0, 240, 255);
    } else {
      this.dropReward(c.x, c.y);
    }
    Bus.emit('room:clear', { room });
  }

  /** Recompensa visible al limpiar una sala: créditos, salud, llave o módulo de software. */
  dropReward(x, y) {
    const rng = this.rng, luck = this.player.luck;
    const r = rng() * 100;
    this.spawnBurst(x, y, 0x00f0ff, 18);
    if (r < 12 + 6 * luck && Modules.roll(rng, this.player, 1).length) {
      this.addItem('module', x, y, { id: Modules.roll(rng, this.player, 1)[0] });
    } else if (r < 38) {
      this.addItem('heart', x, y, {});
    } else if (r < 52) {
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
      if (this.sealed || locked) for (const [x, y] of DOOR_TILES[name]) this.blocked[y * RW + x] = 1;
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
      if (!(this.sealed || locked)) continue;
      for (const [x, y] of DOOR_TILES[name]) {
        const s = this.add.image(OX + x * T + T / 2, OY + y * T + T / 2, locked ? 'door_locked' : 'door_closed').setDepth(2);
        this.doorLayer.add(s);
        this.doorSprites.push(s);
      }
    }
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
    const press = Phaser.Input.Keyboard.JustDown(this.keyE);
    for (const it of this.items.slice()) {
      if (it.collected) continue;
      it.update(dt);
      const d = Math.hypot(it.x - p.x, it.baseY - p.y);
      const mag = p.stack('magnet');
      if (mag && it.auto && !(it.kind === 'heart' && p.hp >= p.maxHp) && d < 70 + 70 * mag && d > 1) {   // imán
        it.x += (p.x - it.x) / d * 260 * dt; it.baseY += (p.y - it.baseY) / d * 260 * dt;
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
      case 'coin': p.credits += 1; this.sfx('coin'); break;
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
      case 'portal': this.nextFloor(); break;
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

  fireEnemyBullet(x, y, angle, speed, color, status, size = 1) {
    return this.fireBullet({ owner: 'enemy', damage: 1, speed, life: 3.2, pierce: 0, bounces: 0, size, color, homing: 0, tags: [], status }, x, y, angle);
  }

  updateBullets(dt) {
    const p = this.player;
    this.bulletPool.forEach(b => {
      if (!b.step(dt)) { this.releaseBullet(b); return; }
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
          e.takeDamage(dmg, 'player', { color: crit ? 0xffe94d : b.spec.color });
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
    if (!p.dead && (p.x - x) ** 2 + (p.y - y) ** 2 < (radius + p.radius) ** 2) { if (p.takeDamage(dmg, 'explosion')) p.knock(Math.atan2(p.y - y, p.x - x), 320); }
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
    const a = this.add.image(spr.x, spr.y, spr.texture.key).setTint(spr.character ? spr.character.color : 0xffffff).setRotation(spr.rotation).setAlpha(0.5).setDepth(15).setBlendMode(Phaser.BlendModes.ADD);
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
      g.gain.setValueAtTime(P[2], ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + P[3]);
      o.connect(g); g.connect(ctx.destination); o.start(); o.stop(ctx.currentTime + P[3] + 0.02);
    } catch (e) { /* sin audio */ }
  }

  // ===================================================================================
  //  Bucle principal
  // ===================================================================================
  update(time, delta) {
    if (this.runOver) return;
    if (Phaser.Input.Keyboard.JustDown(this.keyEsc)) { this.paused = !this.paused; Bus.emit('game:pause', { paused: this.paused }); }
    if (this.paused) return;
    const dt = Math.min(0.05, delta / 1000);

    this.player.update(dt);
    for (const e of this.enemies.slice()) if (!e.dead) e.update(dt);
    this.updateBullets(dt);
    this.updateFires(dt);
    this.updateItems(dt);
    this.updateParticles(dt);
    this.updateHazards(dt);
    this.updateMines(dt);
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
        if (p.takeDamage(1, 'contact')) { p.knock(Math.atan2(p.y - e.y, p.x - e.x), 320); e.knock(Math.atan2(e.y - p.y, e.x - p.x), 120); }
      }
    }
  }

  /** Cambio de sala al cruzar una puerta abierta + apertura de puertas con llave. */
  checkDoors() {
    const p = this.player, room = this.room, { OX, OY, RW, RH, T } = CFG;
    if (this.transition) return;
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
    const frag = this.roomsCleared * 2 + (this.floor - 1) * 6 + this.bossesKilled * 12 + (win ? 25 : 0);
    Meta.addFragments(frag);
    Meta.data.runs++; if (win) Meta.data.wins++;
    Meta.data.bestFloor = Math.max(Meta.data.bestFloor, this.floor);
    Meta.data.bestRooms = Math.max(Meta.data.bestRooms, this.roomsCleared);
    Meta.save();
    Bus.emit('run:end', { win, fragments: frag, rooms: this.roomsCleared, floor: this.floor });
  }
}
