/**
 * Entity: clase base de todo lo que se mueve y recibe daño (jugador y enemigos).
 * Incluye física propia contra la rejilla de baldosas de la sala (círculo contra baldosas sólidas,
 * resolución por ejes para deslizarse por las paredes), vida, estados alterados y retroceso.
 */
class Entity extends Phaser.GameObjects.Sprite {
  constructor(scene, x, y, texture, radius, hp) {
    super(scene, x, y, texture);
    scene.add.existing(this);
    this.gs = scene;               // escena de juego (GameScene)
    this.radius = radius;
    this.maxHp = hp;
    this.hp = hp;
    this.dead = false;
    this.kx = 0; this.ky = 0;      // velocidad de retroceso (knockback)
    this.statuses = {};            // slow / poison ...: { time, duration, power }
    this.flash = 0;
    this.baseTint = 0xffffff;
    this.shadow = scene.add.image(x, y + 5, 'shadow').setDepth(4).setAlpha(0.4).setScale(radius / 11);
  }

  preUpdate(t, d) {
    super.preUpdate(t, d);
    if (this.shadow) this.shadow.setPosition(this.x, this.y + this.radius * 0.5).setVisible(this.visible).setAlpha(0.4 * this.alpha);
  }

  destroy(fromScene) {
    if (this.shadow) { this.shadow.destroy(); this.shadow = null; }
    super.destroy(fromScene);
  }

  /** Mueve la entidad (dx,dy en píxeles) deslizándose contra paredes y obstáculos. */
  move(dx, dy) {
    const s = this.gs;
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / 8));
    const sx = dx / steps, sy = dy / steps;
    for (let i = 0; i < steps; i++) {
      if (sx && !s.collides(this.x + sx, this.y, this.radius)) this.x += sx;
      if (sy && !s.collides(this.x, this.y + sy, this.radius)) this.y += sy;
    }
  }

  /** Baldosa (coordenadas de la sala) en la que está la entidad. */
  tileXY() {
    return { x: Math.floor((this.x - CFG.OX) / CFG.T), y: Math.floor((this.y - CFG.OY) / CFG.T) };
  }

  addStatus(name, duration, power) {
    const st = this.statuses[name];
    if (st && name === 'poison') {             // el veneno se acumula
      st.time = Math.max(st.time, duration);
      st.duration = Math.max(st.duration, duration);
      st.power = Math.min(st.power + power * 0.5, 6);
    } else {
      this.statuses[name] = { time: duration, duration, power };
    }
  }

  hasStatus(name) { return !!this.statuses[name]; }

  /** Multiplicador de velocidad por estados (ralentización). */
  speedFactor() {
    if (this.statuses.stun) return 0;
    const sl = this.statuses.slow;
    return sl ? sl.power : 1;
  }

  updateStatuses(dt) {
    for (const [name, st] of Object.entries(this.statuses)) {
      st.time -= dt;
      if (name === 'poison') this.takeDamage(st.power * dt, 'status', { silent: true });
      if (st.time <= 0) delete this.statuses[name];
    }
    // retroceso amortiguado
    if (this.kx || this.ky) {
      this.move(this.kx * dt, this.ky * dt);
      const f = Math.pow(0.0008, dt);
      this.kx *= f; this.ky *= f;
      if (Math.abs(this.kx) < 5) this.kx = 0;
      if (Math.abs(this.ky) < 5) this.ky = 0;
    }
    if (this.flash > 0) {
      this.flash -= dt;
      this.setTint(this.flash > 0 ? 0xffffff : this.statusTint());
    }
  }

  statusTint() {
    if (this.statuses.stun) return 0xffe94d;
    if (this.statuses.poison) return 0x7dff9a;
    if (this.statuses.slow) return 0x9fe9ff;
    return this.baseTint;
  }

  knock(angle, force) {
    this.kx += Math.cos(angle) * force;
    this.ky += Math.sin(angle) * force;
  }

  takeDamage(amount, source, info) {
    if (this.dead) return false;
    this.hp -= amount;
    if (!(info && info.silent)) {
      this.flash = 0.07;
      this.gs.floatText(this.x, this.y - this.radius - 6, amount >= 1 ? String(Math.round(amount * 10) / 10) : '', info && info.color);
    }
    if (this.hp <= 0) this.die(source);
    return true;
  }

  die() { this.dead = true; }
}
