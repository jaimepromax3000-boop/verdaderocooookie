// Renderiza los 95 caracteres ASCII imprimibles con la fuente real del juego (Merriweather 900)
// en varios colores/tamanos y guarda sb3/glyphs.json (PNG en base64 + anchos de avance).
//   NODE_PATH=$(npm root -g) node sb3/render_glyphs.js
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

// banco: [color, tamano de fuente en px (a resolucion 2), alto de celda, margen, grosor del contorno]
const BANKS = {
  w: ['#ffffff', 20, 32, 4, 2.0],   // blanco, texto pequeno
  g: ['#66ff66', 20, 32, 4, 2.0],   // precio asequible
  r: ['#ff6666', 20, 32, 4, 2.0],   // precio inasequible
  y: ['#ffcc00', 20, 32, 4, 2.0],   // dorado
  W: ['#ffffff', 44, 64, 6, 3.6],   // blanco, texto grande
  Y: ['#ffcc00', 44, 64, 6, 3.6],   // dorado, texto grande
};

(async () => {
  const browser = await chromium.launch();
  const page = await (await browser.newContext()).newPage();
  await page.route(/^https?:/, r => r.abort());
  await page.goto('file://' + path.resolve(__dirname, '..', 'index.html'));
  await page.waitForTimeout(2000);
  const out = await page.evaluate(async (BANKS) => {
    await document.fonts.load('900 20px Merriweather', 'abcXYZ019');
    const res = {};
    for (const [b, [col, px, cellH, pad, lw]] of Object.entries(BANKS)) {
      const font = '900 ' + px + 'px Merriweather';
      const m = document.createElement('canvas').getContext('2d');
      m.font = font;
      const adv = [], imgs = [];
      for (let c = 32; c < 127; c++) {
        const ch = String.fromCharCode(c);
        const a = m.measureText(ch).width;
        adv.push(a);
        const cv = document.createElement('canvas');
        cv.width = Math.ceil(a) + pad * 2; cv.height = cellH;
        const g = cv.getContext('2d');
        g.font = font; g.textBaseline = 'middle'; g.textAlign = 'left'; g.lineJoin = 'round';
        g.lineWidth = lw; g.strokeStyle = 'rgba(0,0,0,0.85)';
        g.strokeText(ch, pad, cellH / 2 + 1);
        g.fillStyle = col;
        g.fillText(ch, pad, cellH / 2 + 1);
        imgs.push(cv.toDataURL('image/png').split(',')[1]);
      }
      res[b] = { px, cellH, pad, adv, imgs };
    }
    return res;
  }, BANKS);
  fs.writeFileSync(path.join(__dirname, 'glyphs.json'), JSON.stringify(out));
  console.log('banks:', Object.keys(out).join(','), 'adv(M) small/big =', (out.w.adv[45] ).toFixed(1), (out.W.adv[45]).toFixed(1));
  await browser.close();
})();
