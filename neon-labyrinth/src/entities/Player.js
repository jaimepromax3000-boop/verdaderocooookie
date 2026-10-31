/**
 * Player: el "Hacker de Almas".
 *  - Movimiento fluido en 8 direcciones (WASD / flechas).
 *  - Dash (Espacio / Shift): décimas de segundo de invulnerabilidad (i-frames).
 *  - Disparo direccional de 360º apuntado con el ratón (botón izquierdo, se puede mantener).
 *  - Estadísticas modificables por metaprogresión, módulos de software y buffs temporales.
 */
class Player extends Entity {
  constructor(scene, x, y, character, weaponId, skinId = 'operator') {
    super(scene, x, y, Art.playerKey(scene, skinId), 11, 1);
    this.wpImg = scene.add.image(x, y, character.wp).setDepth(21);
    this.character = character;
    this.baseTint = 0xffffff;                           // la nave ya trae sus colores
    this.setDepth(20);
    this.glowImg = scene.add.image(x, y, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(character.color).setAlpha(0.45).setScale(1.7).setDepth(19);
    this.engineT = 0;
    this.orbiters = [];                                 // satélites (habilidad del Daemon y módulo 'orbit')
    this.phaseT = 0;                                    // fase espectral activa

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
    this.ability = character.ability;
    this.abilityCooldown = this.ability.cd * (1 - 0.12 * m('ability'));
    this.abilityCdT = this.abilityCooldown * 0.35;      // empieza algo cargada
    this.prevRight = false;
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
      w: 'W', a: 'A', s: 'S', d: 'D', up: 'UP', left: 'LEFT', down: 'DOWN', right: 'RIGHT', space: 'SPACE', shift: 'SHIFT', q: 'Q',
    });
  }

  destroy(fromScene) {
    if (this.glowImg) { this.glowImg.destroy(); this.glowImg = null; }
    if (this.wpImg) { this.wpImg.destroy(); this.wpImg = null; }
    super.destroy(fromScene);
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
    const lines = spec.multi || 1;                           // doble / triple disparo (mejora "Cadencia de fuego")
    for (let l = 0; l < lines; l++) {
      const off = (l - (lines - 1) / 2) * 9;                 // líneas paralelas separadas lateralmente
      for (let i = 0; i < w.pellets; i++) {
        let a = this.aimAngle;
        if (w.pellets > 1) a += (i / (w.pellets - 1) - 0.5) * w.spread + (this.gs.rng() - 0.5) * 0.08;
        else a += (this.gs.rng() - 0.5) * w.spread;
        const px = this.x + Math.cos(this.aimAngle) * 16 - Math.sin(this.aimAngle) * off, py = this.y + Math.sin(this.aimAngle) * 16 + Math.cos(this.aimAngle) * off;
        this.gs.fireBullet(Object.assign({}, spec, { tags: spec.tags.slice() }), px, py, a);
      }
    }
    this.gs.spawnBurst(this.x + Math.cos(this.aimAngle) * 20, this.y + Math.sin(this.aimAngle) * 20, this.character.color, 2);
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

  // ---------- habilidad activa ----------
  tryAbility() {
    if (this.abilityCdT > 0 || this.dead || this.gs.inputLocked) return;
    this.abilityCdT = this.abilityCooldown;
    const g = this.gs;
    switch (this.ability.id) {
      case 'emp':
        g.shockwave(this.x, this.y, 200, 2 * this.damageMult, 1.6, 0x00f0ff, true);
        break;
      case 'phase':
        this.phaseT = 2.5; this.iframes = Math.max(this.iframes, 2.5);
        this.addBuff('speed', 2.5, 1.5);
        g.spawnBurst(this.x, this.y, 0xff2bd6, 16);
        break;
      case 'swarm':
        for (let i = 0; i < 3; i++) this.addOrbiter(8, 'sat');
        g.spawnBurst(this.x, this.y, 0xffe94d, 14);
        break;
    }
    g.sfx('module');
    g.cameras.main.shake(120, 0.004);
    Bus.emit('player:ability', { id: this.ability.id });
  }

  /** Añade un orbital: 'sat' (satélite que daña) o 'shield' (escudo orbital que bloquea balas y se regenera). */
  addOrbiter(life, kind = 'sat') {
    const sprite = this.gs.add.image(this.x, this.y, kind === 'shield' ? 'orbshield' : 'orbiter').setBlendMode(Phaser.BlendModes.ADD).setDepth(21);
    this.orbiters.push({ sprite, life, kind, hitCd: new Map(), broken: 0 });
  }

  updateOrbiters(dt) {
    const g = this.gs, t = g.time.now / 1000;
    for (const kind of ['sat', 'shield']) {
      const list = this.orbiters.filter(o => o.kind === kind), n = list.length;
      list.forEach((o, i) => {
        if (o.life !== null) o.life -= dt;
        const sh = kind === 'shield', rad = sh ? 34 : 52, a = sh ? -t * 2.6 + (i / n) * Math.PI * 2 : t * 4.2 + (i / n) * Math.PI * 2;
        o.sprite.setPosition(this.x + Math.cos(a) * rad, this.y + Math.sin(a) * rad).setRotation(a * (sh ? 1 : 2) + (sh ? Math.PI / 2 : 0));
        if (o.broken > 0) {                                  // escudo roto: se regenera
          o.broken -= dt; o.sprite.setAlpha(0.12);
          if (o.broken <= 0) { o.sprite.setAlpha(1); g.spark(o.sprite.x, o.sprite.y, 0x5dff8a, 1.5); }
          return;
        }
        if (o.life !== null && o.life < 1.2) o.sprite.setAlpha(0.4 + 0.6 * Math.abs(Math.sin(t * 14)));
        if (!sh) for (const e of g.enemies) {
          if (e.dead || e.spawnT > 0) continue;
          const cd = (o.hitCd.get(e) || 0) - dt; o.hitCd.set(e, cd);
          if (cd <= 0 && (e.x - o.sprite.x) ** 2 + (e.y - o.sprite.y) ** 2 < (e.radius + 9) ** 2) {
            o.hitCd.set(e, 0.45);
            e.takeDamage(1.2 * this.damageMult, 'player', { color: 0x00f0ff });
            e.knock(Math.atan2(e.y - this.y, e.x - this.x), 120);
            g.spark(o.sprite.x, o.sprite.y, 0x00f0ff, 1.2);
          }
        }
        g.bulletPool.forEach(b => {                           // bloquean balas enemigas
          if (b.owner !== 'enemy' || o.broken > 0) return;
          if ((b.x - o.sprite.x) ** 2 + (b.y - o.sprite.y) ** 2 < (sh ? 16 : 14) ** 2) {
            g.releaseBullet(b); g.spark(b.x, b.y, sh ? 0x5dff8a : 0x00f0ff, 1.2);
            if (sh) { o.broken = 10; g.spawnBurst(o.sprite.x, o.sprite.y, 0x5dff8a, 6); }   // el escudo absorbe 1 impacto
          }
        });
      });
    }
    this.orbiters = this.orbiters.filter(o => { if (o.life !== null && o.life <= 0) { o.sprite.destroy(); return false; } return true; });
  }

  update(dt) {
    if (this.dead) return;
    const k = this.keys2;
    const mobile = Settings.mobile, tc = this.gs.touch;
    const dir = new Phaser.Math.Vector2(
      (k.d.isDown || k.right.isDown ? 1 : 0) - (k.a.isDown || k.left.isDown ? 1 : 0),
      (k.s.isDown || k.down.isDown ? 1 : 0) - (k.w.isDown || k.up.isDown ? 1 : 0));
    if (mobile && (tc.mx || tc.my)) dir.set(tc.mx, tc.my);                // joystick izquierdo (magnitud 0..1)
    if (dir.lengthSq() > 1) dir.normalize();

    // apuntado: ratón (coordenadas de mundo) o joystick derecho en modo móvil
    const p = this.gs.input.activePointer;
    if (mobile) { if (Math.hypot(tc.ax, tc.ay) > 0.2) this.aimAngle = Math.atan2(tc.ay, tc.ax); }
    else this.aimAngle = Math.atan2(p.worldY - this.y, p.worldX - this.x);
    this.setRotation(this.aimAngle + Math.PI / 2);

    const dashKey = Phaser.Input.Keyboard.JustDown(k.space) || Phaser.Input.Keyboard.JustDown(k.shift);
    if (dashKey || (mobile && tc.dash)) { tc.dash = false; this.tryDash(dir.lengthSq() ? dir.clone().normalize() : new Phaser.Math.Vector2()); }
    const right = !mobile && p.rightButtonDown();
    if (Phaser.Input.Keyboard.JustDown(k.q) || (right && !this.prevRight) || (mobile && tc.ability)) { tc.ability = false; this.tryAbility(); }
    this.prevRight = right;

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
    this.abilityCdT = Math.max(0, this.abilityCdT - dt);
    if (this.phaseT > 0) {                               // fase espectral: estela de fuego de datos
      this.phaseT -= dt;
      this.fadeT = (this.fadeT || 0) - dt;
      if (this.fadeT <= 0) { this.fadeT = 0.12; this.gs.spawnFire(this.x, this.y, this.baseDamage() * 0.6, 1.4, ['ability'], 0xff2bd6); }
      this.gs.afterimage(this);
    }
    this.updateOrbiters(dt);
    this.glowImg.setPosition(this.x, this.y).setAlpha(0.35 + 0.1 * Math.sin(this.gs.time.now / 180));
    this.wpImg.setPosition(this.x + Math.cos(this.aimAngle) * 15, this.y + Math.sin(this.aimAngle) * 15).setRotation(this.aimAngle + Math.PI / 2);
    if ((dir.x || dir.y) && this.dashT <= 0) {           // chispas del motor
      this.engineT -= dt;
      if (this.engineT <= 0) { this.engineT = 0.045; this.gs.spark(this.x - Math.cos(this.aimAngle) * 10 + (Math.random() - 0.5) * 4, this.y - Math.sin(this.aimAngle) * 10 + (Math.random() - 0.5) * 4, this.character.color, 0.7); }
    }
    this.iframes = Math.max(0, this.iframes - dt);
    this.fireT -= dt;
    const wantFire = mobile ? Math.hypot(tc.ax, tc.ay) > 0.35 : (p.isDown && p.leftButtonDown());
    if ((wantFire || this.gs.autoFire) && this.fireT <= 0 && !this.gs.inputLocked) this.shoot();

    // recarga de escudo si lleva un rato sin recibir daño
    this.lastHitT += dt;
    if (this.shield < this.maxShield && this.lastHitT > 3) {
      this.shieldT += dt;
      if (this.shieldT >= this.shieldRegen) { this.shieldT = 0; this.shield++; }
    }

    for (const [name, b] of Object.entries(this.buffs)) { b.time -= dt; if (b.time <= 0) delete this.buffs[name]; }
    this.updateStatuses(dt);

    // parpadeo mientras es invulnerable
    const al = this.phaseT > 0 ? 0.35 : this.iframes > 0 ? 0.45 + 0.35 * Math.sin(this.gs.time.now / 40) : 1;
    this.setAlpha(al); this.wpImg.setAlpha(al);
  }

  takeDamage(amount, source, info) {
    if (this.dead || this.iframes > 0) return false;
    amount *= 1 - Armor.reduction();                  // la armadura permanente reduce el daño recibido
    const dodge = this.stack('dodge');
    if (dodge && !(info && info.silent) && this.gs.rng() < 0.08 * dodge) {   // esquiva: ignora el golpe
      this.iframes = 0.35; this.gs.floatText(this.x, this.y - 22, 'ESQUIVA', 0x5dff8a); return false;
    }
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
    Bus.emit('player:hit', { damage: amount, crit: amount >= 2 || this.hp <= 1, source });
    if (this.hp <= 0) this.die(source);
    return true;
  }

  die() {
    if (this.dead) return;
    this.dead = true;
    this.setVisible(false);
    this.glowImg.setVisible(false); this.wpImg.setVisible(false);
    this.orbiters.forEach(o => o.sprite.destroy()); this.orbiters = [];
    this.gs.spawnBurst(this.x, this.y, this.character.color, 30);
    Bus.emit('player:dead', {});
  }
}
