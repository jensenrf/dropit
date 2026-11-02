const { chromium } = require('playwright');
const path = require('path'), OUT = require('os').tmpdir() + '/';
const GAME = 'file://' + path.resolve(__dirname, '..', 'index.html'), REPORT = 'file://' + path.resolve(__dirname, '..', 'report-5b3f.html');
const results = []; const check = (n, ok, i) => results.push((ok ? 'PASS ' : 'FAIL ') + n + (i ? '  ' + i : ''));
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 420, height: 760 } });
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto(GAME); await p.waitForTimeout(300);
  const best = () => p.evaluate(() => window.__drop.state().best);
  const run = (lv, sc) => p.evaluate(([l, c]) => { window.__drop.goto(l); window.__drop.endRun(c, 'LEVEL FAILED'); }, [lv, sc]);
  let s;
  s = await best(); check('fresh day: no best yet', s.score === 0);
  await p.screenshot({ path: OUT + 'title_nobest.png' });
  await run(8, 7345); s = await best(); check('run 1 (L8, 7345) recorded together', s.score === 7345 && s.level === 8, JSON.stringify(s));
  await run(10, 5000); s = await best();
  check('deeper but lower-scoring run does NOT change best (stays L8)', s.score === 7345 && s.level === 8, JSON.stringify(s));
  await p.waitForTimeout(700); await p.screenshot({ path: OUT + 'results_notbest.png' });
  await run(6, 8000); s = await best(); check('higher score replaces best, with its own level', s.score === 8000 && s.level === 6, JSON.stringify(s));
  await p.evaluate(() => { window.__drop.dbg.day = '2026-11-02'; });
  s = await best(); check('next day: best resets', s.score === 0);
  await p.evaluate(() => { window.__drop.dbg.day = null; window.__drop.start(); });   // back to today's stored best
  s = await best(); check('same day again: best still there', s.score === 8000);
  // title screen text
  await p.reload(); await p.waitForTimeout(500);
  await p.screenshot({ path: OUT + 'title_best.png' });
  console.log(results.join('\n')); console.log('errors', JSON.stringify(errs));
  await b.close();
})();
