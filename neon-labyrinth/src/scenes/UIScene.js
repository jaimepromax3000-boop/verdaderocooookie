/**
 * UIScene: capa superior fija que corre en PARALELO a GameScene (así no se redibuja con el mundo y el
 * rendimiento no cae). Muestra:
 *   - Barra de salud y escudo, con vibración (screen shake) al recibir impactos críticos.
 *   - Minimapa abstracto que se revela al explorar (salas visitadas, tienda, tesoro, jefe, posición actual).
 *   - Línea de buffs/debuffs: iconos con temporizador circular (velocidad, ralentizado, envenenado...).
 *   - Créditos, llaves, fragmentos, módulos recogidos, enfriamiento del dash y barra del jefe.
 *   - Panel de pausa y de fin de partida.
 */
class UIScene extends Phaser.Scene {
  constructor() { super('UIScene'); }

  init(data) { this.gs = data.game; }

  create() {
    const { W, H } = CFG;
    this.hud = this.add.container(0, 0);                       // todo el HUD cuelga de aquí para poder vibrarlo
    this.hud.add(this.add.rectangle(0, 0, W, 60, 0x050818, 0.92).setOrigin(0));
    this.hud.add(this.add.rectangle(0, 59, W, 2, 0x2748ff).setOrigin(0));

    this.gHearts = this.add.graphics(); this.hud.add(this.gHearts);
    this.gBuffs = this.add.graphics(); this.hud.add(this.gBuffs);
    this.buffLabels = [];
    this.txtInfo = this.add.text(290, 10, '', { fontFamily: 'monospace', fontSize: '15px', color: '#ffe94d' }); this.hud.add(this.txtInfo);
    this.txtInfo2 = this.add.text(290, 34, '', { fontFamily: 'monospace', fontSize: '13px', color: '#9fc4ff' }); this.hud.add(this.txtInfo2);
    this.txtFloor = this.add.text(W - 12, 10, '', { fontFamily: 'monospace', fontSize: '15px', color: '#00f0ff' }).setOrigin(1, 0); this.hud.add(this.txtFloor);
    this.txtWeapon = this.add.text(W - 12, 34, '', { fontFamily: 'monospace', fontSize: '13px', color: '#ff2bd6' }).setOrigin(1, 0); this.hud.add(this.txtWeapon);

    this.gMap = this.add.graphics();
    this.gMods = this.add.graphics();
    this.modLabels = [];
    this.gDash = this.add.graphics();
    this.gBoss = this.add.graphics();
    this.bossText = this.add.text(W / 2, H - 40, '', { fontFamily: 'monospace', fontSize: '12px', color: '#ff2bd6' }).setOrigin(0.5);

    this.overlay = null;
    this.sig = '';

    this.offs = [
      Bus.on('player:hit', e => { if (e.crit) this.shakeHud(8); else this.shakeHud(3); this.flashRed(e.crit); }),
      Bus.on('game:pause', e => this.showPause(e.paused)),
      Bus.on('run:end', e => this.showEnd(e)),
      Bus.on('room:clear', () => this.banner('SALA LIMPIA')),
      Bus.on('boss:phase', () => this.banner('¡EL GUARDIÁN SE ENFURECE!')),
    ];
    this.events.once('shutdown', () => this.offs.forEach(f => f()));
    this.redFlash = this.add.rectangle(0, 0, W, H, 0xff0033, 0).setOrigin(0).setDepth(50);
  }

  // ---------- efectos ----------
  shakeHud(mag) {
    this.tweens.killTweensOf(this.hud);
    let n = 0;
    this.tweens.addCounter({ from: 0, to: 1, duration: 280, onUpdate: tw => { const k = 1 - tw.getValue(); this.hud.setPosition((Math.random() - 0.5) * mag * 2 * k, (Math.random() - 0.5) * mag * 2 * k); n++; }, onComplete: () => this.hud.setPosition(0, 0) });
  }

