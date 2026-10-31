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
    Settings.load();
    I18n.apply();
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

  ngon(cx, cy, r, n, rot = 0) {
    const p = [];
    for (let i = 0; i < n; i++) p.push([cx + r * Math.cos(rot + (i * 2 * Math.PI) / n), cy + r * Math.sin(rot + (i * 2 * Math.PI) / n)]);
    return p;
  }

  makeTextures() {
    Art.build(this);                               // arte semi-realista (canvas): enemigos, jefes, skins, armadura, herrero
    this.makeShips();
    this.makeSkins();
    this.makeWeapons();
    this.makeEnemies();
    this.makeProps();
    this.makeTiles();
  }

  // ---------------------------------------------------------------------------------------
  makeShips() {
    // Hacker de Almas: ala delta cian, cabina blanca, motor naranja
    this.tex('ship_hacker', 40, 40, g => {
      this.glow(g, 20, 20, 20, 0x00f0ff, 0.06);
      g.fillStyle(0xff9a3c, 0.85); g.fillTriangle(16, 31, 24, 31, 20, 39);
      g.fillStyle(0xffe94d, 0.9); g.fillTriangle(18, 31, 22, 31, 20, 36);
      this.poly(g, [[20, 3], [35, 33], [26, 29], [20, 35], [14, 29], [5, 33]], 0x0a2a44, 0x00f0ff, 2, 0.95);
      this.poly(g, [[20, 9], [27, 27], [20, 23], [13, 27]], 0x00f0ff, 0xcffcff, 1, 0.35);
      g.lineStyle(2, 0xff2bd6, 1); g.lineBetween(7, 31, 12, 22); g.lineBetween(33, 31, 28, 22);
      g.fillStyle(0xffffff, 1); g.fillCircle(20, 17, 3); g.lineStyle(1, 0x00f0ff, 1); g.strokeCircle(20, 17, 5);
    });
    // Fantasma: dardo esbelto magenta con aletas traseras translúcidas
    this.tex('ship_ghost', 40, 40, g => {
      this.glow(g, 20, 20, 20, 0xff2bd6, 0.06);
      g.fillStyle(0x9b5cff, 0.8); g.fillTriangle(17, 32, 23, 32, 20, 40);
      this.poly(g, [[3, 36], [14, 22], [14, 31]], 0x9b5cff, 0x9b5cff, 1, 0.3);
      this.poly(g, [[37, 36], [26, 22], [26, 31]], 0x9b5cff, 0x9b5cff, 1, 0.3);
      this.poly(g, [[20, 2], [25, 18], [30, 35], [20, 29], [10, 35], [15, 18]], 0x2a0a3a, 0xff2bd6, 2, 0.95);
      g.lineStyle(1, 0xffffff, 0.7); g.lineBetween(20, 8, 20, 26);
      this.poly(g, [[20, 13], [23, 18], [20, 23], [17, 18]], 0xffffff, 0xffffff, 1, 1);
    });
    // Daemon: casco hexagonal robusto con cañón y vainas laterales
    this.tex('ship_daemon', 44, 44, g => {
      this.glow(g, 22, 22, 22, 0xffe94d, 0.06);
      g.fillStyle(0xff9a3c, 0.85); g.fillTriangle(17, 36, 27, 36, 22, 44);
      g.fillStyle(0x2a2208, 1); g.lineStyle(2, 0xffe94d, 1);
      g.fillRect(3, 14, 7, 20); g.strokeRect(3, 14, 7, 20); g.fillRect(34, 14, 7, 20); g.strokeRect(34, 14, 7, 20);
      g.fillRect(19, 0, 6, 11); g.strokeRect(19, 0, 6, 11);
      this.poly(g, [[22, 6], [35, 13], [35, 31], [22, 40], [9, 31], [9, 13]], 0x2a2208, 0xffe94d, 2, 0.95);
      g.lineStyle(1, 0xffe94d, 0.6); g.strokeCircle(22, 23, 9); g.lineBetween(9, 22, 35, 22);
      g.fillStyle(0xff9a3c, 1); g.fillCircle(22, 23, 4); g.fillStyle(0xffffff, 1); g.fillCircle(22, 23, 1.8);
    });
    this.tex('player', 40, 40, g => { this.poly(g, [[20, 3], [35, 33], [20, 27], [5, 33]], 0xffffff, 0xffffff, 2, 0.3); });
  }


  // ---------------------------------------------------------------------------------------
  /** Skins: vistas desde arriba, mirando hacia arriba (el jugador las gira hacia el ratón). Solo cosméticas. */
  makeSkins() {
    const W = 0xffffff, ell = (g, x, y, w, h, fill, stroke, a = 1) => { g.fillStyle(fill, a); g.fillEllipse(x, y, w, h); if (stroke !== null) { g.lineStyle(1.5, stroke, 1); g.strokeEllipse(x, y, w, h); } };
    const sk = (id, draw) => this.tex('skin_' + id, 40, 40, g => { g.fillStyle(0x000000, 0); this.glow(g, 20, 20, 20, (SKINS.find(s => s.id === id) || { color: W }).color, 0.05); draw(g); });
    const robot = (g, metal, dark, eye, trim) => {
      g.fillStyle(dark, 1); g.fillRect(7, 22, 26, 11); g.lineStyle(2, trim, 1); g.strokeRect(7, 22, 26, 11);
      g.fillStyle(metal, 1); g.fillRect(12, 8, 16, 16); g.lineStyle(2, trim, 1); g.strokeRect(12, 8, 16, 16);
      g.fillStyle(eye, 1); g.fillRect(15, 13, 10, 4); g.fillStyle(W, 0.9); g.fillRect(17, 14, 3, 2);
      g.lineStyle(2, trim, 1); g.lineBetween(20, 8, 20, 3); g.fillStyle(eye, 1); g.fillCircle(20, 3, 2);
    };
    sk('operator', g => {
      ell(g, 20, 28, 28, 13, 0x0a1a2e, 0x00f0ff);
      ell(g, 20, 19, 18, 18, 0x14243a, 0x00f0ff);
      g.fillStyle(0x00f0ff, 1); g.fillRect(13, 11, 14, 3.5); g.fillStyle(W, 0.8); g.fillRect(15, 12, 4, 1.5);
      g.fillStyle(0x00f0ff, 1); g.fillCircle(10.5, 19, 3); g.fillCircle(29.5, 19, 3);
      g.lineStyle(2, 0x00f0ff, 1); g.beginPath(); g.arc(20, 19, 10.5, Math.PI * 1.05, Math.PI * 1.95); g.strokePath();
    });
    sk('virus', g => {
      for (let i = 0; i < 10; i++) { const a = i * Math.PI / 5; g.lineStyle(3, 0x9b5cff, 1); g.lineBetween(20 + 9 * Math.cos(a), 21 + 9 * Math.sin(a), 20 + 15 * Math.cos(a), 21 + 15 * Math.sin(a)); g.fillStyle(0xff2bd6, 1); g.fillCircle(20 + 16 * Math.cos(a), 21 + 16 * Math.sin(a), 2.6); }
      g.fillStyle(0x2a0f4a, 1); g.fillCircle(20, 21, 10); g.lineStyle(2, 0x9b5cff, 1); g.strokeCircle(20, 21, 10);
      g.fillStyle(W, 1); g.fillCircle(20, 17, 4.5); g.fillStyle(0xff2bd6, 1); g.fillCircle(20, 16, 2.4);
      g.fillStyle(0x9b5cff, 0.8); g.fillCircle(14, 25, 2); g.fillCircle(26, 25, 2);
    });
    sk('pirate', g => {
      ell(g, 20, 29, 30, 12, 0x1a3a6a, 0xffd23c);
      g.fillStyle(0xffd23c, 1); g.fillCircle(14, 29, 1.4); g.fillCircle(20, 31, 1.4); g.fillCircle(26, 29, 1.4);
      ell(g, 20, 20, 17, 17, 0xf2c9a0, null);
      g.fillStyle(0xcc2233, 1); g.fillRect(11, 19, 18, 4);                     // pañuelo
      g.fillStyle(0x15151f, 1); g.lineStyle(2, 0x555577, 1);
      g.beginPath(); g.moveTo(20, 2); g.lineTo(35, 15); g.lineTo(28, 19); g.lineTo(20, 15); g.lineTo(12, 19); g.lineTo(5, 15); g.closePath(); g.fillPath(); g.strokePath();   // tricornio
      g.fillStyle(W, 1); g.fillCircle(20, 11, 2.2); g.fillRect(19, 13, 2, 2);
    });
    sk('viking', g => {
      ell(g, 20, 30, 24, 10, 0x6a4a2a, 0x3a2a14);
      ell(g, 20, 28, 15, 12, 0xd08a3a, 0x8a5a1a);                              // barba
      g.fillStyle(0xf2ead6, 1); g.lineStyle(1.5, 0x998866, 1);
      g.beginPath(); g.moveTo(11, 17); g.lineTo(2, 12); g.lineTo(3, 6); g.lineTo(8, 11); g.lineTo(13, 13); g.closePath(); g.fillPath(); g.strokePath();   // cuernos
      g.beginPath(); g.moveTo(29, 17); g.lineTo(38, 12); g.lineTo(37, 6); g.lineTo(32, 11); g.lineTo(27, 13); g.closePath(); g.fillPath(); g.strokePath();
      ell(g, 20, 19, 17, 17, 0x7d8696, 0xc0c8d8);                               // yelmo
      g.fillStyle(0xc0c8d8, 1); g.fillRect(18.5, 11, 3, 8);
      g.fillStyle(0xf2c9a0, 1); g.fillRect(14, 22, 12, 3);
    });
    sk('robot', g => robot(g, 0xc0c8d8, 0x4a5368, 0xff2244, 0x00f0ff));
    sk('ninja', g => {
      ell(g, 20, 29, 28, 11, 0x14141c, 0x666680);
      g.fillStyle(0xaa1122, 1); g.fillTriangle(12, 22, 7, 33, 14, 26); g.fillTriangle(28, 22, 33, 33, 26, 26);   // colas de la banda
      ell(g, 20, 19, 18, 18, 0x14141c, 0x666680);
      g.fillStyle(0xf2c9a0, 1); g.fillRect(13, 14, 14, 4);
      g.fillStyle(0x14141c, 1); g.fillRect(16, 15, 3, 2); g.fillRect(21, 15, 3, 2);
      g.fillStyle(0xaa1122, 1); g.fillRect(11, 10, 18, 3.5); g.fillStyle(0xdddddd, 1); g.fillRect(18, 10.5, 4, 2.5);
    });
    sk('astronaut', g => {
      g.fillStyle(0x8890a8, 1); g.fillRect(11, 27, 18, 9); g.lineStyle(1.5, 0xc0c8d8, 1); g.strokeRect(11, 27, 18, 9);
      ell(g, 20, 27, 28, 12, 0xeef2fa, 0xaab4cc);
      ell(g, 20, 19, 20, 20, 0xf7f9ff, 0xaab4cc);
      ell(g, 20, 16.5, 14, 9, 0xff9a3c, 0xffe94d); g.fillStyle(W, 0.55); g.fillEllipse(17, 14.5, 5, 3);
      g.fillStyle(0xcc2233, 1); g.fillRect(12, 28, 4, 2);
    });
    sk('alien', g => {
      ell(g, 20, 30, 18, 9, 0x2f8a4a, 0x5dff8a);
      ell(g, 20, 18, 24, 20, 0x5dff8a, 0x2fd06a);
      g.fillStyle(0x03120a, 1); g.fillEllipse(14, 14, 7, 11); g.fillEllipse(26, 14, 7, 11);
      g.fillStyle(W, 0.8); g.fillCircle(13, 12, 1.2); g.fillCircle(25, 12, 1.2);
      g.lineStyle(1.5, 0x2fd06a, 1); g.lineBetween(14, 8, 10, 3); g.lineBetween(26, 8, 30, 3); g.fillStyle(0xffe94d, 1); g.fillCircle(10, 3, 1.8); g.fillCircle(30, 3, 1.8);
    });
    sk('skull', g => {
      g.lineStyle(2.5, 0xe8e8f0, 1); for (let i = 0; i < 3; i++) g.strokeEllipse(20, 28 + i * 2, 28 - i * 5, 9);
      ell(g, 20, 19, 19, 19, 0xf2f2f8, 0xaaaabb);
      g.fillStyle(0x0a0a12, 1); g.fillEllipse(15, 17, 6, 7); g.fillEllipse(25, 17, 6, 7); g.fillTriangle(20, 21, 18, 25, 22, 25);
      g.fillStyle(0xff2244, 1); g.fillCircle(15, 17, 1.2); g.fillCircle(25, 17, 1.2);
      g.lineStyle(1.5, 0x0a0a12, 1); for (const x of [16, 20, 24]) g.lineBetween(x, 26, x, 28.5);
    });
    sk('samurai', g => {
      ell(g, 20, 29, 32, 12, 0xaa2233, 0xffd23c);
      g.lineStyle(1.5, 0xffd23c, 1); g.lineBetween(10, 26, 10, 33); g.lineBetween(30, 26, 30, 33);
      ell(g, 20, 20, 17, 17, 0xf2c9a0, null);
      ell(g, 20, 16, 22, 17, 0x1a1a24, 0xffd23c);                                // kabuto
      g.lineStyle(2.5, 0xffd23c, 1); g.beginPath(); g.arc(20, 10, 9, Math.PI * 1.15, Math.PI * 1.85); g.strokePath();   // cresta
      g.fillStyle(0xffd23c, 1); g.fillTriangle(20, 3, 17, 9, 23, 9);
      g.fillStyle(0xaa2233, 1); g.fillRect(14, 22, 12, 4);
    });
    sk('wizard', g => {
      ell(g, 20, 30, 28, 11, 0x4a2a8a, 0x9b5cff);
      ell(g, 20, 29, 11, 12, 0xf0f0ff, 0xaaaacc);                                // barba
      ell(g, 20, 17, 30, 28, 0x6a3acb, 0xc9a6ff);                                // ala del sombrero
      ell(g, 20, 17, 16, 15, 0x4a2a8a, 0x9b5cff);
      g.fillStyle(0xffd23c, 1); g.fillPoints(this.ngon(20, 17, 4.5, 5, -Math.PI / 2).flatMap((p, i, a) => [{ x: p[0], y: p[1] }, { x: 20 + 2 * Math.cos(-Math.PI / 2 + (i + 0.5) * 2 * Math.PI / 5), y: 17 + 2 * Math.sin(-Math.PI / 2 + (i + 0.5) * 2 * Math.PI / 5) }]), true);
    });
    sk('golden', g => robot(g, 0xffd23c, 0xb8860b, 0x00f0ff, 0xfff2a8));
  }

  /** Cañones de las armas (el jugador los lleva delante, rotando con el apuntado). */
  makeWeapons() {
    const W = 0xffffff;
    this.tex('wp_hacker', 20, 30, g => {      // pistola de pulso
      this.glow(g, 10, 15, 12, 0x00f0ff, 0.05);
      g.fillStyle(0x0a2a44, 1); g.lineStyle(2, 0x00f0ff, 1); g.fillRect(6, 8, 8, 20); g.strokeRect(6, 8, 8, 20);
      g.fillStyle(0x00f0ff, 1); g.fillRect(8.5, 1, 3, 9); g.fillStyle(W, 1); g.fillCircle(10, 2, 1.6);
      g.fillStyle(0x00f0ff, 0.6); g.fillRect(8, 14, 4, 8);
    });
    this.tex('wp_ghost', 20, 34, g => {       // arma ligera y alargada
      this.glow(g, 10, 17, 12, 0xff2bd6, 0.05);
      g.fillStyle(0x2a0a3a, 1); g.lineStyle(2, 0xff2bd6, 1); g.fillRect(8, 6, 4, 26); g.strokeRect(8, 6, 4, 26);
      g.fillStyle(0xff2bd6, 1); g.fillTriangle(10, 0, 8, 7, 12, 7);
      g.fillTriangle(4, 22, 8, 14, 8, 24); g.fillTriangle(16, 22, 12, 14, 12, 24);
      g.fillStyle(W, 1); g.fillCircle(10, 2, 1.4);
    });
    this.tex('wp_daemon', 28, 30, g => {      // cañón pesado de doble boca
      this.glow(g, 14, 15, 14, 0xffe94d, 0.05);
      g.fillStyle(0x2a2208, 1); g.lineStyle(2, 0xffe94d, 1); g.fillRect(5, 10, 18, 18); g.strokeRect(5, 10, 18, 18);
      g.fillRect(7, 1, 5, 11); g.strokeRect(7, 1, 5, 11); g.fillRect(16, 1, 5, 11); g.strokeRect(16, 1, 5, 11);
      g.fillStyle(0xff9a3c, 1); g.fillRect(11, 16, 6, 8); g.fillStyle(W, 1); g.fillCircle(9.5, 2, 1.3); g.fillCircle(18.5, 2, 1.3);
    });
    // cofres de jefe (bronce / plata / oro)
    [0xcd7f32, 0xc0c8d8, 0xffd23c].forEach((col, i) => this.tex('chest_' + (i + 1), 44, 38, g => {
      this.glow(g, 22, 19, 22, col, 0.1);
      g.fillStyle(0x1a1208, 1); g.lineStyle(3, col, 1);
      g.fillRoundedRect(5, 12, 34, 22, 3); g.strokeRoundedRect(5, 12, 34, 22, 3);
      g.fillRoundedRect(5, 5, 34, 12, 5); g.strokeRoundedRect(5, 5, 34, 12, 5);
      g.lineStyle(2, col, 1); g.lineBetween(14, 12, 14, 34); g.lineBetween(30, 12, 30, 34);
      g.fillStyle(col, 1); g.fillRect(19, 14, 6, 8); g.fillStyle(0x1a1208, 1); g.fillCircle(22, 18, 1.5);
      for (let k = 0; k < i; k++) { g.fillStyle(W, 0.9); g.fillTriangle(22 - 8 + k * 16, 2, 22 - 11 + k * 16, 8, 22 - 5 + k * 16, 8); }
    }));
  }

  // ---------------------------------------------------------------------------------------
  makeEnemies() {
    const W = 0xffffff;
    // Virus: erizo de 8 púas
    this.tex('enemy_grunt', 36, 36, g => {
      this.glow(g, 18, 18, 18, 0xff4466, 0.07);
      for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; this.poly(g, [[18 + 10 * Math.cos(a - 0.22), 18 + 10 * Math.sin(a - 0.22)], [18 + 17 * Math.cos(a), 18 + 17 * Math.sin(a)], [18 + 10 * Math.cos(a + 0.22), 18 + 10 * Math.sin(a + 0.22)]], 0xff4466, 0xff4466, 1, 0.5); }
      g.fillStyle(0x2a0a14, 1); g.fillCircle(18, 18, 10); g.lineStyle(2, 0xff4466, 1); g.strokeCircle(18, 18, 10);
      g.fillStyle(W, 1); g.fillCircle(18, 18, 3.5); g.fillStyle(0xff4466, 1); g.fillCircle(18, 18, 1.8);
    });
    // Centinela: torreta cuadrada con cañón
    this.tex('enemy_shooter', 36, 36, g => {
      this.glow(g, 18, 18, 18, 0xff9a3c, 0.07);
      g.fillStyle(0xff9a3c, 0.9); g.fillRect(15, 0, 6, 14);
      this.poly(g, [[7, 7], [29, 7], [29, 29], [7, 29]], 0x2a1608, 0xff9a3c, 2, 0.95);
      g.lineStyle(1, 0xff9a3c, 0.7); g.strokeRect(11, 11, 14, 14);
      g.fillStyle(W, 1); g.fillCircle(18, 18, 3.5); g.fillStyle(0xff9a3c, 1); g.fillCircle(18, 18, 1.8);
      g.fillStyle(0xff9a3c, 1); for (const [x, y] of [[9, 9], [27, 9], [9, 27], [27, 27]]) g.fillCircle(x, y, 1.5);
    });
    // Invocador: octógono con nodos orbitales
    this.tex('enemy_summoner', 40, 40, g => {
      this.glow(g, 20, 20, 20, 0xff2bd6, 0.07);
      this.poly(g, this.ngon(20, 20, 16, 8, Math.PI / 8), 0x2a0a2a, 0xff2bd6, 2, 0.95);
      g.lineStyle(1, 0xff2bd6, 0.6); g.strokeCircle(20, 20, 10);
      for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + 0.4; g.fillStyle(0xff2bd6, 1); g.fillCircle(20 + 10 * Math.cos(a), 20 + 10 * Math.sin(a), 2.4); }
      g.fillStyle(W, 1); g.fillCircle(20, 20, 3.5);
    });
    this.tex('enemy_drone', 24, 24, g => {
      this.glow(g, 12, 12, 12, 0xffe94d, 0.07);
      this.poly(g, [[12, 2], [21, 20], [12, 16], [3, 20]], 0xffe94d, 0xffe94d, 2, 0.5);
      g.fillStyle(W, 1); g.fillCircle(12, 11, 2);
    });
    // Francotirador: rombo largo con mira
    this.tex('enemy_sniper', 36, 36, g => {
      this.glow(g, 18, 18, 18, 0xb6ff3c, 0.07);
      this.poly(g, [[18, 0], [26, 18], [18, 34], [10, 18]], 0x142a08, 0xb6ff3c, 2, 0.95);
      g.lineStyle(1, 0xb6ff3c, 0.8); g.strokeCircle(18, 18, 6); g.lineBetween(18, 6, 18, 30); g.lineBetween(12, 18, 24, 18);
      g.fillStyle(W, 1); g.fillCircle(18, 18, 2);
    });
    // Blindado: casco pesado con placas
    this.tex('enemy_tank', 44, 44, g => {
      this.glow(g, 22, 22, 22, 0xff6a4c, 0.07);
      this.poly(g, this.ngon(22, 22, 20, 6, Math.PI / 6), 0x2a1210, 0xff6a4c, 3, 0.95);
      this.poly(g, this.ngon(22, 22, 13, 6, Math.PI / 6), 0x3a1a16, 0xff9a3c, 2, 0.9);
      g.lineStyle(2, 0xff6a4c, 0.8); for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3 + Math.PI / 6; g.lineBetween(22 + 13 * Math.cos(a), 22 + 13 * Math.sin(a), 22 + 20 * Math.cos(a), 22 + 20 * Math.sin(a)); }
      g.fillStyle(0xffe94d, 1); g.fillCircle(22, 22, 5); g.fillStyle(W, 1); g.fillCircle(22, 22, 2);
    });
    // Bomba lógica: esfera con franjas de aviso
    this.tex('enemy_bomber', 32, 32, g => {
      this.glow(g, 16, 16, 16, 0xffb03c, 0.08);
      g.fillStyle(0x2a1a08, 1); g.fillCircle(16, 16, 12); g.lineStyle(2, 0xffb03c, 1); g.strokeCircle(16, 16, 12);
      g.lineStyle(3, 0xffe94d, 0.9); g.lineBetween(7, 9, 12, 5); g.lineBetween(20, 5, 25, 9); g.lineBetween(7, 23, 12, 27); g.lineBetween(20, 27, 25, 23);
      g.fillStyle(0xff2244, 1); g.fillCircle(16, 16, 5); g.fillStyle(W, 1); g.fillCircle(16, 16, 2);
    });
    // Torreta: base circular con cañón
    this.tex('enemy_turret', 40, 40, g => {
      this.glow(g, 20, 20, 20, 0xffd23c, 0.07);
      g.fillStyle(0xffd23c, 1); g.fillRect(17, 0, 6, 17);
      g.fillStyle(0x2a2208, 1); g.fillCircle(20, 22, 15); g.lineStyle(3, 0xffd23c, 1); g.strokeCircle(20, 22, 15);
      g.lineStyle(1, 0xffd23c, 0.6); g.strokeCircle(20, 22, 9); for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + Math.PI / 4; g.fillStyle(0xffd23c, 1); g.fillCircle(20 + 12 * Math.cos(a), 22 + 12 * Math.sin(a), 1.8); }
      g.fillStyle(W, 1); g.fillCircle(20, 22, 3.5);
    });
    // Espectro: rombo fantasma
    this.tex('enemy_blinker', 36, 36, g => {
      this.glow(g, 18, 18, 18, 0x3cf0c8, 0.08);
      this.poly(g, [[18, 2], [32, 18], [18, 34], [4, 18]], 0x3cf0c8, 0x3cf0c8, 2, 0.2);
      this.poly(g, [[18, 9], [26, 18], [18, 27], [10, 18]], 0x3cf0c8, W, 1, 0.35);
      g.fillStyle(W, 1); g.fillCircle(14, 17, 2); g.fillCircle(22, 17, 2);
    });
    // Fractal: dos células
    this.tex('enemy_splitter', 36, 36, g => {
      this.glow(g, 18, 18, 18, 0x7dff3c, 0.07);
      g.fillStyle(0x143a08, 1); g.lineStyle(2, 0x7dff3c, 1);
      g.fillCircle(13, 18, 11); g.strokeCircle(13, 18, 11); g.fillCircle(24, 18, 9); g.strokeCircle(24, 18, 9);
      g.fillStyle(0x7dff3c, 0.9); g.fillCircle(13, 18, 4); g.fillCircle(24, 18, 3.2);
      g.fillStyle(W, 1); g.fillCircle(13, 18, 1.6);
    });
    // Jefes: uno por planta
    const boss = (key, main, sub, drawCore) => this.tex(key, 90, 90, g => {
      this.glow(g, 45, 45, 45, main, 0.07);
      drawCore(g);
      g.fillStyle(W, 1); g.fillCircle(45, 45, 7); g.lineStyle(3, W, 0.8); g.strokeCircle(45, 45, 14);
    });
    boss('enemy_boss1', 0xff2bd6, 0x9b5cff, g => {                       // Guardián: hexágonos concéntricos
      this.poly(g, this.ngon(45, 45, 41, 6), 0x9b5cff, 0x9b5cff, 3, 0.18);
      this.poly(g, this.ngon(45, 45, 29, 6, Math.PI / 6), 0xff2bd6, 0xff2bd6, 3, 0.3);
      g.lineStyle(2, 0xff2bd6, 0.8); for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; g.lineBetween(45 + 29 * Math.cos(a), 45 + 29 * Math.sin(a), 45 + 41 * Math.cos(a), 45 + 41 * Math.sin(a)); }
    });
    boss('enemy_boss2', 0xff9a3c, 0xff4466, g => {                       // Hidra: ocho brazos con cabeza
      for (let i = 0; i < 8; i++) {
        const a = i * Math.PI / 4;
        g.lineStyle(5, 0xff4466, 0.9); g.lineBetween(45 + 14 * Math.cos(a), 45 + 14 * Math.sin(a), 45 + 36 * Math.cos(a), 45 + 36 * Math.sin(a));
        g.fillStyle(0xff9a3c, 1); g.fillCircle(45 + 38 * Math.cos(a), 45 + 38 * Math.sin(a), 5);
      }
      this.poly(g, this.ngon(45, 45, 25, 8, Math.PI / 8), 0x3a1608, 0xff9a3c, 3, 0.95);
      this.poly(g, this.ngon(45, 45, 17, 8), 0xff4466, 0xff4466, 2, 0.4);
    });
    boss('enemy_boss3', 0x9b5cff, 0x00f0ff, g => {                       // Núcleo: anillos y rombos
      g.lineStyle(3, 0x9b5cff, 0.9); g.strokeCircle(45, 45, 40); g.lineStyle(2, 0x00f0ff, 0.7); g.strokeCircle(45, 45, 32);
      for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2; this.poly(g, [[45 + 42 * Math.cos(a), 45 + 42 * Math.sin(a)], [45 + 30 * Math.cos(a + 0.3), 45 + 30 * Math.sin(a + 0.3)], [45 + 30 * Math.cos(a - 0.3), 45 + 30 * Math.sin(a - 0.3)]], 0x9b5cff, 0x9b5cff, 2, 0.6); }
      this.poly(g, [[45, 14], [76, 45], [45, 76], [14, 45]], 0x1a0830, 0x9b5cff, 3, 0.95);
      this.poly(g, [[45, 26], [64, 45], [45, 64], [26, 45]], 0x9b5cff, 0x00f0ff, 2, 0.35);
    });
  }

  // ---------------------------------------------------------------------------------------
  makeProps() {
    const W = 0xffffff;
    this.tex('shadow', 32, 32, g => { for (let i = 6; i >= 1; i--) { g.fillStyle(0x000000, 0.1); g.fillCircle(16, 16, 15 * i / 6); } });
    // proyectiles: el del jugador es alargado (se orienta con su rumbo)
    this.tex('bullet', 26, 14, g => {
      this.glow(g, 13, 7, 7, W, 0.08);
      g.fillStyle(W, 0.35); g.fillRoundedRect(1, 3, 24, 8, 4);
      g.fillStyle(W, 1); g.fillRoundedRect(5, 5, 16, 4, 2);
    });
    this.tex('ebullet', 18, 18, g => { this.glow(g, 9, 9, 9, W, 0.14); g.fillStyle(W, 1); g.fillCircle(9, 9, 4); g.lineStyle(1, 0x000000, 0.4); g.strokeCircle(9, 9, 4); g.lineStyle(1, W, 0.7); g.strokeCircle(9, 9, 6.5); });
    this.tex('spark', 8, 8, g => { g.fillStyle(W, 1); g.fillCircle(4, 4, 3); });
    this.tex('glow', 64, 64, g => this.glow(g, 32, 32, 32, W, 0.16));
    this.tex('fire', 40, 40, g => { this.glow(g, 20, 20, 20, 0xff9a3c, 0.18); g.fillStyle(0xffe94d, 0.8); g.fillCircle(20, 20, 6); });
    this.tex('orbiter', 20, 20, g => { this.glow(g, 10, 10, 10, 0x00f0ff, 0.14); this.poly(g, [[10, 2], [17, 10], [10, 18], [3, 10]], 0x00f0ff, W, 2, 0.6); });
    this.tex('orbshield', 22, 22, g => { this.glow(g, 11, 11, 11, 0x5dff8a, 0.12); g.lineStyle(3, 0x5dff8a, 1); g.beginPath(); g.arc(11, 11, 8, Math.PI * 1.15, Math.PI * 1.85); g.strokePath(); g.fillStyle(0x5dff8a, 0.3); g.fillRect(4, 4, 14, 4); });
    this.tex('mine', 24, 24, g => {
      this.glow(g, 12, 12, 12, 0xff9a3c, 0.12);
      g.fillStyle(0x2a1608, 1); g.fillCircle(12, 12, 7); g.lineStyle(2, 0xff9a3c, 1); g.strokeCircle(12, 12, 7);
      g.lineStyle(2, 0xff9a3c, 1); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; g.lineBetween(12 + 7 * Math.cos(a), 12 + 7 * Math.sin(a), 12 + 11 * Math.cos(a), 12 + 11 * Math.sin(a)); }
      g.fillStyle(0xff2244, 1); g.fillCircle(12, 12, 2.5);
    });
    this.tex('barrel', 30, 30, g => {
      this.glow(g, 15, 15, 15, 0xff4466, 0.1);
      g.fillStyle(0x3a1408, 1); g.fillCircle(15, 15, 11); g.lineStyle(3, 0xff9a3c, 1); g.strokeCircle(15, 15, 11);
      g.lineStyle(2, 0xffe94d, 1); g.strokeCircle(15, 15, 6);
      g.fillStyle(0xffe94d, 1); g.fillTriangle(15, 10, 11, 19, 19, 19); g.fillStyle(0x3a1408, 1); g.fillRect(14, 13, 2, 3); g.fillRect(14, 17, 2, 1.5);
    });
    // trampas de pinchos: apagada / aviso / activa
    const plate = (g, col, a) => { g.fillStyle(0x0a0e1e, 1); g.fillRect(1, 1, 30, 30); g.lineStyle(1, col, a); g.strokeRect(1.5, 1.5, 29, 29); };
    this.tex('spike_off', 32, 32, g => { plate(g, 0x445080, 0.8); g.fillStyle(0x445080, 1); for (const [x, y] of [[9, 9], [23, 9], [9, 23], [23, 23]]) g.fillCircle(x, y, 2); });
    this.tex('spike_warn', 32, 32, g => { plate(g, 0xff4466, 1); g.fillStyle(0xff4466, 0.25); g.fillRect(2, 2, 28, 28); g.fillStyle(0xff4466, 1); for (const [x, y] of [[9, 9], [23, 9], [9, 23], [23, 23]]) g.fillCircle(x, y, 3); });
    this.tex('spike_on', 32, 32, g => {
      plate(g, 0xff4466, 1); g.fillStyle(0xff4466, 0.2); g.fillRect(2, 2, 28, 28);
      for (const [x, y] of [[9, 9], [23, 9], [9, 23], [23, 23]]) { g.fillStyle(0xff4466, 1); g.fillTriangle(x, y - 8, x - 5, y + 5, x + 5, y + 5); g.fillStyle(W, 0.9); g.fillTriangle(x, y - 8, x - 1.5, y, x + 1.5, y); }
    });
    // objetos
    this.tex('coin', 18, 18, g => { this.glow(g, 9, 9, 9, 0xffe94d, 0.08); this.poly(g, [[9, 1], [16, 5], [16, 13], [9, 17], [2, 13], [2, 5]], 0xffe94d, 0xffe94d, 2, 0.5); g.fillStyle(0xffe94d, 1); g.fillRect(8, 5, 2, 8); });
    this.tex('heart', 24, 24, g => {
      this.glow(g, 12, 12, 12, 0xff4466, 0.08);
      g.fillStyle(0xff4466, 1); g.fillCircle(8, 9, 5.5); g.fillCircle(16, 9, 5.5); g.fillTriangle(3, 11, 21, 11, 12, 21);
      g.fillStyle(W, 0.6); g.fillCircle(6, 7, 1.8);
    });
    this.tex('key', 26, 24, g => {
      this.glow(g, 13, 12, 12, 0xffe94d, 0.07);
      g.lineStyle(3, 0xffe94d, 1); g.strokeCircle(8, 12, 5);
      g.lineBetween(13, 12, 23, 12); g.lineBetween(20, 12, 20, 17); g.lineBetween(23, 12, 23, 16);
    });
    this.tex('module', 30, 30, g => {   // chip de software (se tiñe con el color del módulo)
      this.glow(g, 15, 15, 15, W, 0.07);
      g.fillStyle(W, 0.25); g.lineStyle(2, W, 1); g.fillRect(6, 6, 18, 18); g.strokeRect(6, 6, 18, 18);
      g.lineStyle(2, W, 1);
      for (let i = 0; i < 3; i++) { const p = 10 + i * 5; g.lineBetween(p, 2, p, 6); g.lineBetween(p, 24, p, 28); g.lineBetween(2, p, 6, p); g.lineBetween(24, p, 28, p); }
      g.fillStyle(W, 1); g.fillRect(12, 12, 6, 6);
    });
    this.tex('weapon', 34, 20, g => {
      g.fillStyle(W, 0.3); g.lineStyle(2, W, 1);
      g.fillRect(3, 6, 22, 8); g.strokeRect(3, 6, 22, 8); g.fillRect(25, 8, 7, 4); g.fillRect(8, 14, 6, 5);
    });
    this.tex('portal', 44, 44, g => {
      this.glow(g, 22, 22, 22, 0x00f0ff, 0.12);
      g.lineStyle(3, 0x00f0ff, 1); g.strokeCircle(22, 22, 15); g.lineStyle(2, 0xff2bd6, 1); g.strokeCircle(22, 22, 9);
      g.lineStyle(1, 0x00f0ff, 0.8); for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; g.lineBetween(22 + 15 * Math.cos(a), 22 + 15 * Math.sin(a), 22 + 20 * Math.cos(a), 22 + 20 * Math.sin(a)); }
      g.fillStyle(W, 1); g.fillCircle(22, 22, 3);
    });
    this.tex('door_closed', 32, 32, g => { g.fillStyle(0x2a0a14, 1); g.fillRect(0, 0, 32, 32); g.lineStyle(3, 0xff4466, 1); for (let i = 4; i < 32; i += 8) g.lineBetween(i, 2, i, 30); g.lineStyle(2, 0xff4466, 1); g.strokeRect(1, 1, 30, 30); g.fillStyle(0xff4466, 0.2); g.fillRect(1, 1, 30, 30); });
    this.tex('door_locked', 32, 32, g => { g.fillStyle(0x2a2208, 1); g.fillRect(0, 0, 32, 32); g.lineStyle(3, 0xffe94d, 1); g.strokeRect(2, 2, 28, 28); g.fillStyle(0xffe94d, 1); g.fillRect(11, 14, 10, 9); g.lineStyle(3, 0xffe94d, 1); g.strokeCircle(16, 12, 4); });
    this.tex('door_boss', 32, 32, g => {      // barrera de energía del jefe: se abre al limpiar todas las salas
      g.fillStyle(0x14061f, 1); g.fillRect(0, 0, 32, 32); g.fillStyle(0xff2bd6, 0.18); g.fillRect(1, 1, 30, 30);
      g.lineStyle(3, 0xff2bd6, 1); g.strokeRect(1.5, 1.5, 29, 29); g.lineStyle(2, 0xffe94d, 0.9); g.lineBetween(4, 4, 28, 28); g.lineBetween(28, 4, 4, 28);
      g.fillStyle(0xff2bd6, 1); g.fillCircle(16, 16, 4); g.fillStyle(0xffffff, 1); g.fillCircle(16, 16, 1.6);
    });
    this.tex('vignette', 4, 4, g => { g.fillStyle(0x000000, 1); g.fillRect(0, 0, 4, 4); });
    this.tex('bg_grid', 64, 64, g => { g.fillStyle(0x000000, 0); g.lineStyle(1, 0xffffff, 0.35); g.lineBetween(0, 0, 64, 0); g.lineBetween(0, 0, 0, 64); g.fillStyle(0xffffff, 0.5); g.fillRect(0, 0, 2, 2); });
  }

  // ---------------------------------------------------------------------------------------
  makeTiles() {
    THEMES.forEach((th, t) => {
      // suelo: 4 variantes (liso, punto, circuito, rejilla hexagonal)
      const base = g => { g.fillStyle(th.floor, 1); g.fillRect(0, 0, 32, 32); g.lineStyle(1, th.grid, 1); g.strokeRect(0.5, 0.5, 31, 31); };
      this.tex(`tile_floor_${t}_0`, 32, 32, base);
      this.tex(`tile_floor_${t}_1`, 32, 32, g => { base(g); g.fillStyle(th.dot, 1); g.fillRect(14, 14, 4, 4); g.lineStyle(1, th.grid, 0.8); g.lineBetween(14, 16, 18, 16); g.lineBetween(16, 14, 16, 18); });
      this.tex(`tile_floor_${t}_2`, 32, 32, g => {
        base(g); g.lineStyle(1, th.edge, 0.32); g.beginPath(); g.moveTo(3, 20); g.lineTo(14, 20); g.lineTo(14, 8); g.lineTo(28, 8); g.strokePath();
        g.fillStyle(th.edge, 0.5); g.fillCircle(28, 8, 2); g.fillCircle(3, 20, 1.5);
      });
      this.tex(`tile_floor_${t}_3`, 32, 32, g => { base(g); g.lineStyle(1, th.grid, 0.9); g.strokePoints(this.ngon(16, 16, 9, 6, Math.PI / 6).map(p => ({ x: p[0], y: p[1] })), true); g.fillStyle(th.dot, 1); g.fillCircle(16, 16, 3); });
      // pared: panel con remaches
      this.tex(`tile_wall_${t}`, 32, 32, g => {
        g.fillStyle(th.wall, 1); g.fillRect(0, 0, 32, 32);
        g.lineStyle(2, th.edge, 0.85); g.strokeRect(1, 1, 30, 30);
        g.lineStyle(1, th.edge2, 0.3); g.strokeRect(5, 5, 22, 22);
        g.lineStyle(1, th.edge, 0.15); g.lineBetween(0, 32, 32, 0); g.lineBetween(0, 16, 16, 0); g.lineBetween(16, 32, 32, 16);
        g.fillStyle(th.edge2, 0.8); for (const [x, y] of [[4, 4], [28, 4], [4, 28], [28, 28]]) g.fillCircle(x, y, 1.3);
      });
      // obstáculo: rack de servidor con leds
      this.tex(`tile_obs_${t}`, 32, 32, g => {
        g.fillStyle(th.obs, 1); g.fillRect(0, 0, 32, 32);
        g.lineStyle(2, th.obsEdge, 0.95); g.strokeRect(1, 1, 30, 30);
        g.lineStyle(1, th.obsEdge, 0.4); for (const y of [9, 16, 23]) g.lineBetween(5, y, 27, y);
        for (const [i, y] of [[0, 6], [1, 13], [2, 20], [3, 27]]) { g.fillStyle(i % 2 ? 0x5dff8a : th.obsEdge, 1); g.fillRect(24, y - 1, 3, 2); }
      });
      // decoración de suelo
      this.tex(`decal_${t}_0`, 32, 32, g => { g.lineStyle(1, th.edge, 0.28); g.beginPath(); g.moveTo(0, 12); g.lineTo(10, 12); g.lineTo(14, 18); g.lineTo(32, 18); g.strokePath(); g.fillStyle(th.edge, 0.4); g.fillCircle(10, 12, 1.6); });
      this.tex(`decal_${t}_1`, 32, 32, g => { g.lineStyle(1, th.edge, 0.22); g.beginPath(); g.moveTo(4, 6); g.lineTo(12, 13); g.lineTo(9, 18); g.lineTo(20, 27); g.strokePath(); g.beginPath(); g.moveTo(12, 13); g.lineTo(22, 11); g.strokePath(); });
      this.tex(`decal_${t}_2`, 32, 32, g => { g.lineStyle(1, th.edge2, 0.3); g.strokePoints(this.ngon(16, 16, 6, 6).map(p => ({ x: p[0], y: p[1] })), true); g.fillStyle(th.edge2, 0.35); g.fillCircle(16, 16, 1.5); });
      this.tex(`decal_${t}_3`, 32, 32, g => { g.lineStyle(1, th.edge2, 0.28); for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(8 + i * 5, 10); g.lineTo(13 + i * 5, 16); g.lineTo(8 + i * 5, 22); g.strokePath(); } });
      // símbolo del suelo (sala de inicio)
      this.tex(`sigil_${t}`, 288, 288, g => this.sigil(g, th.accent, 3));
    });
    this.tex('sigil_boss', 288, 288, g => this.sigil(g, 0xff2bd6, 6));
    this.tex('sigil_shop', 288, 288, g => this.sigil(g, 0xffe94d, 4));
    this.tex('sigil_treasure', 288, 288, g => this.sigil(g, 0x5dff8a, 5));
  }

  /** Anillos concéntricos con marcas y un polígono central (n lados). */
  sigil(g, col, n) {
    const c = 144;
    g.lineStyle(2, col, 0.45); g.strokeCircle(c, c, 134);
    g.lineStyle(1, col, 0.3); g.strokeCircle(c, c, 118); g.strokeCircle(c, c, 78);
    for (let i = 0; i < 36; i++) { const a = i * Math.PI / 18; g.lineStyle(i % 3 ? 1 : 2, col, i % 3 ? 0.25 : 0.5); g.lineBetween(c + 118 * Math.cos(a), c + 118 * Math.sin(a), c + 134 * Math.cos(a), c + 134 * Math.sin(a)); }
    g.lineStyle(2, col, 0.5); g.strokePoints(this.ngon(c, c, 78, n, -Math.PI / 2).map(p => ({ x: p[0], y: p[1] })), true);
    g.lineStyle(1, col, 0.35); g.strokePoints(this.ngon(c, c, 44, n, Math.PI / 2 - (n % 2 ? 0 : Math.PI / n)).map(p => ({ x: p[0], y: p[1] })), true);
    g.fillStyle(col, 0.12); g.fillCircle(c, c, 30);
  }
}
