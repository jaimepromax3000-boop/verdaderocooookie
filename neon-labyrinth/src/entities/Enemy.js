/**
 * Enemy: base de enemigos, gobernada por una Máquina de Estados Finita + A*:
 *
 *   patrol  : se mueve entre nodos libres de la sala. Si el jugador entra en su línea de visión
 *             (raycast sobre baldosas) o recibe daño, pasa a persecución.
 *   chase   : traza la ruta más corta con A* esquivando paredes y obstáculos (o va recto si ve al jugador).
 *             A la distancia óptima ejecuta su ataque.
 *   attack  : patrón propio de cada tipo (embestida, ráfaga, francotirador con aviso láser, bomba suicida,
 *             invocación, teletransporte, onda del blindado...). Los jefes encadenan patrones por fases.
 *
 * Además existen ÉLITES (afijos: veloz / volátil / blindado) con aura de color y mejores recompensas.
 */
const ENEMY_TYPES = {
  grunt:    { tex: 'enemy_grunt',    hp: 3,  speed: 92,  r: 13, contact: 1, range: 150, name: 'Virus',          color: 0xff4466 },
  shooter:  { tex: 'enemy_shooter',  hp: 3,  speed: 66,  r: 12, contact: 0, range: 270, name: 'Centinela',      color: 0xff9a3c },
  summoner: { tex: 'enemy_summoner', hp: 6,  speed: 52,  r: 14, contact: 0, range: 300, name: 'Invocador',      color: 0xff2bd6 },
  drone:    { tex: 'enemy_drone',    hp: 1,  speed: 125, r: 9,  contact: 1, range: 0,   name: 'Dron',           color: 0xffe94d },
  sniper:   { tex: 'enemy_sniper',   hp: 3,  speed: 58,  r: 12, contact: 0, range: 480, name: 'Francotirador',  color: 0xb6ff3c },
  tank:     { tex: 'enemy_tank',     hp: 14, speed: 44,  r: 17, contact: 1, range: 210, name: 'Blindado',       color: 0xff6a4c },
  bomber:   { tex: 'enemy_bomber',   hp: 2,  speed: 150, r: 11, contact: 0, range: 78,  name: 'Bomba lógica',   color: 0xffb03c },
  turret:   { tex: 'enemy_turret',   hp: 7,  speed: 0,   r: 14, contact: 0, range: 430, name: 'Torreta',        color: 0xffd23c },
  blinker:  { tex: 'enemy_blinker',  hp: 4,  speed: 62,  r: 12, contact: 0, range: 330, name: 'Espectro',       color: 0x3cf0c8 },
  splitter: { tex: 'enemy_splitter', hp: 6,  speed: 76,  r: 14, contact: 1, range: 0,   name: 'Fractal',        color: 0x7dff3c },
  splitlet: { tex: 'enemy_splitter', hp: 2,  speed: 120, r: 8,  contact: 1, range: 0,   name: 'Fragmento',      color: 0x7dff3c, scale: 0.58 },
  boss:     { tex: 'enemy_boss1',    hp: 80, speed: 62,  r: 30, contact: 1, range: 330, name: 'Guardián',       color: 0xff2bd6 },
};

