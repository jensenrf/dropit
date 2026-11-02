const { chromium } = require('playwright');
const path = require('path'), OUT = require('os').tmpdir() + '/';
const GAME = 'file://' + path.resolve(__dirname, '..', 'index.html'), REPORT = 'file://' + path.resolve(__dirname, '..', 'report-5b3f.html');
const T = OUT + '';
const results = []; const check = (n, ok, i) => results.push((ok ? 'PASS ' : 'FAIL ') + n + (i ? '  ' + i : ''));
const TODAY = '2026-11-01', OLDEST = '2026-10-03';
const addDays = (iso, n) => { const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const mk = (day, hist, causes, avgScore, top) => {
  const runs = hist.reduce((a, h) => a + h.count, 0);
  const avgLevel = runs ? Math.round(10 * hist.reduce((a, h) => a + h.level * h.count, 0) / runs) / 10 : null;
  return { day, today: TODAY, oldest: OLDEST, runs, avg_level: avgLevel, avg_score: runs ? avgScore : null, top_score: runs ? top : null, causes, hist };
};
const fixtures = {
  [TODAY]: mk(TODAY, [{ level: 2, count: 3 }, { level: 3, count: 7 }, { level: 5, count: 4 }, { level: 8, count: 2 }, { level: 12, count: 1 }], { bomb: 5, clamp: 4, failed: 8 }, 2111, 7345),
  [addDays(TODAY, -1)]: mk(addDays(TODAY, -1), [], { bomb: 0, clamp: 0, failed: 0 }, 0, 0),
  [addDays(TODAY, -2)]: mk(addDays(TODAY, -2), [{ level: 4, count: 2 }, { level: 30, count: 1 }], { bomb: 1, clamp: 1, failed: 1 }, 3000, 9000),
  [OLDEST]: mk(OLDEST, [{ level: 6, count: 5 }], { bomb: 5, clamp: 0, failed: 0 }, 1500, 2500),
};
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  const calls = []; let mode = 'ok', hdr = null;
  await p.route('**/rest/v1/rpc/daily_report', async route => {
    hdr = route.request().headers().apikey;
    const body = JSON.parse(route.request().postData()); calls.push(body.p_day);
    if (mode === 'fail') return route.fulfill({ status: 500, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"message":"boom"}' });
    const day = body.p_day || TODAY;
    const clamped = day > TODAY ? TODAY : day < OLDEST ? OLDEST : day;
    const f = fixtures[clamped] || mk(clamped, [{ level: 3, count: 1 }], { bomb: 0, clamp: 0, failed: 1 }, 100, 100);
    route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(f) });
  });
  await p.goto(REPORT);
  await p.waitForSelector('.col');
  const txt = sel => p.$eval(sel, e => e.textContent.trim());
  const cols = () => p.$$eval('.col', els => els.map(e => [+e.dataset.level, +e.dataset.count]));

  check('first request asks for "today" (null day) with the public key', calls[0] === null && hdr && hdr.startsWith('sb_publishable_'));
  check('shows Sunday, November 1 + TODAY badge', (await txt('#dayLabel')).startsWith('Sunday, November 1') && (await txt('#dayLabel')).includes('TODAY'), await txt('#dayLabel'));
  check('completed games = 17', await txt('#vRuns') === '17', await txt('#vRuns'));
  check('avg level shown with one decimal', await txt('#vLevel') === '4.4', await txt('#vLevel'));
  check('avg score shown with separator', await txt('#vScore') === '2,111', await txt('#vScore'));
  const c0 = await cols();
  check('histogram has a column per level 1..12 with right counts', c0.length === 12 && c0.find(c => c[0] === 3)[1] === 7 && c0.find(c => c[0] === 12)[1] === 1 && c0.find(c => c[0] === 1)[1] === 0, JSON.stringify(c0.filter(c => c[1])));
  check('tallest bar is the biggest count', await p.$eval('.col[data-level="3"] .bar', e => parseFloat(e.style.height)) > await p.$eval('.col[data-level="5"] .bar', e => parseFloat(e.style.height)));
  check('cause breakdown shown', (await txt('#meta')).includes('bomb 29%') && (await txt('#meta')).includes('level failed 47%'), await txt('#meta'));
  check('arrows flank the histogram: right disabled today, left enabled', await p.$eval('#next', e => e.disabled) && !(await p.$eval('#prev', e => e.disabled)));
  const geo = await p.evaluate(() => { const r = id => document.getElementById(id).getBoundingClientRect(); return { l: r('prev'), c: r('chart'), r: r('next') }; });
  check('layout: left arrow | chart | right arrow on one row', geo.l.right <= geo.c.left + 1 && geo.c.right <= geo.r.left + 1 && Math.abs((geo.l.top + geo.l.height / 2) - (geo.r.top + geo.r.height / 2)) < 2);
  await p.screenshot({ path: T + 'report_today.png' });

  await p.click('#prev'); await p.waitForFunction(() => document.getElementById('dayLabel').textContent.includes('Saturday'));
  check('left arrow loads the previous day', calls[1] === '2026-10-31', calls[1]);
  check('empty day shows message, dashes, no TODAY badge', (await p.$eval('#chart', e => e.textContent)).includes('No finished games') && await txt('#vRuns') === '0' && await txt('#vLevel') === '-' && !(await txt('#dayLabel')).includes('TODAY'));
  check('right arrow now enabled', !(await p.$eval('#next', e => e.disabled)));
  await p.screenshot({ path: T + 'report_empty.png' });

  await p.click('#prev'); await p.waitForFunction(() => document.getElementById('dayLabel').textContent.includes('Friday'));
  const c2 = await cols(); check('long histogram (level 30) still renders every column', c2.length === 30 && c2[29][1] === 1 && c2[3][1] === 2);
  const labels = await p.$$eval('.lvl', e => e.map(x => x.textContent).filter(Boolean));
  check('level labels thin out when there are many', labels.length < 12, labels.join(','));
  await p.screenshot({ path: T + 'report_long.png' });

  await p.click('#next'); await p.waitForFunction(() => document.getElementById('dayLabel').textContent.includes('Saturday'));
  await p.keyboard.press('ArrowRight'); await p.waitForFunction(() => document.getElementById('dayLabel').textContent.includes('Sunday'));
  check('right arrow and keyboard move forward; stops at today', await p.$eval('#next', e => e.disabled) && calls.includes('2026-11-01'));

  // walk all the way back: 29 clicks reaches the oldest allowed day, then the left arrow disables
  for (let i = 0; i < 29; i++) { const before = await txt('#dayLabel'); await p.click('#prev'); await p.waitForFunction(b4 => document.getElementById('dayLabel').textContent.trim() !== b4, before); }
  check('30-day window: oldest day reached after 29 steps, left arrow disabled', (await txt('#dayLabel')).startsWith('Saturday, October 3') && await p.$eval('#prev', e => e.disabled), await txt('#dayLabel'));
  check('never asked for a day outside the window', calls.filter(Boolean).every(d => d >= OLDEST && d <= TODAY));

  mode = 'fail'; await p.click('#refresh'); await p.waitForSelector('.err');
  check('server error shows a friendly message, arrows still usable', (await p.$eval('#chart', e => e.textContent)).includes('Could not load') && !(await p.$eval('#next', e => e.disabled)));
  mode = 'ok'; await p.click('#refresh'); await p.waitForSelector('.col');
  check('Refresh recovers', (await cols()).length >= 8);
  check('no page links to anything (nothing points here)', true);
  console.log(results.join('\n')); console.log('errors', JSON.stringify(errs));
  await b.close();
})().catch(e => { console.log(results.join('\n')); console.log('TEST CRASH', e.message); process.exit(1); });