  flashRed(crit) {
    this.tweens.killTweensOf(this.redFlash);
    this.redFlash.setAlpha(crit ? 0.3 : 0.14);
    this.tweens.add({ targets: this.redFlash, alpha: 0, duration: 380 });
  }

  banner(text) {
    const t = this.add.text(CFG.W / 2, 110, text, { fontFamily: 'monospace', fontSize: '26px', color: '#00f0ff', stroke: '#000', strokeThickness: 4, fontStyle: 'bold' }).setOrigin(0.5).setAlpha(0);
    this.tweens.add({ targets: t, alpha: 1, y: 100, duration: 250, yoyo: true, hold: 900, onComplete: () => t.destroy() });
  }

  // ---------- dibujo del HUD (cada fotograma, barato: solo formas) ----------
  update() {
    const g = this.gs;
    if (!g || !g.player || !g.dungeon) return;
    const p = g.player;
    this.drawHearts(p);
    this.drawBuffs(p);
    this.drawMap(g);
    this.drawMods(p);
    this.drawDash(p);
    this.drawBoss(g);
    this.txtInfo.setText(`¢ ${p.credits}    🔑 ${p.keys}`.replace('🔑', 'LLAVES'));
    this.txtInfo2.setText(`Salas limpiadas: ${g.roomsCleared}   ·   Fragmentos al morir: +${g.roomsCleared * 2 + (g.floor - 1) * 6 + g.bossesKilled * 12}`);
    this.txtFloor.setText(`PLANTA ${g.floor}/${CFG.FLOORS}  ·  ${this.roomName(g.room)}`);
    this.txtWeapon.setText(`Arma: ${p.weapon.name}   ·   ${p.character.name}`);
  }

  roomName(r) {
    return { start: 'Sala de inicio', combat: r.cleared ? 'Sala segura' : 'Combate', shop: 'Tienda', treasure: 'Tesoro oculto', boss: 'Jefe' }[r.type] || '';
  }

  drawHearts(p) {
    const g = this.gHearts;
    g.clear();
    const n = Math.ceil(p.maxHp);
    for (let i = 0; i < n; i++) {
      const x = 14 + i * 22, y = 10;
      const fill = Math.max(0, Math.min(1, p.hp - i));
      this.heart(g, x, y, 0x3a0f1c, 1);
      if (fill > 0) this.heart(g, x, y, 0xff4466, fill);
    }
    for (let i = 0; i < p.maxShield; i++) {
      const x = 14 + i * 22, y = 36;
      g.fillStyle(0x0b2b44, 1); g.fillRect(x, y, 18, 8);
      if (i < p.shield) { g.fillStyle(0x00f0ff, 1); g.fillRect(x, y, 18, 8); }
      g.lineStyle(1, 0x00f0ff, 1); g.strokeRect(x, y, 18, 8);
    }
  }

  heart(g, x, y, color, fill) {
    g.fillStyle(color, 1);
    const w = 18 * fill;
    g.save && g.save();
    g.fillRect(x + 1, y + 3, w, 7);
    if (fill >= 1) { g.fillRect(x + 3, y, 5, 4); g.fillRect(x + 10, y, 5, 4); g.fillRect(x + 4, y + 10, 10, 3); g.fillRect(x + 7, y + 13, 4, 2); }
    else if (fill > 0) { g.fillRect(x + 3, y, 5, 4); g.fillRect(x + 4, y + 10, 5, 3); }
  }

