# NEON LABYRINTH

Roguelike de acción 2D cenital hecho con **Phaser 3.80.1** (incluido en `lib/`, sin dependencias externas).
Eres un *Hacker de Almas* que se infiltra en los servidores de una megacorporación: mazmorras procedurales,
combate rápido y sinergias entre módulos de software.

## Cómo jugar

Abre `index.html` con doble clic (funciona sin servidor) o sírvelo con `python3 -m http.server`.
Si tu navegador no tiene WebGL: `index.html?canvas` fuerza el render por CPU.

| Acción | Control |
|---|---|
| Mover (8 direcciones) | WASD / flechas |
| Apuntar y disparar (360°) | Ratón (mantén pulsado) |
| Dash con invulnerabilidad | Espacio / Shift |
| Recoger, comprar, usar portal | E |
| Pausa | ESC |

## Bucle de juego

- Sala inicial segura: eliges arma (Pulso, Dispersor, Lanza Riel).
- 3 plantas de 10–15 salas; las puertas se sellan al entrar y se abren al matar a todos los enemigos.
- Al limpiar una sala cae una recompensa visible (créditos, reparación, módulos, llaves).
- Salas especiales: **Tienda**, **Tesoro** oculto (puerta con llave) y **Jefe** en el punto más lejano.
- Al morir pierdes lo de la partida, pero conservas los **Fragmentos de Núcleo** para el árbol de habilidades
  permanente (se guarda en `localStorage`).

## Estructura

```
index.html
lib/phaser.min.js
src/
├── main.js                     configuración de Phaser
├── core/
│   ├── Config.js               constantes, personajes, armas, mejoras permanentes, guardado, RNG con semilla
│   ├── EventBus.js             bus de eventos global (base del sistema de sinergias)
│   ├── StateMachine.js         FSM genérica para la IA
│   ├── ObjectPool.js           pool de proyectiles y partículas
│   └── Modules.js              14 módulos de software y sus ganchos de eventos
├── utils/
│   ├── DungeonGenerator.js     mapa procedural, clasificación de salas, distribución de obstáculos
│   └── Pathfinding.js          A* (heap binario, sin cortar esquinas) + línea de visión (Bresenham)
├── entities/
│   ├── Entity.js  Player.js  Enemy.js  Projectile.js  Item.js
└── scenes/
    ├── BootScene.js            genera todo el arte por código y carga el guardado
    ├── MenuScene.js            personaje + árbol de habilidades
    ├── GameScene.js            salas, combate, puertas, recompensas
    └── UIScene.js              HUD en paralelo (vida/escudo, minimapa, buffs, módulos)
```

## Sistemas destacados

- **Sinergias por eventos**: los módulos reaccionan a eventos (`bullet:bounce`, `bullet:hit`, `explosion`…).
  Ejemplo: *Balas Rebotantes* + *Rastro Incendiario* → cada rebote deja fuego que hereda el daño de la bala.
- **IA de enemigos**: FSM (patrulla/alerta → persecución con línea de visión + A* → ataque: embestida,
  ráfaga o invocación). Los jefes cambian de patrón y entran en fase 2.
- **Generador**: crecimiento aleatorio en rejilla 7×7, BFS para distancias; jefe = hoja más lejana;
  tienda/tesoro = otros callejones; cada sala con obstáculos garantiza conectividad.
- **UI** en una escena paralela: corazones y escudo con temblor al recibir daño, minimapa que se revela
  progresivamente, iconos de buffs/debuffs con temporizador circular.

## Estado de las pruebas

Probado de forma automatizada (Playwright, Chromium headless, modo `?canvas`): recorrido de todas las salas de
las 3 plantas (sellado, enemigos, apertura, recompensas), tienda, sala de tesoro, jefe y portal, muerte con
reparto de fragmentos y guardado, victoria, la sinergia rebote + fuego y la compra en tienda, sin errores de
consola. No se ha probado en un navegador de escritorio real con GPU, ni con mando/táctil, ni el balance de
dificultad a mano.
