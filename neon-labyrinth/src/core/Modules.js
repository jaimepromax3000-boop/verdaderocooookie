/**
 * Módulos de Software y sistema de sinergias.
 *
 * En lugar de sumas simples (+10 de daño), los módulos actúan de dos maneras:
 *   1) `mod(spec, stacks, player)`  modifica el DISPARO antes de crearlo (rebotes, perforación, cadencia...).
 *   2) `hooks`  escuchan EVENTOS del juego (bullet:hit, bullet:bounce, bullet:kill, explosion, player:dash...)
 *      y reaccionan creando efectos nuevos que HEREDAN el daño ya multiplicado de la bala que los originó.
 *
 * Las sinergias salen solas de combinar eventos. Ejemplo:
 *   "Balas rebotantes" añade rebotes -> cada rebote emite `bullet:bounce`
 *   "Rastro incendiario" escucha `bullet:bounce` -> deja fuego en el suelo con daño = bala.daño * 0.5
 *   "Carga explosiva" emite `explosion`; "Rastro incendiario" también la escucha y la convierte en una hoguera.
 */
const Modules = {
  defs: {
    bounce: {
      name: 'Balas rebotantes', letter: 'B', color: 0x5dff8a, max: 3,
      desc: 'Las balas rebotan 2 veces más en las paredes.',
      mod(spec, n) { spec.bounces += 2 * n; },
    },
    fire: {
      name: 'Rastro incendiario', letter: 'F', color: 0xff9a3c, max: 3,
      desc: 'Deja fuego al impactar (siempre al rebotar o al explotar).',
      hooks: {
        'bullet:bounce'(e, n, scene) { scene.spawnFire(e.x, e.y, e.bullet.spec.damage * 0.5 * n, 3.0, e.bullet.spec.tags); },
        'bullet:hit'(e, n, scene) { if (scene.rng() < 0.35 + 0.1 * n) scene.spawnFire(e.target.x, e.target.y, e.bullet.spec.damage * 0.5 * n, 2.5, e.bullet.spec.tags); },
        'explosion'(e, n, scene) { if (e.source === 'player') scene.spawnFire(e.x, e.y, e.damage * 0.4 * n, 3.0, ['explosion']); },
        'player:dashTick'(e, n, scene) { if (scene.player.stack('echo')) scene.spawnFire(e.x, e.y, scene.player.baseDamage() * 0.7 * n, 2.0, ['dash']); },
      },
    },
    pierce: {
      name: 'Punta perforante', letter: 'P', color: 0xff2bd6, max: 2,
      desc: 'Las balas atraviesan 1 enemigo más.',
      mod(spec, n) { spec.pierce += n; },
    },
    homing: {
      name: 'Guiado térmico', letter: 'G', color: 0xffe94d, max: 2,
      desc: 'Las balas giran hacia el enemigo más cercano.',
      mod(spec, n) { spec.homing += 3.2 * n; },
    },
    overclock: {
      name: 'Overclock de cadencia', letter: 'O', color: 0x00f0ff, max: 3,
      desc: '+25 % de cadencia de disparo.',
      mod(spec, n) { spec.rateMult *= Math.pow(1.25, n); },
    },
    explosive: {
      name: 'Carga explosiva', letter: 'X', color: 0xff4466, max: 2,
      desc: 'Los enemigos eliminados explotan.',
      hooks: {
        'bullet:kill'(e, n, scene) { if (!e.bullet.spec.tags.includes('explosion')) scene.explode(e.target.x, e.target.y, 62 + 14 * n, e.bullet.spec.damage * (0.9 + 0.3 * n), 'player'); },
      },
    },
    chain: {
      name: 'Arco voltaico', letter: 'A', color: 0x9b5cff, max: 3,
      desc: 'Cada impacto salta a un enemigo cercano.',
      hooks: {
        'bullet:hit'(e, n, scene) {
          if (e.bullet.spec.tags.includes('chain')) return;
          let best = null, bd = 170 * 170;
          for (const en of scene.enemies) {
            if (en === e.target || en.dead) continue;
            const d = (en.x - e.target.x) ** 2 + (en.y - e.target.y) ** 2;
            if (d < bd) { bd = d; best = en; }
          }
          if (best) {
            scene.spawnLightning(e.target.x, e.target.y, best.x, best.y, 0x9b5cff);
            best.takeDamage(e.bullet.spec.damage * (0.5 + 0.15 * n), 'player', { tags: ['chain'], color: 0x9b5cff });
            Bus.emit('bullet:hit', { bullet: { spec: Object.assign({}, e.bullet.spec, { tags: ['chain'] }), x: best.x, y: best.y }, target: best });
          }
        },
      },
    },
    split: {
      name: 'Fragmentación', letter: 'S', color: 0xffe94d, max: 2,
      desc: 'Los enemigos eliminados lanzan 3 fragmentos.',
      hooks: {
        'bullet:kill'(e, n, scene) {
          if (e.bullet.spec.tags.includes('split')) return;
          for (let i = 0; i < 2 + n; i++) {
            const a = (Math.PI * 2 * i) / (2 + n) + scene.rng() * 0.6;
            const spec = Object.assign({}, e.bullet.spec, { damage: e.bullet.spec.damage * 0.5, life: 0.5, size: 0.7, pierce: 0, tags: e.bullet.spec.tags.concat(['split']) });
            scene.fireBullet(spec, e.target.x, e.target.y, a);
          }
        },
      },
    },
    cryo: {
      name: 'Munición criogénica', letter: 'C', color: 0x7fe9ff, max: 2,
      desc: 'Ralentiza a los enemigos alcanzados. Las explosiones les hacen +50 %.',
      hooks: {
        'bullet:hit'(e, n) { e.target.addStatus('slow', 2.0 + n, 0.55); },
      },
    },
    toxin: {
      name: 'Virus tóxico', letter: 'T', color: 0x5dff8a, max: 3,
      desc: 'Envenena: daño continuo durante 3 s (se acumula).',
      hooks: {
        'bullet:hit'(e, n) { e.target.addStatus('poison', 3, 0.35 * e.bullet.spec.damage * n); },
        'enemy:killed'(e, n, scene) {
          if (e.enemy.hasStatus('poison') && n >= 2) for (const en of scene.enemies) {
            if (!en.dead && en !== e.enemy && (en.x - e.enemy.x) ** 2 + (en.y - e.enemy.y) ** 2 < 100 * 100) en.addStatus('poison', 3, 0.3 * n);
          }
        },
      },
    },
    vampire: {
      name: 'Succión de datos', letter: 'V', color: 0xff4466, max: 2,
      desc: '15 % de curar medio corazón al eliminar un enemigo.',
      hooks: {
        'enemy:killed'(e, n, scene) { if (scene.rng() < 0.15 * n) scene.player.heal(0.5); },
      },
    },
    shield: {
      name: 'Matriz de escudo', letter: 'E', color: 0x00f0ff, max: 2,
      desc: '+1 escudo máximo.',
      onAcquire(player) { player.maxShield += 1; player.shield += 1; },
    },
    surge: {
      name: 'Subida de tensión', letter: 'U', color: 0xffe94d, max: 2,
      desc: 'Al eliminar un enemigo ganas velocidad 2 s.',
      hooks: {
        'enemy:killed'(e, n, scene) { scene.player.addBuff('speed', 2.0 + n, 1.35); },
      },
    },
    orbit: {
      name: 'Satélites de datos', letter: 'R', color: 0x00f0ff, max: 3,
      desc: 'Un satélite orbita contigo: daña enemigos y bloquea balas.',
      onAcquire(player) { player.addOrbiter(null); },
    },
    mine: {
      name: 'Minas de fase', letter: 'M', color: 0xff9a3c, max: 2,
      desc: 'Cada dash deja una mina que explota al acercarse un enemigo.',
      hooks: {
        'player:dash'(e, n, scene) { scene.spawnMine(scene.player.x, scene.player.y, scene.player.baseDamage() * (1.6 + 0.6 * n)); },
      },
    },
    crit: {
      name: 'Núcleo crítico', letter: 'K', color: 0xff2bd6, max: 3,
      desc: '+12 % de probabilidad de golpe crítico (daño x2).',
      mod(spec, n) { spec.crit = (spec.crit || 0) + 0.12 * n; },
    },
    magnet: {
      name: 'Imán de créditos', letter: 'N', color: 0xffe94d, max: 2,
      desc: 'Atrae créditos, llaves y corazones desde más lejos.',
    },
    nova: {
      name: 'Onda de choque', letter: 'W', color: 0x9b5cff, max: 2,
      desc: 'Cada pocas bajas liberas una onda que daña a tu alrededor.',
      hooks: {
        'enemy:killed'(e, n, scene) {
          scene.novaKills = (scene.novaKills || 0) + 1;
          if (scene.novaKills >= 9 - 2 * n) { scene.novaKills = 0; scene.shockwave(scene.player.x, scene.player.y, 130 + 25 * n, scene.player.baseDamage() * 1.5, 0, 0x9b5cff, false); }
        },
      },
    },
    echo: {
      name: 'Eco de dash', letter: 'D', color: 0xff2bd6, max: 2,
      desc: 'El dash deja una estela dañina (con "Rastro incendiario" arde).',
      hooks: {
        'player:dashTick'(e, n, scene) { if (!scene.player.stack('fire')) scene.spawnFire(e.x, e.y, scene.player.baseDamage() * 0.5 * n, 1.2, ['dash'], 0x00f0ff); },
      },
    },
  },

  ids() { return Object.keys(this.defs); },

  /** Registra todos los hooks en el EventBus. Cada manejador comprueba que el jugador tenga el módulo. */
  install(scene) {
    const offs = [];
    for (const [id, def] of Object.entries(this.defs)) {
      if (!def.hooks) continue;
      for (const [event, fn] of Object.entries(def.hooks)) {
        offs.push(Bus.on(event, e => {
          const n = scene.player ? scene.player.stack(id) : 0;
          if (n > 0) fn(e, n, scene);
        }));
      }
    }
    return offs;
  },

  /** Elige `count` módulos distintos que aún no estén al máximo. */
  roll(rng, player, count = 1, exclude = []) {
    const pool = this.ids().filter(id => player.stack(id) < this.defs[id].max && !exclude.includes(id));
    rng.shuffle(pool);
    return pool.slice(0, count);
  },
};
