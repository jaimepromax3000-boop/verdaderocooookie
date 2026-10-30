/**
 * MenuScene: pantalla de título, selección de personaje y árbol de habilidades permanente
 * (se compra con "Fragmentos de Núcleo", la divisa que se conserva al morir).
 */
class MenuScene extends Phaser.Scene {
  constructor() { super('MenuScene'); }

  create() {
    this.selected = Math.min(MenuScene.lastChar || 0, CHARACTERS.length - 1);
    const W = CFG.W, H = CFG.H;
    this.add.rectangle(W / 2, H / 2, W, H, 0x04060f);
    this.drawGrid();

    const title = this.add.text(W / 2, 54, 'NEON LABYRINTH', { fontFamily: 'monospace', fontSize: '52px', color: '#00f0ff', fontStyle: 'bold', stroke: '#ff2bd6', strokeThickness: 2 }).setOrigin(0.5);
    this.tweens.add({ targets: title, alpha: 0.82, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.add.text(W / 2, 96, 'Infíltrate en los servidores de la megacorporación  ·  roguelike de acción', { fontFamily: 'monospace', fontSize: '14px', color: '#8ab4ff' }).setOrigin(0.5);

    // --- selección de personaje ---
    this.add.text(40, 132, '1 · ELIGE PERSONAJE', { fontFamily: 'monospace', fontSize: '16px', color: '#ffe94d' });
    this.cards = [];
    CHARACTERS.forEach((c, i) => {
      const x = 40 + i * 152, y = 160;
      const bg = this.add.rectangle(x, y, 142, 190, 0x0a1230).setOrigin(0).setStrokeStyle(2, 0x2748ff).setInteractive({ useHandCursor: true });
      const ship = this.add.image(x + 71, y + 56, 'player').setTint(c.color).setScale(2);
      this.add.text(x + 71, y + 104, c.name, { fontFamily: 'monospace', fontSize: '13px', color: '#ffffff', align: 'center', wordWrap: { width: 130 } }).setOrigin(0.5, 0);
      this.add.text(x + 71, y + 140, `♥ ${c.hp + Meta.level('hp')}  ◈ ${c.shield + Meta.level('shield')}\n${c.desc}`, { fontFamily: 'monospace', fontSize: '11px', color: '#9fc4ff', align: 'center', wordWrap: { width: 130 } }).setOrigin(0.5, 0);
      bg.on('pointerdown', () => { this.selected = i; this.refreshCards(); });
      this.cards.push({ bg, ship, c });
    });
    this.refreshCards();

    // --- controles ---
    this.add.text(40, 376, 'CONTROLES', { fontFamily: 'monospace', fontSize: '16px', color: '#ffe94d' });
    this.add.text(40, 402,
      'WASD / flechas  mover\nRatón            apuntar y disparar (mantén pulsado)\nEspacio / Shift  dash con invulnerabilidad\nE                recoger, comprar, usar el portal\nESC              pausa\n\nLimpia cada sala para abrir sus puertas.\nLa sala con llave guarda un tesoro oculto.\nCombina módulos: ¡las sinergias son el truco!',
      { fontFamily: 'monospace', fontSize: '13px', color: '#9fc4ff', lineSpacing: 3 });

    // --- árbol de habilidades ---
    this.add.text(520, 132, '2 · HABILIDADES PERMANENTES', { fontFamily: 'monospace', fontSize: '16px', color: '#ffe94d' });
    this.fragText = this.add.text(990, 132, '', { fontFamily: 'monospace', fontSize: '16px', color: '#5dff8a' }).setOrigin(1, 0);
    this.nodes = [];
    this.tip = this.add.text(520, 520, '', { fontFamily: 'monospace', fontSize: '13px', color: '#cffcff', wordWrap: { width: 470 } });
    const g = this.add.graphics();
    this.treeGfx = g;
    UPGRADES.forEach(u => {
      const x = 520 + u.pos[0] * 160, y = 162 + u.pos[1] * 84;
      const bg = this.add.rectangle(x, y, 148, 70, 0x0a1230).setOrigin(0).setInteractive({ useHandCursor: true });
      const name = this.add.text(x + 74, y + 8, u.name, { fontFamily: 'monospace', fontSize: '12px', color: '#ffffff', align: 'center', wordWrap: { width: 140 } }).setOrigin(0.5, 0);
      const info = this.add.text(x + 74, y + 40, '', { fontFamily: 'monospace', fontSize: '12px', color: '#5dff8a', align: 'center' }).setOrigin(0.5, 0);
      bg.on('pointerdown', () => { if (Meta.buy(u)) { this.sfxBeep(660); this.refreshTree(); } else this.sfxBeep(160); });
      bg.on('pointerover', () => { this.tip.setText(`${u.name}: ${u.desc}${u.req ? '   (requiere: ' + UPGRADES.find(x2 => x2.id === u.req).name + ')' : ''}`); });
      this.nodes.push({ u, bg, name, info, x, y });
    });
    this.refreshTree();

    // --- botones ---
    const start = this.add.rectangle(W / 2 + 120, 596, 330, 44, 0x00f0ff, 0.15).setStrokeStyle(2, 0x00f0ff).setInteractive({ useHandCursor: true });
    this.add.text(W / 2 + 120, 596, 'INICIAR INCURSIÓN  [Enter]', { fontFamily: 'monospace', fontSize: '20px', color: '#00f0ff', fontStyle: 'bold' }).setOrigin(0.5);
    start.on('pointerdown', () => this.startRun());
    this.input.keyboard.on('keydown-ENTER', () => this.startRun());
    this.add.text(40, 610, `Mejor planta: ${Meta.data.bestFloor}   Salas limpiadas (récord): ${Meta.data.bestRooms}   Victorias: ${Meta.data.wins}`, { fontFamily: 'monospace', fontSize: '12px', color: '#6f86c9' });
    const reset = this.add.text(500, 618, '[borrar progreso]', { fontFamily: 'monospace', fontSize: '11px', color: '#6a3a46' }).setInteractive({ useHandCursor: true });
    reset.on('pointerdown', () => { if (reset.confirm) { Meta.reset(); this.scene.restart(); } else { reset.confirm = true; reset.setText('[¿seguro? pulsa otra vez]').setColor('#ff4466'); } });
  }

  drawGrid() {
    const g = this.add.graphics();
    g.lineStyle(1, 0x0d1840, 0.8);
    for (let x = 0; x < CFG.W; x += 32) g.lineBetween(x, 0, x, CFG.H);
    for (let y = 0; y < CFG.H; y += 32) g.lineBetween(0, y, CFG.W, y);
  }

  refreshCards() {
    this.cards.forEach((k, i) => {
      const on = i === this.selected;
      k.bg.setStrokeStyle(on ? 3 : 2, on ? k.c.color : 0x2748ff).setFillStyle(on ? 0x13204a : 0x0a1230);
      k.ship.setScale(on ? 2.3 : 2);
    });
  }

  refreshTree() {
    this.fragText.setText('Fragmentos de Núcleo: ' + Meta.data.fragments);
    const g = this.treeGfx;
    g.clear();
    for (const n of this.nodes) {                       // líneas de dependencia
      if (!n.u.req) continue;
      const p = this.nodes.find(m => m.u.id === n.u.req);
      g.lineStyle(2, Meta.level(n.u.req) ? 0x2748ff : 0x1a2450, 1);
      g.lineBetween(p.x + 74, p.y + 70, n.x + 74, n.y);
    }
    for (const n of this.nodes) {
      const lv = Meta.level(n.u.id), maxed = lv >= n.u.max;
      const locked = n.u.req && Meta.level(n.u.req) < 1;
      const can = Meta.canBuy(n.u);
      n.bg.setFillStyle(maxed ? 0x103a22 : can ? 0x14234f : 0x0a1230).setStrokeStyle(2, maxed ? 0x5dff8a : can ? 0x00f0ff : locked ? 0x1a2450 : 0x2748ff);
      n.name.setColor(locked ? '#4a5a8a' : '#ffffff');
      n.info.setText(maxed ? `NIVEL ${lv}/${n.u.max} · MAX` : `Nv ${lv}/${n.u.max} · ${n.u.cost[lv]} ◆`).setColor(maxed ? '#5dff8a' : can ? '#00f0ff' : '#8a6a6a');
    }
  }

  sfxBeep(freq) {
    try {
      const ctx = this.sound.context;
      if (!ctx) return;
      const o = ctx.createOscillator(), gn = ctx.createGain();
      o.type = 'square'; o.frequency.value = freq; gn.gain.value = 0.04;
      o.connect(gn); gn.connect(ctx.destination); o.start(); o.stop(ctx.currentTime + 0.08);
    } catch (e) { /* sin audio */ }
  }

  startRun() {
    MenuScene.lastChar = this.selected;
    this.scene.start('GameScene', { character: CHARACTERS[this.selected].id });
  }
}
