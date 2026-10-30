/**
 * Player: el "Hacker de Almas".
 *  - Movimiento fluido en 8 direcciones (WASD / flechas).
 *  - Dash (Espacio / Shift): décimas de segundo de invulnerabilidad (i-frames).
 *  - Disparo direccional de 360º apuntado con el ratón (botón izquierdo, se puede mantener).
 *  - Estadísticas modificables por metaprogresión, módulos de software y buffs temporales.
 */
class Player extends Entity {
  constructor(scene, x, y, character, weaponId) {
    super(scene, x, y, 'player', 11, 1);
    this.character = character;
    this.baseTint = character.color;
    this.setTint(this.baseTint);
    this.setDepth(20);

    // --- estadísticas base + metaprogresión ---
    const m = id => Meta.level(id);
    this.maxHp = character.hp + m('hp');
    this.hp = this.maxHp;
    this.maxShield = character.shield + m('shield');
    this.shield = this.maxShield;
    this.shieldRegen = 6.5 - 1.6 * m('regen');          // segundos por punto de escudo
    this.moveSpeed = 185 * character.speed * (1 + 0.06 * m('speed'));
    this.damageMult = character.damage * (1 + 0.10 * m('dmg'));
    this.dashCooldown = 0.9 * (1 - 0.12 * m('dash'));
    this.luck = m('luck');
    this.credits = 15 * m('credits');
    this.keys = m('key') ? 1 : 0;

    this.weapon = WEAPONS[weaponId] || WEAPONS.pulse;
    this.modules = {};                                  // id -> acumulaciones
    this.buffs = {};                                    // name -> { time, duration, power }

    // --- estado de combate ---
    this.fireT = 0;
    this.dashT = 0;           // tiempo restante del dash en curso
    this.dashCdT = 0;
    this.iframes = 0;         // invulnerabilidad (dash + tras recibir daño)
    this.hitInvuln = 0;
    this.lastHitT = 0;
    this.shieldT = 0;
    this.dashDir = new Phaser.Math.Vector2(1, 0);
    this.aimAngle = 0;

    const kb = scene.input.keyboard;
    this.keys2 = kb.addKeys({
      w: 'W', a: 'A', s: 'S', d: 'D', up: 'UP', left: 'LEFT', down: 'DOWN', right: 'RIGHT', space: 'SPACE', shift: 'SHIFT',
    });
  }

  stack(id) { return this.modules[id] || 0; }

  baseDamage() { return this.weapon.damage * this.damageMult; }

  addModule(id) {
    const def = Modules.defs[id];
    if (this.stack(id) >= def.max) return false;
    this.modules[id] = this.stack(id) + 1;
    if (def.onAcquire) def.onAcquire(this);
    Bus.emit('player:module', { id, stacks: this.modules[id] });
    return true;
  }

  heal(n) {
    if (this.hp >= this.maxHp) return;
    this.hp = Math.min(this.maxHp, this.hp + n);
    Bus.emit('player:heal', { amount: n });
  }

  addBuff(name, duration, power) {
    this.buffs[name] = { time: duration, duration, power };
  }

  /** Factor de velocidad total (buffs, ralentización). */
  speedMult() {
    const b = this.buffs.speed;
    return (b ? b.power : 1) * this.speedFactor();
  }

  /** Construye la especificación de un disparo: arma + módulos (mods) + daño del jugador. */
  shotSpec() {
    const w = this.weapon;
    const spec = {
      owner: 'player', damage: w.damage * this.damageMult, speed: w.speed, life: w.life, pierce: w.pierce,
      bounces: 0, size: w.size, color: w.color, homing: 0, tags: [], rateMult: 1,
    };
    for (const [id, n] of Object.entries(this.modules)) {
      const def = Modules.defs[id];
      if (def.mod) def.mod(spec, n, this);
    }
    return spec;
  }

