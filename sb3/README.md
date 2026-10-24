# Cookie Clicker en Scratch (.sb3)

`CookieClicker.sb3` es un proyecto de Scratch 3 (ábrelo en Scratch o TurboWarp con
*Archivo → Cargar desde tu computadora*) que replica el juego de este repositorio con tres columnas como el original:
galleta + leche a la izquierda, **barra central con el dibujo de cada edificio comprado** y tienda a la derecha.

Se genera con `python3 sb3/build_sb3.py` (necesita Pillow y ffmpeg) a partir de las imágenes y sonidos del repositorio y
de los **datos reales del juego** extraídos ejecutando `index.html` (`sb3/game_data.json`).

## Qué incluye
- **Galleta grande** (`perfectCookie.png`): clic con el valor real de `Game.mouseCps()`, efecto de pulsación, «+N» flotante y sonidos `click1-7`.
  Los cursores comprados giran alrededor en anillos de 50, como en el original.
- **Barra central**: una fila por edificio comprado con su fondo (`*Background.png`) y sus sprites colocados con el mismo
  esquema que `Game.Object.draw` (separación `w`, filas, variación `xV/yV`, fotogramas). Las abuelas cambian de aspecto
  según los oficios comprados.
- **Tienda** con los 20 edificios (precio base y CpS base idénticos a `main.js`, precio ×1,15 por unidad), edificios bloqueados
  como `???`, **comprar/vender** y lotes **×1 / ×10 / ×100 / Max** con la misma lógica que `Game.Object.buy/sell`
  (compra parcial, venta al 25 %).
- **495 mejoras reales** (nombre, icono, precio, descripción y condición de desbloqueo): niveles ×2 de los 19 edificios
  (15 niveles cada uno), cursor ×2, «Thousand fingers…Undecillion fingers», ratones, abuelas con oficio y centro de bingo,
  gatitos (leche), galletas (+% de producción, 143), y «Lucky day / Serendipity / Get lucky». Se muestran en la
  cuadrícula superior con los marcos de `upgradeFrame.png`, ordenadas por precio, con ayuda emergente al pasar el ratón.
- **516 logros reales** (banco, CpS, «Have N», producción por edificio, clics, galletas doradas, mejoras, edificios…)
  con aviso al desbloquear, visor de logros (botón *Achievements*) y **leche** (progreso = logros / 25) que sube en la
  parte inferior con los mismos tipos de leche del juego.
- **Galleta dorada**: Frenzy (×7), Lucky, Click frenzy (×777 al clic) y Building special, con la selección y duraciones del
  original. Aparece cada 5-15 min (la mitad con *Lucky day*, etc.) y dura 13 s.
- **Titular de noticias** arriba (franja de `darkNoiseTopBar.jpg`): ~1.300 titulares reales muestreados de `Game.getNewTicker()`
  (generales por galletas horneadas y específicos de cada edificio comprado), con desvanecido, cambio cada 10 s y al hacer
  clic (50 clics = logro *Tabloid addiction*).
- Textos grandes y nítidos: dos juegos de glifos (pequeño y grande), columnas repartidas para dar espacio, barras de
  desplazamiento en tienda/mejoras/filas y cuadros de ayuda anchos que quedan por encima de la galleta.
- Botón *Stats* con las estadísticas principales; contadores con el formato del juego (`1,234`, `1.235 million`…) y la fuente
  **Merriweather** original (los glifos se renderizan desde `fonts/` con `sb3/render_glyphs.js`).

## Cómo se verificó
Con el motor real del juego (`index.html` en un navegador) como oráculo: en 500 estados aleatorios (edificios, mejoras,
logros) la producción por segundo y el valor por clic de Scratch coinciden con `Game.cookiesPs` y `Game.mouseCps()`
(error relativo < 1e-14); 300 compras/ventas por lotes dan exactamente las mismas cantidades y galletas; y los
desbloqueos por cantidad de edificios coinciden en 40 estados aleatorios.

## Qué NO está (Scratch no puede con todo el juego)
Ascensión y ficha celestial, mejoras celestiales/investigación, temporadas (Navidad, Pascua…), huevos, abuelas furiosas/
wrinklers, dragón, bolsa de valores y demás minijuegos, niveles de edificio con terrones de azúcar,
mejoras de pociones/mods, guardado de partida, idiomas y logros que dependen de esas funciones (la leche usa solo los
516 logros incluidos, de 622).

## Archivos
- `build_sb3.py`, `sb3dsl.py`, `gamedata.py`: generador (DSL de bloques, clasificación de mejoras y logros).
- `extract_game_data.js`, `render_glyphs.js`, `extract_news.js`: extraen `game_data.json`, `glyphs.json` y `news.json` con Playwright.
