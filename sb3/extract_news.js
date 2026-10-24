// Muestrea Game.getNewTicker() del juego real en distintos estados y guarda los titulares en sb3/news.json
//   NODE_PATH=$(npm root -g) node sb3/extract_news.js
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
(async () => {
  const browser = await chromium.launch();
  const page = await (await browser.newContext()).newPage();
  await page.route(/^https?:/, r => r.abort());
  await page.goto('file://' + path.resolve(__dirname, '..', 'index.html'));
  await page.waitForFunction(() => window.Game && Game.ready, null, { timeout: 60000 });
  await page.waitForTimeout(1500);
  const data = await page.evaluate(() => {
    const clean = s => String(s).replace(/<sig>(.*?)<\/sig>/g, ' - $1').replace(/<q>/g, '"').replace(/<\/q>/g, '"')
      .replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
    const names = Object.keys(Game.Objects);
    const reset = () => { for (const n of names) Game.Objects[n].amount = 0; Game.cookiesEarned = 0; Game.season = ''; Game.pledges = 0; Game.elderWrath = 0; };
    const sample = n => { const set = new Set(); for (let i = 0; i < n; i++) { Game.TickerN = i; try { Game.getNewTicker(true); } catch (e) {} if (Game.Ticker) set.add(clean(Game.Ticker)); } return set; };
    const thresholds = [0, 10, 100, 1e3, 1e4, 1e5, 1e6, 1e7, 1e8, 1e9, 1e10, 1e11, 1e12, 1e13, 1e14, 1e15, 1e16, 1e17, 1e18];
    const out = { general: [], buildings: {} };
    const seen = new Set();
    for (const t of thresholds) {
      reset(); Game.cookiesEarned = t;
      for (const x of sample(150)) if (!seen.has(x)) { seen.add(x); out.general.push([t, x]); }
    }
    reset(); Game.cookiesEarned = 1e12;
    const base = sample(150);
    for (const n of names) {
      if (n === 'Cursor') continue;
      reset(); Game.cookiesEarned = 1e12; Game.Objects[n].amount = 50;
      out.buildings[n] = [...sample(260)].filter(x => !base.has(x));
    }
    return out;
  });
  fs.writeFileSync(path.join(__dirname, 'news.json'), JSON.stringify(data));
  console.log('general', data.general.length, Object.entries(data.buildings).map(([k, v]) => k + ':' + v.length).join(' '));
  await browser.close();
})();
