# Tests

Headless browser tests (Playwright) that play the real game. They run against the local `index.html` and `report-5b3f.html` in the parent folder, and mock the network, so they never touch the live database.

```
npm i playwright && npx playwright install chromium   # once
node tests/game-over-paths.js      # bomb, 3 spikes, miss-resets-combo, bot clears a level
node tests/leaderboard-ui.js       # initials entry, board screens, offline, server replies
node tests/daily-deck.js           # same-day identical decks, reshuffled order, balance rules, bot plays
node tests/banners-and-levels.js   # every level banner renders; level 5 -> 6 transition
node tests/best-today.js           # "best today" is tied to one run and resets daily
node tests/run-logging.js          # one anonymous log per finished run, right cause
node tests/report-page.js          # owner report: stats, histogram, arrows, 30-day window
```

Each prints PASS/FAIL lines and `errors []` (page errors). Screenshots go to the OS temp folder.

The game exposes a small `window.__drop` test surface (state, goto, endRun, banner, buildCards, dbg.next, dbg.day). Keep it if the code is reorganised.
