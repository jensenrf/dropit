const { chromium } = require('playwright');
const path = require('path'), OUT = require('os').tmpdir() + '/';
const GAME = 'file://' + path.resolve(__dirname, '..', 'index.html'), REPORT = 'file://' + path.resolve(__dirname, '..', 'report-5b3f.html');
const results = [];
function check(name, ok, info) { results.push((ok ? 'PASS ' : 'FAIL ') + name + (info ? '  ' + info : '')); }
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 420, height: 760 } });
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto(GAME); await p.waitForTimeout(300);

  const r = await p.evaluate(() => {
    const D = window.__drop, out = {};
    D.dbg.day = '2026-11-01';
    const sig = lv => JSON.stringify(D.buildCards(lv));
    out.sameDaySame = [1, 2, 3, 4, 5, 7].every(lv => sig(lv) === sig(lv));
    const day1 = sig(4); D.dbg.day = '2026-11-02'; const day2 = sig(4); D.dbg.day = '2026-11-01';
    out.differentDaysDiffer = day1 !== day2;

    // order shuffles per run but the cards are the same set
    const key = c => JSON.stringify(c);
    const results = [];
    for (let lv = 1; lv <= 8; lv++) {
      const base = D.buildCards(lv);
      const baseSet = base.cards.map(key).sort().join('|');
      let orders = new Set(), setsMatch = true;
      for (let t = 0; t < 8; t++) {
        const plan = D.buildPlan(lv);
        const used = plan.map(x => key(x.card)).sort().join('|');
        setsMatch = setsMatch && used === baseSet;
        orders.add(plan.map(x => x.kind[0] + x.card.off.toFixed(3)).join(','));
      }
      results.push({ lv, setsMatch, distinctOrders: orders.size, nDecoy: base.nDecoy });
    }
    out.perLevel = results;

    // structural rules
    const rules = { barCount: true, noEarlyDecoy: true, noDoubleDecoy: true, hazardsOffTarget: true, hazardGating: true };
    for (let lv = 1; lv <= 8; lv++) for (let t = 0; t < 20; t++) {
      const plan = D.buildPlan(lv);
      if (plan.filter(x => x.kind === 'bar').length !== 10) rules.barCount = false;
      let bars = 0;
      plan.forEach((x, i) => {
        if (x.kind === 'bar') bars++;
        else { if (bars < (lv === 1 ? 3 : 1)) rules.noEarlyDecoy = false; if (plan[i + 1] && plan[i + 1].kind === 'decoy') rules.noDoubleDecoy = false; if (i === plan.length - 1) rules.noEarlyDecoy = false; }
        const uT = 0.5 + x.card.off * 0.5;
        x.card.segs.forEach(s => { if (s.b > uT - 0.13 && s.a < uT + 0.13) rules.hazardsOffTarget = false;
          if (s.type === 'spike' && lv < 3) rules.hazardGating = false; if (s.type === 'bomb' && lv < 4) rules.hazardGating = false; });
      });
    }
    out.rules = rules;

    // stratification: L2 offsets cover the range; timing values spread over every tenth
    const c2 = D.buildCards(2).cards.slice(0, 10).map(c => c.off).sort((a, b) => a - b);
    out.offRange = [c2[0].toFixed(2), c2[9].toFixed(2)];
    const uw = D.buildCards(2).cards.slice(0, 10).map(c => Math.floor(c.uw * 10)).sort((a, b) => a - b);
    out.uwDeciles = uw.join('');
    out.hazardCountsL4 = (() => { const c = D.buildCards(4).cards.slice(0, 10); return { spikes: c.filter(x => x.segs.some(s => s.type === 'spike')).length, bombs: c.filter(x => x.segs.some(s => s.type === 'bomb')).length }; })();
    return out;
  });
  check('same day -> identical deck contents (levels 1-7)', r.sameDaySame);
  check('different day -> different deck', r.differentDaysDiffer);
  check('every run uses the same card set', r.perLevel.every(x => x.setsMatch));
  check('order is reshuffled between runs', r.perLevel.filter(x => x.lv >= 2).every(x => x.distinctOrders >= 6), r.perLevel.map(x => `L${x.lv}:${x.distinctOrders}/8`).join(' '));
  check('exactly 10 real bars per level', r.rules.barCount);
  check('no fake-out too early, none back-to-back, none last', r.rules.noEarlyDecoy && r.rules.noDoubleDecoy);
  check('hazards never overlap the target', r.rules.hazardsOffTarget);
  check('spikes only from L3, bombs only from L4', r.rules.hazardGating);
  check('target offsets span the range evenly (L2)', Math.abs(+r.offRange[0]) > 0.18 && Math.abs(+r.offRange[1]) > 0.18, r.offRange.join(' .. '));
  check('timing values cover every tenth exactly once', r.uwDeciles === '0123456789', r.uwDeciles);
  console.log('   decoys per level: ' + r.perLevel.map(x => `L${x.lv}=${x.nDecoy}`).join(' ') + '   L4 hazards: ' + JSON.stringify(r.hazardCountsL4));

  // ---- play levels with the bot: 10 real bars each, decoys match the deck
  await p.evaluate(() => {
    window.__seen = { decoys: 0, bars: 0 };
    let armed = null, lastKey = '';
    (function loop() {
      const s = window.__drop.state();
      if (s.bar) { const k = s.level + ':' + s.idx + ':' + s.bar.kind + ':' + s.bar.tell; if (k !== lastKey) { lastKey = k; if (s.bar.kind === 'decoy') window.__seen.decoys++; } }
      if (s.S === 'fall' && s.bar.kind === 'bar') {
        if (!armed || armed.idx !== s.idx || armed.lvl !== s.level) armed = { idx: s.idx, lvl: s.level, aim: (Math.random() - .5) * 16, fired: false };
        const tY = s.bar.top + (0.5 + s.bar.off * 0.5) * s.bar.h;
        if (!armed.fired && tY + armed.aim >= s.handY) { armed.fired = true; window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' })); }
      }
      requestAnimationFrame(loop);
    })();
  });
  for (const lv of [1, 4]) {
    await p.evaluate(l => { window.__seen.decoys = 0; window.__drop.goto(l); }, lv);
    const expected = await p.evaluate(l => window.__drop.buildCards(l).nDecoy, lv);
    let s;
    for (let n = 0; n < 2000; n++) { s = await p.evaluate(() => window.__drop.state()); if (s.S === 'banner' || s.S === 'results') break; await p.waitForTimeout(100); }
    const seen = await p.evaluate(() => window.__seen.decoys);
    check(`bot clears level ${lv} using the deck`, s.S === 'banner' && s.level === lv && !s.dead, `S=${s.S} lost=${s.lost}`);
    check(`level ${lv}: fake-outs seen = deck's ${expected}`, seen === expected, `seen=${seen}`);
  }
  console.log(results.join('\n'));
  console.log('errors', JSON.stringify(errs));
  await b.close();
})().catch(e => { console.log(results.join('\n')); console.log('TEST CRASH', e.message); process.exit(1); });
