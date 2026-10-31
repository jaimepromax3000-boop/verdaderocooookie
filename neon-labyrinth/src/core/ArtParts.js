/**
 * ArtParts: skins, armadura, materiales y herrero (continuación de Art.js).
 * Las skins se dibujan en un lienzo de 40x40 mirando hacia ARRIBA: cabeza en (20,14), hombros en (20,25),
 * piernas y botas debajo. Para vestirlas se compone: piernas/botas -> skin -> pechera -> casco.
 */
Object.assign(Art, {
  // Estilos de material: base, claro, oscuro, brillo
  MAT: {
    leather: { base: 0x8a5a2b, light: 0xd09a58, dark: 0x3e2410, line: 0xe8c890 },
    iron:    { base: 0x8e98aa, light: 0xeef3fb, dark: 0x343c4c, line: 0xffffff },
    gold:    { base: 0xd9a520, light: 0xfff2a8, dark: 0x6a4600, line: 0xfff8d0 },
    diamond: { base: 0x4fd3e8, light: 0xf0ffff, dark: 0x0a5a78, line: 0xffffff },
  },

  matGrad(c, m, x0, y0, x1, y1) {
    const M = this.MAT[m];
    return this.lg(c, x0, y0, x1, y1, [[0, M.light], [0.32, M.base], [1, M.dark]]);
  },

  sparkle(c, x, y, r, col = 0xffffff) {
    c.fillStyle = this.css(col, 0.95); c.beginPath(); c.moveTo(x, y - r); c.lineTo(x + r * 0.22, y - r * 0.22); c.lineTo(x + r, y); c.lineTo(x + r * 0.22, y + r * 0.22); c.lineTo(x, y + r); c.lineTo(x - r * 0.22, y + r * 0.22); c.lineTo(x - r, y); c.lineTo(x - r * 0.22, y - r * 0.22); c.closePath(); c.fill();
  },

  // ---------------------------------------------------------------- piezas de armadura (en espacio 40x40, escala s)
  helmetPiece(c, cx, cy, s, m) {
    const M = this.MAT[m], A = this, r = 8 * s;
    c.save();
    c.fillStyle = A.css(0x000000, 0.25); c.beginPath(); c.ellipse(cx + 0.6 * s, cy + 1.2 * s, r, r * 0.95, 0, 0, A.T); c.fill();
    if (m === 'gold' || m === 'diamond') {                              // cresta
      c.fillStyle = A.matGrad(c, m, cx - s, cy - 10 * s, cx + s, cy + 4 * s); A.rr(c, cx - 1.1 * s, cy - 10.5 * s, 2.2 * s, 13 * s, 1 * s); c.fill();
    }
    c.fillStyle = A.rg(c, cx - r * 0.35, cy - r * 0.45, r * 0.1, cx, cy, r, [[0, M.light], [0.4, M.base], [1, M.dark]]);
    c.beginPath(); c.arc(cx, cy, r, 0, A.T); c.fill();
    c.lineWidth = 0.7 * s; c.strokeStyle = A.css(M.dark, 0.9); c.stroke();
    if (m === 'leather') {                                               // costuras
      c.strokeStyle = A.css(M.line, 0.85); c.lineWidth = 0.5 * s; c.setLineDash([1 * s, 0.9 * s]);
      c.beginPath(); c.arc(cx, cy, r * 0.8, Math.PI * 1.05, Math.PI * 1.95); c.moveTo(cx, cy - r); c.lineTo(cx, cy + r * 0.2); c.stroke(); c.setLineDash([]);
    } else if (m === 'iron') {                                           // remaches y banda
      c.strokeStyle = A.css(M.dark, 0.8); c.lineWidth = 0.8 * s; c.beginPath(); c.arc(cx, cy, r * 0.78, Math.PI * 1.15, Math.PI * 1.85); c.stroke();
      c.fillStyle = A.css(0xffffff, 0.9); for (const a of [-2.2, -1.57, -0.94]) { c.beginPath(); c.arc(cx + Math.cos(a) * r * 0.78, cy + Math.sin(a) * r * 0.78, 0.6 * s, 0, A.T); c.fill(); }
    } else if (m === 'gold') {
      c.strokeStyle = A.css(M.line, 0.7); c.lineWidth = 0.6 * s; c.beginPath(); c.arc(cx, cy, r * 0.8, Math.PI * 1.1, Math.PI * 1.9); c.stroke();
    } else {                                                             // diamante: facetas
      c.strokeStyle = A.css(0xffffff, 0.65); c.lineWidth = 0.5 * s; c.beginPath();
      for (let i = 0; i < 6; i++) { const a = i * A.T / 6; c.moveTo(cx, cy); c.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); }
      c.stroke(); c.beginPath(); c.arc(cx, cy, r * 0.55, 0, A.T); c.stroke();
    }
    c.fillStyle = A.css(0x06080e, 0.95); A.rr(c, cx - 5 * s, cy - 2.4 * s, 10 * s, 2.4 * s, 1.1 * s); c.fill();   // visera
    if (m === 'diamond') { c.fillStyle = A.css(0x7fe9ff, 0.9); c.fillRect(cx - 4.2 * s, cy - 1.8 * s, 8.4 * s, 1 * s); A.sparkle(c, cx - 3.5 * s, cy - 5 * s, 1.8 * s); }
    c.restore();
  },

  chestPiece(c, cx, cy, s, m) {
    const M = this.MAT[m], A = this;
    c.save();
    for (const sx of [-1, 1]) {                                          // hombreras
      const px = cx + sx * 12.2 * s, py = cy - 0.6 * s;
      c.fillStyle = A.css(0x000000, 0.25); c.beginPath(); c.arc(px + 0.4 * s, py + 0.9 * s, 4.6 * s, 0, A.T); c.fill();
      A.ball(c, px, py, 4.5 * s, M.base, 0.55); c.strokeStyle = A.css(M.dark, 0.9); c.lineWidth = 0.6 * s; c.beginPath(); c.arc(px, py, 4.5 * s, 0, A.T); c.stroke();
      c.strokeStyle = A.css(M.line, 0.5); c.lineWidth = 0.5 * s; c.beginPath(); c.arc(px, py, 2.8 * s, 0.4, 2.4); c.stroke();
    }
    A.poly(c, [[cx - 8 * s, cy - 6.2 * s], [cx + 8 * s, cy - 6.2 * s], [cx + 6.6 * s, cy + 6.6 * s], [cx, cy + 8 * s], [cx - 6.6 * s, cy + 6.6 * s]]);
    c.fillStyle = A.matGrad(c, m, cx - 8 * s, cy - 6 * s, cx + 8 * s, cy + 8 * s); c.fill();
    c.lineWidth = 0.7 * s; c.strokeStyle = A.css(M.dark, 0.95); c.stroke();
    c.strokeStyle = A.css(M.line, 0.6); c.lineWidth = 0.6 * s; c.beginPath(); c.moveTo(cx, cy - 5.8 * s); c.lineTo(cx, cy + 7.4 * s); c.moveTo(cx - 5.5 * s, cy - 1 * s); c.quadraticCurveTo(cx, cy + 2 * s, cx + 5.5 * s, cy - 1 * s); c.stroke();
    if (m === 'leather') { c.strokeStyle = A.css(M.dark, 0.9); c.lineWidth = 1.1 * s; c.beginPath(); c.moveTo(cx - 6 * s, cy - 6 * s); c.lineTo(cx + 5 * s, cy + 6 * s); c.moveTo(cx + 6 * s, cy - 6 * s); c.lineTo(cx - 5 * s, cy + 6 * s); c.stroke(); }
    if (m === 'diamond') { A.sparkle(c, cx - 3 * s, cy - 3 * s, 2 * s); A.sparkle(c, cx + 11 * s, cy - 3 * s, 1.4 * s); }
    if (m === 'iron') { c.fillStyle = A.css(0xffffff, 0.85); for (const [x, y] of [[-5, -4.5], [5, -4.5], [-4.5, 4.5], [4.5, 4.5]]) { c.beginPath(); c.arc(cx + x * s, cy + y * s, 0.55 * s, 0, A.T); c.fill(); } }
    c.restore();
  },

  pantsPiece(c, cx, cy, s, m) {
    const M = this.MAT[m], A = this;
    for (const sx of [-1, 1]) {
      const px = cx + sx * 4.6 * s;
      c.fillStyle = A.css(0x000000, 0.25); c.beginPath(); c.ellipse(px + 0.4 * s, cy + 0.8 * s, 4.1 * s, 4.8 * s, 0, 0, A.T); c.fill();
      c.beginPath(); c.ellipse(px, cy, 4.1 * s, 4.8 * s, 0, 0, A.T); c.fillStyle = A.matGrad(c, m, px - 4 * s, cy - 4 * s, px + 4 * s, cy + 5 * s); c.fill();
      c.strokeStyle = A.css(M.dark, 0.95); c.lineWidth = 0.6 * s; c.stroke();
      c.strokeStyle = A.css(M.line, 0.55); c.lineWidth = 0.5 * s; c.beginPath(); c.moveTo(px - 3 * s, cy + 1.2 * s); c.lineTo(px + 3 * s, cy + 1.2 * s); c.stroke();
      A.ball(c, px, cy - 1.2 * s, 1.5 * s, M.light, 0.3);
      if (m === 'diamond') A.sparkle(c, px - 1.5 * s, cy - 2.5 * s, 1.3 * s);
    }
  },

  bootsPiece(c, cx, cy, s, m) {
    const M = this.MAT[m], A = this;
    for (const sx of [-1, 1]) {
      const px = cx + sx * 4.6 * s;
      c.fillStyle = A.css(0x000000, 0.28); A.rr(c, px - 3.2 * s + 0.4 * s, cy - 2.4 * s + 0.8 * s, 6.4 * s, 6 * s, 2.2 * s); c.fill();
      A.rr(c, px - 3.2 * s, cy - 2.4 * s, 6.4 * s, 6 * s, 2.2 * s); c.fillStyle = A.matGrad(c, m, px - 3 * s, cy - 2.4 * s, px + 3 * s, cy + 3.6 * s); c.fill();
      c.strokeStyle = A.css(M.dark, 0.95); c.lineWidth = 0.6 * s; c.stroke();
      c.fillStyle = A.css(M.dark, 0.85); c.fillRect(px - 3 * s, cy + 2.2 * s, 6 * s, 1.2 * s);                       // suela
      c.fillStyle = A.css(M.light, 0.55); c.beginPath(); c.ellipse(px - 0.6 * s, cy - 1 * s, 1.7 * s, 1 * s, 0, 0, A.T); c.fill();
      if (m === 'diamond') A.sparkle(c, px + 1.6 * s, cy - 1.2 * s, 1.2 * s);
    }
  },

  // ---------------------------------------------------------------- skins
  skinBase(c, id) {
    const A = this, T = this.T;
    const shoulders = (base, rim, rx = 12.5, ry = 6.3) => {
      c.beginPath(); c.ellipse(20, 25, rx, ry, 0, 0, T);
      c.fillStyle = A.lg(c, 0, 18, 0, 32, [[0, A.lt(base, 0.35)], [0.5, base], [1, A.dk(base, 0.6)]]); c.fill();
      c.lineWidth = 0.8; c.strokeStyle = A.css(rim, 0.95); c.stroke();
    };
    const skin = (cx, cy, r, tone = 0xf0c8a0) => A.ball(c, cx, cy, r, tone, 0.45);
    const drawRobot = (metal, dark, eye, trim) => {
      A.rr(c, 8, 21, 24, 9, 2.5); A.plate(c, dark, trim, 0, 21, 0, 30, 1);
      A.rr(c, 13, 7, 14, 13.5, 3); A.plate(c, metal, trim, 0, 7, 0, 20.5, 1);
      A.glow(c, 20, 12.6, 9, eye, 0.45); c.fillStyle = A.css(eye, 1); A.rr(c, 15, 11, 10, 3, 1.4); c.fill(); c.fillStyle = A.css(0xffffff, 0.8); c.fillRect(16.5, 11.7, 3, 1);
      c.strokeStyle = A.css(trim, 1); c.lineWidth = 0.9; c.beginPath(); c.moveTo(20, 7); c.lineTo(20, 3.5); c.stroke(); A.glow(c, 20, 3.5, 3.5, eye, 0.9); A.ball(c, 20, 3.5, 1.4, eye, 0.6);
      c.fillStyle = A.css(0xffffff, 0.7); for (const [x, y] of [[14.5, 19], [25.5, 19], [10, 22.5], [30, 22.5]]) { c.beginPath(); c.arc(x, y, 0.5, 0, T); c.fill(); }
    };
    switch (id) {
      case 'operator':
        shoulders(0x1a2a44, 0x00f0ff);
        c.strokeStyle = A.css(0x00f0ff, 0.6); c.lineWidth = 0.6; c.beginPath(); c.moveTo(11, 24); c.lineTo(16, 30); c.moveTo(29, 24); c.lineTo(24, 30); c.stroke();
        A.ball(c, 20, 14, 7.7, 0x23365a, 0.5);
        A.glow(c, 20, 10.6, 8, 0x00f0ff, 0.45); c.fillStyle = A.css(0x00f0ff, 1); A.rr(c, 14.2, 9.4, 11.6, 2.5, 1.2); c.fill(); c.fillStyle = A.css(0xffffff, 0.85); c.fillRect(15.5, 10, 4, 0.9);
        for (const sx of [-1, 1]) { A.ball(c, 20 + sx * 8.1, 14.5, 2.2, 0x00c8dc, 0.6); }
        c.strokeStyle = A.css(0x00f0ff, 0.9); c.lineWidth = 0.9; c.beginPath(); c.arc(20, 14, 8.1, Math.PI * 1.02, Math.PI * 1.98); c.stroke();
        break;
      case 'virus':
        A.glow(c, 20, 16, 17, 0x9b5cff, 0.35);
        for (let i = 0; i < 10; i++) A.spike(c, 20, 16, i * T / 10, 5, 13, 1.8, 0x7a5aa8, 0xff2bd6);
        A.ball(c, 20, 26, 6, 0x4a2a8a, 0.5);
        A.ball(c, 20, 16, 7.2, 0x3a1a66, 0.55); c.strokeStyle = A.css(0x9b5cff, 0.9); c.lineWidth = 0.8; c.beginPath(); c.arc(20, 16, 5.8, 0, T); c.stroke();
        A.ball(c, 20, 14.4, 3.4, 0xffffff, 0.2); A.glow(c, 20, 14.4, 5, 0xff2bd6, 0.7); A.ball(c, 20, 14.4, 1.7, 0xff2bd6, 0.5);
        break;
      case 'pirate':
        shoulders(0x1a3a6a, 0xffd23c);
        c.fillStyle = A.css(0xf4f4ff, 0.95); A.poly(c, [[17, 19.5], [23, 19.5], [20, 24.5]]); c.fill();
        for (const y of [25, 28]) A.ball(c, 20, y, 0.9, 0xffd23c, 0.6);
        skin(20, 14.5, 6.6);
        c.fillStyle = A.lg(c, 0, 11, 0, 15, [[0, 0xee4455], [1, 0x8a1020]]); A.rr(c, 13.6, 12, 12.8, 3, 1.5); c.fill();
        A.poly(c, [[20, 2.2], [33.5, 12.2], [27, 14.4], [20, 11.4], [13, 14.4], [6.5, 12.2]]);
        c.fillStyle = A.lg(c, 0, 2, 0, 14, [[0, 0x3a3a4a], [0.5, 0x15151f], [1, 0x07070c]]); c.fill(); c.strokeStyle = A.css(0xffd23c, 0.9); c.lineWidth = 0.8; c.stroke();
        A.ball(c, 20, 8, 1.6, 0xf4f4ff, 0.3); c.strokeStyle = A.css(0xf4f4ff, 0.9); c.lineWidth = 0.7; c.beginPath(); c.moveTo(17.5, 10.2); c.lineTo(22.5, 6); c.moveTo(22.5, 10.2); c.lineTo(17.5, 6); c.stroke();
        break;
      case 'viking':
        shoulders(0x6a4a2a, 0x2a1a0c, 13, 6.5);
        c.strokeStyle = A.css(0x9a7040, 0.8); c.lineWidth = 0.7; for (let i = 0; i < 14; i++) { const a = i * T / 14; c.beginPath(); c.moveTo(20 + Math.cos(a) * 9, 25 + Math.sin(a) * 4.5); c.lineTo(20 + Math.cos(a) * 12.4, 25 + Math.sin(a) * 6.2); c.stroke(); }
        c.fillStyle = A.lg(c, 0, 16, 0, 26, [[0, 0xf0b860], [1, 0xa86a20]]); c.beginPath(); c.ellipse(20, 21, 6, 4.8, 0, 0, T); c.fill();
        skin(20, 15.5, 6);
        for (const sx of [-1, 1]) {
          c.beginPath(); c.moveTo(20 + sx * 7, 12); c.bezierCurveTo(20 + sx * 14, 12, 20 + sx * 17, 7, 20 + sx * 16, 2.5); c.bezierCurveTo(20 + sx * 14, 7, 20 + sx * 11, 8.6, 20 + sx * 7, 9.4); c.closePath();
          c.fillStyle = A.lg(c, 20 + sx * 7, 12, 20 + sx * 16, 2.5, [[0, 0x8a7a50], [0.5, 0xf6f0dc], [1, 0xffffff]]); c.fill(); c.strokeStyle = A.css(0x8a7a50, 0.9); c.lineWidth = 0.6; c.stroke();
        }
        c.save(); c.beginPath(); c.arc(20, 13.4, 7.6, Math.PI, 0); c.lineTo(27.6, 13.4); c.closePath(); c.fillStyle = A.rg(c, 17, 8, 1, 20, 12, 9, [[0, 0xc8d0de], [0.5, 0x7d8696], [1, 0x3a4252]]); c.fill(); c.strokeStyle = A.css(0xdfe6f2, 0.9); c.lineWidth = 0.7; c.stroke(); c.restore();
        c.fillStyle = A.css(0x9aa4b6, 1); c.fillRect(19, 7, 2, 7.5);
        break;
      case 'robot': drawRobot(0xc0c8d8, 0x56607a, 0xff2244, 0x00f0ff); break;
      case 'golden': drawRobot(0xffd23c, 0xb8860b, 0x00f0ff, 0xfff2a8); A.sparkle(c, 27, 9, 2.2); break;
      case 'ninja':
        for (const [x1, y1, x2, y2] of [[12.5, 14, 6, 23], [27.5, 14, 34, 23]]) { A.poly(c, [[x1, y1], [x2, y2], [x1 + (x2 > x1 ? -1 : 1) * 3, y2 - 6]]); c.fillStyle = A.lg(c, x1, y1, x2, y2, [[0, 0xdd2233], [1, 0x7a0e1a]]); c.fill(); }
        shoulders(0x1a1a24, 0x606078);
        c.strokeStyle = A.css(0x8890aa, 0.45); c.lineWidth = 0.6; c.beginPath(); c.moveTo(12, 22.5); c.quadraticCurveTo(20, 28, 28, 22.5); c.stroke();
        A.ball(c, 20, 14, 6.9, 0x1c1c26, 0.35);
        c.fillStyle = A.lg(c, 0, 12, 0, 16, [[0, 0xf4d0a8], [1, 0xc8946a]]); A.rr(c, 14.5, 12.2, 11, 3.1, 1.4); c.fill();
        c.fillStyle = '#0a0a10'; c.fillRect(16.4, 13, 2.8, 1.3); c.fillRect(20.8, 13, 2.8, 1.3); c.fillStyle = A.css(0xffffff, 0.9); c.fillRect(17, 13.1, 0.8, 0.6); c.fillRect(21.4, 13.1, 0.8, 0.6);
        c.fillStyle = A.lg(c, 0, 8.6, 0, 11.4, [[0, 0xee3344], [1, 0x8a1020]]); A.rr(c, 13, 8.8, 14, 2.6, 1.2); c.fill(); c.fillStyle = A.css(0xcfd6e6, 1); A.rr(c, 18, 9, 4, 2.2, 0.8); c.fill();
        break;
      case 'astronaut':
        A.rr(c, 14, 22, 12, 9, 2.5); A.plate(c, 0x9098ae, 0xc8d0e0, 0, 22, 0, 31, 0.8);
        shoulders(0xe8ecf6, 0xaab4cc);
        c.fillStyle = A.css(0xff7a1c, 0.95); A.rr(c, 8, 25, 24, 1.8, 0.8); c.fill(); c.fillStyle = A.css(0xcc2233, 1); A.rr(c, 12.5, 27.2, 4, 2.2, 0.6); c.fill();
        A.ball(c, 20, 14, 7.9, 0xf4f6ff, 0.5); c.strokeStyle = A.css(0xaab4cc, 0.9); c.lineWidth = 0.8; c.beginPath(); c.arc(20, 14, 7.9, 0, T); c.stroke();
        c.beginPath(); c.ellipse(20, 12.8, 5.6, 4.2, 0, 0, T); c.fillStyle = A.rg(c, 18, 10.5, 0.5, 20, 13, 6, [[0, 0xffe8a0], [0.5, 0xff9a3c], [1, 0x7a3a00]]); c.fill(); c.strokeStyle = A.css(0x6a4a1a, 0.9); c.lineWidth = 0.6; c.stroke();
        c.strokeStyle = A.css(0xffffff, 0.8); c.lineWidth = 0.9; c.beginPath(); c.arc(20, 12.8, 3.6, Math.PI * 1.1, Math.PI * 1.55); c.stroke();
        break;
      case 'alien':
        shoulders(0x2a7a46, 0x5dff8a, 9.5, 5);
        c.beginPath(); c.ellipse(20, 14, 8.6, 7.8, 0, 0, T); c.fillStyle = A.rg(c, 16.5, 10, 1, 20, 14, 10, [[0, 0xc8ffd8], [0.45, 0x5dff8a], [1, 0x1f8a40]]); c.fill(); c.strokeStyle = A.css(0x1f8a40, 0.9); c.lineWidth = 0.7; c.stroke();
        for (const sx of [-1, 1]) { c.fillStyle = A.rg(c, 20 + sx * 4.6 - 1, 11.2, 0.4, 20 + sx * 4.6, 12.5, 3.6, [[0, 0x6a7a80], [0.35, 0x05100a], [1, 0x000000]]); c.beginPath(); c.ellipse(20 + sx * 4.6, 12.8, 2.8, 3.8, sx * 0.45, 0, T); c.fill(); c.fillStyle = A.css(0xffffff, 0.9); c.beginPath(); c.arc(20 + sx * 4.6 - 0.9, 11.3, 0.8, 0, T); c.fill(); }
        c.strokeStyle = A.css(0x2fd06a, 1); c.lineWidth = 0.8; c.beginPath(); c.moveTo(15, 8); c.lineTo(11, 2.5); c.moveTo(25, 8); c.lineTo(29, 2.5); c.stroke(); A.glow(c, 11, 2.5, 3, 0xffe94d, 0.9); A.glow(c, 29, 2.5, 3, 0xffe94d, 0.9);
        break;
      case 'skull':
        c.strokeStyle = A.css(0xeae6d8, 0.95); c.lineWidth = 1.2; for (let i = 0; i < 3; i++) { c.beginPath(); c.ellipse(20, 24 + i * 1.6, 11.5 - i * 1.6, 4.6, 0, 0.15 * Math.PI, 0.85 * Math.PI); c.stroke(); }
        c.strokeStyle = A.css(0x8a8472, 0.7); c.lineWidth = 0.7; c.beginPath(); c.moveTo(20, 20); c.lineTo(20, 30); c.stroke();
        A.ball(c, 20, 14, 7.4, 0xeae6d8, 0.55); c.strokeStyle = A.css(0x8a8472, 0.9); c.lineWidth = 0.6; c.beginPath(); c.arc(20, 14, 7.4, 0, T); c.stroke();
        for (const sx of [-1, 1]) { c.fillStyle = '#06060a'; c.beginPath(); c.ellipse(20 + sx * 3, 13, 2.2, 2.6, 0, 0, T); c.fill(); A.glow(c, 20 + sx * 3, 13, 3.2, 0xff2244, 0.85); }
        c.fillStyle = '#06060a'; A.poly(c, [[20, 15.8], [18.6, 18.2], [21.4, 18.2]]); c.fill();
        c.strokeStyle = A.css(0x6a6454, 0.9); c.lineWidth = 0.5; c.beginPath(); for (let i = 0; i < 5; i++) { c.moveTo(16.5 + i * 1.75, 19.2); c.lineTo(16.5 + i * 1.75, 20.8); } c.stroke();
        break;
      case 'samurai':
        for (const sx of [-1, 1]) { c.beginPath(); c.ellipse(20 + sx * 10, 25, 4.6, 5.6, 0, 0, T); c.fillStyle = A.lg(c, 0, 19, 0, 31, [[0, 0xee3344], [0.5, 0xaa2233], [1, 0x5a0e18]]); c.fill(); c.strokeStyle = A.css(0xffd23c, 0.95); c.lineWidth = 0.7; c.stroke(); c.strokeStyle = A.css(0xffd23c, 0.55); c.lineWidth = 0.5; for (const y of [22.5, 25, 27.5]) { c.beginPath(); c.moveTo(20 + sx * 10 - 3.4, y); c.lineTo(20 + sx * 10 + 3.4, y); c.stroke(); } }
        shoulders(0x8a1a28, 0xffd23c, 9, 5.8);
        skin(20, 15.5, 6.3);
        c.beginPath(); c.arc(20, 13.2, 8.2, Math.PI * 1.02, Math.PI * 1.98); c.lineTo(28, 14.6); c.quadraticCurveTo(20, 11.4, 12, 14.6); c.closePath(); c.fillStyle = A.rg(c, 17, 8, 1, 20, 12, 10, [[0, 0x4a4a5a], [0.5, 0x1a1a24], [1, 0x07070c]]); c.fill(); c.strokeStyle = A.css(0xffd23c, 0.95); c.lineWidth = 0.7; c.stroke();
        c.strokeStyle = A.css(0xffd23c, 1); c.lineWidth = 1.1; c.beginPath(); c.arc(20, 8.6, 5, Math.PI * 1.1, Math.PI * 1.9); c.stroke(); A.poly(c, [[20, 2.6], [18.4, 6.4], [21.6, 6.4]]); c.fillStyle = A.lg(c, 0, 2, 0, 7, [[0, 0xfff2a8], [1, 0xc89a20]]); c.fill();
        c.strokeStyle = A.css(0xffd23c, 0.5); c.lineWidth = 0.5; c.beginPath(); c.moveTo(20, 6); c.lineTo(20, 13); c.stroke();
        break;
      case 'wizard':
        shoulders(0x4a2a8a, 0x9b5cff);
        c.fillStyle = A.css(0xffd23c, 0.9); for (const [x, y] of [[11, 24], [15, 28], [26, 27], [30, 23], [20, 30]]) A.sparkle(c, x, y, 1.2);
        c.fillStyle = A.lg(c, 0, 19, 0, 27, [[0, 0xffffff], [1, 0xc8c8e0]]); c.beginPath(); c.ellipse(20, 21.5, 4.8, 4.6, 0, 0, T); c.fill();
        skin(20, 15.4, 5.2);
        c.beginPath(); c.ellipse(20, 12.4, 12.2, 10.6, 0, 0, T); c.fillStyle = A.rg(c, 16, 7, 1, 20, 12.4, 12.5, [[0, 0x9a6aee], [0.55, 0x5a2aab], [1, 0x2a1060]]); c.fill(); c.strokeStyle = A.css(0xc9a6ff, 0.9); c.lineWidth = 0.7; c.stroke();
        c.beginPath(); c.arc(20, 12.4, 6.3, 0, T); c.fillStyle = A.rg(c, 18, 10, 0.5, 20, 12.4, 6.6, [[0, 0x8a5aee], [1, 0x3a1a80]]); c.fill();
        c.strokeStyle = A.css(0xffd23c, 1); c.lineWidth = 1; c.beginPath(); c.arc(20, 12.4, 6.3, 0, T); c.stroke(); A.sparkle(c, 20, 12.4, 3, 0xffe680);
        break;
    }
  },

  /** Dibuja con un contorno oscuro nítido alrededor de la silueta (da profundidad y lectura a cualquier fondo). */
  makeOutlined(scene, key, w, h, draw) {
    this.make(scene, key, w, h, c => {
      const mk = () => { const o = document.createElement('canvas'); o.width = w * 2; o.height = h * 2; const oc = o.getContext('2d'); oc.scale(2, 2); return [o, oc]; };
      const [o, oc] = mk(); draw(oc, w, h);
      const [sil, sc] = mk(); sc.drawImage(o, 0, 0, w, h); sc.globalCompositeOperation = 'source-in'; sc.fillStyle = '#04050c'; sc.fillRect(0, 0, w, h);
      for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; c.drawImage(sil, Math.cos(a) * 0.9, Math.sin(a) * 0.9, w, h); }
      c.drawImage(o, 0, 0, w, h);
    });
  },

  /** Skins (sin armadura) y piezas sueltas: se generan al arrancar. */
  skins(scene) {
    SKINS.forEach(sk => {
      this.makeOutlined(scene, 'skinbase_' + sk.id, 40, 40, c => { c.save(); c.shadowColor = this.css(0x000000, 0.4); c.shadowBlur = 2; c.shadowOffsetY = 1; this.skinBase(c, sk.id); c.restore(); });
      this.compose(scene, sk.id, null, 'skin_' + sk.id);
    });
  },

  /** Piernas animadas: devuelve las claves de las texturas del torso y de los 3 fotogramas de piernas (quieto, paso A, paso B). */
  playerParts(scene, skinId) {
    const arm = Meta.data.armor, A = this, sig = ['helmet', 'chest', 'pants', 'boots'].map(k => (arm[k] || '-')[0]).join('');
    const upper = `pu_${skinId}_${sig}`;
    if (!scene.textures.exists(upper)) A.makeOutlined(scene, upper, 40, 40, c => {
      c.drawImage(scene.textures.get('skinbase_' + skinId).getSourceImage(), 0, 0, 40, 40);
      if (arm.chest) A.chestPiece(c, 20, 25, 1, arm.chest);
      if (arm.helmet) A.helmetPiece(c, 20, 14, 1, arm.helmet);
    });
    const legs = { i: [0, 0], a: [-3.2, 2.4], b: [2.4, -3.2] }, keys = {};
    for (const f of ['i', 'a', 'b']) {
      const key = `plegs_${sig}_${f}`; keys[f] = key;
      if (scene.textures.exists(key)) continue;
      const [ly, ry] = legs[f];
      A.makeOutlined(scene, key, 40, 40, c => {
        const one = (sx, dy) => {
          if (arm.pants) { c.save(); c.translate(0, dy); A.pantsPiece(c, 20 + (sx < 0 ? 0 : 0), 32.4, 1, arm.pants); c.restore(); }
          else { c.beginPath(); c.ellipse(20 + sx * 4.6, 32.4 + dy, 4, 4.7, 0, 0, A.T); c.fillStyle = A.lg(c, 0, 28, 0, 37, [[0, 0x4a5468], [1, 0x1c2230]]); c.fill(); }
        };
        // pantalones/botas por pierna: se dibujan completos y se recorta por mitades para mover cada pierna por separado
        for (const sx of [-1, 1]) {
          c.save(); c.beginPath(); c.rect(sx < 0 ? 0 : 20, 20, 20, 24); c.clip();
          const dy = sx < 0 ? ly : ry;
          c.translate(0, dy);
          if (arm.pants) A.pantsPiece(c, 20, 32.4, 1, arm.pants); else { for (const q of [-1, 1]) { c.beginPath(); c.ellipse(20 + q * 4.6, 32.4, 4, 4.7, 0, 0, A.T); c.fillStyle = A.lg(c, 0, 28, 0, 37, [[0, 0x4a5468], [1, 0x1c2230]]); c.fill(); c.strokeStyle = A.css(0x0a0e18, 0.9); c.lineWidth = 0.6; c.stroke(); } }
          if (arm.boots) A.bootsPiece(c, 20, 36.2, 1, arm.boots); else { for (const q of [-1, 1]) { A.rr(c, 20 + q * 4.6 - 3.1, 33.8, 6.2, 5.6, 2.2); c.fillStyle = A.lg(c, 0, 34, 0, 39, [[0, 0x3a3a46], [1, 0x0c0c12]]); c.fill(); c.strokeStyle = A.css(0x000000, 0.9); c.lineWidth = 0.6; c.stroke(); } }
          c.restore();
        }
      });
    }
    return { upper, idle: keys.i, a: keys.a, b: keys.b };
  },

  /** Compone skin + armadura equipada y devuelve la clave de la textura (se cachea por firma). */
  compose(scene, skinId, armor, forceKey) {
    const arm = armor || { helmet: null, chest: null, pants: null, boots: null };
    const sig = ['helmet', 'chest', 'pants', 'boots'].map(k => (arm[k] || '-')[0]).join('');
    const key = forceKey || `pl_${skinId}_${sig}`;
    if (scene.textures.exists(key)) return key;
    const A = this;
    this.make(scene, key, 40, 40, c => {
      // piernas y botas (con tela y cuero oscuros si no llevas armadura)
      if (arm.pants) A.pantsPiece(c, 20, 32.4, 1, arm.pants); else {
        for (const sx of [-1, 1]) { c.beginPath(); c.ellipse(20 + sx * 4.6, 32.4, 4, 4.7, 0, 0, A.T); c.fillStyle = A.lg(c, 0, 28, 0, 37, [[0, 0x4a5468], [1, 0x1c2230]]); c.fill(); c.strokeStyle = A.css(0x0a0e18, 0.9); c.lineWidth = 0.6; c.stroke(); }
      }
      if (arm.boots) A.bootsPiece(c, 20, 36.2, 1, arm.boots); else {
        for (const sx of [-1, 1]) { A.rr(c, 20 + sx * 4.6 - 3.1, 33.8, 6.2, 5.6, 2.2); c.fillStyle = A.lg(c, 0, 34, 0, 39, [[0, 0x3a3a46], [1, 0x0c0c12]]); c.fill(); c.strokeStyle = A.css(0x000000, 0.9); c.lineWidth = 0.6; c.stroke(); c.fillStyle = A.css(0xffffff, 0.2); c.fillRect(20 + sx * 4.6 - 1.8, 35, 2, 0.8); }
      }
      c.drawImage(scene.textures.get('skinbase_' + skinId).getSourceImage(), 0, 0, 40, 40);
      if (arm.chest) A.chestPiece(c, 20, 25, 1, arm.chest);
      if (arm.helmet) A.helmetPiece(c, 20, 14, 1, arm.helmet);
    });
    return key;
  },

  /** Textura del jugador con su skin y la armadura permanente actual. */
  playerKey(scene, skinId) { return this.compose(scene, skinId, Meta.data.armor); },

  // ---------------------------------------------------------------- iconos de armadura y materiales
  items(scene) {
    const A = this;
    const draw = {
      helmet: (c, m) => A.helmetPiece(c, 24, 25, 2.1, m), chest: (c, m) => A.chestPiece(c, 24, 24, 1.75, m),
      pants: (c, m) => A.pantsPiece(c, 24, 24, 2.3, m), boots: (c, m) => A.bootsPiece(c, 24, 23, 2.3, m),
    };
    for (const slot of ['helmet', 'chest', 'pants', 'boots']) for (const m of ['leather', 'iron', 'gold', 'diamond']) {
      A.make(scene, `ar_${slot}_${m}`, 48, 48, c => { A.glow(c, 24, 24, 24, A.MAT[m].base, 0.25); draw[slot](c, m); });
    }
    for (const slot of ['helmet', 'chest', 'pants', 'boots']) {
      A.make(scene, `ar_${slot}_none`, 48, 48, c => { c.globalAlpha = 0.28; draw[slot](c, 'iron'); c.globalAlpha = 1; c.strokeStyle = A.css(0x445080, 0.8); c.lineWidth = 1.2; c.setLineDash([3, 3]); c.beginPath(); c.arc(24, 24, 20, 0, A.T); c.stroke(); });
    }
    // lingotes virtuales: con trazas de circuito luminosas
    const trace = c => { c.strokeStyle = A.css(0x00f0ff, 0.9); c.lineWidth = 0.9; c.shadowColor = A.css(0x00f0ff, 1); c.shadowBlur = 3; c.beginPath(); c.moveTo(14, 26); c.lineTo(22, 26); c.lineTo(25, 22); c.lineTo(34, 22); c.stroke(); c.shadowBlur = 0; c.fillStyle = A.css(0x00f0ff, 1); c.beginPath(); c.arc(34, 22, 1.2, 0, A.T); c.fill(); };
    const ingot = (c, m) => {
      const M = A.MAT[m];
      A.glow(c, 24, 26, 24, M.base, 0.3);
      A.poly(c, [[9, 20], [39, 20], [34, 12], [14, 12]]); c.fillStyle = A.lg(c, 9, 12, 39, 20, [[0, M.light], [1, A.lt(M.base, 0.3)]]); c.fill(); c.strokeStyle = A.css(M.dark, 0.9); c.lineWidth = 0.8; c.stroke();
      A.poly(c, [[9, 20], [39, 20], [36, 36], [12, 36]]); c.fillStyle = A.lg(c, 0, 20, 0, 36, [[0, M.base], [1, M.dark]]); c.fill(); c.stroke();
      c.fillStyle = A.css(0xffffff, 0.5); c.beginPath(); c.moveTo(11, 21.5); c.lineTo(30, 21.5); c.lineTo(29, 23.5); c.lineTo(10.6, 23.5); c.closePath(); c.fill();
      trace(c);
    };
    A.make(scene, 'mat_iron', 48, 48, c => ingot(c, 'iron'));
    A.make(scene, 'mat_gold', 48, 48, c => ingot(c, 'gold'));
    A.make(scene, 'mat_leather', 48, 48, c => {
      const M = A.MAT.leather; A.glow(c, 24, 26, 24, M.base, 0.3);
      A.rr(c, 7, 13, 34, 23, 6); c.fillStyle = A.lg(c, 0, 13, 0, 36, [[0, M.light], [0.4, M.base], [1, M.dark]]); c.fill(); c.strokeStyle = A.css(M.dark, 0.9); c.lineWidth = 0.9; c.stroke();
      c.strokeStyle = A.css(M.line, 0.85); c.lineWidth = 0.7; c.setLineDash([2, 1.6]); A.rr(c, 10, 16, 28, 17, 4); c.stroke(); c.setLineDash([]);
      c.strokeStyle = A.css(M.dark, 0.35); c.lineWidth = 0.7; for (const [x, y] of [[16, 20], [28, 29], [32, 19]]) { c.beginPath(); c.moveTo(x, y); c.lineTo(x + 4, y + 2); c.stroke(); }
      trace(c);
    });
    A.make(scene, 'mat_diamond', 48, 48, c => {
      const M = A.MAT.diamond; A.glow(c, 24, 25, 24, 0x7fe9ff, 0.45);
      A.poly(c, [[24, 5], [41, 18], [24, 43], [7, 18]]); c.fillStyle = A.lg(c, 7, 5, 41, 43, [[0, 0xf0ffff], [0.35, M.base], [1, M.dark]]); c.fill(); c.strokeStyle = A.css(0xcffcff, 0.95); c.lineWidth = 1; c.stroke();
      c.strokeStyle = A.css(0xffffff, 0.8); c.lineWidth = 0.8; c.beginPath(); c.moveTo(7, 18); c.lineTo(41, 18); c.moveTo(24, 5); c.lineTo(16, 18); c.lineTo(24, 43); c.lineTo(32, 18); c.lineTo(24, 5); c.stroke();
      c.fillStyle = A.css(0xffffff, 0.35); A.poly(c, [[24, 5], [16, 18], [24, 18]]); c.fill();
      A.sparkle(c, 33, 11, 3.5); A.sparkle(c, 14, 30, 2);
    });
  },

  /** Taller del herrero: pared de ladrillo, tuberías, herramientas colgadas y un foso de brasas. */
  workshop(scene) {
    const A = this, T = this.T;
    A.make(scene, 'forge_bg', 244, 488, c => {
      c.fillStyle = A.lg(c, 0, 0, 0, 488, [[0, 0x0b1124], [0.7, 0x070b18], [1, 0x14080a]]); c.fillRect(0, 0, 244, 488);
      for (let y = 0, row = 0; y < 488; y += 17, row++) for (let x = (row % 2) * 18 - 18; x < 244; x += 36) {                        // ladrillos
        const sh = 0.04 + ((x * 7 + y * 13) % 11) / 220;
        c.fillStyle = A.css(0x2a3a6a, sh); c.fillRect(x + 1, y + 1, 34, 15); c.strokeStyle = A.css(0x1c2748, 0.7); c.lineWidth = 0.8; c.strokeRect(x + 0.5, y + 0.5, 35, 16);
      }
      for (const x of [10, 226]) {                                                                                                     // tuberías con anillos luminosos
        A.rr(c, x - 5, 0, 10, 488, 3); c.fillStyle = A.lg(c, x - 5, 0, x + 5, 0, [[0, 0x1a2236], [0.5, 0x5a6a88], [1, 0x151c2e]]); c.fill();
        for (let y = 30; y < 488; y += 74) { c.fillStyle = A.css(0x00f0ff, 0.85); c.fillRect(x - 6, y, 12, 3); A.glow(c, x, y + 1.5, 9, 0x00f0ff, 0.35); }
      }
      c.strokeStyle = A.css(0x6a7a98, 0.9); c.lineWidth = 2; c.beginPath(); c.moveTo(24, 246); c.lineTo(220, 246); c.stroke();     // barra con herramientas colgadas
      const hang = (x, fn) => { c.save(); c.translate(x, 248); c.strokeStyle = A.css(0x8a9ab8, 0.9); c.fillStyle = A.lg(c, 0, 0, 0, 40, [[0, 0x9aa8c4], [1, 0x3a465e]]); fn(); c.restore(); };
      hang(48, () => { c.lineWidth = 3; c.beginPath(); c.moveTo(0, 0); c.lineTo(0, 30); c.stroke(); A.rr(c, -8, 26, 16, 9, 2); c.fill(); });              // martillo
      hang(92, () => { c.lineWidth = 3; c.beginPath(); c.moveTo(-5, 0); c.lineTo(0, 34); c.lineTo(5, 0); c.stroke(); });                                // tenazas
      hang(136, () => { c.lineWidth = 3; c.beginPath(); c.moveTo(0, 0); c.lineTo(0, 28); c.stroke(); c.beginPath(); c.arc(0, 33, 6, 0, T); c.stroke(); }); // llave
      hang(182, () => { c.lineWidth = 3; c.beginPath(); c.moveTo(0, 0); c.lineTo(0, 34); c.stroke(); A.poly(c, [[-7, 30], [7, 30], [0, 42]]); c.fill(); }); // cincel
      A.rr(c, 24, 332, 196, 5, 2); c.fillStyle = A.lg(c, 0, 332, 0, 337, [[0, 0x6a7a98], [1, 0x2a3248]]); c.fill();                      // estante con viales
      [[0x00f0ff, 40], [0xff2bd6, 66], [0x5dff8a, 92], [0xffe94d, 178], [0xff9a3c, 204]].forEach(([col, x]) => { A.rr(c, x - 6, 312, 12, 20, 4); c.fillStyle = A.css(col, 0.35); c.fill(); c.strokeStyle = A.css(col, 0.95); c.lineWidth = 1.2; c.stroke(); A.glow(c, x, 322, 11, col, 0.45); });
      A.rr(c, 20, 506, 204, 46, 6); c.fillStyle = A.lg(c, 0, 506, 0, 552, [[0, 0x2a0e08], [1, 0x090303]]); c.fill(); c.strokeStyle = A.css(0x8a5a40, 0.9); c.lineWidth = 2; c.stroke();   // foso de brasas
      c.fillStyle = A.rg(c, 122, 530, 4, 122, 530, 110, [[0, 0xffd060, 0.95], [0.35, 0xff7a1c, 0.8], [1, 0x7a1c08, 0]]); c.fillRect(20, 506, 204, 46);
      for (let i = 0; i < 26; i++) { const x = 28 + (i * 37) % 188, y = 512 + (i * 17) % 34; A.glow(c, x, y, 5, i % 3 ? 0xff9a3c : 0xffe08a, 0.75); }
    });
    A.make(scene, 'flame', 24, 40, c => {
      c.beginPath(); c.moveTo(12, 1); c.bezierCurveTo(22, 12, 24, 22, 20, 30); c.bezierCurveTo(18, 38, 6, 38, 4, 30); c.bezierCurveTo(0, 22, 4, 14, 8, 8); c.bezierCurveTo(9, 14, 12, 12, 12, 1); c.closePath();
      c.fillStyle = A.lg(c, 0, 40, 0, 0, [[0, 0xff4a1c, 0.95], [0.45, 0xff9a3c, 0.9], [0.8, 0xffe08a, 0.8], [1, 0xffffff, 0]]); c.fill();
      c.beginPath(); c.moveTo(12, 14); c.bezierCurveTo(17, 20, 17, 28, 12, 33); c.bezierCurveTo(7, 28, 7, 20, 12, 14); c.fillStyle = A.css(0xffffff, 0.6); c.fill();
    });
  },

  // ---------------------------------------------------------------- herrero virtual
  smith(scene) {
    const A = this, T = this.T;
    // cuerpo (sin el brazo del martillo)
    A.make(scene, 'smith', 120, 160, c => {
      A.glow(c, 60, 90, 62, 0x00f0ff, 0.12);
      // piernas
      for (const x of [44, 76]) { A.rr(c, x - 10, 108, 20, 46, 6); A.plate(c, 0x3a4252, 0x00f0ff, 0, 108, 0, 154, 1); A.rr(c, x - 12, 146, 24, 11, 5); A.plate(c, 0x1c2028, 0x6a7488, 0, 146, 0, 157, 1); }
      // torso metálico + delantal de cuero virtual
      A.rr(c, 24, 48, 72, 66, 14); A.plate(c, 0x5a6478, 0x8aa0c8, 24, 48, 24, 114, 2);
      A.rr(c, 33, 58, 54, 62, 8); c.fillStyle = A.lg(c, 0, 58, 0, 120, [[0, 0x9a6a38], [0.5, 0x6a4220], [1, 0x3a2410]]); c.fill(); c.strokeStyle = A.css(0x2a1608, 0.95); c.lineWidth = 1.5; c.stroke();
      c.strokeStyle = A.css(0xe8c890, 0.7); c.lineWidth = 1; c.setLineDash([3, 2.5]); A.rr(c, 37, 62, 46, 54, 6); c.stroke(); c.setLineDash([]);
      c.strokeStyle = A.css(0x00f0ff, 0.95); c.lineWidth = 1.4; c.shadowColor = A.css(0x00f0ff, 1); c.shadowBlur = 5;       // circuito luminoso
      c.beginPath(); c.moveTo(60, 66); c.lineTo(60, 82); c.lineTo(48, 90); c.lineTo(48, 104); c.moveTo(60, 82); c.lineTo(72, 90); c.lineTo(72, 100); c.lineTo(80, 108); c.stroke(); c.shadowBlur = 0;
      c.fillStyle = A.css(0x00f0ff, 1); for (const [x, y] of [[48, 104], [80, 108], [60, 66]]) { c.beginPath(); c.arc(x, y, 2.2, 0, T); c.fill(); }
      // brazo izquierdo con tenazas (a la derecha de la imagen)
      A.rr(c, 94, 52, 16, 40, 7); A.plate(c, 0x5a6478, 0x8aa0c8, 94, 52, 94, 92, 1.5);
      A.ball(c, 102, 96, 8, 0x3a4252, 0.4);
      c.strokeStyle = A.lg(c, 100, 90, 112, 124, [[0, 0xc8d0e0], [1, 0x5a6478]]); c.lineWidth = 3; c.lineCap = 'round'; c.beginPath(); c.moveTo(100, 98); c.lineTo(108, 124); c.moveTo(106, 96); c.lineTo(112, 122); c.stroke();
      A.ball(c, 78, 52, 12, 0x6a7488, 0.55);                                                                                    // hombro derecho
      // detalles: reactor en el pecho, hombreras con leds y cinturón con herramientas
      A.glow(c, 60, 62, 12, 0x00f0ff, 0.7); A.ball(c, 60, 62, 6, 0x1a2a3a, 0.5); c.strokeStyle = A.css(0x00f0ff, 1); c.lineWidth = 1.6; c.beginPath(); c.arc(60, 62, 6, 0, T); c.stroke();
      A.ball(c, 60, 62, 2.4, 0xcfffff, 0.9);
      A.ball(c, 28, 56, 12, 0x6a7488, 0.55); c.strokeStyle = A.css(0x8aa0c8, 0.9); c.lineWidth = 1.5; c.beginPath(); c.arc(28, 56, 12, 0, T); c.stroke();
      for (const [x, y] of [[24, 52], [32, 60]]) { A.glow(c, x, y, 4, 0x00f0ff, 0.9); }
      A.rr(c, 30, 106, 60, 7, 2); c.fillStyle = A.lg(c, 0, 106, 0, 113, [[0, 0x6a4220], [1, 0x2a1608]]); c.fill(); c.strokeStyle = A.css(0xe8c890, 0.7); c.lineWidth = 0.8; c.stroke();
      A.rr(c, 54, 105, 12, 9, 2); A.plate(c, 0xb8c0d0, 0xffffff, 0, 105, 0, 114, 1); A.glow(c, 60, 109.5, 4, 0x00f0ff, 0.8);
      for (const x of [38, 80]) { A.rr(c, x - 5, 112, 10, 12, 2); c.fillStyle = A.lg(c, 0, 112, 0, 124, [[0, 0x7a5030], [1, 0x2a1608]]); c.fill(); c.strokeStyle = A.css(0x1a0c04, 0.9); c.lineWidth = 0.8; c.stroke(); }
      // cabeza: casco de forja con visor
      A.rr(c, 36, 10, 48, 46, 17); A.plate(c, 0x6a7488, 0x9ab0d8, 36, 10, 36, 56, 2);
      A.rr(c, 41, 24, 38, 16, 6); c.fillStyle = '#05080e'; c.fill();
      A.glow(c, 60, 32, 26, 0xffa030, 0.55); c.fillStyle = A.lg(c, 44, 0, 76, 0, [[0, 0xff8a1c], [0.5, 0xffe08a], [1, 0xff8a1c]]); A.rr(c, 45, 29, 30, 6, 3); c.fill();
      c.strokeStyle = A.css(0x00f0ff, 0.9); c.lineWidth = 1; c.beginPath(); c.moveTo(48, 46); c.lineTo(72, 46); c.moveTo(52, 50); c.lineTo(68, 50); c.stroke();
      // gafas de soldar levantadas
      for (const x of [47, 73]) { A.ball(c, x, 14, 7.5, 0x3a4252, 0.5); c.fillStyle = A.rg(c, x, 14, 0.5, x, 14, 5, [[0, 0x9ff0ff], [1, 0x0a5a78]]); c.beginPath(); c.arc(x, 14, 4.8, 0, T); c.fill(); }
      c.fillStyle = A.css(0x3a4252, 1); c.fillRect(54, 12, 12, 4);
      // escáner holográfico (efecto virtual)
      c.fillStyle = A.css(0x00f0ff, 0.07); for (let y = 6; y < 156; y += 4) c.fillRect(20, y, 90, 1.2);
    }, true);
    // brazo del martillo (pivote en el hombro, arriba-izquierda)
    A.make(scene, 'smith_arm', 90, 120, c => {
      A.ball(c, 12, 12, 11, 0x6a7488, 0.55);
      c.save(); c.translate(12, 12); c.rotate(-0.35);
      A.rr(c, -7, 0, 15, 36, 7); A.plate(c, 0x5a6478, 0x8aa0c8, -7, 0, -7, 36, 1.5);
      A.ball(c, 0, 38, 7.5, 0x3a4252, 0.45);
      c.fillStyle = A.lg(c, -3, 0, 3, 0, [[0, 0x5a3a1c], [0.5, 0xb07a40], [1, 0x4a2c10]]); A.rr(c, -2.6, 36, 5.2, 50, 2); c.fill();      // mango
      c.save(); c.translate(0, 84); A.rr(c, -18, -10, 36, 22, 3); A.plate(c, 0x9aa4b8, 0xe8f0ff, -18, -10, -18, 12, 1.5);                 // cabeza del martillo
      c.fillStyle = A.css(0x00f0ff, 0.9); c.fillRect(-14, -3, 28, 2); c.restore();
      c.restore();
    }, true);
    A.make(scene, 'anvil', 120, 62, c => {
      A.glow(c, 60, 14, 60, 0x00f0ff, 0.18);
      c.fillStyle = A.css(0x000000, 0.35); c.beginPath(); c.ellipse(60, 58, 44, 5, 0, 0, T); c.fill();
      A.poly(c, [[34, 46], [86, 46], [78, 34], [42, 34]]); A.plate(c, 0x3a4252, 0x6a7488, 0, 34, 0, 46, 1.5);
      A.poly(c, [[10, 14], [100, 14], [110, 24], [86, 28], [84, 36], [36, 36], [34, 28], [4, 24]]); A.plate(c, 0x8a94a8, 0xdfe6f2, 0, 14, 0, 36, 2);
      A.poly(c, [[10, 14], [100, 14], [98, 18], [12, 18]]); c.fillStyle = A.lg(c, 0, 14, 0, 18, [[0, 0xffffff, 0.9], [1, 0xc8d0e0, 0.6]]); c.fill();
      c.strokeStyle = A.css(0x00f0ff, 0.85); c.lineWidth = 1.2; c.shadowColor = A.css(0x00f0ff, 1); c.shadowBlur = 5; c.beginPath(); c.moveTo(18, 16); c.lineTo(94, 16); c.stroke(); c.shadowBlur = 0;
    }, true);
  },

  // ---------------------------------------------------------------- generador de portal y portal
  portal(scene) {
    const A = this, T = this.T;
    A.make(scene, 'portal_gen', 56, 56, c => {
      A.glow(c, 28, 30, 28, 0x00f0ff, 0.3);
      c.fillStyle = A.css(0x000000, 0.35); c.beginPath(); c.ellipse(28, 50, 22, 5, 0, 0, T); c.fill();
      A.poly(c, A.ngon(28, 38, 21, 6, Math.PI / 6)); A.plate(c, 0x3a4252, 0x00f0ff, 0, 20, 0, 56, 2);
      A.poly(c, A.ngon(28, 38, 14, 6, Math.PI / 6)); A.plate(c, 0x1c2230, 0x7fe9ff, 0, 26, 0, 50, 1.5);
      for (const sx of [-1, 1]) { A.rr(c, 28 + sx * 16 - 3, 12, 6, 28, 2); A.plate(c, 0x6a7488, 0xdfe6f2, 0, 12, 0, 40, 1); A.glow(c, 28 + sx * 16, 12, 5, 0x00f0ff, 0.9); }
      A.poly(c, [[28, 6], [37, 24], [28, 42], [19, 24]]); A.plate(c, 0x1a7a9a, 0x9ff6ff, 19, 6, 37, 42, 2);
      c.strokeStyle = A.css(0xffffff, 0.7); c.lineWidth = 0.8; c.beginPath(); c.moveTo(28, 6); c.lineTo(28, 42); c.moveTo(19, 24); c.lineTo(37, 24); c.stroke();
      A.glow(c, 28, 24, 13, 0x00f0ff, 0.85); A.sparkle(c, 33, 15, 3.2);
    });
    A.make(scene, 'portal_swirl', 96, 96, c => {
      const C = 48;
      A.glow(c, C, C, 48, 0x00f0ff, 0.35);
      c.fillStyle = A.rg(c, C, C, 2, C, C, 40, [[0, 0x02040e], [0.55, 0x0a1a4a], [0.85, 0x1a4aa8], [1, 0x00f0ff, 0.9]]);
      c.beginPath(); c.arc(C, C, 40, 0, T); c.fill();
      for (let arm = 0; arm < 5; arm++) {                               // brazos de la espiral
        c.beginPath();
        for (let r = 4; r <= 39; r += 1.5) { const a = arm * T / 5 + r * 0.13; const x = C + r * Math.cos(a), y = C + r * Math.sin(a); if (r === 4) c.moveTo(x, y); else c.lineTo(x, y); }
        c.strokeStyle = A.lg(c, C - 40, C, C + 40, C, [[0, 0x00f0ff, 0.95], [1, 0xff2bd6, 0.85]]); c.lineWidth = 3.2; c.lineCap = 'round'; c.stroke();
        c.strokeStyle = A.css(0xffffff, 0.55); c.lineWidth = 1; c.stroke();
      }
      c.strokeStyle = A.css(0x9ff6ff, 1); c.lineWidth = 3; c.beginPath(); c.arc(C, C, 40, 0, T); c.stroke();
      c.strokeStyle = A.css(0xff2bd6, 0.8); c.lineWidth = 1.5; c.beginPath(); c.arc(C, C, 45, 0.3, 2.2); c.stroke(); c.beginPath(); c.arc(C, C, 45, 3.4, 5.3); c.stroke();
      A.glow(c, C, C, 14, 0xffffff, 0.9);
    });
  },

  // ---------------------------------------------------------------- cartas de mejora: fondo e iconos
  ICON_OF: {
    bounce: 'bounce', fire: 'flame', pierce: 'pierce', homing: 'target', overclock: 'bullet', explosive: 'blast', chain: 'bolt', split: 'split',
    cryo: 'snow', toxin: 'skull', vampire: 'heart', shield: 'shield', surge: 'bolt', echo: 'boot', orbit: 'orbit', mine: 'mine', crit: 'crit',
    magnet: 'magnet', nova: 'blast', orbshield: 'shield', rapid: 'bullet', forcefield: 'field', power: 'blast', nano: 'heart', maxhp: 'heart',
    servo: 'boot', dodge: 'ghost', thorns: 'mine', timefield: 'snow', dashcd: 'boot', abilitycd: 'gear',
  },

  /** Fondo de cristal de una carta, teñido con el color de la mejora. */
  cardBg(scene, col) {
    const key = 'cardbg_' + col.toString(16), A = this, T = this.T, W = 262, H = 340;
    A.make(scene, key, W, H, c => {
      c.save();
      c.shadowColor = A.css(col, 0.9); c.shadowBlur = 14;
      A.rr(c, 8, 8, W - 16, H - 16, 14); c.fillStyle = A.lg(c, 0, 8, 0, H - 8, [[0, A.mix(0x0a1230, col, 0.22)], [0.35, 0x0b1432], [1, 0x060a18]]); c.fill();
      c.restore();
      c.save(); A.rr(c, 8, 8, W - 16, H - 16, 14); c.clip();
      c.fillStyle = A.rg(c, W / 2, 80, 4, W / 2, 80, 150, [[0, col, 0.34], [1, col, 0]]); c.fillRect(0, 0, W, 240);          // resplandor del icono
      c.strokeStyle = A.css(col, 0.06); c.lineWidth = 1; for (let i = -H; i < W; i += 14) { c.beginPath(); c.moveTo(i, H); c.lineTo(i + H, 0); c.stroke(); }
      c.strokeStyle = A.css(col, 0.5); c.lineWidth = 1; c.beginPath(); c.moveTo(24, 212); c.lineTo(W - 24, 212); c.stroke();    // separador
      c.fillStyle = A.css(col, 0.9); c.fillRect(W / 2 - 18, 210, 36, 4);
      c.fillStyle = A.lg(c, 0, H - 60, 0, H, [[0, col, 0], [1, col, 0.22]]); c.fillRect(0, H - 60, W, 60);
      c.restore();
      A.rr(c, 8, 8, W - 16, H - 16, 14); c.strokeStyle = A.css(col, 1); c.lineWidth = 3; c.stroke();
      A.rr(c, 13, 13, W - 26, H - 26, 10); c.strokeStyle = A.css(A.lt(col, 0.6), 0.35); c.lineWidth = 1; c.stroke();
      c.strokeStyle = A.css(A.lt(col, 0.5), 1); c.lineWidth = 2.5;                                                              // esquinas
      for (const [x, y, sx, sy] of [[18, 18, 1, 1], [W - 18, 18, -1, 1], [18, H - 18, 1, -1], [W - 18, H - 18, -1, -1]]) { c.beginPath(); c.moveTo(x, y + sy * 16); c.lineTo(x, y); c.lineTo(x + sx * 16, y); c.stroke(); }
    });
    return key;
  },

  /** Icono de una mejora: hexágono luminoso con un símbolo propio. */
  icon(scene, id, col) {
    const kind = this.ICON_OF[id] || 'gear', key = `ico_${kind}_${col.toString(16)}`, A = this, T = this.T;
    A.make(scene, key, 76, 76, c => {
      const X = 38, Y = 38, lite = A.lt(col, 0.65);
      A.glow(c, X, Y, 38, col, 0.5);
      A.poly(c, A.ngon(X, Y, 33, 6, Math.PI / 6)); c.fillStyle = A.rg(c, X - 6, Y - 8, 2, X, Y, 34, [[0, A.mix(0x10183a, col, 0.35)], [1, 0x070b1c]]); c.fill();
      c.lineWidth = 3; c.strokeStyle = A.css(col, 1); c.shadowColor = A.css(col, 1); c.shadowBlur = 8; c.stroke(); c.shadowBlur = 0;
      c.strokeStyle = A.css(lite, 0.4); c.lineWidth = 1; A.poly(c, A.ngon(X, Y, 28, 6, Math.PI / 6)); c.stroke();
      c.fillStyle = A.lg(c, X, 14, X, 62, [[0, 0xffffff], [1, lite]]); c.strokeStyle = A.lg(c, X, 14, X, 62, [[0, 0xffffff], [1, lite]]); c.lineWidth = 3.2; c.lineCap = 'round'; c.lineJoin = 'round';
      c.shadowColor = A.css(col, 1); c.shadowBlur = 6;
      const P = (pts, fill) => { A.poly(c, pts); fill ? c.fill() : c.stroke(); };
      switch (kind) {
        case 'bullet': for (const dx of [-11, 0, 11]) { c.save(); c.translate(X + dx, Y); c.rotate(-0.5); A.rr(c, -3.2, -13, 6.4, 22, 3.2); c.fill(); c.restore(); } break;
        case 'bounce': c.beginPath(); c.moveTo(14, 54); c.lineTo(30, 22); c.lineTo(44, 50); c.lineTo(60, 20); c.stroke(); P([[60, 14], [66, 26], [53, 25]], true); break;
        case 'flame': c.beginPath(); c.moveTo(38, 12); c.bezierCurveTo(52, 26, 58, 38, 50, 52); c.bezierCurveTo(46, 60, 30, 60, 26, 52); c.bezierCurveTo(20, 42, 28, 34, 32, 26); c.bezierCurveTo(34, 32, 38, 30, 38, 12); c.fill(); break;
        case 'pierce': c.beginPath(); c.moveTo(12, 38); c.lineTo(58, 38); c.stroke(); P([[66, 38], [52, 28], [52, 48]], true); c.lineWidth = 2.4; c.strokeRect(32, 22, 8, 32); break;
        case 'target': c.beginPath(); c.arc(X, Y, 18, 0, T); c.stroke(); c.beginPath(); c.arc(X, Y, 6, 0, T); c.fill(); c.beginPath(); for (const [a, b, d, e] of [[X, 10, X, 22], [X, 54, X, 66], [10, Y, 22, Y], [54, Y, 66, Y]]) { c.moveTo(a, b); c.lineTo(d, e); } c.stroke(); break;
        case 'bolt': P([[44, 10], [24, 40], [36, 40], [30, 66], [54, 32], [41, 32]], true); break;
        case 'blast': { const pts = []; for (let i = 0; i < 16; i++) { const r = i % 2 ? 11 : 26; pts.push([X + r * Math.cos(i * T / 16), Y + r * Math.sin(i * T / 16)]); } P(pts, true); break; }
        case 'split': c.beginPath(); c.moveTo(14, 56); c.lineTo(38, 38); c.moveTo(38, 38); c.lineTo(60, 16); c.moveTo(38, 38); c.lineTo(64, 36); c.moveTo(38, 38); c.lineTo(52, 62); c.stroke(); for (const [x, y] of [[60, 16], [64, 36], [52, 62], [14, 56]]) { c.beginPath(); c.arc(x, y, 4, 0, T); c.fill(); } break;
        case 'snow': c.lineWidth = 2.6; for (let i = 0; i < 6; i++) { const a = i * T / 6; c.beginPath(); c.moveTo(X, Y); c.lineTo(X + 24 * Math.cos(a), Y + 24 * Math.sin(a)); c.moveTo(X + 15 * Math.cos(a), Y + 15 * Math.sin(a)); c.lineTo(X + 21 * Math.cos(a + 0.5), Y + 21 * Math.sin(a + 0.5)); c.moveTo(X + 15 * Math.cos(a), Y + 15 * Math.sin(a)); c.lineTo(X + 21 * Math.cos(a - 0.5), Y + 21 * Math.sin(a - 0.5)); c.stroke(); } break;
        case 'skull': c.beginPath(); c.arc(X, 32, 17, 0, T); c.fill(); A.rr(c, X - 10, 42, 20, 14, 3); c.fill(); c.shadowBlur = 0; c.fillStyle = A.css(0x070b1c, 1); c.beginPath(); c.arc(X - 7, 32, 4.5, 0, T); c.arc(X + 7, 32, 4.5, 0, T); c.fill(); c.fillRect(X - 6, 48, 2.4, 8); c.fillRect(X - 1.2, 48, 2.4, 8); c.fillRect(X + 3.6, 48, 2.4, 8); break;
        case 'heart': c.beginPath(); c.moveTo(X, 58); c.bezierCurveTo(8, 38, 14, 14, 30, 18); c.bezierCurveTo(35, 19, 38, 24, X, 28); c.bezierCurveTo(41, 24, 44, 19, 46, 18); c.bezierCurveTo(62, 14, 68, 38, X, 58); c.fill(); break;
        case 'shield': c.beginPath(); c.moveTo(X, 10); c.lineTo(60, 18); c.lineTo(58, 42); c.quadraticCurveTo(54, 56, X, 66); c.quadraticCurveTo(22, 56, 18, 42); c.lineTo(16, 18); c.closePath(); c.fill(); c.shadowBlur = 0; c.strokeStyle = A.css(0x070b1c, 0.55); c.lineWidth = 2; c.beginPath(); c.moveTo(X, 16); c.lineTo(X, 58); c.moveTo(22, 30); c.lineTo(54, 30); c.stroke(); break;
        case 'orbit': c.beginPath(); c.arc(X, Y, 7, 0, T); c.fill(); c.lineWidth = 2; c.beginPath(); c.ellipse(X, Y, 24, 11, -0.5, 0, T); c.stroke(); for (const a of [0.4, 2.6, 4.4]) { c.beginPath(); c.arc(X + 24 * Math.cos(a) * 0.9, Y + 15 * Math.sin(a), 4.2, 0, T); c.fill(); } break;
        case 'mine': c.beginPath(); c.arc(X, Y, 13, 0, T); c.fill(); for (let i = 0; i < 8; i++) { const a = i * T / 8; c.beginPath(); c.moveTo(X + 13 * Math.cos(a), Y + 13 * Math.sin(a)); c.lineTo(X + 25 * Math.cos(a), Y + 25 * Math.sin(a)); c.stroke(); } break;
        case 'crit': { const pts = []; for (let i = 0; i < 8; i++) { const r = i % 2 ? 7 : 27; pts.push([X + r * Math.cos(i * T / 8 - Math.PI / 2), Y + r * Math.sin(i * T / 8 - Math.PI / 2)]); } P(pts, true); break; }
        case 'magnet': c.lineWidth = 9; c.beginPath(); c.moveTo(22, 16); c.lineTo(22, 38); c.arc(X, 38, 16, Math.PI, 0, true); c.lineTo(54, 16); c.stroke(); c.shadowBlur = 0; c.fillStyle = A.css(0xffffff, 0.95); c.fillRect(17.5, 12, 9, 9); c.fillRect(49.5, 12, 9, 9); break;
        case 'boot': for (const dx of [-9, 7]) { c.beginPath(); c.moveTo(X + dx - 8, 20); c.lineTo(X + dx + 8, 38); c.lineTo(X + dx - 8, 56); c.stroke(); } break;
        case 'field': for (const r of [8, 17, 26]) { c.lineWidth = r === 8 ? 5 : 2.4; c.beginPath(); c.arc(X, Y, r, 0, T); c.stroke(); } break;
        case 'ghost': c.setLineDash([5, 5]); c.beginPath(); c.arc(X, Y, 24, 0, T); c.stroke(); c.setLineDash([]); c.beginPath(); c.arc(X, Y, 8, 0, T); c.fill(); break;
        default: { const pts = []; for (let i = 0; i < 16; i++) { const r = i % 2 ? 15 : 24; pts.push([X + r * Math.cos(i * T / 16), Y + r * Math.sin(i * T / 16)]); } P(pts, true); c.shadowBlur = 0; c.fillStyle = A.css(0x070b1c, 1); c.beginPath(); c.arc(X, Y, 7, 0, T); c.fill(); }
      }
      c.shadowBlur = 0;
    });
    return key;
  },

  // ---------------------------------------------------------------- cofre virtual (holográfico) de jefe
  chests(scene) {
    const A = this, T = this.T, CY = 0x00f0ff;
    [0xcd7f32, 0xc0c8d8, 0xffd23c].forEach((col, i) => {
      const tier = i + 1, lite = A.lt(col, 0.55), dark = A.dk(col, 0.6);
      const drawBase = c => {
        c.fillStyle = A.css(0x000000, 0.4); c.beginPath(); c.ellipse(30, 32, 27, 4.5, 0, 0, T); c.fill();
        A.rr(c, 4, 8, 52, 24, 4);                                                                 // cuerpo de cristal oscuro
        c.fillStyle = A.lg(c, 0, 8, 0, 32, [[0, 0x14224a, 0.96], [1, 0x050818, 0.98]]); c.fill();
        c.save(); A.rr(c, 4, 8, 52, 24, 4); c.clip();
        c.strokeStyle = A.css(CY, 0.16); c.lineWidth = 0.6;                                         // rejilla holográfica
        for (let x = 8; x < 56; x += 5) { c.beginPath(); c.moveTo(x, 8); c.lineTo(x, 32); c.stroke(); }
        for (let y = 11; y < 32; y += 4) { c.beginPath(); c.moveTo(4, y); c.lineTo(56, y); c.stroke(); }
        c.fillStyle = A.lg(c, 0, 24, 0, 32, [[0, col, 0], [1, col, 0.5]]); c.fillRect(4, 24, 52, 8);
        c.restore();
        c.shadowColor = A.css(CY, 1); c.shadowBlur = 4; c.strokeStyle = A.css(CY, 0.95); c.lineWidth = 0.9;      // circuitos
        c.beginPath(); c.moveTo(8, 27); c.lineTo(16, 27); c.lineTo(19, 23); c.lineTo(23, 23); c.moveTo(52, 27); c.lineTo(45, 27); c.lineTo(42, 23); c.lineTo(38, 23); c.stroke(); c.shadowBlur = 0;
        for (const sx of [0, 1]) { const x0 = sx ? 46 : 4; A.rr(c, x0, 8, 10, 24, 3); c.fillStyle = A.lg(c, x0, 0, x0 + 10, 0, [[0, A.mix(dark, col, 0.2)], [0.5, lite], [1, dark]]); c.fill(); c.strokeStyle = A.css(dark, 0.9); c.lineWidth = 0.7; c.stroke();
          c.fillStyle = A.css(0xffffff, 0.85); for (const y of [12, 20, 28]) { c.beginPath(); c.arc(x0 + 5, y, 0.9, 0, T); c.fill(); } }
        A.rr(c, 4, 8, 52, 24, 4); c.lineWidth = 1.6; c.strokeStyle = A.css(col, 1); c.shadowColor = A.css(col, 1); c.shadowBlur = 5; c.stroke(); c.shadowBlur = 0;
        A.poly(c, A.ngon(30, 20, 6.5, 6, Math.PI / 6)); A.plate(c, 0x0a1230, CY, 23, 13, 37, 27, 1.2);                       // cerradura holográfica
        A.glow(c, 30, 20, 8, CY, 0.8); c.fillStyle = A.css(0xffffff, 1); c.beginPath(); c.arc(30, 19, 1.8, 0, T); c.fill(); c.fillRect(29.3, 19.5, 1.4, 4);
      };
      const drawLid = c => {
        c.beginPath(); c.moveTo(4, 24); c.lineTo(4, 14); c.quadraticCurveTo(4, 3, 16, 3); c.lineTo(44, 3); c.quadraticCurveTo(56, 3, 56, 14); c.lineTo(56, 24); c.closePath();
        c.fillStyle = A.lg(c, 0, 3, 0, 24, [[0, A.mix(0x1a2c5a, col, 0.25)], [1, 0x070b1c]]); c.fill();
        c.save(); c.clip();
        c.fillStyle = A.rg(c, 22, 8, 1, 22, 8, 30, [[0, 0xffffff, 0.22], [1, 0xffffff, 0]]); c.fillRect(0, 0, 60, 26);
        c.fillStyle = A.css(CY, 0.55); for (const [x, y, w] of [[14, 9, 14], [32, 9, 8], [14, 13, 8], [25, 13, 18], [14, 17, 20]]) c.fillRect(x, y, w, 1.5);      // líneas de datos
        c.restore();
        c.lineWidth = 1.6; c.strokeStyle = A.css(col, 1); c.shadowColor = A.css(col, 1); c.shadowBlur = 5; c.stroke(); c.shadowBlur = 0;
        c.strokeStyle = A.css(CY, 0.95); c.lineWidth = 1.2; c.shadowColor = A.css(CY, 1); c.shadowBlur = 5; c.beginPath(); c.moveTo(5, 24); c.lineTo(55, 24); c.stroke(); c.shadowBlur = 0;   // junta luminosa
        for (let k = 0; k < tier; k++) A.sparkle(c, 30 + (k - (tier - 1) / 2) * 11, 9, 2.4, 0xffffff);
      };
      A.make(scene, 'chestb_' + tier, 60, 34, drawBase);
      A.make(scene, 'chestl_' + tier, 60, 26, drawLid);
      A.make(scene, 'chest_' + tier, 60, 46, c => { A.glow(c, 30, 26, 30, col, 0.18); c.save(); c.translate(0, 12); drawBase(c); c.restore(); c.save(); drawLid(c); c.restore(); });
    });
    A.make(scene, 'holo_ring', 64, 64, c => {
      c.strokeStyle = A.css(CY, 0.9); c.lineWidth = 1.6; c.shadowColor = A.css(CY, 1); c.shadowBlur = 5;
      for (let k = 0; k < 6; k++) { c.beginPath(); c.arc(32, 32, 28, k * T / 6 + 0.1, k * T / 6 + 0.85); c.stroke(); }
      c.lineWidth = 1; c.beginPath(); c.arc(32, 32, 21, 0, T); c.stroke();
    });
  },

  // ---------------------------------------------------------------- enemigos nuevos
  enemies2(scene) {
    const A = this, T = this.T;
    // Escudero: robot pesado con gran escudo frontal (arriba)
    A.make(scene, 'enemy_shielder', 44, 44, c => {
      A.glow(c, 22, 24, 22, 0x6aa8ff, 0.22);
      A.ball(c, 22, 27, 12.5, 0x4a5568, 0.5);
      c.strokeStyle = A.css(0x6aa8ff, 0.9); c.lineWidth = 1.2; c.beginPath(); c.arc(22, 27, 12.5, 0, T); c.stroke();
      A.rr(c, 12, 30, 20, 8, 3); A.plate(c, 0x3a4252, 0x6aa8ff, 0, 30, 0, 38, 1);
      A.glow(c, 22, 28, 8, 0xff3a3a, 0.7); A.ball(c, 22, 28, 3.6, 0xff6a6a, 0.8);
      c.beginPath(); c.arc(22, 24, 19, Math.PI * 1.17, Math.PI * 1.83); c.lineWidth = 8; c.lineCap = 'round';                // el escudo
      c.strokeStyle = A.lg(c, 4, 4, 40, 18, [[0, 0xdff0ff], [0.5, 0x6aa8ff], [1, 0x1a3a7a]]); c.stroke();
      c.lineWidth = 1.2; c.strokeStyle = A.css(0xffffff, 0.8); c.beginPath(); c.arc(22, 24, 21.5, Math.PI * 1.2, Math.PI * 1.8); c.stroke();
      c.fillStyle = A.css(0x9fd0ff, 0.9); for (const a of [1.28, 1.5, 1.72]) { c.beginPath(); c.arc(22 + 19 * Math.cos(a * Math.PI), 24 + 19 * Math.sin(a * Math.PI), 1.3, 0, T); c.fill(); }
    });
    // Mortero: base octogonal con tubo inclinado y proyectiles
    A.make(scene, 'enemy_mortar', 40, 40, c => {
      A.glow(c, 20, 22, 20, 0xff8a3c, 0.22);
      A.poly(c, A.ngon(20, 25, 15, 8, Math.PI / 8)); A.plate(c, 0x4a4036, 0xff8a3c, 0, 10, 0, 40, 2);
      c.fillStyle = A.lg(c, 14, 0, 26, 0, [[0, 0x1c1812], [0.5, 0x8c8272], [1, 0x1a160f]]); A.rr(c, 14.5, 1, 11, 22, 3); c.fill();
      c.strokeStyle = A.css(0xff8a3c, 0.95); c.lineWidth = 1.5; c.stroke(); c.fillStyle = A.css(0xff8a3c, 0.95); c.fillRect(14.5, 1, 11, 3);
      A.glow(c, 20, 3, 6, 0xffb060, 0.8);
      A.ball(c, 20, 26, 8, 0x5a4e40, 0.5);
      for (const x of [9, 31]) { A.rr(c, x - 2, 24, 4, 9, 2); c.fillStyle = A.lg(c, x, 24, x, 33, [[0, 0xffd060], [1, 0xb0501c]]); c.fill(); }
      A.glow(c, 20, 26, 5, 0xff5a1c, 0.9);
    });
    // Giróscopo: anillos concéntricos con emisores
    A.make(scene, 'enemy_spinner', 40, 40, c => {
      A.glow(c, 20, 20, 20, 0xc65cff, 0.3);
      c.lineWidth = 3.5; c.strokeStyle = A.lg(c, 0, 0, 40, 40, [[0, 0xe8c0ff], [0.5, 0x8a3cd0], [1, 0x3a1070]]); c.beginPath(); c.arc(20, 20, 16, 0, T); c.stroke();
      c.lineWidth = 1; c.strokeStyle = A.css(0xffffff, 0.6); c.beginPath(); c.arc(20, 20, 18, 0, T); c.stroke();
      for (let i = 0; i < 3; i++) { const a = i * T / 3 - Math.PI / 2; A.ball(c, 20 + 16 * Math.cos(a), 20 + 16 * Math.sin(a), 3.6, 0xff7aff, 0.7); A.glow(c, 20 + 16 * Math.cos(a), 20 + 16 * Math.sin(a), 6, 0xc65cff, 0.8); }
      c.strokeStyle = A.css(0xd8b0ff, 0.9); c.lineWidth = 2; for (let i = 0; i < 3; i++) { const a = i * T / 3 - Math.PI / 2; c.beginPath(); c.moveTo(20, 20); c.lineTo(20 + 13 * Math.cos(a), 20 + 13 * Math.sin(a)); c.stroke(); }
      A.ball(c, 20, 20, 6.2, 0x3a1a60, 0.6); A.glow(c, 20, 20, 7, 0xff7aff, 0.9); A.ball(c, 20, 20, 2.8, 0xffd0ff, 0.9);
    });
    // Embestidor: cuña afilada con cuchillas
    A.make(scene, 'enemy_dasher', 28, 28, c => {
      A.glow(c, 14, 15, 14, 0xff5c8a, 0.3);
      A.poly(c, [[14, 1], [20, 14], [27, 25], [14, 20], [1, 25], [8, 14]]); A.plate(c, 0x4a1428, 0xff5c8a, 1, 1, 27, 25, 1.4);
      c.fillStyle = A.lg(c, 14, 3, 14, 20, [[0, 0xffd0e0], [1, 0xff5c8a]]); A.poly(c, [[14, 3], [17, 13], [14, 17], [11, 13]]); c.fill();
      c.strokeStyle = A.css(0xffffff, 0.9); c.lineWidth = 1; c.beginPath(); c.moveTo(14, 3); c.lineTo(14, 17); c.stroke();
      A.glow(c, 14, 23, 6, 0xffa0c0, 0.9);
    });
    // Reparador: dron médico con cruz y halo
    A.make(scene, 'enemy_healer', 36, 36, c => {
      A.glow(c, 18, 18, 18, 0x5dff8a, 0.3);
      c.strokeStyle = A.css(0x5dff8a, 0.8); c.lineWidth = 1.6; c.beginPath(); c.arc(18, 18, 15.5, 0.3, 2.6); c.stroke(); c.beginPath(); c.arc(18, 18, 15.5, 3.5, 5.8); c.stroke();
      for (const sx of [-1, 1]) { c.fillStyle = A.css(0xcfffe0, 0.4); c.strokeStyle = A.css(0x5dff8a, 0.8); c.lineWidth = 0.8; c.beginPath(); c.ellipse(18 + sx * 11, 20, 5, 2.4, sx * 0.4, 0, T); c.fill(); c.stroke(); }
      A.ball(c, 18, 18, 10.5, 0xe8fff0, 0.55); c.strokeStyle = A.css(0x5dff8a, 0.9); c.lineWidth = 1; c.beginPath(); c.arc(18, 18, 10.5, 0, T); c.stroke();
      c.fillStyle = A.lg(c, 0, 11, 0, 25, [[0, 0x8fffb0], [1, 0x1fa850]]); c.fillRect(16, 11, 4, 14); c.fillRect(11, 16, 14, 4);
      c.fillStyle = A.css(0xffffff, 0.7); c.fillRect(16.8, 11.5, 1.2, 13);
      A.glow(c, 18, 18, 5, 0xffffff, 0.8);
    });
  },
});