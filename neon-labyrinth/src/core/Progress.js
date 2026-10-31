/**
 * Progreso persistente: skins (solo estéticas), dificultades, cofres de jefe y misiones.
 * Todo se guarda a través de `Meta` (localStorage).
 */

/** Skins: solo cambian el aspecto del jugador, nunca las estadísticas. */
const SKINS = [
  { id: 'operator',  name: 'Operador',      price: 0,   rarity: 'común',      color: 0x00f0ff },
  { id: 'virus',     name: 'Virus',         price: 250, rarity: 'común',      color: 0x9b5cff },
  { id: 'pirate',    name: 'Pirata',        price: 350, rarity: 'común',      color: 0xff4466 },
  { id: 'viking',    name: 'Vikingo',       price: 350, rarity: 'común',      color: 0xff9a3c },
  { id: 'robot',     name: 'Robot',         price: 300, rarity: 'común',      color: 0xc0c8ff },
  { id: 'ninja',     name: 'Ninja',         price: 500, rarity: 'rara',       color: 0xff2244 },
  { id: 'astronaut', name: 'Astronauta',    price: 500, rarity: 'rara',       color: 0xffe94d },
  { id: 'alien',     name: 'Alien',         price: 600, rarity: 'rara',       color: 0x5dff8a },
  { id: 'skull',     name: 'Esqueleto',     price: 800, rarity: 'épica',      color: 0xffffff },
  { id: 'samurai',   name: 'Samurái',       price: 900, rarity: 'épica',      color: 0xff4466 },
  { id: 'wizard',    name: 'Mago',          price: 900, rarity: 'épica',      color: 0x9b5cff },
  { id: 'golden',    name: 'Titán dorado',  price: 0,   rarity: 'legendaria', color: 0xffd23c, chestOnly: true },
];
const RARITY_COLOR = { 'común': 0x9fc4ff, 'rara': 0x5dff8a, 'épica': 0xff2bd6, 'legendaria': 0xffd23c };

/** Dificultades: escalan a los enemigos y las recompensas. `chest` sube o baja la calidad del cofre del jefe. */
const DIFFICULTIES = [
  { id: 'easy',   name: 'FÁCIL',   color: 0x5dff8a, hp: 0.75, count: 0.8,  speed: 0.92, elite: 0.5, dmg: 1,   reward: 0.7, chest: -1, desc: 'Menos enemigos y más débiles. Recompensas x0,7.' },
  { id: 'normal', name: 'NORMAL',  color: 0x00f0ff, hp: 1,    count: 1,    speed: 1,    elite: 1,   dmg: 1,   reward: 1,   chest: 0,  desc: 'La experiencia equilibrada. Recompensas x1.' },
  { id: 'hard',   name: 'DIFÍCIL', color: 0xff4466, hp: 1.45, count: 1.3,  speed: 1.1,  elite: 2,   dmg: 1.5, reward: 1.7, chest: 1,  desc: 'Enemigos con +45 % de vida y +50 % de daño, más numerosos. Tu vida no cambia. Recompensas x1,7.' },
];

const CHEST_TIERS = [
  { name: 'Bronce', color: 0xcd7f32 },
  { name: 'Plata',  color: 0xc0c8d8 },
  { name: 'Oro',    color: 0xffd23c },
];

const ENEMY_LABEL = {
  grunt: 'Virus', shooter: 'Centinelas', summoner: 'Invocadores', sniper: 'Francotiradores', tank: 'Blindados',
  bomber: 'Bombas lógicas', blinker: 'Espectros', splitter: 'Fractales', turret: 'Torretas', drone: 'Drones',
};

