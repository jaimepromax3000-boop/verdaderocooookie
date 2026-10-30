/**
 * Projectile: balas del jugador y de los enemigos. Se reciclan con el ObjectPool de la GameScene.
 *
 * Una bala lleva su `spec` (daño ya multiplicado, rebotes, perforación, etiquetas...).
 * Emite eventos en el EventBus (bullet:fire / bounce / hit / kill / expire) que usan los módulos de software
 * para crear sinergias. El movimiento y el rebote contra las baldosas se calculan aquí.
 */
class Projectile extends Phaser.GameObjects.Image {
  constructor(scene) {
    super(scene, 0, 0, 'bullet');
    scene.add.existing(this);
    this.gs = scene;
    this.setBlendMode(Phaser.BlendModes.ADD);
    this.setActive(false).setVisible(false);
    this.spec = null;
    this.hitSet = new Set();
  }

  /** (Re)inicializa la bala sacada del pool. */
  init(spec, x, y, angle) {
    this.spec = spec;
    this.owner = spec.owner;            // 'player' | 'enemy'
    this.x = x; this.y = y;
    this.angle0 = angle;
    this.vx = Math.cos(angle) * spec.speed;
    this.vy = Math.sin(angle) * spec.speed;
    this.life = spec.life;
    this.pierceLeft = spec.pierce;
    this.bouncesLeft = spec.bounces;
    this.radius = 5 * spec.size;
    this.hitSet.clear();
    this.setTexture(this.owner === 'player' ? 'bullet' : 'ebullet');
    this.setTint(spec.color);
    this.setScale(spec.size);
    this.setRotation(angle);
    this.setActive(true).setVisible(true);
    this.trail = 0;
    return this;
  }

  /** Devuelve false cuando la bala debe volver al pool. */
  step(dt) {
    const s = this.gs, spec = this.spec;
    this.life -= dt;
    if (this.life <= 0) {
      Bus.emit('bullet:expire', { bullet: this, x: this.x, y: this.y });
      return false;
    }
    // guiado térmico: gira hacia el enemigo más cercano
    if (spec.homing > 0 && this.owner === 'player') {
      let best = null, bd = 260 * 260;
      for (const e of s.enemies) {
        if (e.dead || e.spawnT > 0 || this.hitSet.has(e)) continue;
        const d = (e.x - this.x) ** 2 + (e.y - this.y) ** 2;
        if (d < bd) { bd = d; best = e; }
      }
      if (best) {
        const sp = Math.hypot(this.vx, this.vy);
        const cur = Math.atan2(this.vy, this.vx);
        const want = Math.atan2(best.y - this.y, best.x - this.x);
        let da = Phaser.Math.Angle.Wrap(want - cur);
        da = Phaser.Math.Clamp(da, -spec.homing * dt, spec.homing * dt);
        this.vx = Math.cos(cur + da) * sp; this.vy = Math.sin(cur + da) * sp;
      }
    }
    // avance en sub-pasos para no atravesar paredes finas
    const dist = Math.hypot(this.vx, this.vy) * dt;
    const n = Math.max(1, Math.ceil(dist / 6));
    const dx = this.vx * dt / n, dy = this.vy * dt / n;
    for (let i = 0; i < n; i++) {
      let nx = this.x + dx, ny = this.y + dy;
      if (s.solidAt(nx, ny)) {
        if (this.bouncesLeft > 0) {
          const hitX = s.solidAt(this.x + dx, this.y), hitY = s.solidAt(this.x, this.y + dy);
          if (hitX || !hitY) this.vx = -this.vx;
          if (hitY || !hitX) this.vy = -this.vy;
          this.bouncesLeft--;
          this.setRotation(Math.atan2(this.vy, this.vx));
          Bus.emit('bullet:bounce', { bullet: this, x: this.x, y: this.y });
          this.hitSet.clear();               // tras rebotar puede volver a golpear
          break;
        }
        Bus.emit('bullet:expire', { bullet: this, x: this.x, y: this.y, wall: true });
        return false;
      }
      this.x = nx; this.y = ny;
    }
    this.trail -= dt;
    if (this.trail <= 0 && this.owner === 'player') { this.trail = 0.035; s.spark(this.x, this.y, spec.color, 0.5); }
    return true;
  }
}
