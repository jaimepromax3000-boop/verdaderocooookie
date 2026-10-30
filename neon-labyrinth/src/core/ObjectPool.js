/**
 * ObjectPool: reciclador de objetos para proyectiles y partículas.
 * Evita crear/destruir cientos de objetos por segundo (menos basura, menos tirones).
 *
 *   const pool = new ObjectPool(() => new Projectile(scene), 64);
 *   const b = pool.get();   // saca uno (lo crea solo si no quedan libres)
 *   pool.release(b);        // lo devuelve
 */
class ObjectPool {
  constructor(create, prewarm = 0) {
    this.create = create;
    this.free = [];
    this.active = new Set();
    for (let i = 0; i < prewarm; i++) this.free.push(create());
  }

  get() {
    const o = this.free.pop() || this.create();
    this.active.add(o);
    return o;
  }

  release(o) {
    if (this.active.delete(o)) this.free.push(o);
  }

  /** Recorre una copia de los activos (se puede liberar dentro del bucle). */
  forEach(fn) {
    for (const o of Array.from(this.active)) fn(o);
  }

  releaseAll(onRelease) {
    for (const o of Array.from(this.active)) {
      if (onRelease) onRelease(o);
      this.release(o);
    }
  }

  get size() {
    return this.active.size;
  }
}
