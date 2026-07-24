# 🍃 Pip's Inventor Islands

A child-friendly 3D platform-adventure that teaches **Year 1 maths** (with early
algebraic thinking) and **Design & Technology** through play — not quizzes.
Everything the player counts, builds, balances and shares directly changes the
world.

**All characters, names, models, music and sounds are original.** Every 3D model
is built from primitives at load time, the music is synthesised live from a
pentatonic sequencer, and narration uses the browser's built-in speech voice.
No ads, no accounts, no purchases — progress saves to this device only.

## How to play

Open `pips-inventor-islands/index.html` in a modern desktop or tablet browser.
No install, no build, works offline. (If your browser blocks local files, run
any static server, e.g. `npx http-server`, and open the printed URL.)

| Action | Keyboard | Touch |
|---|---|---|
| Move | WASD / arrow keys | left joystick |
| Jump / double-jump | SPACE (again in the air) | JUMP |
| Flutter (fall slowly) | hold SPACE while falling | hold JUMP |
| Talk / pick up / place | E or ENTER | DO |
| Leaf-vine grab (pull sparkles) | Q | VINE |
| Ground stomp | X (in the air) | DO in the air |
| 🍃 Leaf Tornado (fun spin) | F | SPIN |
| ✨ Sparkle Blast (fun burst) | G | ZAP |
| Camera | drag the screen | drag the screen |
| Pause | ESC or P | ⏸ button |

The two "fun moves" are purely cosmetic — a spinning leaf-tornado and a rainbow
sparkle fountain. They're there for delight and never affect any challenge,
route or collectible, so children can spam them freely.

Gamepads work too (left stick move, A jump, X do, B vine, right stick camera).

## The story

The Mix-Up Machine has malfunctioned and scattered the five **Idea Cores**
across the Inventor Islands. Pip — a small leaf-tailed inventor — explores each
island, counts, builds, tests and **improves** inventions to bring the cores
home. Professor Pebble's motto: *"A first design is an idea. A tested design is
information."*

## What's in this build

### ✅ Inventor Village (hub) — complete
Workshop, practice-jump area with signposted tutorials, progress-map board,
build table, five travel gates, Professor Pebble, and a **Challenge Door**
(number bonds to 10, unlocks with the first core). The village visibly repairs
itself when the first Idea Core returns: fountain flows, lamps light, the pond
bridge mends, a villager moves in.

### ✅ World 1 — Numberberry Meadow — complete
* **Mission 1 – The stepping-stone path**: physically carry stones into gaps;
  numerals show the target, counting is spoken aloud. *(counting to 20,
  matching numerals to quantities)*
* **Mission 2 – A bridge for the Berrybacks**: "We need 10 planks, the crate has
  6 — how many more?", hunt the missing planks, then build the bridge in the
  snap-builder: 10 deck planks, two 4-block towers, triangle braces. Testing a
  braceless bridge makes it **wobble** — the Berrybacks retreat and Pip improves
  the design. *(number bonds to 10, DT structures, test → improve)*
* **Mission 3 – The Numberberry Picnic**: share berries fairly onto three
  picnic mats, one at a time; unequal shares make somebody sulk. *(equal
  sharing, comparing more/fewer, addition as equal groups)*
* **Hidden challenge**: a growing flower trail (2, 4, 6, 8, …) — stomp the pad
  that comes next. *(growing patterns, counting in 2s)*
* **Idea Core** appears after all three missions; collecting it upgrades the hub
  and opens World 2.
* 8 Spark Seeds, a ravine bounce-mushroom, chatty Berrybacks.

All five travel gates that have worlds behind them are **open from the start** —
you can dive straight into any built world without finishing the one before.

### 🟡 World 2 — Gearleaf Grove — partial (by design, per the build plan)
* **Mission 1 – Fix the tree lift**: choose a partner gear (4 / 8 / 16 teeth)
  for the 8-tooth drive gear. Wrong choices *run* — double-speed rattling or a
  half-speed crawl — and Nutkin explains why. The fixed lift becomes a real
  rideable platform. *(doubles and halves, DT mechanisms)*
* **Mission 2 – The acorn balance**: make both pans equal by filling a mystery
  bag; the beam tilts live. Ends with `5 + 2 = 4 + 3`. *(equality, missing
  numbers — the □ in □-form)*
* Mission 3 (delivery cart), the function-machine tree, and the Grove Idea Core
  are signposted in-world as "still being invented".

### ✅ World 3 — Shape Sail Harbour — short missions
A gentle water world of wooden boardwalks (every splash is just a swim — never a
fall). Three quick missions:
* **Shape lighthouse**: rebuild it by stacking the right solid shapes — a wide
  cube base, a cylinder tower, a sphere lamp, a cone roof. *(2D/3D shapes,
  stable structures — the wide base is why it stays up)*
* **Captain Shell's boat**: choose a hull material and test it in the water. A
  stone hull sinks, a sponge soaks up the sea and sinks, wood floats — then
  count the 4 crates you load. *(material properties, floating, counting)*