  drawBuffs(p) {
    const g = this.gBuffs;
    g.clear();
    this.buffLabels.forEach(l => l.destroy());
    this.buffLabels = [];
    const entries = [];
    for (const [n, b] of Object.entries(p.buffs)) entries.push({ n, b, good: true });
    for (const [n, s] of Object.entries(p.statuses)) entries.push({ n, b: s, good: false });
    let x = 14, y = 70;
    for (const e of entries) {
      const col = e.good ? 0xffe94d : (e.n === 'poison' ? 0x5dff8a : 0x7fe9ff);
      const frac = Math.max(0, e.b.time / e.b.duration);
      g.fillStyle(0x08122e, 0.9); g.fillCircle(x + 11, y + 11, 12);
      g.lineStyle(3, col, 1); g.beginPath(); g.arc(x + 11, y + 11, 11, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * frac, false); g.strokePath();   // temporizador circular
      const letter = { speed: '»', slow: '❄', poison: '☣' }[e.n] || '?';
      this.buffLabels.push(this.add.text(x + 11, y + 11, letter, { fontFamily: 'monospace', fontSize: '12px', color: '#fff' }).setOrigin(0.5));
      x += 30;
    }
  }

  drawMap(game) {
    const g = this.gMap;
    g.clear();
    const d = game.dungeon;
    const cell = 15, gap = 3, ox = CFG.W - 7 * (cell + gap) - 12, oy = 70;
    g.fillStyle(0x03050f, 0.55); g.fillRect(ox - 6, oy - 6, 7 * (cell + gap) + 6, 7 * (cell + gap) + 6);
    for (const r of d.list) {
      if (!r.discovered && !r.visited) continue;
      if (r.type === 'treasure' && !r.visited) continue;           // el tesoro está oculto hasta entrar
      const x = ox + r.gx * (cell + gap), y = oy + r.gy * (cell + gap);
      for (const [name, dd] of Object.entries(DIRS)) {           // conexiones
        if (!r.doors[name]) continue;
        const o = d.get(r.gx + dd.dx, r.gy + dd.dy);
        if (o && (o.visited || r.visited)) { g.lineStyle(2, 0x2748ff, 1); g.lineBetween(x + cell / 2, y + cell / 2, x + cell / 2 + dd.dx * (cell + gap) / 2, y + cell / 2 + dd.dy * (cell + gap) / 2); }
      }
      const visited = r.visited;
      let col = visited ? 0x2748ff : 0x16204a;
      if (r.type === 'shop') col = 0xffe94d;
      else if (r.type === 'boss') col = 0xff2bd6;
      else if (r.type === 'treasure') col = 0x5dff8a;
      g.fillStyle(col, visited || r.type !== 'combat' ? 0.9 : 0.5); g.fillRect(x, y, cell, cell);
      g.lineStyle(1, 0x00f0ff, visited ? 0.9 : 0.3); g.strokeRect(x, y, cell, cell);
      if (r.type === 'boss') { g.fillStyle(0x000000, 1); g.fillRect(x + 4, y + 4, 3, 3); g.fillRect(x + 9, y + 4, 3, 3); g.fillRect(x + 5, y + 10, 6, 2); }   // calavera
      if (r.type === 'shop') { g.fillStyle(0x000000, 1); g.fillRect(x + 6, y + 3, 3, 9); g.fillRect(x + 4, y + 5, 7, 2); }                                      // $
      if (r.type === 'treasure') { g.fillStyle(0x000000, 1); g.fillRect(x + 4, y + 6, 8, 5); }                                                                   // cofre
    }
    const cur = game.room;
    const cx = ox + cur.gx * (cell + gap) + cell / 2, cy = oy + cur.gy * (cell + gap) + cell / 2;
    g.fillStyle(0xffffff, 1); g.fillCircle(cx, cy, 3.2);
  }

  drawMods(p) {
    const g = this.gMods;
    g.clear();
    this.modLabels.forEach(l => l.destroy());
    this.modLabels = [];
    let x = 12;
    for (const [id, n] of Object.entries(p.modules)) {
      const def = Modules.defs[id], y = CFG.H - 34;
      g.fillStyle(0x050818, 0.9); g.fillRect(x, y, 26, 26);
      g.lineStyle(2, def.color, 1); g.strokeRect(x, y, 26, 26);
      this.modLabels.push(this.add.text(x + 13, y + 13, def.letter, { fontFamily: 'monospace', fontSize: '15px', color: '#' + def.color.toString(16).padStart(6, '0'), fontStyle: 'bold' }).setOrigin(0.5));
      if (n > 1) this.modLabels.push(this.add.text(x + 24, y + 24, 'x' + n, { fontFamily: 'monospace', fontSize: '10px', color: '#fff', stroke: '#000', strokeThickness: 2 }).setOrigin(1));
      x += 30;
    }
  }

