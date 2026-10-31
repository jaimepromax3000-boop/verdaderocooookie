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
    this.wallet = this.add.text(W - 74, 14, '', { fontFamily: 'monospace', fontSize: '16px', color: '#ffe94d', align: 'right' }).setOrigin(1, 0);
    this.buildGear();
    this.tabBtns = {};
    [['play', 'PARTIDA'], ['shop', 'TIENDA'], ['smith', 'HERRERO'], ['missions', 'MISIONES']].forEach(([id, label], i) => {
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
    if (this.forging || this.settingsUI) return;
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
    else if (this.tab === 'smith') this.buildSmith();
    else this.buildMissions();
  }

  refreshWallet() {
    const d = Meta.data;
    this.wallet.setText(`${Meta.shown()}\n¢ ${d.coins} monedas    ◆ ${d.fragments} fragmentos`);
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
      o.type = 'square'; o.frequency.value = freq; gn.gain.value = 0.04 * Settings.volume * 1.4;
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
    this.txt(30, 176, 'Pulsa en el nombre y escribe (máx. 14 letras). Enter para guardar.', 10, '#6f86c9', { wordWrap: { width: 322 } });
    this.refreshName();

    this.box(30, 196, 320, 262, 0x0a1230, 0x2748ff);
    const sk = SKINS.find(s => s.id === d.skin) || SKINS[0], ld = CHARACTERS.find(c => c.id === d.loadout) || CHARACTERS[0];
    const pkey = Art.playerKey(this, sk.id);
    const pv = this.add.image(190, 330, pkey).setScale(Art.sc(pkey, 3.4));
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
    this.txt(30, 466, `Solo cambia el aspecto, no el juego.\nCompra más skins en la TIENDA o encuéntralas en cofres.`, 10, '#6f86c9', { wordWrap: { width: 330 } });

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
  startEditing() {
    this.editing = true; this.nameFresh = true; this.nameBox.setStrokeStyle(2, 0x00f0ff); this.nameDraft = Meta.data.name; this.refreshName();
    if (Settings.mobile) this.openDomInput();
  }

  /** En móvil/tablet se usa un campo de texto real para que aparezca el teclado del dispositivo. */
  openDomInput() {
    const inp = document.createElement('input');
    inp.type = 'text'; inp.maxLength = 14; inp.value = Meta.data.name; inp.autocomplete = 'off';
    Object.assign(inp.style, { position: 'fixed', left: '50%', top: '16%', transform: 'translateX(-50%)', zIndex: 9999, fontSize: '22px', padding: '10px 14px', border: '2px solid #00f0ff', borderRadius: '6px', background: '#0a1230', color: '#ffffff', fontFamily: 'monospace', width: '260px' });
    document.body.appendChild(inp);
    this.domInput = inp;
    const done = () => { if (this.domInput !== inp) return; this.nameDraft = inp.value; this.domInput = null; inp.remove(); this.stopEditing(); };
    inp.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === 'Escape') done(); });
    inp.addEventListener('blur', done);
    inp.focus(); inp.select();
  }

  stopEditing() {
    if (!this.editing) return;
    if (this.domInput) { this.nameDraft = this.domInput.value; const i = this.domInput; this.domInput = null; i.remove(); }
    this.editing = false;
    Meta.setName(this.nameDraft);
    if (this.nameBox && this.nameBox.active) this.nameBox.setStrokeStyle(2, 0x2748ff);
    this.refreshName(); this.refreshWallet();
  }

  refreshName() {
    if (!this.nameText || !this.nameText.active) return;
    const caret = this.editing && Math.floor(this.time.now / 450) % 2 === 0 ? '|' : ' ';
    this.nameText.setText(this.editing ? '\u2060' + this.nameDraft + caret : Meta.shown());
  }

  update() { if (this.editing) this.refreshName(); }

  onKey(ev) {
    if (this.domInput) return;
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
    [['upgrades', 'MEJORAS PERMANENTES'], ['skins', 'SKINS'], ['materials', 'MATERIALES']].forEach(([id, label], i) => {
      const on = this.shopTab === id, x = 28 + i * 240;
      const bg = this.box(x, 112, 228, 28, on ? 0x13204a : 0x0a1230, on ? 0xffe94d : 0x2748ff).setInteractive({ useHandCursor: true });
      bg.on('pointerdown', () => { this.shopTab = id; MenuScene.lastShopTab = id; this.rebuild(); });
      this.txt(x + 114, 126, label, 13, on ? '#ffe94d' : '#9fc4ff', { fontStyle: 'bold' }).setOrigin(0.5);
    });
    if (this.shopTab === 'upgrades') this.buildUpgrades(); else if (this.shopTab === 'skins') this.buildSkins(); else this.buildMaterials();
  }

  buildUpgrades() {
    this.txt(740, 112, 'Se pagan con ◆ Fragmentos\nde Núcleo (los ganas jugando)', 12, '#5dff8a');
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
    this.txt(740, 112, 'Se pagan con ¢ monedas,\no salen en los cofres de jefe', 12, '#ffe94d');
    const cols = 4, cw = 228, ch = 138;
    SKINS.forEach((s, i) => {
      const x = 28 + (i % cols) * (cw + 12), y = 152 + Math.floor(i / cols) * (ch + 10);
      const own = Meta.hasSkin(s.id), eq = Meta.data.skin === s.id;
      const rc = RARITY_COLOR[s.rarity];
      const bg = this.box(x, y, cw, ch, eq ? 0x13204a : 0x0a1230, eq ? 0x00f0ff : own ? 0x2f56ff : 0x1a2450, eq ? 3 : 2).setInteractive({ useHandCursor: true });
      const img = this.add.image(x + 54, y + 62, 'skin_' + s.id).setScale(Art.sc('skin_' + s.id, 2.3));
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

  // ======================================================================================= AJUSTES (engranaje)
  buildGear() {
    const W = CFG.W, x = W - 36, y = 30;
    const bg = this.add.circle(x, y, 20, 0x0a1230).setStrokeStyle(2, 0x2748ff).setInteractive({ useHandCursor: true });
    const g = this.add.graphics();
    g.fillStyle(0x9fc4ff, 1);
    for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; g.fillRect(x + Math.cos(a) * 11 - 2.5, y + Math.sin(a) * 11 - 2.5, 5, 5); }
    g.fillCircle(x, y, 9.5); g.fillStyle(0x0a1230, 1); g.fillCircle(x, y, 4);
    bg.on('pointerover', () => bg.setStrokeStyle(2, 0x00f0ff));
    bg.on('pointerout', () => bg.setStrokeStyle(2, 0x2748ff));
    bg.on('pointerdown', () => this.openSettings());
  }

  openSettings() {
    if (this.settingsUI || this.forging) return;
    this.stopEditing();
    const W = CFG.W, H = CFG.H, c = this.add.container(0, 0).setDepth(100);
    this.settingsUI = c;
    const bgBlock = this.add.rectangle(0, 0, W, H, 0x02030a, 0.86).setOrigin(0).setInteractive();
    c.add(bgBlock);
    const px = 212, py = 70, pw = 600, ph = 500;
    c.add(this.add.rectangle(px, py, pw, ph, 0x0a1230, 1).setOrigin(0).setStrokeStyle(3, 0x00f0ff));
    const T = (x, y, str, size = 14, color = '#9fc4ff', ex = {}) => { const t = this.add.text(x, y, str, Object.assign({ fontFamily: 'monospace', fontSize: size + 'px', color }, ex)); c.add(t); return t; };
    T(px + pw / 2, py + 24, 'AJUSTES', 28, '#00f0ff', { fontStyle: 'bold' }).setOrigin(0.5);

    const btn = (x, y, w, h, label, on, cb) => {
      const r = this.add.rectangle(x, y, w, h, on ? 0x13204a : 0x0a1230).setOrigin(0).setStrokeStyle(on ? 3 : 2, on ? 0x00f0ff : 0x2748ff).setInteractive({ useHandCursor: true });
      const t = this.add.text(x + w / 2, y + h / 2, label, { fontFamily: 'monospace', fontSize: '15px', color: on ? '#00f0ff' : '#9fc4ff', fontStyle: 'bold', align: 'center' }).setOrigin(0.5);
      r.on('pointerdown', cb); c.add([r, t]);
    };
    // idioma
    T(px + 30, py + 70, 'IDIOMA', 16, '#ffe94d');
    [['es', 'ESPAÑOL'], ['en', 'ENGLISH'], ['fr', 'FRANÇAIS']].forEach(([id, label], i) => btn(px + 30 + i * 182, py + 98, 170, 44, label, Settings.lang === id, () => { Settings.data.lang = id; Settings.save(); I18n.apply(); this.closeSettings(true); }));
    // volumen
    T(px + 30, py + 170, 'VOLUMEN', 16, '#ffe94d');
    const bx = px + 30, by = py + 206, bw = 460;
    const track = this.add.rectangle(bx, by, bw, 14, 0x08122e).setOrigin(0, 0.5).setStrokeStyle(2, 0x2748ff).setInteractive({ useHandCursor: true });
    const fill = this.add.rectangle(bx, by, bw * Settings.volume, 14, 0x00f0ff).setOrigin(0, 0.5);
    const knob = this.add.circle(bx + bw * Settings.volume, by, 11, 0xffffff).setStrokeStyle(3, 0x00f0ff);
    const pct = T(bx + bw + 14, by - 10, Math.round(Settings.volume * 100) + ' %', 16, '#ffffff');
    const setVol = px2 => { const v = Phaser.Math.Clamp((px2 - bx) / bw, 0, 1); Settings.data.volume = Math.round(v * 20) / 20; Settings.save(); fill.width = bw * Settings.volume; knob.x = bx + bw * Settings.volume; pct.setText(Math.round(Settings.volume * 100) + ' %'); };
    track.on('pointerdown', p => { setVol(p.x); this.beep(660); this.dragVol = true; });
    this.input.on('pointermove', p => { if (this.dragVol && p.isDown) setVol(p.x); });
    this.input.on('pointerup', () => { this.dragVol = false; });
    c.add([track, fill, knob]);
    // controles
    T(px + 30, py + 250, 'CONTROLES', 16, '#ffe94d');
    btn(px + 30, py + 278, 270, 52, 'ORDENADOR\nteclado y ratón', !Settings.mobile, () => { Settings.data.controls = 'pc'; Settings.save(); this.closeSettings(true); });
    btn(px + 312, py + 278, 258, 52, 'MÓVIL / TABLET\ntáctil con 2 joysticks', Settings.mobile, () => { Settings.data.controls = 'mobile'; Settings.save(); this.closeSettings(true); });
    T(px + 30, py + 346, Settings.mobile
      ? 'Modo móvil (incluye iPad): joystick izquierdo para moverte, joystick derecho para apuntar y disparar. Botones en pantalla para dash, habilidad, interactuar, pausa y mapa.'
      : 'Modo ordenador: WASD o flechas para moverte, ratón para apuntar y disparar, Espacio/Shift para el dash, Q o clic derecho para la habilidad, E para interactuar.', 12, '#9fc4ff', { wordWrap: { width: pw - 60 } });
    btn(px + pw / 2 - 90, py + ph - 70, 180, 44, 'CERRAR', false, () => this.closeSettings(false));
  }

  closeSettings(rebuild) {
    if (!this.settingsUI) return;
    this.settingsUI.destroy(); this.settingsUI = null; this.dragVol = false;
    if (rebuild) this.scene.restart();
  }

  // ======================================================================================= TIENDA > MATERIALES
  buildMaterials() {
    this.txt(740, 112, 'Con ellos el HERRERO\nfabrica tu armadura', 12, '#ffd23c');
    MATERIALS.forEach((m, i) => {
      const y = 152 + i * 110, have = Meta.data.materials[m.id];
      this.box(28, y, 968, 100, 0x0a1230, 0x2748ff);
      const icon = this.add.image(86, y + 50, 'mat_' + m.id).setScale(Art.sc('mat_' + m.id, 1.5)); this.content.add(icon);
      this.txt(150, y + 12, m.name, 20, this.hex(m.color), { fontStyle: 'bold' });
      this.txt(150, y + 42, `Nivel de protección x${m.tier}   ·   ${'★'.repeat(m.tier)}${'☆'.repeat(4 - m.tier)}`, 13, '#cffcff');
      this.txt(150, y + 66, `Precio: ${m.price} ¢ por unidad   ·   Tienes: ${have}`, 13, '#ffe94d');
      [1, 5, 10].forEach((q, j) => {
        const ok = Meta.data.coins >= m.price * q, x = 610 + j * 128;
        const b = this.box(x, y + 26, 118, 48, ok ? 0x14234f : 0x0a1230, ok ? 0x00f0ff : 0x2a3566).setInteractive({ useHandCursor: true });
        this.txt(x + 59, y + 40, `+${q}`, 16, ok ? '#00f0ff' : '#5a6490', { fontStyle: 'bold' }).setOrigin(0.5);
        this.txt(x + 59, y + 60, `${m.price * q} ¢`, 11, ok ? '#ffe94d' : '#8a6a6a').setOrigin(0.5);
        b.on('pointerdown', () => { if (Meta.buyMaterial(m.id, q)) { this.beep(720); this.rebuild(); } else this.beep(160); });
      });
    });
  }

  // ======================================================================================= HERRERO
  buildSmith() {
    const d = Meta.data;
    this.smithSay = this.smithSay || '¡Bienvenido a mi forja virtual! Dame materiales y dime qué pieza quieres. Cuanto mejor el material, más te protege.';
    // ---- el herrero ----
    this.box(24, 112, 244, 488, 0x0a1230, 0x2748ff);
    const sm = this.add.image(146, 372, 'smith').setScale(Art.sc('smith', 1.3));
    this.tweens.add({ targets: sm, alpha: 0.88, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    const anvil = this.add.image(200, 484, 'anvil').setScale(Art.sc('anvil', 1.0));
    this.arm = this.add.image(169, 336, 'smith_arm').setOrigin(12 / 90, 12 / 120).setScale(Art.sc('smith_arm', 1.3)).setRotation(-0.5);
    this.content.add([sm, anvil, this.arm]);
    this.anvilPos = { x: 212, y: 452 };
    this.box(36, 124, 220, 100, 0x05081a, 0x00f0ff, 1);
    this.bubble = this.txt(44, 130, this.smithSay, 12, '#cffcff', { wordWrap: { width: 204 } });
    this.box(40, 576, 212, 12, 0x08122e, 0x2748ff, 1);
    this.bar = this.add.rectangle(40, 576, 0, 12, 0x00f0ff).setOrigin(0); this.content.add(this.bar);

    // ---- piezas y materiales ----
    this.txt(276, 112, 'ARMADURA PERMANENTE', 14, '#ffe94d');
    ARMOR_SLOTS.forEach((sl, i) => {
      const y = 134 + i * 116, cur = d.armor[sl.id], curMat = Armor.mat(cur);
      this.box(276, y, 428, 108, 0x0a1230, 0x2748ff);
      const ic = this.add.image(318, y + 54, `ar_${sl.id}_${cur || 'none'}`).setScale(Art.sc(`ar_${sl.id}_${cur || 'none'}`, 1.15)); this.content.add(ic);
      this.txt(352, y + 10, sl.name, 16, '#ffffff', { fontStyle: 'bold' });
      this.txt(352, y + 32, curMat ? curMat.name : 'Sin pieza', 10, curMat ? this.hex(curMat.color) : '#6f86c9', { wordWrap: { width: 108 } });
      this.txt(352, y + 62, `Prot. ${Armor.pieceDef(sl.id, cur)}\nCuesta ${sl.cost} u.`, 10, '#9fc4ff');
      MATERIALS.forEach((m, j) => {
        const x = 464 + j * 59, have = d.materials[m.id], can = Armor.canForge(sl.id, m.id), worse = m.tier <= Armor.tierOf(sl.id);
        const b = this.box(x, y + 8, 54, 92, worse ? 0x070b1a : can ? 0x14234f : 0x0a1230, worse ? 0x1a2450 : can ? 0x5dff8a : 0x4a3a50).setInteractive({ useHandCursor: true });
        const mi = this.add.image(x + 27, y + 34, 'mat_' + m.id).setScale(Art.sc('mat_' + m.id, 0.78)); if (worse) mi.setAlpha(0.35); this.content.add(mi);
        this.txt(x + 27, y + 66, `${have}/${sl.cost}`, 11, worse ? '#3a4466' : can ? '#5dff8a' : '#ff8a9a').setOrigin(0.5);
        this.txt(x + 27, y + 82, worse ? 'ya' : 'x' + m.tier, 9, '#6f86c9').setOrigin(0.5);
        b.on('pointerdown', () => this.startForge(sl.id, m.id));
      });
    });

    // ---- tu personaje con la armadura puesta ----
    this.box(712, 112, 288, 488, 0x0a1230, 0x2748ff);
    const pkey = Art.playerKey(this, d.skin);
    const pv = this.add.image(856, 226, pkey).setScale(Art.sc(pkey, 4.2)); this.content.add(pv);
    this.previewPos = { x: 856, y: 226 };
    this.txt(856, 322, Meta.shown(), 15, '#ffffff', { fontStyle: 'bold' }).setOrigin(0.5);
    const pts = Armor.points(), red = Math.round(Armor.reduction() * 1000) / 10;
    this.txt(856, 346, `Protección: ${pts} puntos`, 13, '#5dff8a').setOrigin(0.5);
    this.txt(856, 366, `Daño recibido: -${red} %`, 13, '#5dff8a').setOrigin(0.5);
    this.txt(728, 398, 'TUS MATERIALES', 12, '#ffe94d');
    MATERIALS.forEach((m, i) => {
      const y = 420 + i * 36, im = this.add.image(750, y + 14, 'mat_' + m.id).setScale(Art.sc('mat_' + m.id, 0.62)); this.content.add(im);
      this.txt(778, y + 4, m.name, 12, this.hex(m.color));
      this.txt(976, y + 4, String(d.materials[m.id]), 14, '#ffffff', { fontStyle: 'bold' }).setOrigin(1, 0);
    });
    this.txt(728, 568, 'Compra materiales en la TIENDA', 11, '#6f86c9');
  }

  smithTalk(msg) { this.smithSay = msg; if (this.bubble && this.bubble.active) this.bubble.setText(msg); }

  startForge(slotId, matId) {
    if (this.forging) return;
    const sl = Armor.slot(slotId), m = Armor.mat(matId);
    if (m.tier <= Armor.tierOf(slotId)) { this.smithTalk(`Tu ${sl.name.toLowerCase()} ya es de ese material o mejor. Elige un material superior.`); this.beep(160); return; }
    if (!Armor.canForge(slotId, matId)) { this.smithTalk(`Te faltan materiales: ${sl.name.toLowerCase()} de ${m.name} necesita ${sl.cost} unidades. Cómpralas en la TIENDA.`); this.beep(160); return; }
    Meta.forgeStart(slotId, matId);                       // el herrero recibe los materiales
    this.forging = true;
    this.smithTalk(`Recibido: ${sl.cost} de ${m.name}. ¡Voy a forjar tu ${sl.name.toLowerCase()}!`);
    const ax = this.anvilPos.x, ay = this.anvilPos.y, col = m.color;
    // 1) los materiales vuelan al yunque
    for (let k = 0; k < 3; k++) {
      const mi = this.add.image(560 + k * 20, 330, 'mat_' + matId).setScale(Art.sc('mat_' + matId, 0.9)).setDepth(60);
      this.tweens.add({ targets: mi, x: ax + (k - 1) * 14, y: ay - 6, scale: Art.sc('mat_' + matId, 0.5), alpha: 0.2, duration: 650, delay: k * 120, ease: 'Cubic.easeIn', onComplete: () => mi.destroy() });
    }
    // 2) golpes de martillo con chispas y barra de progreso
    const STR = 6, STEP = 440;
    this.time.delayedCall(900, () => this.smithTalk('¡Clang! ¡Clang! Forjando…'));
    this.tweens.add({ targets: this.bar, width: 212, duration: STR * STEP, delay: 900, ease: 'Linear' });
    for (let k = 0; k < STR; k++) {
      this.time.delayedCall(900 + k * STEP, () => {
        if (!this.arm || !this.arm.active) return;
        this.tweens.add({ targets: this.arm, rotation: -1.05, duration: 170, ease: 'Sine.easeOut', onComplete: () => {
          if (!this.arm || !this.arm.active) return;
          this.tweens.add({ targets: this.arm, rotation: 0.1, duration: 110, ease: 'Cubic.easeIn', onComplete: () => { this.strike(ax, ay, col, k); } });
        } });
      });
    }
    // 3) entrega de la pieza
    this.time.delayedCall(900 + STR * STEP + 250, () => {
      if (!this.arm || !this.arm.active) { this.finishForge(slotId, matId); return; }
      this.tweens.add({ targets: this.arm, rotation: -0.5, duration: 300 });
      const fl = this.add.circle(ax, ay - 10, 8, 0xffffff, 0.9).setBlendMode(Phaser.BlendModes.ADD).setDepth(60);
      this.tweens.add({ targets: fl, radius: 70, alpha: 0, duration: 420, onComplete: () => fl.destroy() });
      this.beep(990);
      const piece = this.add.image(ax, ay - 20, `ar_${slotId}_${matId}`).setScale(0).setDepth(61);
      this.tweens.add({ targets: piece, scale: Art.sc(`ar_${slotId}_${matId}`, 1.9), duration: 260, ease: 'Back.easeOut', onComplete: () => {
        this.smithTalk(`¡Listo! Aquí tienes tu ${sl.name.toLowerCase()} de ${m.name}. ¡Te sienta genial!`);
        this.tweens.add({ targets: piece, x: this.previewPos.x, y: this.previewPos.y, scale: Art.sc(`ar_${slotId}_${matId}`, 0.9), duration: 700, delay: 350, ease: 'Cubic.easeInOut', onComplete: () => { piece.destroy(); this.finishForge(slotId, matId); } });
      } });
    });
  }

  strike(x, y, col, k) {
    this.beep(180 + (k % 3) * 40); this.cameras.main.shake(70, 0.003);
    for (let i = 0; i < 12; i++) {
      const sp = this.add.image(x, y, 'spark').setBlendMode(Phaser.BlendModes.ADD).setTint(i % 3 ? col : 0xffe9a0).setScale(0.5 + Math.random()).setDepth(60);
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.6, v = 40 + Math.random() * 90;
      this.tweens.add({ targets: sp, x: x + Math.cos(a) * v, y: y + Math.sin(a) * v + 24, alpha: 0, duration: 420, ease: 'Quad.easeOut', onComplete: () => sp.destroy() });
    }
  }

  finishForge(slotId, matId) {
    Meta.forgeFinish(slotId, matId);
    this.forging = false;
    this.smithSay = `¡Listo! Pieza equipada: ${Armor.slot(slotId).name.toLowerCase()} de ${Armor.mat(matId).name}. ¿Algo más?`;
    this.rebuild();
  }
}