  shoot() {
    const spec = this.shotSpec();
    const w = this.weapon;
    for (let i = 0; i < w.pellets; i++) {
      let a = this.aimAngle;
      if (w.pellets > 1) a += (i / (w.pellets - 1) - 0.5) * w.spread + (this.gs.rng() - 0.5) * 0.08;
      else a += (this.gs.rng() - 0.5) * w.spread;
      this.gs.fireBullet(Object.assign({}, spec, { tags: spec.tags.slice() }), this.x + Math.cos(a) * 14, this.y + Math.sin(a) * 14, a);
    }
    this.fireT = 1 / (w.rate * spec.rateMult);
    this.gs.sfx('shoot');
  }

  tryDash(dir) {
    if (this.dashCdT > 0 || this.dashT > 0) return;
    this.dashDir.copy(dir.lengthSq() ? dir : new Phaser.Math.Vector2(Math.cos(this.aimAngle), Math.sin(this.aimAngle))).normalize();
    this.dashT = 0.18;
    this.dashCdT = this.dashCooldown;
    this.iframes = Math.max(this.iframes, 0.28);   // i-frames del dash
    this.gs.sfx('dash');
    Bus.emit('player:dash', { player: this });
  }

  update(dt) {
    if (this.dead) return;
    const k = this.keys2;
    const dir = new Phaser.Math.Vector2(
      (k.d.isDown || k.right.isDown ? 1 : 0) - (k.a.isDown || k.left.isDown ? 1 : 0),
      (k.s.isDown || k.down.isDown ? 1 : 0) - (k.w.isDown || k.up.isDown ? 1 : 0));
    if (dir.lengthSq()) dir.normalize();

    // apuntado con el ratón (coordenadas de mundo)
    const p = this.gs.input.activePointer;
    this.aimAngle = Math.atan2(p.worldY - this.y, p.worldX - this.x);
    this.setRotation(this.aimAngle + Math.PI / 2);

    if (Phaser.Input.Keyboard.JustDown(k.space) || Phaser.Input.Keyboard.JustDown(k.shift)) this.tryDash(dir.clone());

    if (this.dashT > 0) {
      this.dashT -= dt;
      this.move(this.dashDir.x * 600 * dt, this.dashDir.y * 600 * dt);
      this.gs.afterimage(this);
      Bus.emit('player:dashTick', { x: this.x, y: this.y });
    } else {
      const sp = this.moveSpeed * this.speedMult();
      this.move(dir.x * sp * dt, dir.y * sp * dt);
    }

    this.dashCdT = Math.max(0, this.dashCdT - dt);
    this.iframes = Math.max(0, this.iframes - dt);
    this.fireT -= dt;
    if ((p.isDown && p.leftButtonDown() || this.gs.autoFire) && this.fireT <= 0 && !this.gs.inputLocked) this.shoot();

    // recarga de escudo si lleva un rato sin recibir daño
    this.lastHitT += dt;
    if (this.shield < this.maxShield && this.lastHitT > 3) {
      this.shieldT += dt;
      if (this.shieldT >= this.shieldRegen) { this.shieldT = 0; this.shield++; }
    }

    for (const [name, b] of Object.entries(this.buffs)) { b.time -= dt; if (b.time <= 0) delete this.buffs[name]; }
    this.updateStatuses(dt);

    // parpadeo mientras es invulnerable
    this.setAlpha(this.iframes > 0 ? 0.45 + 0.35 * Math.sin(this.gs.time.now / 40) : 1);
  }

  takeDamage(amount, source, info) {
    if (this.dead || this.iframes > 0) return false;
    if (info && info.silent) {                      // veneno: no usa escudo ni invulnerabilidad
      this.hp -= amount;
      if (this.hp <= 0) this.die(source);
      return true;
    }
    this.lastHitT = 0; this.shieldT = 0;
    this.iframes = 0.9;
    this.flash = 0.12;
    let left = amount;
    if (this.shield > 0) { const s = Math.min(this.shield, Math.ceil(left)); this.shield -= s; left -= s; }
    if (left > 0) this.hp -= left;
    Bus.emit('player:hit', { damage: amount, crit: amount >= 2 || this.hp <= 1 });
    if (this.hp <= 0) this.die(source);
    return true;
  }

  die() {
    if (this.dead) return;
    this.dead = true;
    this.setVisible(false);
    Bus.emit('player:dead', {});
  }
}
