// Extrae los datos reales del juego (mejoras, logros, edificios, tiers, leches) ejecutando
// index.html en un navegador sin red y volcando los objetos de `Game` a sb3/game_data.json.
//   NODE_PATH=$(npm root -g) node sb3/extract_game_data.js
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

(async () => {
  const browser = await chromium.launch();
  const page = await (await browser.newContext()).newPage();
  await page.route(/^https?:/, r => r.abort());
  await page.goto('file://' + path.resolve(__dirname, '..', 'index.html'));
  await page.waitForFunction(() => window.Game && Game.ready, null, { timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(3000);
  const data = await page.evaluate(() => {
    const strip = s => String(s || '').replace(/<q>.*?<\/q>/g, '').replace(/<br>/g, ' ').replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&reg;/g, '');
    const ups = Object.values(Game.UpgradesById).map(u => ({
      id: u.id, name: u.name, price: u.basePrice, icon: u.icon, pool: u.pool || '',
      tier: u.tier === undefined ? null : u.tier,
      b1: u.buildingTie1 ? u.buildingTie1.name : null, b2: u.buildingTie2 ? u.buildingTie2.name : null,
      order: u.order, desc: strip(typeof u.desc === 'function' ? u.desc() : u.desc),
      power: typeof u.power === 'function' ? null : u.power,
    }));
    const achs = Object.values(Game.AchievementsById).map(a => ({
      id: a.id, name: a.name, desc: strip(a.desc), icon: a.icon, pool: a.pool || '', order: a.order,
    }));
    const unlockAt = Game.UnlockAt.map(x => ({ name: x.name, cookies: x.cookies, require: x.require || null, season: x.season || null }));
    const objs = Object.values(Game.ObjectsById).map(o => ({
      id: o.id, name: o.name, single: o.single, plural: o.plural, base: o.basePrice, cps: o.baseCps, icon: o.iconColumn,
      art: o.art && { base: o.art.base, pic: typeof o.art.pic === 'string' ? o.art.pic : null, bg: o.art.bg, xV: o.art.xV,
        yV: o.art.yV, w: o.art.w, rows: o.art.rows, x: o.art.x, y: o.art.y, frames: o.art.frames },
    }));
    return {
      ups, achs, unlockAt, objs,
      milks: Game.Milks.map(m => ({ name: m.name, pic: m.pic, icon: m.icon })),
      tiers: Object.fromEntries(Object.entries(Game.Tiers).map(([k, v]) => [k, { unlock: v.unlock, achievUnlock: v.achievUnlock, price: v.price, iconRow: v.iconRow }])),
      bank: Game.BankAchievements.map(a => [a.name, a.threshold]),
      cps: Game.CpsAchievements.map(a => [a.name, a.threshold]),
      prodAch: Object.values(Game.ObjectsById).map(o => o.productionAchievs.map(p => [p.achiev.name, p.pow])),
      tierAch: Object.values(Game.ObjectsById).map(o => Object.entries(o.tieredAchievs).map(([t, a]) => [t, a.name])),
    };
  });
  fs.writeFileSync(path.join(__dirname, 'game_data.json'), JSON.stringify(data));
  console.log('upgrades', data.ups.length, 'achievements', data.achs.length, 'objects', data.objs.length);
  await browser.close();
})();