/** Cofres: devuelven la lista de premios y los aplican al guardado. */
const Chests = {
  open(tier, rng = Math.random) {
    tier = Math.max(1, Math.min(3, tier));
    const int = (a, b) => a + Math.floor(rng() * (b - a + 1));
    const d = Meta.data, out = [];
    const coins = int(...[[30, 60], [70, 130], [150, 260]][tier - 1]);
    d.coins += coins; out.push({ kind: 'coins', amount: coins, label: `${coins} monedas` });
    const frag = int(...[[8, 16], [20, 40], [45, 90]][tier - 1]);
    d.fragments += frag; out.push({ kind: 'frag', amount: frag, label: `${frag} Fragmentos de Núcleo` });
    for (let i = 0; i < tier; i++) {                                    // premios extra: 1 / 2 / 3
      const r = rng();
      const pSkin = [0.12, 0.26, 0.4][tier - 1], pUp = [0.18, 0.32, 0.45][tier - 1];
      if (r < pSkin) {
        let pool = SKINS.filter(s => !s.chestOnly && !Meta.hasSkin(s.id));
        if (tier === 3 && !Meta.hasSkin('golden') && rng() < 0.25) pool = [SKINS.find(s => s.id === 'golden')];
        if (pool.length) { const s = pool[Math.floor(rng() * pool.length)]; d.skins.push(s.id); out.push({ kind: 'skin', id: s.id, label: `Skin: ${s.name} (${s.rarity})` }); continue; }
      } else if (r < pSkin + pUp) {
        const pool = UPGRADES.filter(u => Meta.level(u.id) < u.max && (!u.req || Meta.level(u.req) >= 1));
        if (pool.length) { const u = pool[Math.floor(rng() * pool.length)]; d.upgrades[u.id] = Meta.level(u.id) + 1; out.push({ kind: 'upgrade', id: u.id, label: `Mejora permanente: ${u.name} (Nv ${d.upgrades[u.id]})` }); continue; }
      }
      const extra = int(...[[15, 30], [35, 70], [80, 140]][tier - 1]);
      d.coins += extra; out.push({ kind: 'coins', amount: extra, label: `${extra} monedas extra` });
    }
    d.totals.chests++;
    Meta.save();
    return out;
  },
};

/** Misiones: 3 activas a la vez; el progreso cuenta entre partidas. */
const Missions = {
  GEN: {
    kill_any: () => { const n = 25 + 5 * Math.floor(Math.random() * 8); return { target: n, text: `Elimina ${n} enemigos`, reward: { coins: 40 + n * 2 } }; },
    kill_type: () => {
      const type = ['grunt', 'shooter', 'summoner', 'sniper', 'tank', 'bomber', 'blinker', 'splitter'][Math.floor(Math.random() * 8)];
      const n = 5 + Math.floor(Math.random() * 6);
      return { target: n, text: `Elimina ${n} ${ENEMY_LABEL[type]}`, extra: { type }, reward: { coins: 30 + n * 6 } };
    },
    rooms: () => { const n = 4 + Math.floor(Math.random() * 7); return { target: n, text: `Limpia ${n} salas`, reward: { coins: 30 + n * 8 } }; },
    boss: () => { const n = 1 + Math.floor(Math.random() * 2); return { target: n, text: n === 1 ? 'Derrota a un jefe' : `Derrota a ${n} jefes`, reward: { frag: 20 * n, chest: 1 } }; },
    elite: () => { const n = 2 + Math.floor(Math.random() * 3); return { target: n, text: `Elimina ${n} élites`, reward: { coins: 60 + n * 20, frag: 10 } }; },
    ability: () => { const n = 4 + Math.floor(Math.random() * 7); return { target: n, text: `Usa tu habilidad ${n} veces`, reward: { coins: 40 + n * 5 } }; },
    coins: () => { const n = 30 + 10 * Math.floor(Math.random() * 6); return { target: n, text: `Recoge ${n} créditos en partidas`, reward: { coins: 40 + n } }; },
    floor: () => { const n = 2 + Math.floor(Math.random() * 12); return { target: n, text: `Llega a la planta ${n}`, reward: { coins: n * 50, frag: n * 8 } }; },
    upgrade: () => { const n = 5 + Math.floor(Math.random() * 6); return { target: n, text: `Elige ${n} mejoras de sala`, reward: { coins: 40 + n * 6 } }; },
    win: () => { const diff = 1 + Math.floor(Math.random() * 2); return { target: 1, text: `Completa una partida en ${DIFFICULTIES[diff].name}`, extra: { diff }, reward: { frag: 40 * (diff + 1), chest: diff + 1 } }; },
  },

  /** Rellena hasta 3 misiones activas, sin repetir plantilla ni tipo de enemigo. */
  ensure() {
    const list = Meta.data.missions;
    const keys = Object.keys(this.GEN);
    let guard = 0;
    while (list.length < 3 && guard++ < 40) {
      const tpl = keys[Math.floor(Math.random() * keys.length)];
      const m = this.GEN[tpl]();
      if (list.some(x => x.tpl === tpl && (!m.extra || !x.extra || x.extra.type === m.extra.type))) continue;
      list.push(Object.assign({ tpl, progress: 0, done: false }, m));
    }
  },

  /** Suma progreso: kind = kill | room | boss | ability | coins | upgrade | floor | win. */
  track(kind, n = 1, info = {}) {
    let changed = false;
    for (const m of Meta.data.missions) {
      if (m.done) continue;
      let add = 0;
      switch (m.tpl) {
        case 'kill_any': if (kind === 'kill') add = n; break;
        case 'kill_type': if (kind === 'kill' && info.type === m.extra.type) add = n; break;
        case 'elite': if (kind === 'kill' && info.elite) add = n; break;
        case 'rooms': if (kind === 'room') add = n; break;
        case 'boss': if (kind === 'boss') add = n; break;
        case 'ability': if (kind === 'ability') add = n; break;
        case 'coins': if (kind === 'coins') add = n; break;
        case 'upgrade': if (kind === 'upgrade') add = n; break;
        case 'win': if (kind === 'win' && info.diff >= m.extra.diff) add = n; break;
        case 'floor': if (kind === 'floor' && n > m.progress) { m.progress = Math.min(m.target, n); changed = true; } break;
      }
      if (add) { m.progress = Math.min(m.target, m.progress + add); changed = true; }
      if (m.progress >= m.target && !m.done) { m.done = true; Bus.emit('mission:done', { mission: m }); }
    }
    if (changed) Meta.save();
  },

  /** Cobra una misión completada y la sustituye por otra nueva. Devuelve lo recibido. */
  claim(index) {
    const m = Meta.data.missions[index];
    if (!m || !m.done) return null;
    const res = { coins: 0, frag: 0, chest: null };
    if (m.reward.coins) { Meta.data.coins += m.reward.coins; res.coins = m.reward.coins; }
    if (m.reward.frag) { Meta.data.fragments += m.reward.frag; res.frag = m.reward.frag; }
    if (m.reward.chest) res.chest = { tier: m.reward.chest, items: Chests.open(m.reward.chest) };
    Meta.data.missions.splice(index, 1);
    this.ensure();
    Meta.save();
    return res;
  },
};


