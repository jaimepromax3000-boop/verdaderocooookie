/**
 * Enemy: base de enemigos, gobernada por una Máquina de Estados Finita + A*:
 *
 *   patrol  : se mueve entre nodos libres de la sala. Si el jugador entra en su línea de visión
 *             (raycast sobre baldosas) o recibe daño, pasa a persecución.
 *   chase   : traza la ruta más corta con A* esquivando paredes y obstáculos (o va recto si ve al jugador).
 *             A la distancia óptima ejecuta su ataque.
 *   attack  : patrón propio de cada tipo: embestida, ráfaga de disparos, invocación de súbditos, jefe con fases.
 */
const ENEMY_TYPES = {
  grunt:    { tex: 'enemy_grunt',    hp: 3,  speed: 92,  r: 13, contact: 1, range: 150, name: 'Virus' },
  shooter:  { tex: 'enemy_shooter',  hp: 3,  speed: 66,  r: 12, contact: 0, range: 270, name: 'Centinela' },
  summoner: { tex: 'enemy_summoner', hp: 6,  speed: 52,  r: 14, contact: 0, range: 300, name: 'Invocador' },
  drone:    { tex: 'enemy_drone',    hp: 1,  speed: 125, r: 9,  contact: 1, range: 0,   name: 'Dron' },
  boss:     { tex: 'enemy_boss',     hp: 70, speed: 64,  r: 30, contact: 1, range: 330, name: 'Guardián del Servidor' },
};

