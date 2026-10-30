/**
 * BootScene: carga de recursos. Todo el arte se genera por código (formas de neón dibujadas con Graphics
 * y convertidas en texturas), así que el juego no depende de imágenes externas y arranca al instante.
 * Si quisieras usar spritesheets/audio propios, este es el sitio: this.load.spritesheet(...) / this.load.audio(...).
 */
class BootScene extends Phaser.Scene {
  constructor() { super('BootScene'); }

  preload() {
    // Barra de carga mínima (por si se añaden recursos externos)
    const w = this.scale.width, h = this.scale.height;
    const bar = this.add.rectangle(w / 2 - 150, h / 2, 0, 8, CFG.COL.cyan).setOrigin(0, 0.5);
    this.add.text(w / 2, h / 2 - 24, 'NEON LABYRINTH', { fontFamily: 'monospace', fontSize: '20px', color: '#00f0ff' }).setOrigin(0.5);
    this.load.on('progress', v => { bar.width = 300 * v; });
  }

  create() {
    Meta.load();
    this.makeTextures();
    this.scene.start('MenuScene');
  }

  /** Dibuja con Graphics y guarda como textura. */
  tex(key, w, h, draw) {
    if (this.textures.exists(key)) return;
    const g = this.make.graphics({ x: 0, y: 0, add: false });
    draw(g, w, h);
    g.generateTexture(key, w, h);
    g.destroy();
  }

  glow(g, cx, cy, r, color, a = 0.12) {
    for (let i = 6; i >= 1; i--) { g.fillStyle(color, a * (7 - i) / 6); g.fillCircle(cx, cy, r * i / 6); }
  }

  poly(g, pts, fill, stroke, lw = 2, fa = 0.25) {
    g.fillStyle(fill, fa); g.lineStyle(lw, stroke, 1);
    g.beginPath(); g.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
    g.closePath(); g.fillPath(); g.strokePath();
  }