/**
 * Armadura permanente: 4 piezas x 4 materiales virtuales. Se mezclan libremente.
 * Los materiales se compran en la TIENDA; el HERRERO fabrica la pieza (cuesta más material la pechera que las botas).
 * Protección: puntos = puntos de la pieza x nivel del material; cada punto reduce un 1,5 % el daño recibido.
 */
const MATERIALS = [
  { id: 'leather', name: 'Cuero polimérico',  tier: 1, price: 12,  color: 0xb5753a },
  { id: 'iron',    name: 'Hierro binario',    tier: 2, price: 30,  color: 0xaab4c8 },
  { id: 'gold',    name: 'Oro cifrado',       tier: 3, price: 70,  color: 0xffd23c },
  { id: 'diamond', name: 'Diamante cuántico', tier: 4, price: 160, color: 0x7fe9ff },
];
const ARMOR_SLOTS = [
  { id: 'helmet', name: 'Casco',      cost: 5, pts: 1.5 },
  { id: 'chest',  name: 'Pechera',    cost: 8, pts: 3 },
  { id: 'pants',  name: 'Pantalones', cost: 6, pts: 2 },
  { id: 'boots',  name: 'Botas',      cost: 4, pts: 1 },
];

const Armor = {
  mat(id) { return MATERIALS.find(m => m.id === id) || null; },
  slot(id) { return ARMOR_SLOTS.find(s => s.id === id); },
  tierOf(slotId) { const m = this.mat(Meta.data.armor[slotId]); return m ? m.tier : 0; },
  /** Puntos de protección de una pieza con ese material. */
  pieceDef(slotId, matId) { const m = this.mat(matId); return m ? this.slot(slotId).pts * m.tier : 0; },
  points() { return ARMOR_SLOTS.reduce((a, s) => a + this.pieceDef(s.id, Meta.data.armor[s.id]), 0); },
  /** Fracción de daño que se evita (0..0,45 con todo de diamante). */
  reduction() { return Math.min(0.6, this.points() * 0.015); },
  /** Firma de lo equipado: sirve de nombre de la textura compuesta del jugador. */
  signature() { return ARMOR_SLOTS.map(s => (Meta.data.armor[s.id] || '-')[0]).join(''); },
  /** ¿Se puede fabricar esa pieza con ese material? (debe mejorar lo que ya llevas) */
  canForge(slotId, matId) {
    const m = this.mat(matId), s = this.slot(slotId);
    return !!(m && s && m.tier > this.tierOf(slotId) && Meta.data.materials[matId] >= s.cost);
  },
};