* **Crane directions**: work out how many steps forward the crane must travel to
  drop its parcel on boat 3, then watch it deliver. *(position & counting-on)*
* **Hidden**: jump onto the shape with exactly 3 sides. *(shape properties)*
* **Idea Core** appears once all three missions are done.

### 🚧 Worlds 4–5 (Measure Mountain, Patternworks Factory)
Designed in the plan, gated in the hub as "still being invented".

## Learning systems

* **Challenge framework** (`js/challenge.js`) — every activity states a
  one-sentence goal (spoken + on screen, replayable via 🔊), offers **three hint
  levels** (attention cue → strategy cue → guided first step via 💛), and ends
  with a summary card linking the physical action to the number sentence
  (e.g. `6 + 4 = 10`). No red crosses, no "wrong again" — only "not yet".
* **Adaptive difficulty** (`js/save.js`) — each concept tracks attempts,
  hints and streaks. Three clean successes nudge a concept up a level (bigger
  numbers, distractors); two stumbles bring it down (smaller numbers, extra
  scaffolding). Platforming difficulty never changes. Adults can pin the range.
* **Snap builder** (`js/builder.js`) — pick a part card, tap a glowing slot;
  tap a placed part to take it back; test and reset are always free. Deliberate
  first-design failures (sagging, wobbling) are shown as animation, then
  improved.
* **Inventor Badges** — Careful Counter, Fair Sharer, Brave Tester, Clever
  Improver, Pattern Finder, Mechanism Maker (+ Shape Spotter reserved for
  World 3).

## Grown-up corner

Pause → 🔒 Grown-up area → hold the circle 3 s → answer a times-table check.
Shows concepts as *Practising / Developing / Usually secure / Ready for a
greater challenge* (never clinical grades), hint usage, finished designs, play
time, offline activity ideas, and learning options (maths/DT emphasis, number
range, full progress erase).

## Voices

By default the game speaks with your browser's built-in voice — free, private
and fully offline. Quality varies by browser: **Microsoft Edge** has the most
natural free voices, Chrome's Google voices are good, Safari's "Enhanced" voices
are good once downloaded in system settings.

For a **natural, ChatGPT-style storyteller voice**, a grown-up can add an OpenAI
API key in *Pause → 🔒 Grown-up area → Voice*: paste the key, pick a voice
(nova, shimmer, fable, …), press Test. It uses OpenAI's neural text-to-speech
(the same voices ChatGPT uses). Spoken clips are cached in the browser
(IndexedDB), so repeated lines are instant, replay offline, and cost nothing the
second time. The key is stored only on the device and sent only to OpenAI; any
failure (wrong key, offline) silently falls back to the browser voice. Cost is a
fraction of a penny per new line. The game is fully playable without it.

## Accessibility

Full voice narration with always-available subtitles, big-text and
high-contrast modes, reduced motion, assisted camera, remappable-free simple
controls (keyboard/touch/gamepad), no strict time limits, replayable
instructions everywhere, adjustable music/SFX/voice, character chatter can be
switched off. Colour is never the only signal (numerals + position + speech).

## Technical architecture

Plain JavaScript + Three.js r128 (vendored, no build step, runs from `file://`).

```
pips-inventor-islands/
  index.html      UI shell, CSS, script loading
  three.min.js    Three.js r128 (vendored)
  js/
    util.js       maths/DOM helpers
    save.js       localStorage save, settings, adaptive-learning tracker
    audio.js      WebAudio sequencer music + synthesised SFX
    narration.js  speechSynthesis narration + subtitles
    input.js      keyboard / touch joystick / gamepad
    assets.js     procedural low-poly model factory (all original)
    ui.js         HUD, dialogue, menus, adult area
    challenge.js  maths-challenge framework (goals, hints, summaries)
    builder.js    snap-slot construction system
    player.js     forgiving character controller + follow camera
    worldkit.js   shared world plumbing (lighting, seeds, beacons…)
    hub.js        Inventor Village
    meadow.js     World 1 (complete)
    grove.js      World 2 (partial)
    main.js       boot, game loop, world switching
```

Worlds are factory functions returning a common interface (terrain function,
platforms, colliders, water volumes, interactables, tick updaters), so new
islands slot in without touching the engine.

## Change log

* **v0.1** — first playable build: hub + complete World 1 + partial World 2,
  movement/camera, challenge framework, snap builder, adaptive difficulty,
  hints, badges, save/load, adult area, accessibility options, procedural
  music/SFX/narration.

## Known gaps / next steps

* Grove Mission 3 (delivery cart), function-machine tree, Grove Idea Core.
* Worlds 3–5.
* Builder is tap/click-driven; a full keyboard-only slot cursor is planned.
* Finished story missions don't replay yet (the hub Challenge Door is the
  repeatable practice loop for now); a "rebuild it" option at the build table
  is planned.
* Swimming exists (stream/pond) but no deep-water levels yet; no rideable
  vehicles yet (the tree lift is the first moving platform).
* Voice quality depends on the browser's built-in speech voices.
