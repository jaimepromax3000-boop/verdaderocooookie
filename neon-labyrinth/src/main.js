/**
 * main.js: inicialización y configuración global de Phaser 3.
 * Las escenas se registran en orden: Boot (genera el arte y carga el guardado) -> Menu -> Game (+ UI en paralelo).
 */
window.addEventListener('load', () => {
  const config = {
    type: /[?&]canvas/.test(location.search) ? Phaser.CANVAS : Phaser.AUTO,   // ?canvas fuerza el render por CPU (equipos sin WebGL)
    parent: 'game',
    width: CFG.W,
    height: CFG.H,
    backgroundColor: '#03040c',
    pixelArt: false,
    antialias: true,
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    input: { activePointers: 1 },
    scene: [BootScene, MenuScene, GameScene, UIScene],
  };
  window.NeonLabyrinth = new Phaser.Game(config);
});
