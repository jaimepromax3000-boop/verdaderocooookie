/**
 * Configuración global, personajes, armas iniciales y metaprogresión (guardado en localStorage).
 */
const CFG = {
  W: 1024, H: 640,          // tamaño del lienzo
  T: 32,                    // tamaño de baldosa
  RW: 30, RH: 17,           // baldosas por sala (960 x 544)
  OX: 32, OY: 64,           // desplazamiento de la sala en pantalla (arriba queda el HUD)
  FLOORS: 10,               // plantas del servidor (la última tiene el jefe final)
  COL: { cyan: 0x00f0ff, magenta: 0xff2bd6, yellow: 0xffe94d, green: 0x5dff8a, red: 0xff4466, orange: 0xff9a3c, violet: 0x9b5cff, white: 0xffffff },
};

/** Personajes seleccionables en el menú. Cada uno tiene una habilidad activa (tecla Q o clic derecho). */
const CHARACTERS = [
  { id: 'hacker', name: 'Estándar', desc: 'Equilibrada.', color: 0x00f0ff, wp: 'wp_hacker', hp: 6, shield: 1, speed: 1.0, damage: 1.0,
    ability: { id: 'emp', name: 'Pulso EMP', cd: 9, desc: 'Borra balas y aturde a los enemigos cercanos.' } },
  { id: 'ghost',  name: 'Ligero',           desc: 'Rápida y frágil.', color: 0xff2bd6, wp: 'wp_ghost', hp: 4, shield: 1, speed: 1.2, damage: 1.0,
    ability: { id: 'phase', name: 'Fase espectral', cd: 10, desc: '2,5 s intangible y rápido, con estela de fuego.' } },
  { id: 'daemon', name: 'Pesado',           desc: 'Resistente y lenta.', color: 0xffe94d, wp: 'wp_daemon', hp: 8, shield: 0, speed: 0.88, damage: 1.1,
    ability: { id: 'swarm', name: 'Enjambre', cd: 12, desc: '3 satélites orbitan 8 s: dañan y bloquean balas.' } },
];

/** Biomas: uno por planta. Definen la paleta de suelos, paredes, obstáculos y fondo. */
const THEMES = [
  { name: 'SERVIDORES',    floor: 0x070b1a, grid: 0x12204a, dot: 0x0e1a3d, wall: 0x0b1030, edge: 0x2748ff, edge2: 0x00f0ff, obs: 0x1b0b2e, obsEdge: 0xff2bd6, bg: 0x03040c, accent: 0x00f0ff },
  { name: 'RED NEURONAL',  floor: 0x0d0716, grid: 0x2a1250, dot: 0x24103f, wall: 0x1a0a30, edge: 0x9b5cff, edge2: 0xff2bd6, obs: 0x2a0a22, obsEdge: 0xffe94d, bg: 0x07030c, accent: 0xff2bd6 },
  { name: 'NÚCLEO CENTRAL', floor: 0x140806, grid: 0x3a1608, dot: 0x2a1008, wall: 0x240c08, edge: 0xff9a3c, edge2: 0xff4466, obs: 0x1a0a0a, obsEdge: 0xffe94d, bg: 0x0a0302, accent: 0xff9a3c },
  { name: 'CIUDAD NEÓN',   floor: 0x06121a, grid: 0x0f3a4a, dot: 0x0b2a38, wall: 0x0a1e2a, edge: 0x00ffd0, edge2: 0xff2bd6, obs: 0x201030, obsEdge: 0x00ffd0, bg: 0x02080c, accent: 0x00ffd0 },
  { name: 'OCÉANO DE DATOS', floor: 0x04101c, grid: 0x0c3052, dot: 0x0a2640, wall: 0x081c34, edge: 0x3c8cff, edge2: 0x7fe9ff, obs: 0x0a1f3a, obsEdge: 0x5dff8a, bg: 0x020813, accent: 0x3c8cff },
  { name: 'EL VACÍO',      floor: 0x0a0a10, grid: 0x22224a, dot: 0x181838, wall: 0x12122a, edge: 0x9b5cff, edge2: 0xffe94d, obs: 0x1a1030, obsEdge: 0xffffff, bg: 0x040408, accent: 0xc9a6ff },
];