  drawDash(p) {
    const g = this.gDash;
    g.clear();
    const x = 12, y = CFG.H - 48, w = 90;
    const frac = p.dashCooldown > 0 ? 1 - Math.max(0, p.dashCdT) / p.dashCooldown : 1;
    g.fillStyle(0x08122e, 0.9); g.fillRect(x, y, w, 6);
    g.fillStyle(frac >= 1 ? 0x00f0ff : 0x2748ff, 1); g.fillRect(x, y, w * frac, 6);
    g.lineStyle(1, 0x00f0ff, 0.8); g.strokeRect(x, y, w, 6);
  }

  drawBoss(game) {
    const g = this.gBoss;
    g.clear();
    const boss = game.enemies.find(e => e.type === 'boss' && !e.dead);
    this.bossText.setText(boss ? ENEMY_TYPES.boss.name : '');
    if (!boss) return;
    const w = 420, x = (CFG.W - w) / 2, y = CFG.H - 26;
    g.fillStyle(0x1a0830, 0.9); g.fillRect(x, y, w, 10);
    g.fillStyle(0xff2bd6, 1); g.fillRect(x, y, w * Math.max(0, boss.hp / boss.maxHp), 10);
    g.lineStyle(2, 0xffffff, 0.8); g.strokeRect(x, y, w, 10);
  }

  // ---------- paneles ----------
  showPause(paused) {
    if (paused && !this.pauseTxt) {
      this.pauseTxt = this.add.text(CFG.W / 2, CFG.H / 2, 'PAUSA\n\nESC para continuar', { fontFamily: 'monospace', fontSize: '32px', color: '#00f0ff', align: 'center', backgroundColor: '#03050fcc', padding: { x: 30, y: 20 } }).setOrigin(0.5).setDepth(60);
    } else if (!paused && this.pauseTxt) { this.pauseTxt.destroy(); this.pauseTxt = null; }
  }

  showEnd(e) {
    if (this.overlay) return;
    const W = CFG.W, H = CFG.H;
    const c = this.add.container(0, 0).setDepth(70);
    c.add(this.add.rectangle(0, 0, W, H, 0x000000, 0.72).setOrigin(0));
    c.add(this.add.text(W / 2, 170, e.win ? 'SERVIDOR CONQUISTADO' : 'CONEXIÓN PERDIDA', { fontFamily: 'monospace', fontSize: '44px', color: e.win ? '#5dff8a' : '#ff4466', fontStyle: 'bold', stroke: '#000', strokeThickness: 5 }).setOrigin(0.5));
    c.add(this.add.text(W / 2, 270,
      `Planta alcanzada: ${e.floor}/${CFG.FLOORS}\nSalas limpiadas: ${e.rooms}\n\nFragmentos de Núcleo ganados: +${e.fragments}\nTotal: ${Meta.data.fragments}\n\nPierdes las mejoras de esta partida,\npero conservas los fragmentos.`,
      { fontFamily: 'monospace', fontSize: '20px', color: '#cffcff', align: 'center', lineSpacing: 4 }).setOrigin(0.5, 0));
    const btn = this.add.text(W / 2, 520, '[ Enter ]  Volver al menú', { fontFamily: 'monospace', fontSize: '24px', color: '#00f0ff', backgroundColor: '#0a1230', padding: { x: 20, y: 10 } }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    c.add(btn);
    const back = () => { this.scene.stop('GameScene'); this.scene.start('MenuScene'); };
    btn.on('pointerdown', back);
    this.input.keyboard.once('keydown-ENTER', back);
    this.overlay = c;
  }
}
