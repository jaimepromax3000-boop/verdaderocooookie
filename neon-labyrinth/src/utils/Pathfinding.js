/**
 * Pathfinding: A* sobre la rejilla de baldosas de una sala + línea de visión (raycast sobre baldosas).
 * `blocked` es un array plano (y * w + x) donde un valor distinto de 0 es una pared/obstáculo.
 */
const Pathfinding = {
  /** Cola de prioridad binaria mínima. */
  _heap() {
    const a = [];
    return {
      size: () => a.length,
      push(node) {
        a.push(node);
        let i = a.length - 1;
        while (i > 0) {
          const p = (i - 1) >> 1;
          if (a[p].f <= a[i].f) break;
          [a[p], a[i]] = [a[i], a[p]];
          i = p;
        }
      },
      pop() {
        const top = a[0], last = a.pop();
        if (a.length) {
          a[0] = last;
          let i = 0;
          for (;;) {
            const l = 2 * i + 1, r = l + 1;
            let m = i;
            if (l < a.length && a[l].f < a[m].f) m = l;
            if (r < a.length && a[r].f < a[m].f) m = r;
            if (m === i) break;
            [a[m], a[i]] = [a[i], a[m]];
            i = m;
          }
        }
        return top;
      },
    };
  },

  /**
   * Devuelve la lista de baldosas {x,y} desde (sx,sy) hasta (ex,ey), sin incluir el origen.
   * Movimiento en 8 direcciones sin "cortar esquinas" de paredes. null si no hay camino.
   */
  astar(blocked, w, h, sx, sy, ex, ey, maxNodes = 1500) {
    const inb = (x, y) => x >= 0 && y >= 0 && x < w && y < h;
    if (!inb(sx, sy) || !inb(ex, ey)) return null;
    if (blocked[ey * w + ex]) {
      // el destino está dentro de un obstáculo: busca la baldosa libre más cercana alrededor
      let best = null, bd = 1e9;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
        const x = ex + dx, y = ey + dy;
        if (inb(x, y) && !blocked[y * w + x]) {
          const d = dx * dx + dy * dy;
          if (d < bd) { bd = d; best = [x, y]; }
        }
      }
      if (!best) return null;
      ex = best[0]; ey = best[1];
    }
    if (sx === ex && sy === ey) return [];
    const open = this._heap();
    const g = new Map(), came = new Map(), closed = new Set();
    const key = (x, y) => y * w + x;
    const hfn = (x, y) => {
      const dx = Math.abs(x - ex), dy = Math.abs(y - ey);
      return (dx + dy) + (Math.SQRT2 - 2) * Math.min(dx, dy); // distancia octil
    };
    g.set(key(sx, sy), 0);
    open.push({ x: sx, y: sy, f: hfn(sx, sy) });
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
    let expanded = 0;
    while (open.size() && expanded < maxNodes) {
      const cur = open.pop();
      const ck = key(cur.x, cur.y);
      if (closed.has(ck)) continue;
      closed.add(ck);
      expanded++;
      if (cur.x === ex && cur.y === ey) {
        const path = [];
        let k = ck;
        while (k !== key(sx, sy)) {
          path.push({ x: k % w, y: (k / w) | 0 });
          k = came.get(k);
        }
        return path.reverse();
      }
      for (const [dx, dy] of dirs) {
        const nx = cur.x + dx, ny = cur.y + dy;
        if (!inb(nx, ny) || blocked[key(nx, ny)]) continue;
        if (dx && dy && (blocked[key(cur.x + dx, cur.y)] || blocked[key(cur.x, cur.y + dy)])) continue;
        const nk = key(nx, ny);
        if (closed.has(nk)) continue;
        const ng = g.get(ck) + (dx && dy ? Math.SQRT2 : 1);
        if (ng < (g.has(nk) ? g.get(nk) : Infinity)) {
          g.set(nk, ng);
          came.set(nk, ck);
          open.push({ x: nx, y: ny, f: ng + hfn(nx, ny) });
        }
      }
    }
    return null;
  },

  /** Línea de visión entre dos baldosas (Bresenham). true si no hay paredes entre ellas. */
  lineOfSight(blocked, w, x0, y0, x1, y1) {
    let dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      if (!(x0 === x1 && y0 === y1) && blocked[y0 * w + x0]) return false;
      if (x0 === x1 && y0 === y1) return true;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  },
};
