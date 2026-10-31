/**
 * main.js: inicialización y configuración global de Phaser 3.
 * Las escenas se registran en orden: Boot (genera el arte y carga el guardado) -> Menu -> Game (+ UI en paralelo).
 */
function bootNeonLabyrinth() {
  const config = {
    type: /[?&]canvas/.test(location.search) ? Phaser.CANVAS : Phaser.AUTO,   // ?canvas fuerza el render por CPU (equipos sin WebGL)
    parent: 'game',
    width: CFG.W,
    height: CFG.H,
    backgroundColor: '#03040c',
    pixelArt: false,
    antialias: true,
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    input: { activePointers: 4 },
    scene: [BootScene, MenuScene, GameScene, UIScene],
  };
  window.NeonLabyrinth = new Phaser.Game(config);
}

// Arranca ya si la página está cargada (p. ej. incrustada después del evento load)
if (document.readyState === 'complete') bootNeonLabyrinth();
else window.addEventListener('load', bootNeonLabyrinth);
