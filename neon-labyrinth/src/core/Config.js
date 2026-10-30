/**
 * Configuración global, personajes, armas iniciales y metaprogresión (guardado en localStorage).
 */
const CFG = {
  W: 1024, H: 640,          // tamaño del lienzo
  T: 32,                    // tamaño de baldosa
  RW: 30, RH: 17,           // baldosas por sala (960 x 544)
  OX: 32, OY: 64,           // desplazamiento de la sala en pantalla (arriba queda el HUD)
  FLOORS: 3,                // plantas del servidor (la última tiene el jefe final)
  COL: { cyan: 0x00f0ff, magenta: 0xff2bd6, yellow: 0xffe94d, green: 0x5dff8a, red: 0xff4466, orange: 0xff9a3c, violet: 0x9b5cff, white: 0xffffff },
};

/** Personajes seleccionables en el menú. */
const CHARACTERS = [
  { id: 'hacker', name: 'Hacker de Almas', desc: 'Equilibrado.', color: 0x00f0ff, hp: 6, shield: 1, speed: 1.0, damage: 1.0 },
  { id: 'ghost',  name: 'Fantasma',         desc: 'Rápido y frágil.', color: 0xff2bd6, hp: 4, shield: 1, speed: 1.2, damage: 1.0 },
  { id: 'daemon', name: 'Daemon',           desc: 'Resistente y lento.', color: 0xffe94d, hp: 8, shield: 0, speed: 0.88, damage: 1.1 },
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
  { id: 'speed',   name: 'Overclock motor',    desc: '+6 % de velocidad',         max: 3, cost: [15, 35, 65],  req: null,      pos: [2, 0] },
  { id: 'credits', name: 'Fondos opacos',      desc: '+15 créditos iniciales',    max: 3, cost: [15, 30, 55],  req: 'speed',   pos: [2, 1] },
  { id: 'key',     name: 'Llave maestra',     desc: 'Empiezas con 1 llave',       max: 1, cost: [60],          req: 'credits', pos: [2, 2] },
  { id: 'luck',    name: 'Suerte de sistema',  desc: 'Más recompensas',           max: 2, cost: [40, 90],      req: 'key',     pos: [2, 3] },
];

/** Metaprogresión persistente: divisa "Fragmentos de Núcleo" y mejoras compradas. */
const Meta = {
  KEY: 'neon-labyrinth-save-v1',
  data: { fragments: 0, upgrades: {}, bestFloor: 0, bestRooms: 0, runs: 0, wins: 0 },

  load() {
    try {
      const raw = localStorage.getItem(this.KEY);
      if (raw) this.data = Object.assign(this.data, JSON.parse(raw));
    } catch (e) { /* localStorage no disponible: se juega sin guardar */ }
  },

  save() {
    try { localStorage.setItem(this.KEY, JSON.stringify(this.data)); } catch (e) { /* ignorar */ }
  },

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
    this.data = { fragments: 0, upgrades: {}, bestFloor: 0, bestRooms: 0, runs: 0, wins: 0 };
    this.save();
  },
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
