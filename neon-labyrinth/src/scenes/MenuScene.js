/**
 * MenuScene: menú principal con tres secciones.
 *   PARTIDA  : nombre de usuario, skin (solo estética), arma (clase con habilidad) y dificultad.
 *   TIENDA   : mejoras permanentes (Fragmentos de Núcleo) y skins (monedas).
 *   MISIONES : objetivos que avanzan entre partidas y dan recompensas.
 */
class MenuScene extends Phaser.Scene {
  constructor() { super('MenuScene'); }

  create() {
    const W = CFG.W, H = CFG.H;
    this.tab = MenuScene.lastTab || 'play';
    this.shopTab = MenuScene.lastShopTab || 'upgrades';
    this.editing = false;
    this.add.rectangle(W / 2, H / 2, W, H, 0x04060f);
    this.drawGrid();

    // --- barra superior: título, cartera y pestañas ---
    const title = this.add.text(28, 12, 'NEON LABYRINTH', { fontFamily: 'monospace', fontSize: '30px', color: '#00f0ff', fontStyle: 'bold', stroke: '#ff2bd6', strokeThickness: 2 });
    this.tweens.add({ targets: title, alpha: 0.82, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.wallet = this.add.text(W - 24, 14, '', { fontFamily: 'monospace', fontSize: '16px', color: '#ffe94d', align: 'right' }).setOrigin(1, 0);
    this.tabBtns = {};
    [['play', 'PARTIDA'], ['shop', 'TIENDA'], ['missions', 'MISIONES']].forEach(([id, label], i) => {
      const x = 28 + i * 168, y = 58;
      const bg = this.add.rectangle(x, y, 156, 34, 0x0a1230).setOrigin(0).setStrokeStyle(2, 0x2748ff).setInteractive({ useHandCursor: true });
      const tx = this.add.text(x + 78, y + 17, label, { fontFamily: 'monospace', fontSize: '17px', color: '#9fc4ff', fontStyle: 'bold' }).setOrigin(0.5);
      bg.on('pointerdown', () => this.setTab(id));
      this.tabBtns[id] = { bg, tx };
    });
    this.add.rectangle(0, 100, W, 2, 0x2748ff).setOrigin(0);
    this.content = null;

    this.input.keyboard.on('keydown', ev => this.onKey(ev));
    this.input.on('pointerdown', (p, over) => { if (this.editing && !over.includes(this.nameBox)) this.stopEditing(); });
    this.setTab(this.tab);
  }

  drawGrid() {
    const g = this.add.graphics();
    g.lineStyle(1, 0x0d1840, 0.8);
    for (let x = 0; x < CFG.W; x += 32) g.lineBetween(x, 0, x, CFG.H);
    for (let y = 0; y < CFG.H; y += 32) g.lineBetween(0, y, CFG.W, y);
  }

  // ---------------------------------------------------------------------------------------
  setTab(id) {
    this.stopEditing();
    this.tab = id; MenuScene.lastTab = id;
    for (const [k, b] of Object.entries(this.tabBtns)) {
      const on = k === id;
      b.bg.setFillStyle(on ? 0x14234f : 0x0a1230).setStrokeStyle(on ? 3 : 2, on ? 0x00f0ff : 0x2748ff);
      b.tx.setColor(on ? '#00f0ff' : '#9fc4ff');
    }
    this.rebuild();
  }

  rebuild() {
    if (this.content) this.content.destroy();
    this.content = this.add.container(0, 0);
    this.refreshWallet();
    if (this.tab === 'play') this.buildPlay();
    else if (this.tab === 'shop') this.buildShop();
    else this.buildMissions();
  }

  refreshWallet() {
    const d = Meta.data;
    this.wallet.setText(`${d.name}\n¢ ${d.coins} monedas    ◆ ${d.fragments} fragmentos`);
  }

  txt(x, y, s, size = 13, color = '#9fc4ff', extra = {}) {
    const t = this.add.text(x, y, s, Object.assign({ fontFamily: 'monospace', fontSize: size + 'px', color }, extra));
    this.content.add(t);
    return t;
  }

  box(x, y, w, h, fill, stroke, lw = 2) {
    const r = this.add.rectangle(x, y, w, h, fill).setOrigin(0).setStrokeStyle(lw, stroke);
    this.content.add(r);
    return r;
  }

  hex(c) { return '#' + c.toString(16).padStart(6, '0'); }

  beep(freq) {
    try {
      const ctx = this.sound.context;
      if (!ctx) return;
      const o = ctx.createOscillator(), gn = ctx.createGain();
      o.type = 'square'; o.frequency.value = freq; gn.gain.value = 0.04;
      o.connect(gn); gn.connect(ctx.destination); o.start(); o.stop(ctx.currentTime + 0.08);
    } catch (e) { /* sin audio */ }
  }

  // ======================================================================================= PARTIDA
  buildPlay() {
    const d = Meta.data, W = CFG.W;
    const ownedSkins = SKINS.filter(s => Meta.hasSkin(s.id));

    // ---- jugador: nombre y skin ----
    this.txt(30, 114, 'JUGADOR', 16, '#ffe94d');
    this.nameBox = this.box(30, 138, 320, 34, 0x0a1230, this.editing ? 0x00f0ff : 0x2748ff).setInteractive({ useHandCursor: true });
    this.nameBox.on('pointerdown', () => this.startEditing());
    this.nameText = this.txt(42, 146, '', 17, '#ffffff');
    this.txt(30, 176, 'Pulsa en el nombre y escribe (máx. 14 letras). Enter para guardar.', 10, '#6f86c9');
    this.refreshName();

    this.box(30, 196, 320, 262, 0x0a1230, 0x2748ff);
    const sk = SKINS.find(s => s.id === d.skin) || SKINS[0], ld = CHARACTERS.find(c => c.id === d.loadout) || CHARACTERS[0];
    const pv = this.add.image(190, 330, 'skin_' + sk.id).setScale(3.4);
    const wp = this.add.image(190, 330 - 48, ld.wp).setScale(2.4);
    const glow = this.add.image(190, 330, 'glow').setTint(ld.color).setBlendMode(Phaser.BlendModes.ADD).setScale(3).setAlpha(0.4);
    this.content.add([glow, pv, wp]);
    this.tweens.add({ targets: [pv, wp], y: '+=4', duration: 1100, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.txt(190, 418, sk.name, 18, '#ffffff', { fontStyle: 'bold' }).setOrigin(0.5);
    this.txt(190, 438, `skin ${sk.rarity}`, 11, this.hex(RARITY_COLOR[sk.rarity]), { align: 'center' }).setOrigin(0.5);
    const idx = ownedSkins.findIndex(s => s.id === d.skin);
    [[-1, 52, '◄'], [1, 328, '►']].forEach(([dir, x, ch]) => {
      const b = this.add.text(x, 330, ch, { fontFamily: 'monospace', fontSize: '34px', color: '#00f0ff' }).setOrigin(0.5).setInteractive({ useHandCursor: true });
      b.on('pointerdown', () => { const n = ownedSkins[(idx + dir + ownedSkins.length) % ownedSkins.length]; Meta.equipSkin(n.id); this.beep(520); this.rebuild(); });
      this.content.add(b);
    });
    this.txt(30, 466, `Solo cambia el aspecto, no el juego.\nCompra más skins en la TIENDA o encuéntralas en cofres.`, 10, '#6f86c9');

    // ---- arma (clase con habilidad) ----
    this.txt(372, 114, 'ARMA', 16, '#ffe94d');
    CHARACTERS.forEach((c, i) => {
      const y = 138 + i * 106, on = c.id === d.loadout;
      const bg = this.box(372, y, 292, 98, on ? 0x13204a : 0x0a1230, on ? c.color : 0x2748ff, on ? 3 : 2).setInteractive({ useHandCursor: true });
      bg.on('pointerdown', () => { Meta.data.loadout = c.id; Meta.save(); this.beep(520); this.rebuild(); });
      this.content.add(this.add.image(406, y + 49, c.wp).setScale(1.7));
      this.txt(438, y + 8, c.name.toUpperCase(), 16, this.hex(c.color), { fontStyle: 'bold' });
      this.txt(438, y + 28, `♥ ${c.hp + Meta.level('hp')}   ◈ ${c.shield + Meta.level('shield')}   ${c.desc}`, 11, '#9fc4ff');
      this.txt(438, y + 46, `Q · ${c.ability.name}`, 12, '#ffffff', { fontStyle: 'bold' });
      this.txt(438, y + 62, c.ability.desc, 10, '#7f95c9', { wordWrap: { width: 218 } });
    });

    // ---- dificultad ----
    this.txt(686, 114, 'DIFICULTAD', 16, '#ffe94d');
    DIFFICULTIES.forEach((df, i) => {
      const y = 138 + i * 106, on = d.difficulty === i;
      const bg = this.box(686, y, 308, 98, on ? 0x13204a : 0x0a1230, on ? df.color : 0x2748ff, on ? 3 : 2).setInteractive({ useHandCursor: true });
      bg.on('pointerdown', () => { Meta.data.difficulty = i; Meta.save(); this.beep(520); this.rebuild(); });
      this.txt(702, y + 10, df.name, 20, this.hex(df.color), { fontStyle: 'bold' });
      if (on) this.txt(976, y + 10, '✔', 20, this.hex(df.color)).setOrigin(1, 0);
      this.txt(702, y + 40, df.desc, 11, '#cffcff', { wordWrap: { width: 276 } });
    });

    // ---- botón de jugar y estadísticas ----
    const start = this.add.rectangle(W / 2 + 190, 590, 380, 46, 0x00f0ff, 0.15).setStrokeStyle(2, 0x00f0ff).setInteractive({ useHandCursor: true });
    start.on('pointerdown', () => this.startRun());
    this.content.add([start, this.add.text(W / 2 + 190, 590, 'JUGAR  [Enter]', { fontFamily: 'monospace', fontSize: '24px', color: '#00f0ff', fontStyle: 'bold' }).setOrigin(0.5)]);
    this.txt(372, 466, `Mejor planta: ${d.bestFloor}   Salas (récord): ${d.bestRooms}   Victorias: ${d.wins}   Partidas: ${d.runs}`, 11, '#6f86c9');
    const reset = this.txt(30, 618, '[borrar todo el progreso]', 10, '#6a3a46').setInteractive({ useHandCursor: true });
    reset.on('pointerdown', () => { if (reset.confirm) { Meta.reset(); this.scene.restart(); } else { reset.confirm = true; reset.setText('[¿seguro? pulsa otra vez]').setColor('#ff4466'); } });
  }

  // ---- edición del nombre con el teclado ----
  startEditing() { this.editing = true; this.nameFresh = true; this.nameBox.setStrokeStyle(2, 0x00f0ff); this.nameDraft = Meta.data.name; this.refreshName(); }

  stopEditing() {
    if (!this.editing) return;
    this.editing = false;
    Meta.setName(this.nameDraft);
    if (this.nameBox && this.nameBox.active) this.nameBox.setStrokeStyle(2, 0x2748ff);
    this.refreshName(); this.refreshWallet();
  }

  refreshName() {
    if (!this.nameText || !this.nameText.active) return;
    const caret = this.editing && Math.floor(this.time.now / 450) % 2 === 0 ? '|' : ' ';
    this.nameText.setText((this.editing ? this.nameDraft : Meta.data.name) + (this.editing ? caret : ''));
  }

  update() { if (this.editing) this.refreshName(); }

  onKey(ev) {
    if (this.editing) {
      if (ev.key === 'Enter' || ev.key === 'Escape') { this.stopEditing(); return; }
      if (ev.key === 'Backspace') { this.nameDraft = this.nameFresh ? '' : this.nameDraft.slice(0, -1); this.nameFresh = false; return; }
      if (ev.key.length === 1 && /[\wÁ-ú \-]/.test(ev.key)) {
        if (this.nameFresh) { this.nameDraft = ''; this.nameFresh = false; }     // la primera tecla reemplaza el nombre anterior
        if (this.nameDraft.length < 14) this.nameDraft += ev.key;
      }
      return;
    }
    if (ev.key === 'Enter' && this.tab === 'play') this.startRun();
  }

  startRun() {
    this.stopEditing();
    const d = Meta.data;
    this.scene.start('GameScene', { character: d.loadout, skin: d.skin, difficulty: d.difficulty });
  }

  // ======================================================================================= TIENDA
  buildShop() {
    [['upgrades', 'MEJORAS PERMANENTES'], ['skins', 'SKINS']].forEach(([id, label], i) => {
      const on = this.shopTab === id, x = 28 + i * 240;
      const bg = this.box(x, 112, 228, 28, on ? 0x13204a : 0x0a1230, on ? 0xffe94d : 0x2748ff).setInteractive({ useHandCursor: true });
      bg.on('pointerdown', () => { this.shopTab = id; MenuScene.lastShopTab = id; this.rebuild(); });
      this.txt(x + 114, 126, label, 13, on ? '#ffe94d' : '#9fc4ff', { fontStyle: 'bold' }).setOrigin(0.5);
    });
    if (this.shopTab === 'upgrades') this.buildUpgrades(); else this.buildSkins();
  }

  buildUpgrades() {
    this.txt(540, 118, 'Se pagan con ◆ Fragmentos de Núcleo (los ganas en cada partida)', 12, '#5dff8a');
    const ox = 300, oy = 168, nodes = [];
    const tip = this.txt(ox, 500, 'Pasa el ratón por una mejora para ver qué hace.', 13, '#cffcff', { wordWrap: { width: 480 } });
    const g = this.add.graphics(); this.content.add(g);
    const refresh = () => {
      this.refreshWallet(); g.clear();
      for (const n of nodes) {
        if (!n.u.req) continue;
        const p = nodes.find(m => m.u.id === n.u.req);
        g.lineStyle(2, Meta.level(n.u.req) ? 0x2748ff : 0x1a2450, 1); g.lineBetween(p.x + 74, p.y + 62, n.x + 74, n.y);
      }
      for (const n of nodes) {
        const lv = Meta.level(n.u.id), maxed = lv >= n.u.max, locked = n.u.req && Meta.level(n.u.req) < 1, can = Meta.canBuy(n.u);
        n.bg.setFillStyle(maxed ? 0x103a22 : can ? 0x14234f : 0x0a1230).setStrokeStyle(2, maxed ? 0x5dff8a : can ? 0x00f0ff : locked ? 0x1a2450 : 0x2748ff);
        n.name.setColor(locked ? '#4a5a8a' : '#ffffff');
        n.info.setText(maxed ? `NIVEL ${lv}/${n.u.max} · MAX` : `Nv ${lv}/${n.u.max} · ${n.u.cost[lv]} ◆`).setColor(maxed ? '#5dff8a' : can ? '#00f0ff' : '#8a6a6a');
      }
    };
    UPGRADES.forEach(u => {
      const x = ox + u.pos[0] * 164, y = oy + u.pos[1] * 76;
      const bg = this.box(x, y, 148, 62, 0x0a1230, 0x2748ff).setInteractive({ useHandCursor: true });
      const name = this.txt(x + 74, y + 7, u.name, 12, '#ffffff', { align: 'center', wordWrap: { width: 140 } }).setOrigin(0.5, 0);
      const info = this.txt(x + 74, y + 40, '', 12, '#5dff8a', { align: 'center' }).setOrigin(0.5, 0);
      bg.on('pointerdown', () => { if (Meta.buy(u)) { this.beep(660); refresh(); } else this.beep(160); });
      bg.on('pointerover', () => tip.setText(`${u.name}: ${u.desc}${u.req ? '   (requiere: ' + UPGRADES.find(x2 => x2.id === u.req).name + ')' : ''}`));
      nodes.push({ u, bg, name, info, x, y });
    });
    refresh();
  }

  buildSkins() {
    this.txt(540, 118, 'Se pagan con ¢ monedas, o aparecen en los cofres de jefe', 12, '#ffe94d');
    const cols = 4, cw = 228, ch = 138;
    SKINS.forEach((s, i) => {
      const x = 28 + (i % cols) * (cw + 12), y = 152 + Math.floor(i / cols) * (ch + 10);
      const own = Meta.hasSkin(s.id), eq = Meta.data.skin === s.id;
      const rc = RARITY_COLOR[s.rarity];
      const bg = this.box(x, y, cw, ch, eq ? 0x13204a : 0x0a1230, eq ? 0x00f0ff : own ? 0x2f56ff : 0x1a2450, eq ? 3 : 2).setInteractive({ useHandCursor: true });
      const img = this.add.image(x + 54, y + 62, 'skin_' + s.id).setScale(2.3);
      if (!own) img.setTint(0x555a70);
      this.content.add(img);
      this.txt(x + 100, y + 14, s.name, 15, own ? '#ffffff' : '#8a93b8', { fontStyle: 'bold' });
      this.txt(x + 100, y + 36, s.rarity, 11, this.hex(rc));
      let status, col;
      if (eq) { status = 'EQUIPADA'; col = '#00f0ff'; }
      else if (own) { status = 'Pulsa para equipar'; col = '#5dff8a'; }
      else if (s.chestOnly) { status = 'Solo en cofres'; col = '#ffd23c'; }
      else { status = `${s.price} ¢`; col = Meta.data.coins >= s.price ? '#ffe94d' : '#8a6a6a'; }
      this.txt(x + 100, y + 62, status, 13, col, { wordWrap: { width: 120 } });
      if (!own && !s.chestOnly) this.txt(x + 100, y + 84, Meta.data.coins >= s.price ? 'Pulsa para comprar' : `Te faltan ${s.price - Meta.data.coins} ¢`, 10, '#6f86c9');
      bg.on('pointerdown', () => {
        if (own) { Meta.equipSkin(s.id); this.beep(520); this.rebuild(); }
        else if (!s.chestOnly && Meta.buySkin(s.id)) { Meta.equipSkin(s.id); this.beep(780); this.rebuild(); }
        else this.beep(160);
      });
    });
  }

  // ======================================================================================= MISIONES
  buildMissions() {
    const d = Meta.data;
    this.txt(30, 114, 'MISIONES', 16, '#ffe94d');
    this.txt(130, 118, 'El progreso cuenta entre partidas. Reclama la recompensa al completarlas.', 12, '#6f86c9');
    d.missions.forEach((m, i) => {
      const y = 144 + i * 118, done = m.done;
      this.box(30, y, 964, 104, done ? 0x103a22 : 0x0a1230, done ? 0x5dff8a : 0x2748ff, done ? 3 : 2);
      this.txt(50, y + 14, m.text, 21, '#ffffff', { fontStyle: 'bold' });
      const frac = Math.min(1, m.progress / m.target);
      this.box(50, y + 56, 560, 16, 0x08122e, 0x2748ff, 1);
      const fill = this.add.rectangle(50, y + 56, 560 * frac, 16, done ? 0x5dff8a : 0x2f56ff).setOrigin(0); this.content.add(fill);
      this.txt(626, y + 55, `${m.progress}/${m.target}`, 14, '#cffcff');
      const rw = [];
      if (m.reward.coins) rw.push(`¢ ${m.reward.coins}`);
      if (m.reward.frag) rw.push(`◆ ${m.reward.frag}`);
      if (m.reward.chest) rw.push(`Cofre de ${CHEST_TIERS[m.reward.chest - 1].name}`);
      this.txt(50, y + 80, 'Recompensa: ' + rw.join('   '), 12, '#ffe94d');
      if (done) {
        const b = this.add.rectangle(870, y + 52, 190, 50, 0x5dff8a, 0.2).setStrokeStyle(2, 0x5dff8a).setInteractive({ useHandCursor: true });
        b.on('pointerdown', () => this.claim(i));
        this.content.add([b, this.add.text(870, y + 52, 'RECLAMAR', { fontFamily: 'monospace', fontSize: '20px', color: '#5dff8a', fontStyle: 'bold' }).setOrigin(0.5)]);
      } else this.txt(870, y + 52, 'en curso', 14, '#6f86c9').setOrigin(0.5);
    });
    const t = d.totals;
    this.txt(30, 590, `Totales: ${t.kills} bajas · ${t.rooms} salas limpiadas · ${t.bosses} jefes · ${t.chests} cofres abiertos`, 12, '#6f86c9');
  }

  claim(i) {
    const res = Missions.claim(i);
    if (!res) return;
    this.beep(880);
    const lines = ['¡RECOMPENSA RECLAMADA!', ''];
    if (res.coins) lines.push(`+${res.coins} monedas`);
    if (res.frag) lines.push(`+${res.frag} fragmentos`);
    if (res.chest) { lines.push(`Cofre de ${CHEST_TIERS[res.chest.tier - 1].name}:`); res.chest.items.forEach(it => lines.push('  · ' + it.label)); }
    this.rebuild();
    const panel = this.add.text(CFG.W / 2, CFG.H / 2, lines.join('\n') + '\n\n[clic para cerrar]', { fontFamily: 'monospace', fontSize: '20px', color: '#cffcff', align: 'center', backgroundColor: '#03050ff2', padding: { x: 30, y: 22 }, lineSpacing: 4 }).setOrigin(0.5).setDepth(50).setInteractive();
    panel.on('pointerdown', () => panel.destroy());
  }
}
