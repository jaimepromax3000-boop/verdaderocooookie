/**
 * StateMachine: máquina de estados finita genérica (IA de enemigos, estados del jugador...).
 *
 *   const fsm = new StateMachine(owner)
 *     .add('patrol', { enter(fsm){}, update(fsm, dt){}, exit(fsm){} })
 *     .add('chase',  { ... });
 *   fsm.set('patrol');
 *   fsm.update(dt);          // cada fotograma
 *
 * Las funciones de cada estado se ejecutan con `this === owner`.
 */
class StateMachine {
  constructor(owner) {
    this.owner = owner;
    this.states = {};
    this.current = null;
    this.name = '';
    this.time = 0; // segundos que lleva activo el estado actual
  }

  add(name, def) {
    this.states[name] = def;
    return this;
  }

  set(name, ...args) {
    if (!this.states[name]) throw new Error('Estado desconocido: ' + name);
    if (this.current && this.current.exit) this.current.exit.call(this.owner, this);
    this.name = name;
    this.current = this.states[name];
    this.time = 0;
    if (this.current.enter) this.current.enter.call(this.owner, this, ...args);
  }

  is(name) {
    return this.name === name;
  }

  update(dt) {
    this.time += dt;
    if (this.current && this.current.update) this.current.update.call(this.owner, this, dt);
  }
}