class Enemy extends Entity {
  constructor(scene, x, y, type, scale = 1, variant = null) {
    const cfg = ENEMY_TYPES[type];
    super(scene, x, y, cfg.tex, cfg.r, cfg.hp * scale);
    this.type = type;
    this.cfg = cfg;
    this.variant = variant;                 // 'cryo' | 'toxic' | null (solo centinelas)
    this.contact = cfg.contact;
    this.spawnT = 0.7;                      // aparece con un destello y es inofensivo ese rato
    this.attackCd = 0.8 + scene.rng() * 0.8;
    this.path = null; this.pathIdx = 0; this.repathT = 0;
    this.lostT = 0;
    this.moveDir = new Phaser.Math.Vector2();
    this.baseTint = type === 'shooter' && variant ? (variant === 'cryo' ? 0x7fe9ff : 0x5dff8a) : 0xffffff;
    this.setTint(this.baseTint).setDepth(10);
    this.setAlpha(0.3);
    this.patrolTarget = null;
    this.aiming = 0;
    this.phase = 1;
    this.pattern = 0;
    this.attackTime = 0;
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
        exit() { this.charging = false; this.setTint(this.statusTint()); },
      });
    this.fsm.set('patrol');
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
    const dx = tx - this.x, dy = ty - this.y, d = Math.hypot(dx, dy) || 1;
    let vx = dx / d, vy = dy / d;
    for (const o of this.gs.enemies) {
      if (o === this || o.dead) continue;
      const ox = this.x - o.x, oy = this.y - o.y, od = Math.hypot(ox, oy);
      if (od > 0 && od < this.radius + o.radius + 4) { vx += (ox / od) * 0.6; vy += (oy / od) * 0.6; }
    }
    const l = Math.hypot(vx, vy) || 1;
    const sp = this.cfg.speed * (1 + 0.05 * (this.gs.floor - 1)) * speedMult * this.speedFactor();
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
    const sees = this.canSeePlayer(520);
    this.lostT = sees ? 0 : this.lostT + dt;
    if (this.lostT > 3.5) { fsm.set('patrol'); return; }
    const range = this.cfg.range;

    if (this.type === 'shooter' || this.type === 'summoner') {
      if (sees && dist < range * 0.6) {                 // mantiene la distancia: se aleja del jugador
        this.steer(this.x - (p.x - this.x), this.y - (p.y - this.y), 0.85, dt);
      } else if (!sees || dist > range * 0.9) {
        this.followPath(dt);
      }
      if (sees && dist < range && this.attackCd <= 0) fsm.set('attack');
      return;
    }
    this.followPath(dt, this.type === 'drone' ? 1 : 1);
    if (this.type !== 'drone' && sees && dist < range && this.attackCd <= 0) fsm.set('attack');
  }

  // ---------- ataques ----------
  beginAttack() {
    const p = this.gs.player;
    this.aimAngle = Math.atan2(p.y - this.y, p.x - this.x);
    if (this.type === 'boss') {
      const seq = this.phase === 1 ? ['ring', 'charge', 'ring', 'charge'] : ['spiral', 'summon', 'charge', 'ring'];
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
      case 'boss': this.bossAttack(fsm, dt, t); break;
      default: fsm.set('chase');
    }
  }

  bossAttack(fsm, dt, t) {
    const g = this.gs, p = g.player;
    const ring = (n, off, speed) => { for (let i = 0; i < n; i++) g.fireEnemyBullet(this.x, this.y, off + (Math.PI * 2 * i) / n, speed, 0xff2bd6, null); };
    switch (this.bossPattern) {
      case 'ring':
        if (t > 0.4 && this.attackStep === 0) { this.attackStep = 1; ring(14, g.rng() * 6, 210); }
        if (t > 0.9 && this.attackStep === 1) { this.attackStep = 2; ring(14, g.rng() * 6, 250); }
        if (t > 1.6) { this.attackCd = 0.7; fsm.set('chase'); }
        break;
      case 'charge':
        if (t < 0.7) { this.setTint(Math.floor(t * 18) % 2 ? 0xff4466 : 0xffffff); this.aimAngle = Math.atan2(p.y - this.y, p.x - this.x); }
        else if (t < 1.4) { this.charging = true; this.move(Math.cos(this.aimAngle) * 440 * dt, Math.sin(this.aimAngle) * 440 * dt); }
        else { this.charging = false; this.attackCd = 0.8; fsm.set('chase'); }
        break;
      case 'summon':
        if (t > 0.5 && this.attackStep === 0) {
          this.attackStep = 1;
          for (let i = 0; i < 3; i++) if (g.enemies.filter(e => e.type === 'drone' && !e.dead).length < 5) g.spawnEnemy('drone', this.x + (i - 1) * 40, this.y + 36, true);
        }
        if (t > 1.2) { this.attackCd = 0.6; fsm.set('chase'); }
        break;
      case 'spiral': {
        const n = Math.floor(t / 0.07);
        while (this.attackStep < n && this.attackStep < 32) { g.fireEnemyBullet(this.x, this.y, this.attackStep * 0.55 + this.aimAngle, 200, 0xffe94d, null); this.attackStep++; }
        if (t > 2.4) { this.attackCd = 0.8; fsm.set('chase'); }
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
    if (this.type === 'boss' && this.phase === 1 && this.hp < this.maxHp * 0.5) {
      this.phase = 2; this.pattern = 0;
      this.gs.floatText(this.x, this.y - 50, 'FASE 2', 0xff2bd6);
      Bus.emit('boss:phase', {});
    }
    this.fsm.update(dt);
    this.setRotation(this.type === 'grunt' ? this.gs.time.now / 400 : Math.atan2(this.moveDir.y, this.moveDir.x) + Math.PI / 2);
  }

  takeDamage(amount, source, info) {
    if (this.spawnT > 0 || this.dead) return false;
    const r = super.takeDamage(amount, source, info);
    if (!this.dead && this.fsm.is('patrol')) this.fsm.set('chase');
    return r;
  }

  die() {
    if (this.dead) return;
    this.dead = true;
    this.gs.spawnBurst(this.x, this.y, this.cfg.tex === 'enemy_boss' ? 0xff2bd6 : 0xff4466, this.type === 'boss' ? 40 : 14);
    this.gs.sfx('kill');
    Bus.emit('enemy:killed', { enemy: this });
    this.destroy();
  }
}
