# drop_it

A one-button reflex game. Bars ride in on a rail, a clamp rattles and lets go, and you catch each one as close to the center as you can before it hits the ground.

**Play:** https://jensenrf.github.io/dropit/

## How to play
- Tap (or press Space) to catch the falling bar.
- The closer to the center you catch it, the more points. Consecutive catches build a combo multiplier.
- Tapping before the clamp lets go is a miss ("TOO EARLY").
- Watch out for fake-outs: sometimes the clamp springs but the bar never drops. Tap then and you lose points and your combo.
- 20 bars per round. Your best score is saved in your browser.

## Tweaking
Every game-feel number (bar count, timing, gravity, scoring, fake-out odds) is in the `CFG` block at the top of the script in `index.html`.

It's a single file with no build step. Open `index.html` in a browser to run it locally.
