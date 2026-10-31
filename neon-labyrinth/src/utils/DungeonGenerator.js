/**
 * DungeonGenerator: genera cada planta como un grafo de 10-15 salas conectadas sobre una rejilla 7x7
 * (crecimiento aleatorio tipo "random walk" ramificado) y después CLASIFICA las salas por función:
 *
 *   start    -> sala de inicio (en el centro; en la planta 1 contiene las armas básicas)
 *   boss     -> la sala más alejada posible del origen (distancia por BFS sobre las puertas)
 *   shop     -> tienda (una sala sin salida, lejos del jefe)
 *   treasure -> tesoro oculto: su puerta está cerrada con llave
 *   combat   -> el resto: sellan las puertas hasta eliminar a todos los enemigos
 *
 * También crea el plano de baldosas de cada sala (paredes, huecos de puertas y obstáculos),
 * comprobando que ningún obstáculo deja zonas inaccesibles.
 */
const DIRS = {
  N: { dx: 0, dy: -1, opp: 'S' },
  S: { dx: 0, dy: 1, opp: 'N' },
  W: { dx: -1, dy: 0, opp: 'E' },
  E: { dx: 1, dy: 0, opp: 'W' },
};

/** Baldosas que forman el hueco de cada puerta (en coordenadas de la sala). */
const DOOR_TILES = (() => {
  const mx = CFG.RW / 2, my = (CFG.RH - 1) / 2;
  return {
    N: [[mx - 1, 0], [mx, 0]],
    S: [[mx - 1, CFG.RH - 1], [mx, CFG.RH - 1]],
    W: [[0, my - 1], [0, my], [0, my + 1]],
    E: [[CFG.RW - 1, my - 1], [CFG.RW - 1, my], [CFG.RW - 1, my + 1]],
  };
})();

class DungeonGenerator {
  constructor(seed) {
    this.seed = seed;
    this.rng = makeRng(seed);
  }

  static key(x, y) { return x + ',' + y; }

  generate(floor = 1) {
    const rng = this.rng;
    const GRID = floor >= 4 ? 9 : 7, mid = GRID >> 1;                       // las plantas profundas son mayores
    const target = rng.int(10, 15) + Math.min(8, Math.floor((floor - 1) * 0.9));
    const rooms = new Map();
    const make = (gx, gy) => {
      const r = { gx, gy, type: 'combat', doors: { N: false, S: false, W: false, E: false }, locked: false,
        dist: 0, visited: false, cleared: false, layout: null, floor, enemies: null, items: null, discovered: false };
      rooms.set(DungeonGenerator.key(gx, gy), r);
      return r;
    };
    const get = (x, y) => rooms.get(DungeonGenerator.key(x, y));
    const link = (a, b, dir) => { a.doors[dir] = true; b.doors[DIRS[dir].opp] = true; };
    const neighbours = (x, y) => Object.values(DIRS).filter(d => get(x + d.dx, y + d.dy)).length;

    const start = make(mid, mid);
    start.type = 'start';
    let guard = 0;
    while (rooms.size < target && guard++ < 4000) {
      const list = Array.from(rooms.values());
      const base = rng.pick(list);
      const dirName = rng.pick(Object.keys(DIRS));
      const d = DIRS[dirName];
      const nx = base.gx + d.dx, ny = base.gy + d.dy;
      if (nx < 0 || ny < 0 || nx >= GRID || ny >= GRID || get(nx, ny)) continue;
      if (neighbours(nx, ny) > 1 && rng() > 0.12) continue; // casi sin bucles: conserva pasillos y callejones
      const r = make(nx, ny);
      link(base, r, dirName);
    }
    // algún bucle extra entre salas contiguas
    for (const r of rooms.values()) {
      for (const [name, d] of Object.entries(DIRS)) {
        const o = get(r.gx + d.dx, r.gy + d.dy);
        if (o && !r.doors[name] && rng() < 0.08) link(r, o, name);
      }
    }

    // BFS: distancia (en puertas) desde la sala de inicio
    const queue = [start];
    start.dist = 0;
    const seen = new Set([start]);
    while (queue.length) {
      const r = queue.shift();
      for (const [name, d] of Object.entries(DIRS)) {
        if (!r.doors[name]) continue;
        const o = get(r.gx + d.dx, r.gy + d.dy);
        if (o && !seen.has(o)) { seen.add(o); o.dist = r.dist + 1; queue.push(o); }
      }
    }
    const degree = r => Object.values(r.doors).filter(Boolean).length;
    const all = Array.from(rooms.values());

    // Jefe: el punto más alejado posible del origen (preferimos un callejón sin salida)
    const byDist = all.filter(r => r !== start).sort((a, b) => b.dist - a.dist);
    const boss = byDist.find(r => degree(r) === 1) || byDist[0];
    boss.type = 'boss';

    // Tienda y tesoro: callejones restantes; si faltan, las salas más lejanas con pocas puertas
    let spare = all.filter(r => r.type === 'combat' && degree(r) === 1);
    if (spare.length < 2) spare = spare.concat(all.filter(r => r.type === 'combat' && degree(r) === 2 && !spare.includes(r)));
    rng.shuffle(spare);
    const shop = spare.find(r => r.dist >= 2) || spare[0];
    if (shop) shop.type = 'shop';
    const treasure = spare.filter(r => r !== shop).sort((a, b) => b.dist - a.dist)[0]
      || all.filter(r => r.type === 'combat').sort((a, b) => b.dist - a.dist)[0];
    if (treasure) { treasure.type = 'treasure'; treasure.locked = true; }

    for (const r of all) r.layout = this.makeLayout(r);
    return { floor, size: GRID, seed: this.seed, rooms, list: all, start, boss, shop, treasure, key: DungeonGenerator.key, get };
  }

