# drop_it

A one-button reflex game. Bars ride in on a rail, a clamp rattles and lets go, and you catch each one as close to the center as you can before it hits the ground.

**Play:** https://jensenrf.github.io/dropit/

## How to play
- Tap (or press Space) to catch the falling bar as close to the glowing target as you can. Consecutive catches build a combo multiplier.
- Tapping before the clamp lets go is a miss ("TOO EARLY").
- A run is a series of levels. Catch 6 of 10 bars to clear one. You get 1 clamp health back after each level (max 3).
- The run ends if you fail a level, your clamp health hits 0, or you catch a bomb. A single miss only resets your combo.
- Fake-outs: sometimes the clamp lets go, the bar drops a little, then gets re-grabbed. Tap then and you lose points and your combo.
- New twists as you climb: moving target (L2), spiked sections that cost 1 clamp health (L3), planted bombs that blow up the clamp and end the run (L4), then everything speeds up.
- Your best score and level are saved in your browser.

## Daily leaderboard
- Finish a run in today's top 10 and you enter 3 letters/numbers, arcade style (tap the arrows or just type).
- "Today's Top 10" is on the title screen and the game-over screen. The board resets each day at midnight Arizona time (old scores are kept in the database).
- Backed by a small Supabase database (`scores` table, `submit_score` and `leaderboard_today` functions). The key in `index.html` is a public publishable key: the database only allows reading today's scores and submitting through `submit_score`, which checks initials, plausibility for the level reached, and that the score makes the top 10.
- If the player is offline the game still works and just shows "leaderboard offline".

## Tweaking
Every game-feel number (bar count, timing, gravity, scoring, fake-out odds) is in the `CFG` block at the top of the script in `index.html`.

It's a single file with no build step. Open `index.html` in a browser to run it locally.
