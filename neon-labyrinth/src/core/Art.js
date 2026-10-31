/**
 * Art: arte semi-realista generado por código con el canvas 2D (degradados, brillos, sombras, metal).
 * Las texturas "HI" se dibujan al doble de resolución y se muestran a escala 0,5: usa Art.sc(clave, escala).
 * Incluye: enemigos y jefes, skins (con piernas para poder vestir armadura), piezas de armadura por material,
 * lingotes de material virtual y el herrero virtual con su yunque y martillo.
 */
const Art = {
  HI: new Set(),
  T: Math.PI * 2,

  scaleOf(key) { return this.HI.has(key) ? 0.5 : 1; },
  sc(key, s = 1) { return s * this.scaleOf(key); },

  // ------------------------------------------------------------------ utilidades de color y pincel
  rgb(h) { return [(h >> 16) & 255, (h >> 8) & 255, h & 255]; },
  css(h, a = 1) { const [r, g, b] = this.rgb(h); return `rgba(${r},${g},${b},${a})`; },
  mix(a, b, t) { const A = this.rgb(a), B = this.rgb(b); return (Math.round(A[0] + (B[0] - A[0]) * t) << 16) | (Math.round(A[1] + (B[1] - A[1]) * t) << 8) | Math.round(A[2] + (B[2] - A[2]) * t); },
  lt(h, t) { return this.mix(h, 0xffffff, t); },
  dk(h, t) { return this.mix(h, 0x000000, t); },
  lg(c, x0, y0, x1, y1, stops) { const g = c.createLinearGradient(x0, y0, x1, y1); stops.forEach(([o, col, a = 1]) => g.addColorStop(o, this.css(col, a))); return g; },
  rg(c, x0, y0, r0, x1, y1, r1, stops) { const g = c.createRadialGradient(x0, y0, r0, x1, y1, r1); stops.forEach(([o, col, a = 1]) => g.addColorStop(o, this.css(col, a))); return g; },

  /** Esfera con brillo especular y sombra propia. */
  ball(c, x, y, r, base, hi = 0.6) {
    c.fillStyle = this.rg(c, x - r * 0.35, y - r * 0.4, r * 0.08, x, y, r, [[0, this.lt(base, hi)], [0.42, base], [1, this.dk(base, 0.7)]]);
    c.beginPath(); c.arc(x, y, r, 0, this.T); c.fill();
  },
  glow(c, x, y, r, col, a = 0.6) {
    c.fillStyle = this.rg(c, x, y, 0, x, y, r, [[0, col, a], [0.4, col, a * 0.35], [1, col, 0]]);
    c.beginPath(); c.arc(x, y, r, 0, this.T); c.fill();
  },
  rr(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); },
  poly(c, pts) { c.beginPath(); c.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]); c.closePath(); },
  ngon(x, y, r, n, rot = 0) { const p = []; for (let i = 0; i < n; i++) p.push([x + r * Math.cos(rot + i * this.T / n), y + r * Math.sin(rot + i * this.T / n)]); return p; },
  /** Cuerpo con bisel metálico: degradado vertical claro-oscuro + borde luminoso. */
  plate(c, base, edge, x0, y0, x1, y1, lw = 2) {
    c.fillStyle = this.lg(c, x0, y0, x1, y1, [[0, this.lt(base, 0.4)], [0.5, base], [1, this.dk(base, 0.6)]]);
    c.fill();
    if (edge !== null) { c.lineWidth = lw; c.strokeStyle = this.css(edge, 0.95); c.stroke(); }
  },

  /** Crea una textura de canvas (hires = al doble de tamaño; se muestra a escala 0,5). */
  make(scene, key, w, h, draw, hires = true) {
    if (scene.textures.exists(key)) return;
    const W = hires ? w * 2 : w, H = hires ? h * 2 : h;
    const tex = scene.textures.createCanvas(key, W, H);
    const c = tex.context;
    c.save(); if (hires) c.scale(2, 2);
    draw(c, w, h);
    c.restore();
    tex.refresh();
    if (hires) this.HI.add(key);
  },

  // ================================================================== ENEMIGOS
  build(scene) {
    this.enemies(scene);
    this.enemies2(scene);
    this.bosses(scene);
    this.skins(scene);
    this.items(scene);
    this.smith(scene);
    this.portal(scene);
    this.chests(scene);
    this.workshop(scene);
  },

  spike(c, cx, cy, ang, r0, r1, w, base, tip) {
    const ca = Math.cos(ang), sa = Math.sin(ang), px = -sa, py = ca;
    const x0 = cx + ca * r0, y0 = cy + sa * r0, x1 = cx + ca * r1, y1 = cy + sa * r1;
    c.beginPath(); c.moveTo(x0 + px * w, y0 + py * w); c.lineTo(x1, y1); c.lineTo(x0 - px * w, y0 - py * w); c.closePath();
    c.fillStyle = this.lg(c, x0, y0, x1, y1, [[0, this.lt(base, 0.25)], [0.65, this.dk(base, 0.3)], [1, tip]]); c.fill();
    c.strokeStyle = this.css(this.dk(base, 0.7), 0.8); c.lineWidth = 0.8; c.stroke();
    c.strokeStyle = this.css(0xffffff, 0.35); c.lineWidth = 0.7; c.beginPath(); c.moveTo(x0 + px * w * 0.35, y0 + py * w * 0.35); c.lineTo(x1 - ca * 1.5, y1 - sa * 1.5); c.stroke();
  },

  enemies(s) {
    const A = this, T = this.T;
    // ---- Virus: núcleo de acero con púas y ojo emisivo
    A.make(s, 'enemy_grunt', 36, 36, c => {
      A.glow(c, 18, 18, 18, 0xff2244, 0.35);
      for (let i = 0; i < 10; i++) A.spike(c, 18, 18, i * T / 10, 8, 17, 2.6, 0x7a8294, 0xff3355);
      A.ball(c, 18, 18, 10.5, 0x3a4150, 0.5);
      c.strokeStyle = A.css(0xff3355, 0.9); c.lineWidth = 1.2; c.beginPath(); c.arc(18, 18, 8.2, 0, T); c.stroke();
      A.glow(c, 18, 18, 7, 0xff2244, 0.95);
      c.fillStyle = A.rg(c, 17, 17, 0.5, 18, 18, 4, [[0, 0xffffff], [0.5, 0xffb0b8], [1, 0xff2244]]); c.beginPath(); c.arc(18, 18, 3.6, 0, T); c.fill();
    });
    // ---- Centinela: torreta blindada con cañón y lente
    A.make(s, 'enemy_shooter', 36, 36, c => {
      A.glow(c, 18, 20, 18, 0xff9a3c, 0.25);
      c.fillStyle = A.lg(c, 14, 0, 22, 0, [[0, 0x222833], [0.45, 0x8c97ab], [1, 0x1c212b]]); A.rr(c, 14.5, 0.5, 7, 15, 2); c.fill();
      c.fillStyle = A.css(0xff9a3c, 0.9); c.fillRect(14.5, 1.5, 7, 2);
      A.poly(c, A.ngon(18, 21, 14, 8, Math.PI / 8)); A.plate(c, 0x59626f, 0xff9a3c, 0, 8, 0, 34);
      A.poly(c, A.ngon(18, 21, 10, 8, Math.PI / 8)); c.fillStyle = A.lg(c, 0, 12, 0, 30, [[0, 0x2c323d], [1, 0x151a22]]); c.fill();
      c.strokeStyle = A.css(0xff9a3c, 0.55); c.lineWidth = 0.8; for (const y of [15, 18, 24, 27]) { c.beginPath(); c.moveTo(10, y); c.lineTo(26, y); c.stroke(); }
      A.glow(c, 18, 21, 8, 0xff9a3c, 0.9); A.ball(c, 18, 21, 4.4, 0xff7a1c, 0.7);
      c.fillStyle = A.css(0xffffff, 0.85); c.beginPath(); c.arc(16.8, 19.7, 1.1, 0, T); c.fill();
      c.fillStyle = A.css(0xc8d0e0, 0.9); for (const [x, y] of [[8, 14], [28, 14], [8, 29], [28, 29]]) { c.beginPath(); c.arc(x, y, 1, 0, T); c.fill(); }
    });
    // ---- Invocador: disco arcano con órbitas
    A.make(s, 'enemy_summoner', 40, 40, c => {
      A.glow(c, 20, 20, 20, 0xff2bd6, 0.3);
      A.ball(c, 20, 20, 14, 0x4a2a5a, 0.55);
      for (const r of [11, 8]) { c.strokeStyle = A.css(0xff2bd6, 0.85); c.lineWidth = 1.2; c.beginPath(); c.arc(20, 20, r, 0, T); c.stroke(); }
      for (let i = 0; i < 4; i++) { const a = i * T / 4 + 0.5, x = 20 + 16.5 * Math.cos(a), y = 20 + 16.5 * Math.sin(a); A.glow(c, x, y, 6, 0xff2bd6, 0.8); A.ball(c, x, y, 2.8, 0xff5ee0, 0.6); }
      A.glow(c, 20, 20, 8, 0xff2bd6, 0.95); c.fillStyle = A.rg(c, 19, 19, 0.5, 20, 20, 4, [[0, 0xffffff], [1, 0xff2bd6]]); c.beginPath(); c.arc(20, 20, 3.8, 0, T); c.fill();
    });
    // ---- Dron: avispa mecánica
    A.make(s, 'enemy_drone', 24, 24, c => {
      A.glow(c, 12, 14, 12, 0xffe94d, 0.3);
      c.fillStyle = A.css(0xfff3a0, 0.35); c.strokeStyle = A.css(0xffe94d, 0.7); c.lineWidth = 0.8;
      for (const sx of [-1, 1]) { c.beginPath(); c.ellipse(12 + sx * 7, 12, 6, 2.6, sx * -0.5, 0, T); c.fill(); c.stroke(); }
      c.fillStyle = A.lg(c, 8, 0, 16, 0, [[0, 0x6a5a10], [0.5, 0xffe94d], [1, 0x5a4a08]]); A.rr(c, 8.5, 6, 7, 15, 3.5); c.fill();
      c.fillStyle = A.css(0x1a1608, 0.9); for (const y of [11, 14, 17]) c.fillRect(8.8, y, 6.4, 1.1);
      A.ball(c, 12, 6.5, 3.4, 0x8a8a98, 0.6); A.glow(c, 12, 6, 3, 0xff2244, 0.9);
      A.glow(c, 12, 22, 5, 0xffa030, 0.9);
    });
    // ---- Francotirador: fuselaje afilado con óptica
    A.make(s, 'enemy_sniper', 36, 36, c => {
      A.glow(c, 18, 18, 18, 0xb6ff3c, 0.22);
      c.fillStyle = A.lg(c, 16, 0, 20, 0, [[0, 0x222a1a], [0.5, 0x9aa890], [1, 0x1c2216]]); A.rr(c, 16.3, 0, 3.4, 16, 1.4); c.fill();
      A.poly(c, [[18, 3], [24, 14], [22, 32], [18, 36], [14, 32], [12, 14]]); A.plate(c, 0x3c4a30, 0xb6ff3c, 12, 0, 24, 0);
      A.poly(c, [[12, 22], [4, 32], [12, 30]]); c.fillStyle = A.lg(c, 4, 22, 12, 30, [[0, 0x2a3a20], [1, 0x6a7a58]]); c.fill();
      A.poly(c, [[24, 22], [32, 32], [24, 30]]); c.fill();
      A.glow(c, 18, 15, 8, 0xb6ff3c, 0.9); A.ball(c, 18, 15, 4.3, 0x6aa010, 0.8);
      c.strokeStyle = A.css(0xffffff, 0.7); c.lineWidth = 0.7; c.beginPath(); c.moveTo(15, 15); c.lineTo(21, 15); c.moveTo(18, 12); c.lineTo(18, 18); c.stroke();
    });
    // ---- Blindado: casco pesado con orugas y cañón
    A.make(s, 'enemy_tank', 44, 44, c => {
      A.glow(c, 22, 22, 22, 0xff6a4c, 0.2);
      for (const x of [3, 33]) { c.fillStyle = A.lg(c, x, 0, x + 8, 0, [[0, 0x14161c], [0.5, 0x3a3f4a], [1, 0x14161c]]); A.rr(c, x, 6, 8, 33, 2.5); c.fill(); c.strokeStyle = A.css(0x000000, 0.6); c.lineWidth = 0.7; c.stroke(); c.strokeStyle = A.css(0x9aa0ae, 0.35); for (let y = 9; y < 38; y += 3.5) { c.beginPath(); c.moveTo(x + 0.6, y); c.lineTo(x + 7.4, y); c.stroke(); } }
      A.rr(c, 9, 8, 26, 30, 4); A.plate(c, 0x6a4038, 0xff6a4c, 9, 8, 9, 38);
      c.fillStyle = A.css(0xffe94d, 0.85); c.save(); A.rr(c, 9, 32, 26, 5, 2); c.clip(); for (let i = -2; i < 12; i++) { c.beginPath(); c.moveTo(9 + i * 5, 37); c.lineTo(13 + i * 5, 37); c.lineTo(9 + i * 5 + 8, 32); c.lineTo(5 + i * 5 + 8, 32); c.closePath(); if (i % 2) c.fill(); } c.restore();
      c.fillStyle = A.lg(c, 19, 0, 25, 0, [[0, 0x1c1f27], [0.5, 0x9099ac], [1, 0x1a1d25]]); A.rr(c, 19.5, 1, 5, 20, 1.5); c.fill();
      c.fillStyle = A.css(0xff6a4c, 0.9); c.fillRect(19.5, 2, 5, 2.4);
      A.ball(c, 22, 22, 9.5, 0x7a4a44, 0.5); c.strokeStyle = A.css(0xff6a4c, 0.8); c.lineWidth = 1; c.beginPath(); c.arc(22, 22, 9.5, 0, T); c.stroke();
      A.glow(c, 22, 23, 6, 0xffb030, 0.9); A.ball(c, 22, 23, 3, 0xffd060, 0.7);
    });
    // ---- Bomba lógica: esfera con franja de peligro y núcleo
    A.make(s, 'enemy_bomber', 32, 32, c => {
      A.glow(c, 16, 16, 16, 0xff7a1c, 0.3);
      A.ball(c, 16, 16, 12.5, 0x7a2418, 0.55);
      c.save(); c.beginPath(); c.arc(16, 16, 12.5, 0, T); c.clip();
      c.fillStyle = A.css(0x15110a, 0.92); c.fillRect(0, 12.5, 32, 7);
      c.fillStyle = A.css(0xffd23c, 0.95); for (let i = -2; i < 9; i++) { c.beginPath(); c.moveTo(i * 5, 19.5); c.lineTo(i * 5 + 3, 19.5); c.lineTo(i * 5 + 6, 12.5); c.lineTo(i * 5 + 3, 12.5); c.closePath(); c.fill(); }
      c.restore();
      A.glow(c, 16, 7, 6, 0xff2244, 0.95); A.ball(c, 16, 7, 2.6, 0xff4455, 0.7);
      c.fillStyle = A.css(0xc8d0e0, 0.9); for (let i = 0; i < 4; i++) { const a = i * T / 4 + 0.78; c.beginPath(); c.arc(16 + 12 * Math.cos(a), 16 + 12 * Math.sin(a), 1.2, 0, T); c.fill(); }
    });
    // ---- Torreta: base atornillada con cañones gemelos
    A.make(s, 'enemy_turret', 40, 40, c => {
      A.glow(c, 20, 22, 20, 0xffd23c, 0.22);
      A.poly(c, A.ngon(20, 23, 17, 8, Math.PI / 8)); A.plate(c, 0x555b68, 0xffd23c, 0, 6, 0, 40);
      c.fillStyle = A.css(0xd0d6e4, 0.9); for (let i = 0; i < 8; i++) { const a = i * T / 8 + Math.PI / 8; c.beginPath(); c.arc(20 + 14 * Math.cos(a), 23 + 14 * Math.sin(a), 1.2, 0, T); c.fill(); }
      for (const x of [13, 23.5]) { c.fillStyle = A.lg(c, x, 0, x + 4, 0, [[0, 0x1c2028], [0.5, 0x9aa2b4], [1, 0x1a1e26]]); A.rr(c, x, 1.5, 4, 19, 1.4); c.fill(); c.fillStyle = A.css(0xffd23c, 0.95); c.fillRect(x, 2, 4, 2); }
      A.ball(c, 20, 23, 9.5, 0x6a6048, 0.55); c.strokeStyle = A.css(0xffd23c, 0.9); c.lineWidth = 1; c.beginPath(); c.arc(20, 23, 9.5, 0, T); c.stroke();
      A.glow(c, 20, 23, 6, 0xffd23c, 0.9); A.ball(c, 20, 23, 3, 0xffe680, 0.8);
    });
    // ---- Espectro: fantasma de datos translúcido
    A.make(s, 'enemy_blinker', 36, 36, c => {
      A.glow(c, 18, 18, 18, 0x3cf0c8, 0.4);
      c.beginPath(); c.moveTo(18, 2); c.bezierCurveTo(30, 6, 32, 20, 28, 32); c.lineTo(24, 28); c.lineTo(21, 34); c.lineTo(18, 29); c.lineTo(15, 34); c.lineTo(12, 28); c.lineTo(8, 32); c.bezierCurveTo(4, 20, 6, 6, 18, 2); c.closePath();
      c.fillStyle = A.rg(c, 18, 12, 1, 18, 18, 17, [[0, 0xd8fff6, 0.95], [0.5, 0x3cf0c8, 0.6], [1, 0x0a8a78, 0.25]]); c.fill();
      c.strokeStyle = A.css(0xb8fff0, 0.8); c.lineWidth = 1; c.stroke();
      c.strokeStyle = A.css(0xffffff, 0.35); c.lineWidth = 0.7; for (const x of [13, 18, 23]) { c.beginPath(); c.moveTo(x, 16); c.lineTo(x + (x - 18) * 0.3, 28); c.stroke(); }
      for (const x of [13.5, 22.5]) { A.glow(c, x, 14, 5, 0xffffff, 0.9); c.fillStyle = '#02201a'; c.beginPath(); c.ellipse(x, 14, 2, 3, 0, 0, T); c.fill(); }
    });
    // ---- Fractal: dos células gelatinosas
    A.make(s, 'enemy_splitter', 36, 36, c => {
      A.glow(c, 18, 18, 18, 0x7dff3c, 0.3);
      c.strokeStyle = A.css(0x5acd28, 0.9); c.lineWidth = 4; c.beginPath(); c.moveTo(13, 20); c.quadraticCurveTo(19, 24, 25, 19); c.stroke();
      const cell = (x, y, r) => {
        c.fillStyle = A.rg(c, x - r * 0.3, y - r * 0.35, r * 0.1, x, y, r, [[0, 0xe6ffc8, 0.95], [0.45, 0x7dff3c, 0.85], [1, 0x1f7a10, 0.95]]);
        c.beginPath(); c.arc(x, y, r, 0, T); c.fill(); c.strokeStyle = A.css(0xc8ff9a, 0.85); c.lineWidth = 1; c.stroke();
        A.ball(c, x + r * 0.1, y + r * 0.1, r * 0.38, 0x2a8a14, 0.5);
        c.strokeStyle = A.css(0xffffff, 0.8); c.lineWidth = 1; c.beginPath(); c.arc(x, y, r * 0.78, Math.PI * 1.1, Math.PI * 1.5); c.stroke();
      };
      cell(13, 20, 11); cell(25, 17, 9);
    });
  },

  // ================================================================== JEFES (180x180 reales, 90 mostrados)
  bosses(s) {
    const A = this, T = this.T, C = 45;
    const core = (c, col) => { A.glow(c, C, C, 20, col, 0.9); A.ball(c, C, C, 9, A.lt(col, 0.4), 0.8); c.fillStyle = A.rg(c, C - 2, C - 2, 0.5, C, C, 6, [[0, 0xffffff], [1, col]]); c.beginPath(); c.arc(C, C, 5.5, 0, T); c.fill(); };
    // 1 · Guardián del Servidor: fortaleza hexagonal de placas
    A.make(s, 'enemy_boss1', 90, 90, c => {
      A.glow(c, C, C, 46, 0xff2bd6, 0.25);
      for (let i = 0; i < 6; i++) { const a = i * T / 6; A.poly(c, [[C + 30 * Math.cos(a - 0.2), C + 30 * Math.sin(a - 0.2)], [C + 43 * Math.cos(a - 0.08), C + 43 * Math.sin(a - 0.08)], [C + 43 * Math.cos(a + 0.08), C + 43 * Math.sin(a + 0.08)], [C + 30 * Math.cos(a + 0.2), C + 30 * Math.sin(a + 0.2)]]); A.plate(c, 0x4a3a6a, 0xff2bd6, 0, C - 43, 0, C + 43, 1.5); }
      A.poly(c, A.ngon(C, C, 34, 6)); A.plate(c, 0x3a2f5a, 0x9b5cff, 0, 8, 0, 82, 3);
      A.poly(c, A.ngon(C, C, 25, 6, Math.PI / 6)); A.plate(c, 0x55407a, 0xff2bd6, 0, 18, 0, 72, 2);
      c.strokeStyle = A.css(0xff2bd6, 0.6); c.lineWidth = 1; for (let i = 0; i < 6; i++) { const a = i * T / 6 + Math.PI / 6; c.beginPath(); c.moveTo(C + 14 * Math.cos(a), C + 14 * Math.sin(a)); c.lineTo(C + 25 * Math.cos(a), C + 25 * Math.sin(a)); c.stroke(); }
      c.strokeStyle = A.css(0xffffff, 0.6); c.lineWidth = 1.5; c.beginPath(); c.arc(C, C, 15, 0, T); c.stroke();
      core(c, 0xff2bd6);
    });
    // 2 · Hidra de Datos: ocho brazos articulados y cabeza blindada
    A.make(s, 'enemy_boss2', 90, 90, c => {
      A.glow(c, C, C, 46, 0xff9a3c, 0.22);
      for (let i = 0; i < 8; i++) {
        const a = i * T / 8 + 0.2; let px = C, py = C;
        for (let k = 0; k < 4; k++) {
          const aa = a + Math.sin(k * 0.9 + i) * 0.22, len = 7.5;
          const nx = px + Math.cos(aa) * len + (k ? 0 : Math.cos(a) * 6), ny = py + Math.sin(aa) * len + (k ? 0 : Math.sin(a) * 6);
          c.strokeStyle = A.lg(c, px, py, nx, ny, [[0, 0x6a3a28], [1, 0xff6a3c]]); c.lineWidth = 7 - k * 1.3; c.lineCap = 'round'; c.beginPath(); c.moveTo(px, py); c.lineTo(nx, ny); c.stroke();
          c.strokeStyle = A.css(0xffd0a0, 0.45); c.lineWidth = 1; c.beginPath(); c.moveTo(px, py); c.lineTo(nx, ny); c.stroke();
          A.ball(c, nx, ny, 4 - k * 0.5, 0x8a4a30, 0.5); px = nx; py = ny;
        }
        A.glow(c, px, py, 7, 0xff9a3c, 0.9);
      }
      A.poly(c, A.ngon(C, C, 24, 8, Math.PI / 8)); A.plate(c, 0x4a3024, 0xff9a3c, 0, 20, 0, 70, 3);
      A.poly(c, A.ngon(C, C, 16, 8)); A.plate(c, 0x6a4030, 0xffb060, 0, 28, 0, 62, 2);
      for (const x of [-7, 7]) { A.glow(c, C + x, C - 3, 6, 0xffe94d, 0.9); c.fillStyle = '#2a1200'; c.beginPath(); c.ellipse(C + x, C - 3, 2, 3.2, 0, 0, T); c.fill(); }
      c.strokeStyle = A.css(0xffd9a0, 0.9); c.lineWidth = 1.2; c.beginPath(); for (let i = 0; i < 6; i++) { c.moveTo(C - 8 + i * 3.2, C + 7); c.lineTo(C - 8 + i * 3.2, C + 11); } c.stroke();
    });
    // 3 · Núcleo Corrupto: cristal flotante con anillos
    A.make(s, 'enemy_boss3', 90, 90, c => {
      A.glow(c, C, C, 46, 0x9b5cff, 0.32);
      c.strokeStyle = A.css(0x9b5cff, 0.85); c.lineWidth = 2.5; c.beginPath(); c.ellipse(C, C, 42, 16, 0.5, 0, T); c.stroke();
      c.strokeStyle = A.css(0x00f0ff, 0.7); c.lineWidth = 2; c.beginPath(); c.ellipse(C, C, 40, 14, -0.7, 0, T); c.stroke();
      const dia = (r, base, edge) => { A.poly(c, [[C, C - r], [C + r * 0.78, C], [C, C + r], [C - r * 0.78, C]]); A.plate(c, base, edge, C - r, C - r, C + r, C + r, 2.5); };
      dia(33, 0x2a1450, 0x9b5cff);
      c.strokeStyle = A.css(0xc9a6ff, 0.7); c.lineWidth = 1; c.beginPath(); c.moveTo(C, C - 33); c.lineTo(C, C + 33); c.moveTo(C - 26, C); c.lineTo(C + 26, C); c.moveTo(C, C - 33); c.lineTo(C + 26, C); c.lineTo(C, C + 33); c.lineTo(C - 26, C); c.closePath(); c.stroke();
      c.fillStyle = A.css(0xe8d8ff, 0.18); A.poly(c, [[C, C - 33], [C + 26, C], [C, C - 8]]); c.fill();
      dia(18, 0x6a3acb, 0x00f0ff); core(c, 0x9b5cff);
      c.strokeStyle = A.css(0x00f0ff, 0.9); c.lineWidth = 2; c.beginPath(); c.ellipse(C, C, 42, 16, 0.5, 0.2, 1.6); c.stroke();
    });
    // 4 · Centinela Prisma: prisma de cristal cian
    A.make(s, 'enemy_boss4', 90, 90, c => {
      A.glow(c, C, C, 46, 0x00f0ff, 0.28);
      A.poly(c, [[C, 4], [C + 40, C + 32], [C - 40, C + 32]]); A.plate(c, 0x1a5a78, 0x7fe9ff, C - 40, 4, C + 40, C + 32, 3);
      c.fillStyle = A.lg(c, C - 40, C, C + 40, C, [[0, 0xff2bd6, 0.28], [0.5, 0xffffff, 0.12], [1, 0x00ffd0, 0.3]]); A.poly(c, [[C, 4], [C + 40, C + 32], [C - 40, C + 32]]); c.fill();
      c.strokeStyle = A.css(0xffffff, 0.7); c.lineWidth = 1.2; c.beginPath(); c.moveTo(C, 4); c.lineTo(C, C + 32); c.moveTo(C - 20, C + 18); c.lineTo(C + 20, C + 18); c.moveTo(C - 20, C + 18); c.lineTo(C, C - 8); c.lineTo(C + 20, C + 18); c.stroke();
      A.poly(c, [[C, 12], [C + 14, C + 6], [C - 14, C + 6]]); c.fillStyle = A.css(0xe8ffff, 0.45); c.fill();
      for (const sx of [-1, 1]) { A.poly(c, [[C + sx * 38, C + 30], [C + sx * 44, C + 44], [C + sx * 30, C + 38]]); A.plate(c, 0x28708a, 0x00f0ff, 0, C + 30, 0, C + 44, 1.5); }
      core(c, 0x00f0ff);
    });
    // 5 · Coloso de Hierro: mecha blindado de hombros anchos
    A.make(s, 'enemy_boss5', 90, 90, c => {
      A.glow(c, C, C, 46, 0xff4466, 0.22);
      for (const sx of [-1, 1]) {
        A.rr(c, C + sx * 28 - 11, 12, 22, 44, 6); A.plate(c, 0x6a707e, 0xff4466, 0, 12, 0, 56, 2.5);
        c.fillStyle = A.lg(c, C + sx * 28 - 3, 0, C + sx * 28 + 3, 0, [[0, 0x14181e], [0.5, 0xa0a8b8], [1, 0x14181e]]); A.rr(c, C + sx * 28 - 3, 2, 6, 20, 2); c.fill();
        c.fillStyle = A.css(0xff4466, 0.9); c.fillRect(C + sx * 28 - 3, 3, 6, 3);
        A.ball(c, C + sx * 28, 62, 8, 0x555b68, 0.5);
      }
      A.rr(c, C - 20, 18, 40, 52, 8); A.plate(c, 0x7a808e, 0xff4466, 0, 18, 0, 70, 3);
      c.strokeStyle = A.css(0x2a2f3a, 0.9); c.lineWidth = 1.2; for (const y of [30, 44, 58]) { c.beginPath(); c.moveTo(C - 17, y); c.lineTo(C + 17, y); c.stroke(); }
      c.fillStyle = A.css(0xffd23c, 0.9); c.save(); A.rr(c, C - 20, 62, 40, 8, 4); c.clip(); for (let i = -2; i < 12; i++) { if (i % 2) { c.beginPath(); c.moveTo(C - 24 + i * 7, 70); c.lineTo(C - 20 + i * 7, 70); c.lineTo(C - 14 + i * 7, 62); c.lineTo(C - 18 + i * 7, 62); c.closePath(); c.fill(); } } c.restore();
      A.ball(c, C, 22, 10, 0x8a909e, 0.55); A.glow(c, C, 22, 8, 0xff4466, 0.95); c.fillStyle = '#220008'; A.rr(c, C - 7, 20, 14, 4, 2); c.fill(); c.fillStyle = A.css(0xff4466, 1); c.fillRect(C - 5.5, 21, 11, 2);
      core(c, 0xff4466);
    });
    // 6 · Emperador del Vacío: corona dorada y núcleo de vacío
    A.make(s, 'enemy_boss6', 90, 90, c => {
      A.glow(c, C, C, 46, 0xffd23c, 0.28);
      for (let i = 0; i < 10; i++) A.spike(c, C, C, i * T / 10 - Math.PI / 2, 26, 44, 5, 0xc89a20, 0xfff0a0);
      A.poly(c, A.ngon(C, C, 31, 12)); A.plate(c, 0x7a5a10, 0xffd23c, 0, 14, 0, 76, 3);
      A.ball(c, C, C, 24, 0x120820, 0.2);
      c.strokeStyle = A.css(0xffd23c, 0.9); c.lineWidth = 2; c.beginPath(); c.arc(C, C, 24, 0, T); c.stroke();
      c.strokeStyle = A.css(0x9b5cff, 0.9); c.lineWidth = 1.5; for (let i = 0; i < 3; i++) { c.beginPath(); c.arc(C, C, 8 + i * 5, i, i + 3.4); c.stroke(); }
      for (let i = 0; i < 8; i++) { const a = i * T / 8; A.ball(c, C + 31 * Math.cos(a), C + 31 * Math.sin(a), 2.8, i % 2 ? 0x9b5cff : 0xfff0a0, 0.7); }
      core(c, 0x9b5cff);
    });
  },
};