  /** Plano de baldosas de la sala: 0 libre, 1 pared, 2 obstáculo. */
  makeLayout(room) {
    const { RW, RH } = CFG;
    const rng = makeRng((this.seed * 7919 + room.gx * 131 + room.gy * 17 + room.floor * 3) >>> 0);
    const L = new Uint8Array(RW * RH);
    for (let y = 0; y < RH; y++) for (let x = 0; x < RW; x++) {
      if (x === 0 || y === 0 || x === RW - 1 || y === RH - 1) L[y * RW + x] = 1;
    }
    for (const [name, open] of Object.entries(room.doors)) {
      if (open) for (const [x, y] of DOOR_TILES[name]) L[y * RW + x] = 0;
    }
    room.hazards = []; room.barrels = [];
    if (room.type !== 'combat' && room.type !== 'boss') return L; // salas especiales: despejadas
    if (room.type === 'boss') return this.addObstacles(L, rng, [0, 3, 6, 11][room.floor % 4]);

    const out = this.addObstacles(L, rng, rng.int(0, 11));
    this.placeExtras(room, out, rng);
    return out;
  }

  /** Trampas de pinchos (que se activan por ciclos) y barriles explosivos, siempre fuera de las zonas de puertas. */
  placeExtras(room, L, rng) {
    const { RW, RH } = CFG, cx = RW >> 1, cy = RH >> 1;
    const nearDoor = (x, y) => { for (const t of Object.values(DOOR_TILES)) for (const [tx, ty] of t) if (Math.abs(x - tx) <= 4 && Math.abs(y - ty) <= 4) return true; return false; };
    const used = new Set();
    const freeRect = (x, y, w, h) => {
      for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
        const xx = x + i, yy = y + j;
        if (xx < 2 || yy < 2 || xx > RW - 3 || yy > RH - 3 || L[yy * RW + xx] || used.has(yy * RW + xx) || nearDoor(xx, yy) || (Math.abs(xx - cx) <= 2 && Math.abs(yy - cy) <= 1)) return false;
      }
      return true;
    };
    if (rng() < [0.22, 0.5, 0.65][room.floor <= 2 ? 0 : room.floor <= 5 ? 1 : 2]) {
      const groups = rng.int(1, room.floor >= 2 ? 3 : 2);
      for (let g = 0; g < groups; g++) for (let tries = 0; tries < 10; tries++) {
        const horiz = rng() < 0.5, w = horiz ? rng.int(3, 6) : rng.int(1, 2), h = horiz ? rng.int(1, 2) : rng.int(3, 5);
        const x = rng.int(3, RW - 4 - w), y = rng.int(3, RH - 4 - h);
        if (!freeRect(x, y, w, h)) continue;
        for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { used.add((y + j) * RW + x + i); room.hazards.push({ tx: x + i, ty: y + j, g }); }
        break;
      }
    }
    if (rng() < 0.55) {
      const n = rng.int(1, 3);
      for (let i = 0; i < n; i++) for (let tries = 0; tries < 10; tries++) {
        const x = rng.int(3, RW - 4), y = rng.int(3, RH - 4);
        if (!freeRect(x, y, 1, 1)) continue;
        used.add(y * RW + x); room.barrels.push({ tx: x, ty: y });
        break;
      }
    }
  }

  addObstacles(L, rng, pattern) {
    const { RW, RH } = CFG;
    const copy = Uint8Array.from(L);
    const block = (x, y, w, h) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const xx = x + i, yy = y + j;
      if (xx > 1 && yy > 1 && xx < RW - 2 && yy < RH - 2) copy[yy * RW + xx] = 2;
    } };
    const cx = RW >> 1, cy = RH >> 1;
    switch (pattern) {
      case 1: for (let y = 4; y < RH - 4; y += 5) for (let x = 6; x < RW - 6; x += 6) block(x, y, 2, 2); break;           // pilares
      case 2: block(cx - 3, cy - 1, 6, 3); break;                                                                      // bloque central
      case 3: block(3, 3, 3, 3); block(RW - 6, 3, 3, 3); block(3, RH - 6, 3, 3); block(RW - 6, RH - 6, 3, 3); break;  // esquinas
      case 4: for (let i = 0; i < 9; i++) block(rng.int(4, RW - 6), rng.int(3, RH - 5), rng.int(1, 2), rng.int(1, 2)); break; // dispersos
      case 5: block(5, cy - 4, 8, 1); block(RW - 13, cy + 4, 8, 1); block(cx - 1, 3, 2, 4); block(cx - 1, RH - 7, 2, 4); break; // barras
      case 6:                                                                                                          // anillo con 4 aberturas
        for (let x = cx - 7; x <= cx + 6; x++) for (const y of [cy - 4, cy + 4]) if (Math.abs(x - cx + 0.5) > 2) block(x, y, 1, 1);
        for (let y = cy - 3; y <= cy + 3; y++) for (const x of [cx - 7, cx + 6]) if (Math.abs(y - cy) > 1) block(x, y, 1, 1);
        break;
      case 7: block(4, 5, 10, 1); block(RW - 14, 5, 10, 1); block(4, RH - 6, 10, 1); block(RW - 14, RH - 6, 10, 1); break; // pasillos
      case 8: for (let row = 0; row < 3; row++) for (let x = 5 + (row % 2 ? 3 : 0); x < RW - 6; x += 6) block(x, 4 + row * 4, 2, 2); break; // pilares al tresbolillo
      case 9: block(8, 3, 1, 5); block(8, RH - 8, 1, 5); block(RW - 9, 3, 1, 5); block(RW - 9, RH - 8, 1, 5); block(cx - 4, 4, 8, 1); block(cx - 4, RH - 5, 8, 1); break; // H
      case 10:                                                                                                         // cuatro cruces
        for (const [ox, oy] of [[-8, -4], [8, -4], [-8, 4], [8, 4]]) { block(cx + ox - 1, cy + oy, 3, 1); block(cx + ox, cy + oy - 1, 1, 3); }
        break;
      case 11: block(4, cy - 2, 2, 5); block(RW - 6, cy - 2, 2, 5); block(cx - 4, 4, 2, 2); block(cx + 2, 4, 2, 2); block(cx - 4, RH - 6, 2, 2); block(cx + 2, RH - 6, 2, 2); break; // plataformas
      default: break;
    }
    // las zonas de puertas y el centro quedan siempre libres
    for (const tiles of Object.values(DOOR_TILES)) for (const [tx, ty] of tiles) {
      for (let j = -4; j <= 4; j++) for (let i = -4; i <= 4; i++) {
        const x = tx + i, y = ty + j;
        if (x > 0 && y > 0 && x < RW - 1 && y < RH - 1 && copy[y * RW + x] === 2) copy[y * RW + x] = 0;
      }
    }
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) copy[(cy + j) * RW + cx + i] = copy[(cy + j) * RW + cx + i] === 2 ? 0 : copy[(cy + j) * RW + cx + i];
    // comprobación de conectividad: todo lo libre debe ser alcanzable desde el centro
    const free = [];
    for (let i = 0; i < copy.length; i++) if (!copy[i]) free.push(i);
    const seen = new Set([cy * RW + cx]);
    const stack = [cy * RW + cx];
    while (stack.length) {
      const k = stack.pop(), x = k % RW, y = (k / RW) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy, nk = ny * RW + nx;
        if (nx < 0 || ny < 0 || nx >= RW || ny >= RH || copy[nk] || seen.has(nk)) continue;
        seen.add(nk); stack.push(nk);
      }
    }
    const reachable = free.filter(k => seen.has(k)).length;
    return reachable === free.length ? copy : L; // si algo quedó aislado, sala sin obstáculos
  }
}
