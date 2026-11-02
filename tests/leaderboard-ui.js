const { chromium } = require('playwright');
const path = require('path'), OUT = require('os').tmpdir() + '/';
const GAME = 'file://' + path.resolve(__dirname, '..', 'index.html'), REPORT = 'file://' + path.resolve(__dirname, '..', 'report-5b3f.html');
const T = OUT + '';
const results = [];
function check(name, ok, info) { results.push((ok ? 'PASS ' : 'FAIL ') + name + (info ? '  ' + info : '')); }
const mkRows = scores => scores.map((sc, i) => ({ place: i + 1, initials: ['ACE', 'BOB', 'CAT', 'DAN', 'EVE', 'FAY', 'GUS', 'HAL', 'IVY', 'JOE'][i], score: sc, level: 3 + (i % 3), accuracy: 80 }));

(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 420, height: 760 } });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  let mode = 'offline', rows = [], submitted = [], submitReply = null;
  await p.route('**/rest/v1/rpc/**', async route => {
    const url = route.request().url(); const hdr = route.request().headers();
    if (mode === 'offline') return route.abort();
    check_hdr = hdr.apikey;
    if (url.endsWith('leaderboard_today')) return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(rows) });
    if (url.endsWith('submit_score')) {
      submitted.push(JSON.parse(route.request().postData()));
      if (submitReply === 'not_top_10') return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ message: 'not_top_10' }) });
      return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify([{ place: 4, played_on: '2026-11-01' }]) });
    }
    route.continue();
  });
  var check_hdr = null;
  await p.goto(GAME); await p.waitForTimeout(300);
  const lb = () => p.evaluate(() => window.__drop.lb());
  const until = (fn, arg, to = 8000) => p.waitForFunction(fn, arg, { timeout: to, polling: 20 });
  const click = (x, y) => p.mouse.click(x, y);
  let s;

  // 1. offline: results shows offline note, no entry
  mode = 'offline';
  await p.evaluate(() => { window.__drop.goto(2); window.__drop.endRun(420, 'LEVEL FAILED'); });
  await until(() => window.__drop.lb().lbNote === 'LEADERBOARD OFFLINE');
  s = await lb(); check('offline: stays on results with note', s.S === 'results' && s.lbNote === 'LEADERBOARD OFFLINE');
  await p.waitForTimeout(700); await p.screenshot({ path: T + 'lb_results_offline.png' });

  // 2. full board, score too low -> no entry
  mode = 'online'; rows = mkRows([2000, 1800, 1500, 1200, 1000, 900, 800, 700, 600, 500]);
  await p.evaluate(() => { window.__drop.goto(2); window.__drop.endRun(300, 'LEVEL FAILED'); });
  await until(() => window.__drop.lb().lbNote.startsWith('NOT IN TODAY'));
  s = await lb(); check('score below #10: no entry', s.S === 'results', s.lbNote);

  // 3. board with space -> entry; check the apikey header too
  rows = mkRows([2000, 1800, 1500]);
  await p.evaluate(() => { window.__drop.goto(3); window.__drop.endRun(1600, 'LEVEL FAILED'); });
  await until(() => window.__drop.lb().S === 'entry');
  s = await lb(); check('qualifying score opens initials entry', s.S === 'entry' && s.entry.place === 3, `place=${s.entry && s.entry.place}`);
  check('request used publishable key', check_hdr && check_hdr.startsWith('sb_publishable_'));
  await p.screenshot({ path: T + 'lb_entry.png' });

  // 4. arrows via real clicks: slot 0 up (A->B), slot 1 down (A->9)
  await click(210 - 84, 331);   // slot 0 up arrow
  await click(210, 461);        // slot 1 down arrow
  s = await lb(); check('arrow taps change letters', s.entry.ch[0] === 'B' && s.entry.ch[1] === '9', JSON.stringify(s.entry.ch));

  // 5. keyboard typing fills + lowercase becomes upper
  await click(210 - 84, 400);   // select slot 0
  await p.keyboard.type('zap');
  s = await lb(); check('typing fills slots uppercase', s.entry.ch.join('') === 'ZAP', s.entry.ch.join(''));
  await p.screenshot({ path: T + 'lb_entry_typed.png' });

  // 6. submit with Enter key -> request body, board shown with highlight
  rows = mkRows([2000, 1800, 1600, 1500]);
  await p.keyboard.press('Enter');
  await until(() => window.__drop.lb().S === 'board');
  s = await lb();
  check('submitted correct payload', submitted.length === 1 && submitted[0].p_initials === 'ZAP' && submitted[0].p_score === 1600 && submitted[0].p_level === 3, JSON.stringify(submitted[0]));
  check('board opens highlighting place 4', s.S === 'board' && s.highlight === 4 && s.boardFrom === 'run');
  await p.waitForTimeout(800); await p.screenshot({ path: T + 'lb_board_after.png' });

  // 7. tap on board -> play again (banner)
  await click(210, 400);
  s = await lb(); check('board tap starts a new run', s.S === 'banner');

  // 8. someone beat you to it: server says not_top_10 -> board, no highlight
  submitted = []; submitReply = 'not_top_10'; rows = mkRows([2000, 1800, 1500]);
  await p.evaluate(() => { window.__drop.goto(3); window.__drop.endRun(1600, 'LEVEL FAILED'); });
  await until(() => window.__drop.lb().S === 'entry');
  await click(210, 528);   // ENTER button
  await until(() => window.__drop.lb().S === 'board');
  s = await lb(); check('not_top_10 reply handled gracefully', s.S === 'board' && s.highlight === 0);
  submitReply = null;

  // 9. title board button + back
  await p.evaluate(() => { window.__drop.goto(1); });   // reach a state, then go to title via results
  await p.evaluate(() => window.__drop.endRun(0, 'LEVEL FAILED'));
  await p.waitForTimeout(700);
  await click(298, 555);  // TODAY'S TOP 10 on results
  s = await lb(); check('results board button opens board', s.S === 'board' && s.boardFrom === 'results');
  await p.waitForTimeout(500); await p.screenshot({ path: T + 'lb_board_from_results.png' });
  await click(210, 300); s = await lb(); check('board tap returns to results', s.S === 'results');

  // 10. skip
  rows = mkRows([2000]);
  await p.evaluate(() => { window.__drop.goto(2); window.__drop.endRun(900, 'LEVEL FAILED'); });
  await until(() => window.__drop.lb().S === 'entry');
  await click(210, 592); s = await lb(); check('SKIP returns to results', s.S === 'results' && !s.entry);

  console.log(results.join('\n'));
  console.log('errors', JSON.stringify(errs));
  await b.close();
})().catch(e => { console.log(results.join('\n')); console.log('TEST CRASH', e.message); process.exit(1); });
