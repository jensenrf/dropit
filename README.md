# drop_it

A one-button reflex game. Bars ride in on a rail, a clamp rattles and lets go, and you catch each one as close to the center as you can before it hits the ground.

**Play:** https://jensenrf.github.io/dropit/

## How to play
- Tap (or press Space) to catch the falling bar as close to the glowing target as you can. Consecutive catches build a combo multiplier.
- Tapping before the clamp lets go is a miss ("TOO EARLY").
- A run is a series of levels. Catch 6 of 10 bars to clear one. You get 1 clamp health back after each level (max 3).
- The run ends if you fail a level, your clamp health hits 0, or you catch a bomb.
- Fake-outs: sometimes the clamp lets go, the bar drops a little, then gets re-grabbed. Tap then and you lose points and your combo.
- New twists as you climb: moving target (L2), ghost sections you slip through (L3), spikes that damage the clamp (L4), bombs (L5), then everything speeds up.
- Your best score and level are saved in your browser.

## Tweaking
Every game-feel number (bar count, timing, gravity, scoring, fake-out odds) is in the `CFG` block at the top of the script in `index.html`.

It's a single file with no build step. Open `index.html` in a browser to run it locally.
