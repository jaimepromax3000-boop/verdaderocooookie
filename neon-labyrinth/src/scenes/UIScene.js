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
    this.gAbility = this.add.graphics();
    this.abilityText = this.add.text(CFG.W - 20, CFG.H - 50, '', { fontFamily: 'monospace', fontSize: '11px', color: '#cffcff', align: 'right' }).setOrigin(1, 0);
    this.gBig = this.add.graphics().setDepth(40);
    this.bigLabels = [];
    this.keyTab = this.input.keyboard.addKey('TAB');
    if (Settings.mobile) this.buildTouch();
    this.gBoss = this.add.graphics();
    this.bossText = this.add.text(W / 2, H - 42, '', { fontFamily: 'monospace', fontSize: '12px', color: '#ff2bd6' }).setOrigin(0.5);

    this.overlay = null;
    this.sig = '';

    this.offs = [
      Bus.on('player:hit', e => { if (e.crit) this.shakeHud(8); else this.shakeHud(3); this.flashRed(e.crit); }),
      Bus.on('game:pause', e => this.showPause(e.paused)),
      Bus.on('run:end', e => this.showEnd(e)),
      Bus.on('room:clear', () => this.banner('SALA LIMPIA')),
      Bus.on('boss:phase', e => this.banner(`¡${(e.name || 'EL JEFE').toUpperCase()} SE ENFURECE!`, '#ff2bd6')),
      Bus.on('boss:intro', e => this.banner('JEFE · ' + e.name.toUpperCase(), '#ff2bd6')),
      Bus.on('wave:start', e => this.banner(`OLEADA ${e.wave}/${e.total}`, '#ffe94d')),
      Bus.on('floor:new', e => this.banner(`PLANTA ${e.floor} · ${e.theme.name}`, '#' + e.theme.accent.toString(16).padStart(6, '0'))),
      Bus.on('upgrade:offer', e => this.showCards(e.cards)),
      Bus.on('chest:open', e => this.showChest(e)),
      Bus.on('mission:done', e => this.banner('MISIÓN COMPLETADA · ' + e.mission.text, '#5dff8a', 150)),
      Bus.on('player:ability', e => this.banner({ emp: 'PULSO EMP', phase: 'FASE ESPECTRAL', swarm: 'ENJAMBRE' }[e.id] || '', '#00f0ff', 70)),
    ];
    this.events.once('shutdown', () => this.offs.forEach(f => f()));
    this.cardsUI = null; this.chestUI = null;
    ['ONE', 'TWO', 'THREE'].forEach((k, i) => this.input.keyboard.on('keydown-' + k, () => { if (this.cardsUI && this.cardsUI.cards[i]) this.choose(this.cardsUI.cards[i].id); }));
    this.input.keyboard.on('keydown-ENTER', () => this.closeChestUI());
    this.input.keyboard.on('keydown-SPACE', () => this.closeChestUI());
    this.redFlash = this.add.rectangle(0, 0, W, H, 0xff0033, 0).setOrigin(0).setDepth(50);
    if (this.gs.theme) this.banner(`PLANTA ${this.gs.floor} · ${this.gs.theme.name}`, '#' + this.gs.theme.accent.toString(16).padStart(6, '0'));
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

  banner(text, color = '#00f0ff', y = 110) {
    if (!text) return;
    const t = this.add.text(CFG.W / 2, y, text, { fontFamily: 'monospace', fontSize: y < 100 ? '18px' : '26px', color, stroke: '#000', strokeThickness: 4, fontStyle: 'bold' }).setOrigin(0.5).setAlpha(0).setDepth(45);
    this.tweens.add({ targets: t, alpha: 1, y: y - 10, duration: 250, yoyo: true, hold: 900, onComplete: () => t.destroy() });
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
    this.drawAbility(p);
    this.drawBoss(g);
    this.drawBigMap(g);
    this.lowHp(p);
    if (this.joy) this.drawTouch();
    this.txtInfo.setText(`¢ ${p.credits}    🔑 ${p.keys}`.replace('🔑', 'LLAVES'));
    const arm = Math.round(Armor.reduction() * 100);
    this.txtInfo2.setText(`Salas: ${g.roomsCleared}  ·  Mejoras: ${g.upgradesPicked}  ·  Fragmentos al morir: +${Math.round((g.roomsCleared * 2 + (g.floor - 1) * 6 + g.bossesKilled * 12) * g.diff.reward)}${arm ? `  ·  Armadura ${arm} %` : ''}`);
    this.txtFloor.setText(`PLANTA ${g.floor}/${CFG.FLOORS}  ·  ${this.roomName(g.room)}`);
    this.txtWeapon.setText(`${Meta.shown()}  ·  ${p.weapon.name}  ·  ${g.diff.name}`);
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

  /** Dibuja un mapa de salas en (ox,oy) con celdas de tamaño `cell` (reutilizado por el minimapa y el mapa grande). */
  paintMap(g, game, ox, oy, cell, gap, big) {
    const d = game.dungeon, step = cell + gap, pulse = 0.5 + 0.5 * Math.sin(this.time.now / 220);
    const cur = game.room;
    for (const r of d.list) {
      if (!r.discovered && !r.visited) continue;
      if (r.type === 'treasure' && !r.visited) continue;           // el tesoro está oculto hasta entrar
      const x = ox + r.gx * step, y = oy + r.gy * step;
      for (const [name, dd] of Object.entries(DIRS)) {           // conexiones (puertas)
        if (!r.doors[name]) continue;
        const o = d.get(r.gx + dd.dx, r.gy + dd.dy);
        if (!o || !(o.visited || r.visited)) continue;
        if (o.type === 'treasure' && !o.visited) continue;
        g.lineStyle(big ? 4 : 2, (r.visited && o.visited) ? 0x2f56ff : 0x1a2a66, 1);
        g.lineBetween(x + cell / 2, y + cell / 2, x + cell / 2 + dd.dx * step / 2, y + cell / 2 + dd.dy * step / 2);
      }
    }
    for (const r of d.list) {
      if (!r.discovered && !r.visited) continue;
      if (r.type === 'treasure' && !r.visited) continue;
      const x = ox + r.gx * step, y = oy + r.gy * step, visited = r.visited, k = cell / 15;
      let col = visited ? 0x2748ff : 0x16204a;
      if (r.type === 'shop') col = 0xffe94d; else if (r.type === 'boss') col = 0xff2bd6; else if (r.type === 'treasure') col = 0x5dff8a; else if (r.type === 'start') col = 0x00b4c8;
      if (visited && r.type === 'combat' && r.cleared) col = 0x1c3a8a;
      g.fillStyle(col, visited || r.type !== 'combat' ? 0.92 : 0.5); g.fillRect(x, y, cell, cell);
      g.lineStyle(big ? 2 : 1, 0x00f0ff, visited ? 0.9 : 0.3); g.strokeRect(x, y, cell, cell);
      g.fillStyle(0x000000, 1);
      if (r.type === 'boss') { g.fillRect(x + 4 * k, y + 4 * k, 3 * k, 3 * k); g.fillRect(x + 9 * k, y + 4 * k, 3 * k, 3 * k); g.fillRect(x + 5 * k, y + 10 * k, 6 * k, 2 * k); }
      else if (r.type === 'shop') { g.fillRect(x + 6 * k, y + 3 * k, 3 * k, 9 * k); g.fillRect(x + 4 * k, y + 5 * k, 7 * k, 2 * k); g.fillRect(x + 4 * k, y + 9 * k, 7 * k, 2 * k); }
      else if (r.type === 'treasure') g.fillRect(x + 4 * k, y + 6 * k, 8 * k, 5 * k);
      else if (r.type === 'start') { g.fillStyle(0xffffff, 0.9); g.fillTriangle(x + 7.5 * k, y + 3 * k, x + 12 * k, y + 11 * k, x + 3 * k, y + 11 * k); }
      else if (visited && r.cleared) { g.fillStyle(0x7fa0ff, 0.9); g.fillRect(x + 6 * k, y + 6 * k, 3 * k, 3 * k); }
      else if (!visited) { g.fillStyle(0x7fa0ff, 0.6); g.fillRect(x + 6 * k, y + 5 * k, 3 * k, 2 * k); g.fillRect(x + 6 * k, y + 9 * k, 3 * k, 2 * k); }   // "?"
    }
    const cx = ox + cur.gx * step + cell / 2, cy = oy + cur.gy * step + cell / 2;       // posición actual (pulsa)
    g.lineStyle(2, 0xffffff, 0.4 + 0.5 * pulse); g.strokeRect(ox + cur.gx * step - 2, oy + cur.gy * step - 2, cell + 4, cell + 4);
    g.fillStyle(0xffffff, 1); g.fillCircle(cx, cy, big ? 5 : 3.2);
  }

  drawMap(game) {
    const g = this.gMap;
    g.clear();
    const n = game.dungeon.size || 7, cell = n > 7 ? 12 : 15, gap = n > 7 ? 2 : 3, side = n * (cell + gap) + 6, ox = CFG.W - side - 6, oy = 70;
    g.fillStyle(0x03050f, 0.6); g.fillRect(ox - 6, oy - 6, side, side);
    g.lineStyle(1, 0x2748ff, 0.8); g.strokeRect(ox - 6, oy - 6, side, side);
    this.paintMap(g, game, ox, oy, cell, gap, false);
  }

  /** Mapa grande de la planta (mantén Tab). */
  drawBigMap(game) {
    const g = this.gBig;
    g.clear();
    this.bigLabels.forEach(l => l.destroy()); this.bigLabels = [];
    if (!(this.keyTab.isDown || this.gs.touch.map) || this.overlay) return;
    const W = CFG.W, H = CFG.H, nn = game.dungeon.size || 7, cell = nn > 7 ? 36 : 46, gap = nn > 7 ? 10 : 14, step = cell + gap, size = nn * step;
    const ox = (W - size) / 2 + 20, oy = nn > 7 ? 92 : 105;
    g.fillStyle(0x02030a, 0.9); g.fillRect(0, 0, W, H);
    g.lineStyle(2, game.theme.accent, 0.7); g.strokeRect(ox - 20, oy - 20, size + 20, size + 4);
    this.paintMap(g, game, ox, oy, cell, gap, true);
    const t = this.add.text(W / 2, 54, `PLANTA ${game.floor} · ${game.theme.name}`, { fontFamily: 'monospace', fontSize: '24px', color: '#00f0ff', fontStyle: 'bold' }).setOrigin(0.5).setDepth(41);
    const legend = [['#00b4c8', 'Inicio'], ['#2748ff', 'Combate'], ['#ffe94d', 'Tienda'], ['#5dff8a', 'Tesoro (llave)'], ['#ff2bd6', 'Jefe']];
    legend.forEach(([c, n], i) => {
      g.fillStyle(parseInt(c.slice(1), 16), 1); g.fillRect(40, 130 + i * 30, 16, 16);
      this.bigLabels.push(this.add.text(64, 130 + i * 30, n, { fontFamily: 'monospace', fontSize: '14px', color: '#cffcff' }).setDepth(41));
    });
    this.bigLabels.push(t, this.add.text(W / 2, H - 28, 'Suelta Tab para volver', { fontFamily: 'monospace', fontSize: '12px', color: '#6f86c9' }).setOrigin(0.5).setDepth(41));
  }

  drawAbility(p) {
    const g = this.gAbility;
    g.clear();
    const x = CFG.W - 38, y = CFG.H - 30, r = 17;
    const frac = p.abilityCooldown > 0 ? 1 - p.abilityCdT / p.abilityCooldown : 1, ready = frac >= 1;
    const col = p.character.color;
    g.fillStyle(0x08122e, 0.95); g.fillCircle(x, y, r + 2);
    g.lineStyle(4, ready ? col : 0x2748ff, 1); g.beginPath(); g.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * frac, false); g.strokePath();
    if (ready) { g.lineStyle(2, 0xffffff, 0.4 + 0.4 * Math.sin(this.time.now / 160)); g.strokeCircle(x, y, r + 5); }
    g.fillStyle(ready ? col : 0x445080, 1);
    const id = p.ability.id;
    if (id === 'emp') { g.lineStyle(2, ready ? col : 0x445080, 1); g.strokeCircle(x, y, 4); g.strokeCircle(x, y, 9); g.fillCircle(x, y, 2); }
    else if (id === 'phase') { g.fillTriangle(x, y - 8, x + 6, y + 7, x - 6, y + 7); g.fillStyle(0x08122e, 1); g.fillTriangle(x, y - 2, x + 2.5, y + 5, x - 2.5, y + 5); }
    else { for (let i = 0; i < 3; i++) { const a = i * Math.PI * 2 / 3 - Math.PI / 2; g.fillCircle(x + Math.cos(a) * 7, y + Math.sin(a) * 7, 3); } }
    this.abilityText.setText(`${p.ability.name}\n[Q] ${ready ? 'LISTA' : (p.abilityCdT).toFixed(1) + 's'}`).setColor(ready ? '#ffffff' : '#7f95c9').setPosition(x - 24, y - 12);
  }

  lowHp(p) {
    const low = !p.dead && p.hp <= 1.5 && p.maxHp > 1;
    if (low && !this.tweens.isTweening(this.redFlash)) this.redFlash.setAlpha(0.05 + 0.05 * (0.5 + 0.5 * Math.sin(this.time.now / 260)));
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
    this.bossText.setText(boss ? boss.bossName.toUpperCase() : '').setColor('#' + (boss ? boss.color : 0xff2bd6).toString(16).padStart(6, '0'));
    if (!boss) return;
    const w = 420, x = (CFG.W - w) / 2, y = CFG.H - 26;
    g.fillStyle(0x1a0830, 0.9); g.fillRect(x, y, w, 10);
    g.fillStyle(boss.color, 1); g.fillRect(x, y, w * Math.max(0, boss.hp / boss.maxHp), 10);
    g.lineStyle(2, 0xffffff, 0.8); g.strokeRect(x, y, w, 10);
    g.lineStyle(2, 0xffffff, 0.9); for (let i = 1; i < boss.bossInfo.phases; i++) { const tx = x + w * (1 - i / boss.bossInfo.phases) + (boss.bossInfo.phases === 2 ? 0 : 0); g.lineBetween(tx, y - 2, tx, y + 12); }
  }

  // ---------- controles táctiles (modo móvil / tablet): dos joysticks flotantes + botones ----------
  buildTouch() {
    const W = CFG.W, H = CFG.H, t = this.gs.touch;
    this.joy = { L: { id: null, cx: 130, cy: 520, x: 0, y: 0, on: false }, R: { id: null, cx: W - 130, cy: 520, x: 0, y: 0, on: false }, r: 62 };
    this.tgfx = this.add.graphics().setDepth(55);
    this.tbtns = [
      { id: 'dash', x: W - 300, y: 574, r: 32, label: 'DASH' }, { id: 'ability', x: W - 334, y: 494, r: 32, label: 'Q' },
      { id: 'interact', x: W - 290, y: 414, r: 28, label: 'E' }, { id: 'pause', x: W / 2 - 34, y: 84, r: 17, label: 'II' }, { id: 'map', x: W / 2 + 34, y: 84, r: 17, label: 'MAP' },
    ];
    this.tbtns.forEach(b => { b.txt = this.add.text(b.x, b.y, b.label, { fontFamily: 'monospace', fontSize: b.r > 20 ? '14px' : '11px', color: '#cffcff', fontStyle: 'bold' }).setOrigin(0.5).setDepth(56); b.id2 = null; });
    this.input.on('pointerdown', p => this.touchDown(p, t));
    this.input.on('pointermove', p => this.touchMove(p, t));
    this.input.on('pointerup', p => this.touchUp(p, t));
    this.input.on('pointerupoutside', p => this.touchUp(p, t));
  }

  touchBlocked() { return !!(this.cardsUI || this.chestUI || this.overlay); }

  touchDown(p, t) {
    if (this.touchBlocked()) return;
    const W = CFG.W;
    for (const b of this.tbtns) {
      if (Math.hypot(p.x - b.x, p.y - b.y) <= b.r + 10) {
        b.id2 = p.id;
        if (b.id === 'map') t.map = true; else t[b.id] = true;
        return;
      }
    }
    if (p.y < 110) return;                                   // zona del HUD
    const side = p.x < W * 0.42 ? this.joy.L : p.x > W * 0.58 ? this.joy.R : null;
    if (!side || side.id !== null) return;
    side.id = p.id; side.on = true; side.cx = Phaser.Math.Clamp(p.x, 70, W - 70); side.cy = Phaser.Math.Clamp(p.y, 150, CFG.H - 70); side.x = side.y = 0;
  }

  touchMove(p, t) {
    for (const k of ['L', 'R']) {
      const j = this.joy[k];
      if (j.id !== p.id) continue;
      let dx = (p.x - j.cx) / this.joy.r, dy = (p.y - j.cy) / this.joy.r;
      const m = Math.hypot(dx, dy);
      if (m > 1) { dx /= m; dy /= m; }
      j.x = dx; j.y = dy;
      if (k === 'L') { t.mx = dx; t.my = dy; } else { t.ax = dx; t.ay = dy; }
    }
  }

  touchUp(p, t) {
    for (const k of ['L', 'R']) {
      const j = this.joy[k];
      if (j.id !== p.id) continue;
      j.id = null; j.on = false; j.x = j.y = 0;
      if (k === 'L') { t.mx = 0; t.my = 0; } else { t.ax = 0; t.ay = 0; }
    }
    for (const b of this.tbtns) if (b.id2 === p.id) { b.id2 = null; if (b.id === 'map') t.map = false; }
  }

  drawTouch() {
    const g = this.tgfx, r = this.joy.r, blocked = this.touchBlocked();
    g.clear();
    if (blocked) { this.tbtns.forEach(b => b.txt.setVisible(false)); return; }
    this.tbtns.forEach(b => b.txt.setVisible(true));
    for (const k of ['L', 'R']) {
      const j = this.joy[k], on = j.on, cx = j.cx, cy = j.cy;
      g.fillStyle(0x00f0ff, on ? 0.16 : 0.07); g.fillCircle(cx, cy, r);
      g.lineStyle(2, 0x00f0ff, on ? 0.7 : 0.3); g.strokeCircle(cx, cy, r);
      g.fillStyle(k === 'R' ? 0xff2bd6 : 0x00f0ff, on ? 0.75 : 0.35); g.fillCircle(cx + j.x * r, cy + j.y * r, r * 0.42);
    }
    for (const b of this.tbtns) {
      const down = b.id2 !== null;
      g.fillStyle(0x0a1230, 0.7); g.fillCircle(b.x, b.y, b.r);
      g.lineStyle(2, down ? 0xffffff : 0x00f0ff, down ? 1 : 0.7); g.strokeCircle(b.x, b.y, b.r);
      if (down) { g.fillStyle(0x00f0ff, 0.3); g.fillCircle(b.x, b.y, b.r); }
    }
  }

  // ---------- elegir mejora (1 de 3) ----------
  showCards(cards) {
    if (this.cardsUI) return;
    const W = CFG.W, H = CFG.H, cw = 262, gap = 28, x0 = (W - (cw * 3 + gap * 2)) / 2, y0 = 150, ch = 340;
    const c = this.add.container(0, 0).setDepth(80);
    c.add(this.add.rectangle(0, 0, W, H, 0x02030a, 0.82).setOrigin(0));
    c.add(this.add.text(W / 2, 78, 'SALA LIMPIA', { fontFamily: 'monospace', fontSize: '15px', color: '#6f86c9' }).setOrigin(0.5));
    c.add(this.add.text(W / 2, 108, 'ELIGE UNA MEJORA', { fontFamily: 'monospace', fontSize: '32px', color: '#00f0ff', fontStyle: 'bold', stroke: '#000', strokeThickness: 4 }).setOrigin(0.5));
    cards.forEach((cd, i) => {
      const x = x0 + i * (cw + gap), col = cd.color, hex = '#' + col.toString(16).padStart(6, '0');
      const card = this.add.container(x, y0);
      const bg = this.add.rectangle(0, 0, cw, ch, 0x0a1230, 0.96).setOrigin(0).setStrokeStyle(3, col).setInteractive({ useHandCursor: true });
      const ring = this.add.graphics();
      ring.fillStyle(col, 0.18); ring.fillCircle(cw / 2, 78, 44); ring.lineStyle(3, col, 1); ring.strokeCircle(cw / 2, 78, 44);
      const letter = this.add.text(cw / 2, 78, cd.letter, { fontFamily: 'monospace', fontSize: '44px', color: hex, fontStyle: 'bold' }).setOrigin(0.5);
      const name = this.add.text(cw / 2, 148, cd.name, { fontFamily: 'monospace', fontSize: '18px', color: '#ffffff', fontStyle: 'bold', align: 'center', wordWrap: { width: cw - 24 } }).setOrigin(0.5, 0);
      const pips = this.add.graphics();
      for (let k = 0; k < cd.max; k++) { pips.fillStyle(k < cd.level ? col : 0x1a2450, 1); pips.fillRect(cw / 2 - cd.max * 9 + k * 18, 196, 14, 6); }
      const lvl = this.add.text(cw / 2, 208, cd.level === 1 ? 'NUEVA' : `NIVEL ${cd.level}/${cd.max}`, { fontFamily: 'monospace', fontSize: '12px', color: hex }).setOrigin(0.5, 0);
      const desc = this.add.text(cw / 2, 238, cd.desc, { fontFamily: 'monospace', fontSize: '14px', color: '#cffcff', align: 'center', wordWrap: { width: cw - 36 } }).setOrigin(0.5, 0);
      const key = this.add.text(cw / 2, ch - 22, `[${i + 1}]`, { fontFamily: 'monospace', fontSize: '14px', color: '#6f86c9' }).setOrigin(0.5);
      bg.on('pointerover', () => { bg.setFillStyle(0x14234f, 1); this.tweens.add({ targets: card, y: y0 - 8, duration: 120 }); });
      bg.on('pointerout', () => { bg.setFillStyle(0x0a1230, 0.96); this.tweens.add({ targets: card, y: y0, duration: 120 }); });
      bg.on('pointerdown', () => this.choose(cd.id));
      card.add([bg, ring, letter, name, pips, lvl, desc, key]);
      card.setAlpha(0).setScale(0.92);
      this.tweens.add({ targets: card, alpha: 1, scale: 1, duration: 220, delay: 90 * i });
      c.add(card);
    });
    this.cardsUI = { c, cards };
  }

  choose(id) {
    if (!this.cardsUI) return;
    this.cardsUI.c.destroy();
    this.cardsUI = null;
    this.gs.pickUpgrade(id);
  }

  // ---------- cofre de jefe ----------
  showChest(e) {
    if (this.chestUI) return;
    const W = CFG.W, H = CFG.H, tier = CHEST_TIERS[e.tier - 1], hex = '#' + tier.color.toString(16).padStart(6, '0');
    const c = this.add.container(0, 0).setDepth(85);
    c.add(this.add.rectangle(0, 0, W, H, 0x02030a, 0.86).setOrigin(0));
    c.add(this.add.text(W / 2, 70, `COFRE DE ${tier.name.toUpperCase()}`, { fontFamily: 'monospace', fontSize: '34px', color: hex, fontStyle: 'bold', stroke: '#000', strokeThickness: 5 }).setOrigin(0.5));
    const img = this.add.image(W / 2, 168, 'chest_' + e.tier).setScale(2.8);
    c.add(img);
    this.tweens.add({ targets: img, scale: 3.2, duration: 500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    const rows = [];
    e.items.forEach((it, i) => {
      const y = 258 + i * 50, col = it.kind === 'skin' ? RARITY_COLOR[(SKINS.find(s => s.id === it.id) || {}).rarity] || 0xffffff : it.kind === 'upgrade' ? 0x5dff8a : it.kind === 'frag' ? 0x00f0ff : 0xffe94d;
      const row = this.add.container(W / 2, y).setAlpha(0);
      row.add(this.add.rectangle(0, 0, 560, 40, 0x0a1230, 0.95).setStrokeStyle(2, col));
      if (it.kind === 'skin') row.add(this.add.image(-250, 0, 'skin_' + it.id).setScale(Art.sc('skin_' + it.id, 0.8)));
      else row.add(this.add.text(-250, 0, { coins: '¢', frag: '◆', upgrade: '▲' }[it.kind] || '?', { fontFamily: 'monospace', fontSize: '22px', color: '#' + col.toString(16).padStart(6, '0'), fontStyle: 'bold' }).setOrigin(0.5));
      row.add(this.add.text(-215, 0, it.label, { fontFamily: 'monospace', fontSize: '17px', color: '#ffffff' }).setOrigin(0, 0.5));
      c.add(row); rows.push(row);
      this.tweens.add({ targets: row, alpha: 1, x: { from: W / 2 + 40, to: W / 2 }, duration: 260, delay: 500 + i * 380 });
    });
    const hint = this.add.text(W / 2, H - 50, '[Enter / clic]  Continuar', { fontFamily: 'monospace', fontSize: '20px', color: '#00f0ff', backgroundColor: '#0a1230', padding: { x: 18, y: 8 } }).setOrigin(0.5).setAlpha(0).setInteractive({ useHandCursor: true });
    this.tweens.add({ targets: hint, alpha: 1, duration: 300, delay: 600 + e.items.length * 380 });
    hint.on('pointerdown', () => this.closeChestUI());
    c.add(hint);
    this.chestUI = { c, t0: this.time.now, ready: 600 + e.items.length * 380 };
  }

  closeChestUI() {
    if (!this.chestUI || this.time.now - this.chestUI.t0 < this.chestUI.ready) return;
    this.chestUI.c.destroy(); this.chestUI = null;
    this.gs.closeChest();
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
    const c = this.add.container(0, 0).setDepth(90);
    c.add(this.add.rectangle(0, 0, W, H, 0x000000, 0.78).setOrigin(0));
    c.add(this.add.text(W / 2, 120, e.win ? 'SERVIDOR CONQUISTADO' : 'CONEXIÓN PERDIDA', { fontFamily: 'monospace', fontSize: '44px', color: e.win ? '#5dff8a' : '#ff4466', fontStyle: 'bold', stroke: '#000', strokeThickness: 5 }).setOrigin(0.5));
    c.add(this.add.text(W / 2, 168, `${Meta.shown()}  ·  dificultad ${e.diff}`, { fontFamily: 'monospace', fontSize: '16px', color: '#9fc4ff' }).setOrigin(0.5));
    c.add(this.add.text(W / 2, 215,
      `Planta alcanzada: ${e.floor}/${CFG.FLOORS}\nSalas limpiadas: ${e.rooms}\nEnemigos eliminados: ${e.kills}\n\nFragmentos de Núcleo: +${e.fragments}   (total ${Meta.data.fragments})\nMonedas: +${e.coins}   (total ${Meta.data.coins})\n\nPierdes las mejoras de esta partida;\nconservas fragmentos, monedas y misiones.`,
      { fontFamily: 'monospace', fontSize: '20px', color: '#cffcff', align: 'center', lineSpacing: 4 }).setOrigin(0.5, 0));
    const btn = this.add.text(W / 2, 560, '[ Enter ]  Volver al menú', { fontFamily: 'monospace', fontSize: '24px', color: '#00f0ff', backgroundColor: '#0a1230', padding: { x: 20, y: 10 } }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    c.add(btn);
    const back = () => { this.scene.stop('GameScene'); this.scene.start('MenuScene'); };
    btn.on('pointerdown', back);
    this.input.keyboard.once('keydown-ENTER', back);
    this.overlay = c;
  }
}
