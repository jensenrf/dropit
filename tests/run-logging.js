const { chromium } = require('playwright');
const path = require('path'), OUT = require('os').tmpdir() + '/';
const GAME = 'file://' + path.resolve(__dirname, '..', 'index.html'), REPORT = 'file://' + path.resolve(__dirname, '..', 'report-5b3f.html');
const results = []; const check = (n, ok, i) => results.push((ok ? 'PASS ' : 'FAIL ') + n + (i ? '  ' + i : ''));
(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 420, height: 760 } })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  const logged = []; let fail = false;
  await p.route('**/rest/v1/rpc/**', async route => {
    const u = route.request().url(), cors = { 'access-control-allow-origin': '*' };
    if (u.endsWith('log_run')) { logged.push(JSON.parse(route.request().postData())); return fail ? route.abort() : route.fulfill({ status: 204, headers: cors, body: '' }); }
    if (u.endsWith('leaderboard_today')) return route.fulfill({ status: 200, contentType: 'application/json', headers: cors, body: '[]' });
    route.fulfill({ status: 200, contentType: 'application/json', headers: cors, body: '[]' });
  });
  await p.goto(GAME); await p.waitForTimeout(300);
  const end = (lv, sc, why) => p.evaluate(([l, s, w]) => { window.__drop.goto(l); window.__drop.endRun(s, w); }, [lv, sc, why]);
  await end(8, 7345, 'BOMB BLEW UP YOUR CLAMP'); await p.waitForTimeout(250);
  await end(5, 900, 'CLAMP DESTROYED'); await p.waitForTimeout(250);
  await end(3, 120, 'LEVEL FAILED'); await p.waitForTimeout(250);
  await end(1, 0, 'LEVEL FAILED'); await p.waitForTimeout(250);
  check('one log per finished run (4 runs, 4 logs)', logged.length === 4, String(logged.length));
  check('bomb ends -> cause bomb, level+score right', JSON.stringify(logged[0]) === JSON.stringify({ p_level: 8, p_score: 7345, p_cause: 'bomb' }), JSON.stringify(logged[0]));
  check('clamp ends -> cause clamp', logged[1].p_cause === 'clamp' && logged[1].p_level === 5 && logged[1].p_score === 900);
  check('failed level -> cause failed', logged[2].p_cause === 'failed' && logged[2].p_level === 3);
  check('zero-score run still logged', logged[3].p_score === 0 && logged[3].p_level === 1);
  // a logging failure must never disturb the game
  fail = true; await end(4, 500, 'LEVEL FAILED'); await p.waitForTimeout(400);
  const s = await p.evaluate(() => window.__drop.state());
  check('network failure on logging does not break the game', s.S === 'results' || s.S === 'entry', s.S);
  console.log(results.join('\n')); console.log('errors', JSON.stringify(errs));
  await b.close();
})();
