/**
 * EventBus: sistema de eventos global para desacoplar sistemas.
 * Los proyectiles, los módulos de software, la interfaz y el generador de salas
 * se hablan solo a través de eventos con nombre ("bullet:bounce", "player:hit"...).
 */
class EventBus {
  constructor() {
    this.handlers = new Map();
  }

  /** Suscribe `fn` al evento. Devuelve una función que cancela la suscripción. */
  on(event, fn, ctx) {
    if (!this.handlers.has(event)) this.handlers.set(event, []);
    const entry = { fn, ctx };
    this.handlers.get(event).push(entry);
    return () => this.off(event, fn, ctx);
  }

  once(event, fn, ctx) {
    const off = this.on(event, (...a) => { off(); fn.apply(ctx, a); });
    return off;
  }

  off(event, fn, ctx) {
    const list = this.handlers.get(event);
    if (!list) return;
    const i = list.findIndex(h => h.fn === fn && h.ctx === ctx);
    if (i >= 0) list.splice(i, 1);
  }

  emit(event, ...args) {
    const list = this.handlers.get(event);
    if (!list) return;
    // copia para poder (des)suscribirse dentro de un manejador
    for (const h of list.slice()) h.fn.apply(h.ctx, args);
  }

  clear() {
    this.handlers.clear();
  }
}

// Instancia única compartida por todo el juego.
const Bus = new EventBus();