/** Un jefe distinto por planta. */
const BOSS_INFO = [
  null,
  { tex: 'enemy_boss1', name: 'Guardián del Servidor', color: 0xff2bd6, phases: 2 },
  { tex: 'enemy_boss2', name: 'Hidra de Datos',        color: 0xff9a3c, phases: 2 },
  { tex: 'enemy_boss3', name: 'Núcleo Corrupto',       color: 0x9b5cff, phases: 3 },
  { tex: 'enemy_boss4', name: 'Centinela Prisma',      color: 0x00f0ff, phases: 2 },
  { tex: 'enemy_boss5', name: 'Coloso de Hierro',      color: 0xff4466, phases: 2 },
  { tex: 'enemy_boss6', name: 'Emperador del Vacío',   color: 0xffd23c, phases: 3 },
];
/** Qué jefe aparece en cada planta (las plantas 7-9 repiten diseños en versión Mk II). */
const bossKindFor = f => (f >= CFG.FLOORS ? 6 : f <= 6 ? f : ((f - 1) % 6) + 1);
/** Versión del jefe: las plantas 7-12 son Mk II, 13-18 Mk III, 19-24 Mk IV y la última Mk V. */
const bossSuffix = f => { const t = f >= CFG.FLOORS ? 5 : Math.floor((f - 1) / 6) + 1; return t > 1 ? ' Mk ' + ['', '', 'II', 'III', 'IV', 'V'][t] : ''; };
/** Escalado de vida de enemigos con la profundidad (se suaviza a partir de la planta 10). */
const depthHp = f => (f <= 10 ? 1 + 0.28 * (f - 1) : 1 + 0.28 * 9 + 0.17 * (f - 10));
const depthBossHp = f => (f <= 10 ? 1 + 0.4 * (f - 1) : 1 + 0.4 * 9 + 0.22 * (f - 10));
/** Daño enemigo extra en plantas profundas (1 hasta la 10). */
const depthDmg = f => 1 + 0.03 * Math.max(0, f - 10);

const BOSS_SEQ = {
  1: { 1: ['ring', 'charge', 'ring', 'charge'],                 2: ['spiral', 'summon', 'charge', 'ring'] },
  2: { 1: ['fan', 'charge', 'fan', 'turrets'],                  2: ['fan', 'spiral', 'charge', 'turrets', 'ring'] },
  3: { 1: ['blink', 'ring', 'rain', 'summon'],                  2: ['blink', 'spiral', 'rain', 'fan'], 3: ['blink', 'spiral', 'rain', 'ring', 'fan'] },
  4: { 1: ['cross', 'fan', 'charge', 'barrage'],                2: ['cross', 'spiral', 'blink', 'barrage'] },
  5: { 1: ['charge', 'turrets', 'ring', 'barrage'],             2: ['charge', 'rain', 'summon', 'cross'] },
  6: { 1: ['blink', 'cross', 'rain', 'summon'],                 2: ['barrage', 'spiral', 'blink', 'turrets'], 3: ['blink', 'cross', 'spiral', 'rain', 'barrage', 'ring'] },
};

/** Afijos de élite: color del aura y efecto. */
const ELITE_AFFIX = {
  fast:     { name: 'Veloz',    color: 0x00f0ff },
  volatile: { name: 'Volátil',  color: 0xff9a3c },
  armored:  { name: 'Blindado', color: 0xc0c8ff },
};

