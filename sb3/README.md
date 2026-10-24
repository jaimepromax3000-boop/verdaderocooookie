# Cookie Clicker en Scratch (.sb3)

`CookieClicker.sb3` es un proyecto de Scratch 3 (se abre en Scratch o TurboWarp con
*Archivo → Cargar desde tu computadora*). Se genera con `python3 sb3/build_sb3.py`
(necesita Pillow y ffmpeg) a partir de las imágenes y sonidos de este repositorio.

## Qué reproduce del juego original
- Galleta grande (`img/perfectCookie.png`): +1 galleta por clic, con efecto de pulsación, «+1» flotante y sonido.
- Los 20 edificios de `main.js` (Cursor … You), con sus iconos de `img/icons.png`, su precio base y su
  producción base (CpS) calculados con las mismas fórmulas, y el precio que sube ×1,15 por unidad comprada
  (`ceil(base · 1,15^cantidad)`).
- Tienda con 7 filas visibles y scroll (flechas ▲▼ de la cabecera o teclas ↑ ↓); las filas que no puedes pagar se atenúan.
- Contador con el formato del juego (`1,234`, `1.235 million`, `4.5 quadrillion`…) y «per second».
- Cursores orbitando la galleta (uno por cursor comprado, hasta 60).
- Galleta dorada (`img/goldCookie.png`): *Frenzy* (producción ×7 durante 77 s) o *Lucky*
  (+ el menor entre 15 % de tus galletas y 15 min de CpS, más 13). Aquí aparece cada 45–120 s
  (en el original, cada 5–15 min) para que se vea enseguida.

## Qué NO está (Scratch no puede con todo el juego)
`main.js` pesa ~1 MB; esto es el núcleo jugable, no un port completo. Faltan mejoras (upgrades), logros,
minijuegos, ascensión/prestigio, temporadas, leche, guardado y localización.

## Cómo está hecho
El texto dinámico se dibuja con la extensión Lápiz: el sprite `Texto` tiene un disfraz por carácter ASCII y
estampa una letra tras otra. Toda la interfaz se redibuja en un bloque «sin refrescar pantalla» por fotograma.
