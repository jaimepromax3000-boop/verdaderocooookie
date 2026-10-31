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
| Habilidad activa del personaje | Q / clic derecho |
| Mapa grande de la planta | mantén Tab |
| Recoger, comprar, usar portal | E |
| Pausa | ESC |

## Menú principal

- **PARTIDA**: nombre de usuario (se guarda), **skin** (solo estética), **arma** (Estándar, Ligero o Pesado, con su habilidad Q) y **dificultad** (Fácil, Normal, Difícil: en Difícil los enemigos tienen más vida y hacen +50 % de daño; tu vida no cambia).
- **TIENDA**: *Mejoras permanentes* (Fragmentos de Núcleo), *Skins* (monedas, o cofres) y *Materiales* (monedas): Cuero polimérico, Hierro binario, Oro cifrado y Diamante cuántico.
- **HERRERO**: un herrero virtual fabrica tu **armadura permanente** (casco, pechera, pantalones y botas). Eliges pieza y material, le entregas los materiales y ves la animación de forja antes de recibirla. Cada pieza pide una cantidad distinta (botas 4, casco 5, pantalones 6, pechera 8). Protección: Diamante > Oro > Hierro > Cuero; se pueden mezclar y se ven puestas en tu skin. Cada punto de protección reduce un 1,5 % el daño recibido.
- **MISIONES**: 3 activas ("elimina 10 Blindados", "limpia 6 salas"...). El progreso cuenta entre partidas y se reclama la recompensa (monedas, fragmentos o un cofre).
- **Ajustes** (engranaje arriba a la derecha): idioma (español, inglés, francés), volumen y controles (ordenador, o móvil/tablet con dos joysticks táctiles y botones de dash, habilidad, interactuar, pausa y mapa).

## Bucle de juego

- Sala inicial segura: eliges arma inicial (Pulso, Dispersor, Lanza Riel).
- **10 plantas** (de ~12 salas la primera a ~20 la última) con 6 biomas y 6 jefes distintos (los de las plantas 7-9 son versiones Mk II); las puertas se sellan al entrar y se abren al matar a todos los enemigos (algunas salas tienen 2 oleadas).
- **Al limpiar una sala eliges 1 de 3 mejoras temporales** aleatorias y distintas. Duran una partida y tienen niveles: escudos orbitales, cadencia de fuego (más disparos por segundo, luego doble y triple disparo), campo de fuerza, daño, nanobots, velocidad, esquiva, espinas, campo temporal... 31 en total.
- **El jefe suelta un cofre** (Bronce / Plata / Oro según la planta y la dificultad) con monedas, fragmentos, mejoras permanentes o skins. Se abre con E.
- Salas especiales: **Tienda** (mejoras temporales con créditos), **Tesoro** oculto (puerta con llave) y **Jefe** en el punto más lejano.
- Trampas de pinchos con aviso, barriles explosivos, 12 diseños de obstáculos y enemigos variados con **élites**.
- Al morir pierdes lo de la partida; conservas fragmentos, monedas, skins, materiales, armadura y misiones.

## Controles

PC: WASD/flechas, ratón, Espacio/Shift (dash), Q o clic derecho (habilidad), E (interactuar), Tab (mapa), ESC (pausa).
Móvil/tablet: joystick izquierdo mover, joystick derecho apuntar y disparar, botones en pantalla.

## Estructura

```
index.html
lib/phaser.min.js
src/
├── main.js                     configuración de Phaser
├── core/
│   ├── Config.js               constantes, personajes, armas, mejoras permanentes, guardado, RNG con semilla
│   ├── Progress.js             skins, dificultades, cofres, misiones, materiales y armadura
│   ├── Art.js  ArtParts.js     arte semi-realista con canvas 2D: enemigos, jefes, skins, armadura, herrero
│   ├── I18n.js                 idiomas ES/EN/FR (glosario + reglas, parche de Phaser Text)
│   ├── EventBus.js             bus de eventos global (base del sistema de sinergias)
│   ├── StateMachine.js         FSM genérica para la IA
│   ├── ObjectPool.js           pool de proyectiles y partículas
│   └── Modules.js              31 mejoras temporales (módulos) con niveles y sus ganchos de eventos
├── utils/
│   ├── DungeonGenerator.js     mapa procedural, clasificación de salas, distribución de obstáculos
│   └── Pathfinding.js          A* (heap binario, sin cortar esquinas) + línea de visión (Bresenham)
├── entities/
│   ├── Entity.js  Player.js  Enemy.js  Projectile.js  Item.js
└── scenes/
    ├── BootScene.js            genera todo el arte por código y carga el guardado
    ├── MenuScene.js            Partida / Tienda / Herrero / Misiones y ajustes
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