class Enemy extends Entity {
  constructor(scene, x, y, type, scale = 1, variant = null, elite = null) {
    const cfg = ENEMY_TYPES[type];
    const info = type === 'boss' ? BOSS_INFO[bossKindFor(scene.floor)] : null;
    const eliteHp = elite ? (elite === 'armored' ? 2.6 : 2) : 1;
    super(scene, x, y, info ? info.tex : cfg.tex, cfg.r * (elite ? 1.15 : 1), cfg.hp * scale * eliteHp);
    this.type = type;
    this.cfg = cfg;
    this.bossInfo = info;
    this.bossName = info ? info.name + bossSuffix(scene.floor) : null;
    this.color = info ? info.color : cfg.color;
    this.elite = elite;
    this.variant = variant;                 // 'cryo' | 'toxic' | null (solo centinelas)
    this.contact = cfg.contact;
    this.spawnT = 0.7;                      // aparece con un destello y es inofensivo ese rato
    this.attackCd = 0.8 + scene.rng() * 0.8;
    this.path = null; this.pathIdx = 0; this.repathT = 0;
    this.lostT = 0;
    this.moveDir = new Phaser.Math.Vector2();
    this.baseTint = type === 'shooter' && variant ? (variant === 'cryo' ? 0x7fe9ff : 0x5dff8a) : 0xffffff;
    this.setTint(this.baseTint).setDepth(10);
    const bs = Art.scaleOf(this.texture.key);
    if (cfg.scale) this.setScale(cfg.scale * bs);
    if (elite) this.setScale((cfg.scale || 1) * 1.25 * bs);
    this.setAlpha(0.3);
    this.patrolTarget = null;
    this.aiming = 0;
    this.phase = 1;
    this.pattern = 0;
    this.attackTime = 0;
    this.eliteSpeed = elite === 'fast' ? 1.4 : 1;
    this.telegraph = null;                  // ángulo del aviso láser (francotirador)

    const gr = this.radius / 14 + (elite ? 1.5 : 0.9) + (type === 'boss' ? 1.6 : 0);
    this.glowImg = scene.add.image(x, y, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(elite ? ELITE_AFFIX[elite].color : this.color)
      .setAlpha(elite ? 0.5 : 0.28).setScale(gr).setDepth(9);

    this.fsm = new StateMachine(this)
      .add('patrol', {
        enter() { this.patrolTarget = null; this.senseT = 0; },
        update(fsm, dt) {
          this.senseT -= dt;
          if (!this.patrolTarget || this.reached(this.patrolTarget, 10)) this.patrolTarget = this.gs.randomFreePoint(this.radius);
          this.steer(this.patrolTarget.x, this.patrolTarget.y, 0.45, dt);
          if (this.senseT <= 0) {
            this.senseT = 0.2;
            if (this.canSeePlayer(380)) fsm.set('chase');
          }
        },
      })
      .add('chase', {
        enter() { this.repathT = 0; this.lostT = 0; },
        update(fsm, dt) { this.chaseUpdate(fsm, dt); },
      })
      .add('attack', {
        enter() { this.attackTime = 0; this.attackStep = 0; this.beginAttack(); },
        update(fsm, dt) { this.attackTime += dt; this.attackUpdate(fsm, dt); },
        exit() { this.charging = false; this.telegraph = null; this.setTint(this.statusTint()); },
      });
    this.fsm.set(type === 'turret' || type === 'boss' ? 'chase' : 'patrol');
  }

  preUpdate(t, d) {
    super.preUpdate(t, d);
    if (this.glowImg) this.glowImg.setPosition(this.x, this.y).setVisible(this.visible);
  }

  destroy(fromScene) {
    if (this.glowImg) { this.glowImg.destroy(); this.glowImg = null; }
    super.destroy(fromScene);
  }

  // ---------- utilidades de navegación ----------
  tile() {
    return { x: Math.floor((this.x - CFG.OX) / CFG.T), y: Math.floor((this.y - CFG.OY) / CFG.T) };
  }

  reached(p, d) { return (p.x - this.x) ** 2 + (p.y - this.y) ** 2 < d * d; }

  canSeePlayer(maxDist) {
    const p = this.gs.player;
    if (!p || p.dead) return false;
    if ((p.x - this.x) ** 2 + (p.y - this.y) ** 2 > maxDist * maxDist) return false;
    const a = this.tile(), b = p.tileXY();
    return Pathfinding.lineOfSight(this.gs.blocked, CFG.RW, a.x, a.y, b.x, b.y);   // raycast sobre baldosas
  }

  /** Avanza hacia un punto con separación suave entre enemigos. */
  steer(tx, ty, speedMult, dt) {
    if (!this.cfg.speed) return;
    const dx = tx - this.x, dy = ty - this.y, d = Math.hypot(dx, dy) || 1;
    let vx = dx / d, vy = dy / d;
    for (const o of this.gs.enemies) {
      if (o === this || o.dead) continue;
      const ox = this.x - o.x, oy = this.y - o.y, od = Math.hypot(ox, oy);
      if (od > 0 && od < this.radius + o.radius + 4) { vx += (ox / od) * 0.6; vy += (oy / od) * 0.6; }
    }
    const l = Math.hypot(vx, vy) || 1;
    const sp = this.cfg.speed * (1 + 0.05 * Math.min(12, this.gs.floor - 1)) * speedMult * this.speedFactor() * this.eliteSpeed * this.gs.diff.speed;
    this.move((vx / l) * sp * dt, (vy / l) * sp * dt);
    this.moveDir.set(vx / l, vy / l);
  }

  /** Sigue una ruta A* hacia el jugador (o va directo si lo ve y no hay obstáculos). */
  followPath(dt, speedMult = 1) {
    const p = this.gs.player;
    this.repathT -= dt;
    const a = this.tile(), b = p.tileXY();
    const direct = Pathfinding.lineOfSight(this.gs.blocked, CFG.RW, a.x, a.y, b.x, b.y);
    if (direct) { this.path = null; this.steer(p.x, p.y, speedMult, dt); return; }
    if (!this.path || this.repathT <= 0) {
      this.path = Pathfinding.astar(this.gs.blocked, CFG.RW, CFG.RH, a.x, a.y, b.x, b.y);
      this.pathIdx = 0;
      this.repathT = 0.35;
    }
    if (this.path && this.pathIdx < this.path.length) {
      const n = this.path[this.pathIdx];
      const wx = CFG.OX + (n.x + 0.5) * CFG.T, wy = CFG.OY + (n.y + 0.5) * CFG.T;
      this.steer(wx, wy, speedMult, dt);
      if (this.reached({ x: wx, y: wy }, 9)) this.pathIdx++;
    } else {
      this.steer(p.x, p.y, speedMult, dt);
    }
  }

  chaseUpdate(fsm, dt) {
    const p = this.gs.player;
    this.attackCd -= dt;
    const dist = Math.hypot(p.x - this.x, p.y - this.y);
    const sees = this.canSeePlayer(this.type === 'sniper' ? 620 : 520);
    const range = this.cfg.range;

    if (this.type === 'turret') {                       // fija en su sitio: solo apunta y dispara
      this.moveDir.set(p.x - this.x, p.y - this.y).normalize();
      if (sees && dist < range && this.attackCd <= 0) fsm.set('attack');
      return;
    }
    if (this.type === 'boss') {                         // los jefes nunca pierden al jugador
      if (dist > range * 0.55 || !sees) this.followPath(dt, 0.8);
      if (this.attackCd <= 0) fsm.set('attack');
      return;
    }

    this.lostT = sees ? 0 : this.lostT + dt;
    if (this.lostT > 3.5) { fsm.set('patrol'); return; }

    if (this.type === 'shooter' || this.type === 'summoner' || this.type === 'sniper' || this.type === 'blinker') {
      const keep = this.type === 'sniper' ? 0.78 : this.type === 'blinker' ? 0.5 : 0.6;
      if (sees && dist < range * keep) {                // mantiene la distancia: se aleja del jugador
        this.steer(this.x - (p.x - this.x), this.y - (p.y - this.y), 0.85, dt);
      } else if (!sees || dist > range * 0.9) {
        this.followPath(dt);
      }
      if (sees && dist < range && this.attackCd <= 0) fsm.set('attack');
      return;
    }
    if (this.type === 'bomber') {
      this.followPath(dt);
      if (dist < range) fsm.set('attack');
      return;
    }
    this.followPath(dt);
    if ((this.type === 'grunt' || this.type === 'tank') && sees && dist < range && this.attackCd <= 0) fsm.set('attack');
  }

  // ---------- ataques ----------
  beginAttack() {
    const p = this.gs.player;
    this.aimAngle = Math.atan2(p.y - this.y, p.x - this.x);
    if (this.type === 'boss') {
      const seq = BOSS_SEQ[bossKindFor(this.gs.floor)][this.phase];
      this.bossPattern = seq[this.pattern++ % seq.length];
    }
  }

  attackUpdate(fsm, dt) {
    const g = this.gs, p = g.player, t = this.attackTime;
    switch (this.type) {
      case 'grunt': {                                    // embestida: aviso -> carga -> descanso
        if (t < 0.5) { this.setTint(Math.floor(t * 20) % 2 ? 0xff4466 : 0xffffff); this.aimAngle = Math.atan2(p.y - this.y, p.x - this.x); }
        else if (t < 1.0) {
          this.charging = true; this.setTint(0xff4466);
          this.move(Math.cos(this.aimAngle) * 360 * dt, Math.sin(this.aimAngle) * 360 * dt);
        } else if (t < 1.6) { this.charging = false; this.setTint(this.statusTint()); }
        else { this.attackCd = 1.2; fsm.set('chase'); }
        break;
      }
      case 'shooter': {                                  // ráfaga de 3 disparos
        const shots = Math.floor(t / 0.16);
        if (shots > this.attackStep && this.attackStep < 3) {
          this.attackStep++;
          const a = Math.atan2(p.y - this.y, p.x - this.x);
          const st = this.variant === 'cryo' ? { name: 'slow', duration: 2.0, power: 0.55 } : this.variant === 'toxic' ? { name: 'poison', duration: 3, power: 0.6 } : null;
          g.fireEnemyBullet(this.x, this.y, a, 250, this.variant === 'cryo' ? 0x7fe9ff : this.variant === 'toxic' ? 0x5dff8a : 0xff4466, st);
        }
        if (t > 0.16 * 3 + 0.3) { this.attackCd = 1.5 + g.rng() * 0.5; fsm.set('chase'); }
        break;
      }
      case 'summoner': {                                 // invoca drones (máximo 4 vivos)
        if (t < 0.6) this.setTint(Math.floor(t * 14) % 2 ? 0xff2bd6 : 0xffffff);
        else {
          if (!this.attackStep) {
            this.attackStep = 1;
            const alive = g.enemies.filter(e => !e.dead && e.type === 'drone').length;
            for (let i = 0; i < 2 && alive + i < 4; i++) g.spawnEnemy('drone', this.x + (i ? 22 : -22), this.y + 10, true);
          }
          if (t > 0.9) { this.attackCd = 4.5; fsm.set('chase'); }
        }
        break;
      }
      case 'sniper': {                                   // aviso láser (sigue al jugador) -> bloqueo -> disparo potente
        if (t < 0.6) this.aimAngle = Math.atan2(p.y - this.y, p.x - this.x);
        this.telegraph = t < 0.95 ? this.aimAngle : null;
        this.moveDir.set(Math.cos(this.aimAngle), Math.sin(this.aimAngle));
        if (t >= 0.95 && !this.attackStep) {
          this.attackStep = 1;
          g.fireBullet({ owner: 'enemy', damage: g.enemyDmg(), speed: 640, life: 1.6, pierce: 0, bounces: 0, size: 1.35, color: 0xb6ff3c, homing: 0, tags: [], status: null }, this.x, this.y, this.aimAngle);
          g.sfx('shoot');
        }
        if (t > 1.3) { this.attackCd = 2.6 + g.rng() * 0.8; fsm.set('chase'); }
        break;
      }
      case 'tank': {                                     // golpe de suelo: onda de balas lentas
        if (t < 0.8) { this.setTint(Math.floor(t * 16) % 2 ? 0xffe94d : 0xffffff); this.x += (g.rng() - 0.5) * 1.2; }
        else if (!this.attackStep) {
          this.attackStep = 1;
          g.enemyExplosion(this.x, this.y, 74, 1, 0xff6a4c);
          for (let i = 0; i < 12; i++) g.fireEnemyBullet(this.x, this.y, (Math.PI * 2 * i) / 12 + 0.13, 175, 0xff6a4c, null);
          g.cameras.main.shake(140, 0.005);
        }
        if (t > 1.3) { this.attackCd = 3.0; fsm.set('chase'); }
        break;
      }
      case 'bomber': {                                   // cuenta atrás y explota
        this.setTint(Math.floor(t * 22) % 2 ? 0xff2244 : 0xffffff);
        this.steer(p.x, p.y, 0.5, dt);
        if (t > 0.65) { g.enemyExplosion(this.x, this.y, 80, 2, 0xffb03c); this.die(); }
        break;
      }
      case 'turret': {                                   // ráfaga de 5 disparos con ligera dispersión
        const shots = Math.floor(t / 0.12);
        if (shots > this.attackStep && this.attackStep < 5) {
          this.attackStep++;
          const a = Math.atan2(p.y - this.y, p.x - this.x) + (g.rng() - 0.5) * 0.35;
          g.fireEnemyBullet(this.x, this.y, a, 240, 0xffd23c, null);
        }
        if (t > 0.12 * 5 + 0.2) { this.attackCd = 2.1 + g.rng() * 0.6; fsm.set('chase'); }
        break;
      }
      case 'blinker': {                                  // desaparece, reaparece cerca y dispara en abanico
        if (t < 0.25) this.setAlpha(1 - t / 0.25);
        else if (!this.attackStep) {
          this.attackStep = 1;
          let pt = null;
          for (let i = 0; i < 14 && !pt; i++) {
            const c = g.randomFreePoint(this.radius, 120);
            const d = Math.hypot(c.x - p.x, c.y - p.y), a = g.tileOf(c), b = p.tileXY();
            if (d < 280 && Pathfinding.lineOfSight(g.blocked, CFG.RW, a.x, a.y, b.x, b.y)) pt = c;
          }
          pt = pt || g.randomFreePoint(this.radius, 120);
          g.spawnBurst(this.x, this.y, 0x3cf0c8, 8);
          this.x = pt.x; this.y = pt.y;
          g.spawnBurst(this.x, this.y, 0x3cf0c8, 8);
        } else if (t < 0.5) this.setAlpha((t - 0.25) / 0.25);
        else {
          this.setAlpha(1);
          if (this.attackStep === 1) {
            this.attackStep = 2;
            const a = Math.atan2(p.y - this.y, p.x - this.x);
            for (let i = -1; i <= 1; i++) g.fireEnemyBullet(this.x, this.y, a + i * 0.28, 235, 0x3cf0c8, null);
          }
          if (t > 0.9) { this.attackCd = 3.0 + g.rng(); fsm.set('chase'); }
        }
        break;
      }
      case 'boss': this.bossAttack(fsm, dt, t); break;
      default: fsm.set('chase');
    }
  }

  bossAttack(fsm, dt, t) {
    const g = this.gs, p = g.player, col = this.color;
    const ring = (n, off, speed, c = col) => { for (let i = 0; i < n; i++) g.fireEnemyBullet(this.x, this.y, off + (Math.PI * 2 * i) / n, speed, c, null); };
    const aliveOf = type => g.enemies.filter(e => e.type === type && !e.dead).length;
    const done = (cd) => { this.attackCd = cd; fsm.set('chase'); };
    switch (this.bossPattern) {
      case 'ring':
        if (t > 0.4 && this.attackStep === 0) { this.attackStep = 1; ring(14, g.rng() * 6, 210); }
        if (t > 0.9 && this.attackStep === 1) { this.attackStep = 2; ring(14, g.rng() * 6, 250); }
        if (t > 1.6) done(0.7);
        break;
      case 'charge':
        if (t < 0.7) { this.setTint(Math.floor(t * 18) % 2 ? 0xff4466 : 0xffffff); this.aimAngle = Math.atan2(p.y - this.y, p.x - this.x); }
        else if (t < 1.4) { this.charging = true; this.move(Math.cos(this.aimAngle) * 440 * dt, Math.sin(this.aimAngle) * 440 * dt); }
        else { this.charging = false; done(0.8); }
        break;
      case 'summon': {
        const kind = this.gs.floor >= 3 ? 'blinker' : 'drone', cap = kind === 'drone' ? 5 : 3;
        if (t > 0.5 && this.attackStep === 0) {
          this.attackStep = 1;
          for (let i = 0; i < (kind === 'drone' ? 3 : 2); i++) if (aliveOf(kind) < cap) g.spawnEnemy(kind, this.x + (i - 1) * 44, this.y + 40, true);
        }
        if (t > 1.2) done(0.6);
        break;
      }
      case 'spiral': {
        const n = Math.floor(t / 0.07);
        while (this.attackStep < n && this.attackStep < 32) { g.fireEnemyBullet(this.x, this.y, this.attackStep * 0.55 + this.aimAngle, 200, 0xffe94d, null); this.attackStep++; }
        if (t > 2.4) done(0.8);
        break;
      }
      case 'fan': {                                      // tres abanicos dirigidos al jugador
        const steps = [0.4, 0.75, 1.1];
        if (this.attackStep < 3 && t > steps[this.attackStep]) {
          this.attackStep++;
          const a = Math.atan2(p.y - this.y, p.x - this.x);
          for (let i = -3; i <= 3; i++) g.fireEnemyBullet(this.x, this.y, a + i * 0.15, 230, col, null);
        }
        if (t > 1.7) done(0.6);
        break;
      }
      case 'turrets':
        if (t > 0.5 && this.attackStep === 0) {
          this.attackStep = 1;
          for (let i = 0; i < 2 && aliveOf('turret') < 3; i++) { const pt = g.randomFreePoint(14, 130); g.spawnEnemy('turret', pt.x, pt.y, true); }
        }
        if (t > 1.2) done(0.6);
        break;
      case 'blink': {
        if (t < 0.3) this.setAlpha(1 - t / 0.3);
        else if (this.attackStep === 0) {
          this.attackStep = 1;
          const pt = g.randomFreePoint(this.radius, 170);
          g.spawnBurst(this.x, this.y, col, 16);
          this.x = pt.x; this.y = pt.y;
          g.spawnBurst(this.x, this.y, col, 16);
        } else if (t < 0.6) this.setAlpha((t - 0.3) / 0.3);
        else {
          this.setAlpha(1);
          if (this.attackStep === 1) { this.attackStep = 2; ring(12, g.rng() * 6, 225); }
          if (t > 1.2) done(0.5);
        }
        break;
      }
      case 'cross': {                                    // cuatro brazos de balas que giran
        const n = Math.floor(t / 0.13);
        while (this.attackStep < n && this.attackStep < 16) {
          const base = this.attackStep * 0.28 + this.aimAngle;
          for (let k = 0; k < 4; k++) g.fireEnemyBullet(this.x, this.y, base + k * Math.PI / 2, 215, col, null);
          this.attackStep++;
        }
        if (t > 2.3) done(0.7);
        break;
      }
      case 'barrage': {                                  // tres ráfagas rápidas dirigidas al jugador
        const starts = [0.4, 0.9, 1.4];
        const burst = Math.floor((t - 0.4) / 0.5);
        if (t > 0.4 && burst < 3 && this.attackStep < burst * 3 + Math.min(3, Math.floor(((t - 0.4) % 0.5) / 0.1) + 1)) {
          this.attackStep++;
          g.fireEnemyBullet(this.x, this.y, Math.atan2(p.y - this.y, p.x - this.x) + (g.rng() - 0.5) * 0.1, 300, col, null);
        }
        if (t > 2.0) done(0.6);
        break;
      }
      case 'rain': {                                     // lluvia de balas desde el borde superior
        const n = Math.floor(t / 0.1);
        while (this.attackStep < n && this.attackStep < 22) {
          this.attackStep++;
          const x = Phaser.Math.Clamp(p.x + (g.rng() - 0.5) * 360, CFG.OX + 40, CFG.OX + CFG.RW * CFG.T - 40);
          g.fireEnemyBullet(x, CFG.OY + 36, Math.PI / 2 + (g.rng() - 0.5) * 0.25, 250, 0xffe94d, null);
        }
        if (t > 2.5) done(0.7);
        break;
      }
      default: fsm.set('chase');
    }
  }

  // ---------- ciclo de vida ----------
  update(dt) {
    if (this.dead) return;
    this.updateStatuses(dt);
    if (this.dead) return;
    if (this.spawnT > 0) {                               // destello de aparición
      this.spawnT -= dt;
      this.setAlpha(0.3 + 0.7 * (1 - this.spawnT / 0.7));
      if (this.spawnT <= 0) this.setAlpha(1);
      return;
    }
    if (this.statuses.stun) {                            // aturdido (EMP): interrumpe cualquier ataque
      this.charging = false; this.telegraph = null;
      if (!this.fsm.is('chase')) this.fsm.set('chase');
      return;
    }
    if (this.type === 'boss') {
      const frac = this.hp / this.maxHp, maxPh = this.bossInfo.phases;
      const want = maxPh === 3 && frac < 0.33 ? 3 : frac < (maxPh === 3 ? 0.66 : 0.5) ? 2 : 1;
      if (want > this.phase) {
        this.phase = want; this.pattern = 0;
        this.gs.floatText(this.x, this.y - 50, 'FASE ' + want, this.color);
        this.gs.spawnBurst(this.x, this.y, this.color, 30);
        this.gs.cameras.main.shake(320, 0.01);
        Bus.emit('boss:phase', { phase: want, name: this.bossInfo.name });
      }
    }
    this.fsm.update(dt);
    if (this.dead) return;
    if (this.type === 'turret') this.setRotation(Math.atan2(this.moveDir.y, this.moveDir.x) + Math.PI / 2);
    else this.setRotation(this.type === 'grunt' || this.type === 'splitter' || this.type === 'splitlet' || this.type === 'bomber' ? this.gs.time.now / 400 : Math.atan2(this.moveDir.y, this.moveDir.x) + Math.PI / 2);
  }

  takeDamage(amount, source, info) {
    if (this.spawnT > 0 || this.dead) return false;
    if (this.elite === 'armored') amount *= 0.55;
    const r = super.takeDamage(amount, source, info);
    if (!this.dead && this.fsm.is('patrol')) this.fsm.set('chase');
    return r;
  }

  die() {
    if (this.dead) return;
    this.dead = true;
    const g = this.gs;
    if (this.type === 'boss') { g.bossDeath(this); return; }          // los jefes mueren con una secuencia animada
    const big = false;
    g.spawnBurst(this.x, this.y, this.color, big ? 50 : this.elite ? 24 : 14);
    g.ringFx(this.x, this.y, big ? 120 : this.elite ? 50 : 28, this.color);
    if (big) {
      g.cameras.main.shake(500, 0.014); g.cameras.main.flash(260, 255, 255, 255);
      for (let i = 0; i < 6; i++) g.time.delayedCall(i * 90, () => g.ringFx(this.x + (g.rng() - 0.5) * 60, this.y + (g.rng() - 0.5) * 60, 60, this.color));
    }
    g.sfx('kill');
    if (this.elite === 'volatile') g.enemyExplosion(this.x, this.y, 85, 1, 0xff9a3c);
    if (this.type === 'splitter') {                       // se parte en dos fragmentos (antes de avisar de la baja)
      for (let i = 0; i < 2; i++) g.spawnEnemy('splitlet', this.x + (i ? 14 : -14), this.y + (i ? 6 : -6), true).spawnT = 0.3;
    }
    Bus.emit('enemy:killed', { enemy: this });
    this.destroy();
  }
}
