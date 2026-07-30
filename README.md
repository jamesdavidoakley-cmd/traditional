# ⚡ HOGWARTS SPEEDSTERS 3D ⚡

*A fully 3D magical creature speed-runner — made for Max!*

Open **`hogwarts-speedsters.html`** in any browser — no install, works offline
(keep `three.min.js` next to it; it's the 3D engine).

Pick a creature and go **FAST** through a Hogwarts-style castle in real 3D,
with a chase camera that zooms wider the faster you go.

- **Real 3D creatures**, procedurally modelled and fully animated — galloping
  legs, flapping wings, waving tails: werewolf 🐺, hippogriff 🦅, cheetah 🐆,
  dragon 🐉, snowy owl 🦉 and stag 🦌. Rotate them in 3D on the picker screen!
- **Three 3D tracks**: the **Moonlit Battlements** (fly through golden hoops,
  dodge bludgers & dementors), the **Grand Staircase Hall** (floating candles,
  portraits, house banners, ghosts) and the **Dungeon Potion Run** (torch-lit
  tunnels, trolls, barrels and green potion slime).
- **1 or 2 players on one keyboard**, split-screen — P1: arrow keys
  (◀ ▶ steer, ▲ jump, **SPACE** power) · P2: WASD (A/D steer, W jump,
  **S** power). Left means **left** — no funny business!
- Grab **⚡ galleons** to fill your power bar. When it's full a **giant golden
  banner tells you exactly which key to press** — werewolf summons a full moon
  that blasts every bad guy off the wall, dragon breathes fire, hippogriff
  soars over hazards, owl freezes rivals, cheetah goes lightning-fast, stag
  smashes through anything. Crash with a full bar and it fires automatically!
- Dynamic shadows, fog, moonlight, particle bursts, synth sound effects — all
  procedural, no downloads, powered by the vendored Three.js.

---

# 🐷 PIG SPORTS 🎾🏀

*Grand Slam Trotters & Slam Dunk Hams — made for Max!*

A 3D sports game where champion piggies battle it out at **Tennis** and **2-v-2
Basketball** — and on Hard mode, face off against **GIANT MONKEYS**. Every match
lasts **2 minutes**. Most points at the buzzer wins (ties go to a Golden
Point / Golden Bucket).

## How to play

Just open `index.html` in any modern browser — no install, no build, works
offline. (If your browser is fussy about local files, run any static server,
e.g. `npx http-server` and open the printed URL.)

1. **Pick your piggy** — Rosie (all-rounder), Truffle (speed), Big Ham (power)
   or Ziggy (touch & spin).
2. **Pick your sport** — Tennis or Basketball.
3. **Pick your bravery** — Easy / Normal (vs. pigs) or **HARD (vs. giant monkeys)**.

## 🎾 Tennis — real swing dynamics

The stroke model follows real biomechanics: the **kinetic chain**. Watch your
pig do a proper **unit turn**, loop the racket back, then fire hips → shoulders
→ arm through a **low-to-high** swing with a windscreen-wiper follow-through.

- **Move**: WASD / arrow keys (sideways *and* up to the net)
- **Topspin drive**: hold **SPACE** to charge the backswing, release to swing.
  Contact the ball **out in front** for a PERFECT strike — late = jammed & weak.
- **Slice**: **X** (floats, stays low) · **Lob**: **C** (over the monkey's head!)
- **Aim** with ◀ ▶ while you swing.
- **Serve**: SPACE to toss, SPACE again **at the top of the toss** — just like
  a real trophy-position serve. Nail the timing meter for flat bombs; miss it
  and you'll fault. Second serve is an auto-safe kick serve.
- Forehand/backhand are picked automatically by which side the ball is on.
- Real rules touches: tiebreak-style serve rotation, service boxes, faults,
  double faults, aces, line calls with a landing marker.

## 🏀 Basketball — 2-v-2 street ball

Shot mechanics follow the research: release **just before the apex of your
jump**, on a ~45–52° arc with backspin.

- **Move**: WASD / arrow keys
- **Shoot**: hold **SPACE** to jump, release at the **top** of the meter.
  Perfect release = green light. Open shots > contested shots. 3-pointers
  from beyond the arc!
- **Layups & dunks**: drive right to the rim and jump — BOOM. 💥
- **Pass**: **X** (watch for interceptions)
- **Defense**: SPACE to jump for blocks, X to poke a steal.
- Live rebounds off a physical rim and backboard — crash the glass!
- On Hard, the **Kong Brothers** hunt dunks and swat weak shots. Beware.

## Tech

- Pure JavaScript + [Three.js](https://threejs.org) (vendored, `three.min.js`) —
  no build step, no dependencies, fully offline.
- Everything is procedural: the pigs, the monkeys, the stadiums, the crowd
  doing the wave, the courts (canvas-painted), even all the sound effects
  (WebAudio synth — oinks included).
- Works with keyboard or touch (virtual joystick + buttons appear on tablets).
