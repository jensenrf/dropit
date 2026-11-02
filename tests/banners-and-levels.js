const { chromium } = require('playwright');
const path = require('path'), OUT = require('os').tmpdir() + '/';
const GAME = 'file://' + path.resolve(__dirname, '..', 'index.html'), REPORT = 'file://' + path.resolve(__dirname, '..', 'report-5b3f.html');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 420, height: 760 } });
  const errs = []; p.on('pageerror', e => errs.push(String(e))); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto(GAME); await p.waitForTimeout(300);
  const out = [];
  // every banner level, rendered for ~3 frames each, then confirm the loop is still alive
  for (const lv of [1, 2, 3, 4, 5, 6, 7, 10, 25, 99]) {
    await p.evaluate(l => window.__drop.banner(l), lv);
    await p.waitForTimeout(120);
    if (lv === 6) await p.screenshot({ path: OUT + 'banner6.png' });
  }
  const t0 = await p.evaluate(() => new Promise(r => { let n = 0; const t = performance.now(); (function f() { if (++n >= 5) r(performance.now() - t); else requestAnimationFrame(f); })(); }));
  const alive = await p.evaluate(() => window.__drop.state().S);
  console.log('banners 1..99 rendered; page errors:', JSON.stringify(errs), ' state:', alive);
  // full real flow: clear level 5 -> level 6 banner -> skip -> level 6 plays
  await p.evaluate(() => window.__drop.goto(5));
  await p.evaluate(() => {
    let armed = null;
    (function loop() {
      const s = window.__drop.state();
      if (s.S === 'fall' && s.bar.kind === 'bar') {
        if (!armed || armed.idx !== s.idx || armed.lvl !== s.level) armed = { idx: s.idx, lvl: s.level, aim: (Math.random() - .5) * 10, fired: false };
        const tY = s.bar.top + (0.5 + s.bar.off * 0.5) * s.bar.h;
        if (!armed.fired && tY + armed.aim >= s.handY) { armed.fired = true; window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' })); }
      }
      requestAnimationFrame(loop);
    })();
  });
  let s;
  for (let n = 0; n < 2500; n++) { s = await p.evaluate(() => window.__drop.state()); if (s.S === 'banner' || s.S === 'results') break; await p.waitForTimeout(100); }
  console.log('after level 5:', s.S, 'level', s.level, 'dead', s.dead);
  await p.waitForTimeout(600); await p.screenshot({ path: OUT + 'banner_after5.png' });
  await p.evaluate(() => window.__drop.skipBanner());
  await p.waitForTimeout(1500);
  s = await p.evaluate(() => window.__drop.state());
  console.log('level 6 running:', s.level === 6 && (s.S === 'hang' || s.S === 'fall'), s.S, 'errors:', JSON.stringify(errs));
  await b.close();
})();