/** Armas básicas que se eligen en la sala segura al empezar cada incursión. */
const WEAPONS = {
  pulse:   { id: 'pulse',   name: 'Pulso',     desc: 'Cadencia alta, daño medio.', rate: 4.2, damage: 1.0, speed: 560, pellets: 1, spread: 0.03, life: 1.1, pierce: 0, size: 1.0, color: 0x00f0ff },
  scatter: { id: 'scatter', name: 'Dispersor', desc: 'Ráfaga de 5 perdigones.', rate: 1.5, damage: 0.55, speed: 480, pellets: 5, spread: 0.55, life: 0.55, pierce: 0, size: 0.85, color: 0xff9a3c },
  rail:    { id: 'rail',    name: 'Lanza Riel', desc: 'Lenta, atraviesa enemigos.', rate: 0.95, damage: 3.2, speed: 900, pellets: 1, spread: 0.0, life: 1.0, pierce: 3, size: 1.5, color: 0xff2bd6 },
};

/** Árbol de habilidades permanentes (se compran con Fragmentos de Núcleo). */
const UPGRADES = [
  { id: 'hp',      name: 'Núcleo reforzado',   desc: '+1 vida máxima',            max: 3, cost: [15, 30, 60],  req: null,      pos: [0, 0] },
  { id: 'shield',  name: 'Barrera latente',    desc: '+1 escudo',                 max: 2, cost: [25, 55],      req: 'hp',      pos: [0, 1] },
  { id: 'regen',   name: 'Autorreparación',    desc: 'El escudo se recarga antes', max: 2, cost: [30, 60],     req: 'shield',  pos: [0, 2] },
  { id: 'dmg',     name: 'Compilador agresivo', desc: '+10 % de daño',            max: 3, cost: [20, 40, 80],  req: null,      pos: [1, 0] },
  { id: 'dash',    name: 'Salto de fase',      desc: '-12 % enfriamiento del dash', max: 3, cost: [20, 40, 70], req: 'dmg',    pos: [1, 1] },
  { id: 'ability', name: 'Núcleo recargable',  desc: '-12 % enfriamiento de la habilidad (Q)', max: 3, cost: [25, 50, 90], req: 'dash', pos: [1, 2] },
  { id: 'speed',   name: 'Overclock motor',    desc: '+6 % de velocidad',         max: 3, cost: [15, 35, 65],  req: null,      pos: [2, 0] },
  { id: 'credits', name: 'Fondos opacos',      desc: '+15 créditos iniciales',    max: 3, cost: [15, 30, 55],  req: 'speed',   pos: [2, 1] },
  { id: 'key',     name: 'Llave maestra',     desc: 'Empiezas con 1 llave',       max: 1, cost: [60],          req: 'credits', pos: [2, 2] },
  { id: 'luck',    name: 'Suerte de sistema',  desc: 'Más recompensas',           max: 2, cost: [40, 90],      req: 'key',     pos: [2, 3] },
];

