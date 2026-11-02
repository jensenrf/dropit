const { chromium } = require('playwright');
const path = require('path'), OUT = require('os').tmpdir() + '/';
const GAME = 'file://' + path.resolve(__dirname, '..', 'index.html'), REPORT = 'file://' + path.resolve(__dirname, '..', 'report-5b3f.html');
const T = OUT + '';
const results = [];
function check(name, ok, info) { results.push((ok ? 'PASS ' : 'FAIL ') + name + (info ? '  ' + info : '')); }
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 420, height: 760 } });
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto(GAME); await p.waitForTimeout(300);
  const st = () => p.evaluate(() => window.__drop.state());
  const until = (fn, to = 15000) => p.waitForFunction(fn, null, { timeout: to, polling: 8 });
  const force = segs => p.evaluate(s => { window.__drop.dbg.next = { kind: 'bar', off: 0, segs: s }; }, segs);
  const atCenter = () => until(() => { const s = window.__drop.state(); return s.S === 'fall' && s.bar.top + s.bar.h / 2 >= s.handY - 2; });
  let s;

  // ---- T1: catching the planted bomb ends the run (real key press)
  await force([{ type: 'bomb', a: 0.4, b: 0.6 }]);
  await p.evaluate(() => window.__drop.goto(4));
  await until(() => window.__drop.state().bar.phase === 'wait');
  await p.screenshot({ path: T + 'v31_bomb_bar.png' });
  await atCenter(); await p.keyboard.press('Space');
  s = await st(); check('bomb section catch -> dead', !!s.dead && s.dead.startsWith('BOMB') && s.hp === 0, `dead=${s.dead} hp=${s.hp}`);
  await p.waitForTimeout(250); await p.screenshot({ path: T + 'v31_boom.png' });
  await until(() => window.__drop.state().S === 'results', 6000);
  check('game over screen reached after bomb', true);
  await p.screenshot({ path: T + 'v31_gameover_bomb.png' });

  // ---- T2: bomb section elsewhere on the bar, catch on target = safe
  await force([{ type: 'bomb', a: 0.74, b: 0.94 }]);
  await p.evaluate(() => window.__drop.goto(4));
  await atCenter(); await p.keyboard.press('Space');
  s = await st(); check('catching off the bomb is safe & scores', !s.dead && s.score > 0 && s.caught === 1, `score=${s.score} dead=${s.dead}`);

  // ---- T3: three spikes -> health 0 -> game over (real key presses)
  await force([{ type: 'spike', a: 0.4, b: 0.6 }]);
  await p.evaluate(() => window.__drop.goto(3));
  for (let k = 0; k < 3; k++) {
    await atCenter();
    await force([{ type: 'spike', a: 0.4, b: 0.6 }]);
    await p.keyboard.press('Space');
    s = await st();
    check(`spike ${k + 1}: hp=${2 - k}, combo reset`, s.hp === 2 - k && s.streak === 0, `hp=${s.hp} dead=${s.dead}`);
    if (k < 2) await until(() => window.__drop.state().S === 'hang', 6000);
  }
  check('hp 0 -> dead CLAMP DESTROYED', s.dead === 'CLAMP DESTROYED');
  await until(() => window.__drop.state().S === 'results', 6000);
  check('game over screen reached after hp 0', true);
  await p.screenshot({ path: T + 'v31_gameover_hp.png' });

  // ---- T4: a miss resets combo but does not end the run
  await p.evaluate(() => { window.__drop.dbg.next = null; window.__drop.goto(1); });
  await atCenter(); await p.keyboard.press('Space');
  s = await st(); const comboBefore = s.streak;
  await until(() => window.__drop.state().S === 'hang' && window.__drop.state().bar.kind === 'bar' && window.__drop.state().bar.phase === 'wait', 12000);
  await p.keyboard.press('Space');   // too early
  s = await st();
  check('miss resets combo, run continues', comboBefore === 1 && s.streak === 0 && !s.dead && s.lost === 1, `before=${comboBefore} after=${s.streak} dead=${s.dead}`);

  // ---- T5: showcase bar with spike + bomb + off-center target
  await p.evaluate(() => { window.__drop.dbg.next = { kind: 'bar', off: 0.3, segs: [{ type: 'bomb', a: 0.06, b: 0.26 }, { type: 'spike', a: 0.74, b: 0.9 }] }; window.__drop.goto(4); });
  await until(() => window.__drop.state().bar.phase === 'wait');
  await p.screenshot({ path: T + 'v31_traps_bar.png' });

  // ---- T6: bot plays levels 3 and up; never hits hazards when aiming for the target
  await p.evaluate(() => {
    let armed = null;
    (function loop() {
      const s = window.__drop.state();
      if (s.S === 'fall' && s.bar.kind === 'bar') {
        if (!armed || armed.idx !== s.idx || armed.lvl !== s.level) armed = { idx: s.idx, lvl: s.level, aim: (Math.random() - .5) * 16, fired: false };
        const tY = s.bar.top + (0.5 + s.bar.off * 0.5) * s.bar.h;
        if (!armed.fired && tY + armed.aim >= s.handY) { armed.fired = true; window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' })); }
      }
      requestAnimationFrame(loop);
    })();
    window.__drop.goto(4);
  });
  for (let n = 0; n < 1500; n++) {
    s = await st();
    if (s.S === 'banner' || s.S === 'results') break;
    await p.waitForTimeout(100);
  }
  check('bot clears level 4 (hazards present, aiming at target)', s.S === 'banner' && !s.dead, `S=${s.S} dead=${s.dead} lost=${s.lost}`);
  console.log(results.join('\n'));
  console.log('errors', JSON.stringify(errs));
  await b.close();
})().catch(e => { console.log(results.join('\n')); console.log('TEST CRASH', e.message); process.exit(1); });
