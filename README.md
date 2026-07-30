# ⚡ HOGWARTS SPEEDSTERS ⚡

*A magical top-down speed game — made for Max!*

Open **`hogwarts-speedsters.html`** in any browser — no install, works offline.

Pick a creature (werewolf 🐺, hippogriff 🦅, cheetah 🐆, dragon 🐉, owl 🦉 or
stag 🦌) and go **FAST** through a Hogwarts-style castle: the Great Hall, the
Forbidden Forest, the Moving Staircases, the Dungeons, the Quidditch sky — or
all five back-to-back in **THE HOGWARTS CUP** 🏆.

- **1 or 2 players on one keyboard** — P1: arrow keys (◀ ▶ steer, ▲ dash-hop,
  ▼ power) · P2: WASD (A/D steer, W dash-hop, S power). Left means **left**!
- Grab **⚡ galleons & ⭐ stars** to charge your power bar, then unleash your
  creature's special move — the werewolf summons a **full moon** that knocks
  everyone flying! Crash into a bad guy with a full bar and your power fires
  back automatically. 💥
- Dodge ghosts, giant spiders and bludgers; hop the staircase gaps; hit the
  golden boost pads.
- Procedural stone floors, glowing torches, a castle skyline, particle trails,
  screen shake, synth music & silly sounds — all in one file, zero dependencies.

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