  makeTextures() {
    const W = 0xffffff;
    // jugador (apunta hacia arriba; se tiñe con el color del personaje)
    this.tex('player', 32, 32, g => {
      this.glow(g, 16, 16, 16, W, 0.07);
      this.poly(g, [[16, 3], [28, 27], [16, 21], [4, 27]], W, W, 2, 0.3);
      g.fillStyle(W, 1); g.fillCircle(16, 16, 2.5);
    });
    // enemigos (colores propios)
    this.tex('enemy_grunt', 32, 32, g => {
      this.glow(g, 16, 16, 16, 0xff4466, 0.08);
      this.poly(g, [[16, 3], [28, 16], [16, 29], [4, 16]], 0xff4466, 0xff4466, 2, 0.3);
      g.lineStyle(2, 0xffffff, 0.9); g.lineBetween(10, 16, 22, 16); g.lineBetween(16, 10, 16, 22);
    });
    this.tex('enemy_shooter', 32, 32, g => {
      this.glow(g, 16, 16, 16, 0xff9a3c, 0.08);
      g.fillStyle(0xff9a3c, 0.25); g.lineStyle(2, 0xff9a3c, 1);
      g.fillRect(5, 5, 22, 22); g.strokeRect(5, 5, 22, 22);
      g.fillStyle(0xffffff, 1); g.fillCircle(16, 16, 4);
      g.lineStyle(3, 0xffffff, 1); g.lineBetween(16, 16, 16, 2);
    });
    this.tex('enemy_summoner', 36, 36, g => {
      this.glow(g, 18, 18, 18, 0xff2bd6, 0.08);
      const pts = []; for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4 + Math.PI / 8; pts.push([18 + 15 * Math.cos(a), 18 + 15 * Math.sin(a)]); }
      this.poly(g, pts, 0xff2bd6, 0xff2bd6, 2, 0.28);
      g.lineStyle(2, 0xffffff, 0.9); g.strokeCircle(18, 18, 7); g.fillStyle(0xffffff, 1); g.fillCircle(18, 18, 2.5);
    });
    this.tex('enemy_drone', 22, 22, g => {
      this.poly(g, [[11, 2], [20, 19], [2, 19]], 0xffe94d, 0xffe94d, 2, 0.35);
    });
    this.tex('enemy_boss', 84, 84, g => {
      this.glow(g, 42, 42, 42, 0xff2bd6, 0.07);
      const hex = (r, c, a) => { const p = []; for (let i = 0; i < 6; i++) p.push([42 + r * Math.cos(i * Math.PI / 3), 42 + r * Math.sin(i * Math.PI / 3)]); this.poly(g, p, c, c, 3, a); };
      hex(38, 0x9b5cff, 0.18); hex(26, 0xff2bd6, 0.3);
      g.fillStyle(0xffffff, 1); g.fillCircle(42, 42, 7);
      g.lineStyle(3, 0xffffff, 0.8); g.strokeCircle(42, 42, 14);
    });
    // proyectiles
    this.tex('bullet', 16, 16, g => { this.glow(g, 8, 8, 8, W, 0.14); g.fillStyle(W, 1); g.fillCircle(8, 8, 3.5); });
    this.tex('ebullet', 16, 16, g => { this.glow(g, 8, 8, 8, W, 0.14); g.fillStyle(W, 1); g.fillCircle(8, 8, 4); g.lineStyle(1, 0x000000, 0.4); g.strokeCircle(8, 8, 4); });
    this.tex('spark', 8, 8, g => { g.fillStyle(W, 1); g.fillCircle(4, 4, 3); });
    this.tex('glow', 64, 64, g => this.glow(g, 32, 32, 32, W, 0.16));
    this.tex('fire', 40, 40, g => { this.glow(g, 20, 20, 20, 0xff9a3c, 0.18); g.fillStyle(0xffe94d, 0.8); g.fillCircle(20, 20, 6); });
    // objetos
    this.tex('coin', 18, 18, g => { this.poly(g, [[9, 1], [16, 5], [16, 13], [9, 17], [2, 13], [2, 5]], 0xffe94d, 0xffe94d, 2, 0.5); });
    this.tex('heart', 22, 22, g => {
      g.fillStyle(0xff4466, 1); g.fillCircle(7, 8, 5.5); g.fillCircle(15, 8, 5.5);
      g.fillTriangle(2, 10, 20, 10, 11, 20);
    });
    this.tex('key', 24, 22, g => {
      g.lineStyle(3, 0xffe94d, 1); g.strokeCircle(7, 11, 5);
      g.lineBetween(12, 11, 22, 11); g.lineBetween(19, 11, 19, 16); g.lineBetween(22, 11, 22, 15);
    });
    this.tex('module', 28, 28, g => {   // chip de software (se tiñe con el color del módulo)
      g.fillStyle(W, 0.25); g.lineStyle(2, W, 1); g.fillRect(5, 5, 18, 18); g.strokeRect(5, 5, 18, 18);
      g.lineStyle(2, W, 1);
      for (let i = 0; i < 3; i++) { const p = 9 + i * 5; g.lineBetween(p, 1, p, 5); g.lineBetween(p, 23, p, 27); g.lineBetween(1, p, 5, p); g.lineBetween(23, p, 27, p); }
      g.fillStyle(W, 1); g.fillRect(11, 11, 6, 6);
    });
    this.tex('weapon', 34, 20, g => {
      g.fillStyle(W, 0.3); g.lineStyle(2, W, 1);
      g.fillRect(3, 6, 22, 8); g.strokeRect(3, 6, 22, 8); g.fillRect(25, 8, 7, 4); g.fillRect(8, 14, 6, 5);
    });
    this.tex('portal', 40, 40, g => {
      this.glow(g, 20, 20, 20, 0x00f0ff, 0.12);
      g.lineStyle(3, 0x00f0ff, 1); g.strokeCircle(20, 20, 14); g.lineStyle(2, 0xff2bd6, 1); g.strokeCircle(20, 20, 8);
      g.lineBetween(20, 2, 20, 8);
    });
    // baldosas
    this.tex('tile_floor', 32, 32, g => { g.fillStyle(0x070b1a, 1); g.fillRect(0, 0, 32, 32); g.lineStyle(1, 0x12204a, 1); g.strokeRect(0.5, 0.5, 31, 31); g.fillStyle(0x0e1a3d, 1); g.fillRect(14, 14, 4, 4); });
    this.tex('tile_wall', 32, 32, g => { g.fillStyle(0x0b1030, 1); g.fillRect(0, 0, 32, 32); g.lineStyle(2, 0x2748ff, 0.9); g.strokeRect(1, 1, 30, 30); g.lineStyle(1, 0x00f0ff, 0.5); g.strokeRect(5, 5, 22, 22); });
    this.tex('tile_obs', 32, 32, g => { g.fillStyle(0x1b0b2e, 1); g.fillRect(0, 0, 32, 32); g.lineStyle(2, 0xff2bd6, 0.9); g.strokeRect(1, 1, 30, 30); g.lineStyle(1, 0xff2bd6, 0.4); g.lineBetween(4, 4, 28, 28); g.lineBetween(28, 4, 4, 28); });
    this.tex('door_closed', 32, 32, g => { g.fillStyle(0x2a0a14, 1); g.fillRect(0, 0, 32, 32); g.lineStyle(3, 0xff4466, 1); for (let i = 4; i < 32; i += 8) g.lineBetween(i, 2, i, 30); g.lineStyle(2, 0xff4466, 1); g.strokeRect(1, 1, 30, 30); });
    this.tex('door_locked', 32, 32, g => { g.fillStyle(0x2a2208, 1); g.fillRect(0, 0, 32, 32); g.lineStyle(3, 0xffe94d, 1); g.strokeRect(2, 2, 28, 28); g.fillStyle(0xffe94d, 1); g.fillRect(11, 14, 10, 9); g.lineStyle(3, 0xffe94d, 1); g.strokeCircle(16, 12, 4); });
    this.tex('vignette', 4, 4, g => { g.fillStyle(0x000000, 1); g.fillRect(0, 0, 4, 4); });
  }
}