/** Metaprogresión persistente: divisa "Fragmentos de Núcleo" y mejoras compradas. */
const Meta = {
  KEY: 'neon-labyrinth-save-v1',
  defaults() {
    return {
      fragments: 0, coins: 0, upgrades: {}, bestFloor: 0, bestRooms: 0, runs: 0, wins: 0,
      name: 'Operador', skin: 'operator', skins: ['operator'], loadout: 'hacker', difficulty: 1,
      missions: [], totals: { kills: 0, rooms: 0, bosses: 0, chests: 0 },
      materials: { leather: 0, iron: 0, gold: 0, diamond: 0 },
      armor: { helmet: null, chest: null, pants: null, boots: null },
    };
  },
  data: null,

  load() {
    this.data = this.defaults();
    try {
      const raw = localStorage.getItem(this.KEY);
      if (raw) this.data = Object.assign(this.data, JSON.parse(raw));
    } catch (e) { /* localStorage no disponible: se juega sin guardar */ }
    const d = this.data;
    if (!Array.isArray(d.skins) || !d.skins.includes('operator')) d.skins = ['operator'].concat(d.skins || []);
    if (!d.skins.includes(d.skin)) d.skin = 'operator';
    if (!Array.isArray(d.missions)) d.missions = [];
    if (!d.totals) d.totals = { kills: 0, rooms: 0, bosses: 0, chests: 0 };
    d.materials = Object.assign({ leather: 0, iron: 0, gold: 0, diamond: 0 }, d.materials || {});
    d.armor = Object.assign({ helmet: null, chest: null, pants: null, boots: null }, d.armor || {});
    if (typeof Missions !== 'undefined') Missions.ensure();
  },

  save() {
    try { localStorage.setItem(this.KEY, JSON.stringify(this.data)); } catch (e) { /* ignorar */ }
  },

  /** Compra materiales con monedas. */
  buyMaterial(id, qty) {
    const m = MATERIALS.find(x => x.id === id), cost = m ? m.price * qty : 0;
    if (!m || qty < 1 || this.data.coins < cost) return false;
    this.data.coins -= cost; this.data.materials[id] += qty; this.save();
    return true;
  },

  /** El herrero recibe los materiales (se gastan ya); la pieza se entrega al acabar la animación. */
  forgeStart(slotId, matId) {
    if (!Armor.canForge(slotId, matId)) return false;
    this.data.materials[matId] -= Armor.slot(slotId).cost;
    this.save();
    return true;
  },

  forgeFinish(slotId, matId) { this.data.armor[slotId] = matId; this.save(); },

  /** Fabricación inmediata (sin animación). */
  forge(slotId, matId) {
    if (!this.forgeStart(slotId, matId)) return false;
    this.forgeFinish(slotId, matId);
    return true;
  },

  addCoins(n) { this.data.coins += Math.max(0, Math.round(n)); this.save(); },

  setName(n) {
    n = String(n || '').replace(/[^\wÁÉÍÓÚÜÑáéíóúüñ \-]/g, '').trim().slice(0, 14);
    this.data.name = n || 'Operador';
    this.save();
  },

  /** Nombre del jugador marcado para que el traductor no lo toque. */
  shown() { return '\u2060' + this.data.name; },

  hasSkin(id) { return this.data.skins.includes(id); },

  buySkin(id) {
    const s = SKINS.find(k => k.id === id);
    if (!s || this.hasSkin(id) || s.chestOnly || this.data.coins < s.price) return false;
    this.data.coins -= s.price; this.data.skins.push(id); this.save();
    return true;
  },

  equipSkin(id) { if (this.hasSkin(id)) { this.data.skin = id; this.save(); } },

  level(id) { return this.data.upgrades[id] || 0; },

  /** ¿Se puede comprar la siguiente mejora de este nodo? */
  canBuy(u) {
    const lv = this.level(u.id);
    if (lv >= u.max) return false;
    if (u.req && this.level(u.req) < 1) return false;
    return this.data.fragments >= u.cost[lv];
  },

  buy(u) {
    if (!this.canBuy(u)) return false;
    this.data.fragments -= u.cost[this.level(u.id)];
    this.data.upgrades[u.id] = this.level(u.id) + 1;
    this.save();
    return true;
  },

  addFragments(n) {
    this.data.fragments += n;
    this.save();
  },

  reset() {
    this.data = this.defaults();
    if (typeof Missions !== 'undefined') Missions.ensure();
    this.save();
  },
};

/** Ajustes del jugador: idioma, volumen y tipo de controles (se guardan aparte del progreso). */
const Settings = {
  KEY: 'neon-labyrinth-settings',
  data: { lang: 'es', volume: 0.7, controls: 'pc' },
  load() {
    let raw = null;
    try { raw = localStorage.getItem(this.KEY); } catch (e) { /* sin almacenamiento */ }
    if (raw) { try { Object.assign(this.data, JSON.parse(raw)); } catch (e) { /* ajustes corruptos */ } return; }
    // primera vez: idioma del navegador y controles táctiles si el dispositivo no tiene ratón
    const nl = (navigator.language || 'es').slice(0, 2);
    if (nl === 'en' || nl === 'fr') this.data.lang = nl;
    try { if (('ontouchstart' in window || navigator.maxTouchPoints > 0) && !(window.matchMedia && matchMedia('(pointer: fine)').matches)) this.data.controls = 'mobile'; } catch (e) { /* ignorar */ }
  },
  save() { try { localStorage.setItem(this.KEY, JSON.stringify(this.data)); } catch (e) { /* ignorar */ } },
  get lang() { return this.data.lang; },
  get volume() { return this.data.volume; },
  get mobile() { return this.data.controls === 'mobile'; },
};

/** Generador pseudoaleatorio con semilla (mulberry32) para poder repetir mazmorras. */
function makeRng(seed) {
  let a = seed >>> 0;
  const rng = function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  rng.int = (lo, hi) => lo + Math.floor(rng() * (hi - lo + 1));   // entero en [lo, hi]
  rng.pick = arr => arr[Math.floor(rng() * arr.length)];
  rng.shuffle = arr => { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; };
  return rng;
}
