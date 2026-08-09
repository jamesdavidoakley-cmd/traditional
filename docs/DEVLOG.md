# DEVLOG — Max & the Star Fossils

Decisions + progress log, per prime directives 7 and 10. This build delivers the adventure **through the end of World 2** (phases P0–P5 plus P6's World-2 slice).

## P0 · Skeleton (2026-08-08)

**Done:** Vite + TypeScript(strict) + Three.js skeleton; engine modules (renderer with toon/post chain + quality presets, custom capsule physics on three-mesh-bvh, input with rebindable actions, WebAudio buses + procedural SFX kit, procedural step-sequencer music engine, TTS `VoiceProvider` trio, 3-slot save manager, typed event bus, ajv content loader); content tree with JSON Schemas for every type; `tools/validate-content.mjs` (schema + cross-checks + hardcoded-registry guard); primitive character rig system with Max/Kenji/Marcus/Digger/Vex/bosses builders; smoke-test harness (Playwright + preinstalled Chromium, screenshots).

**Gate evidence:** `npm run dev`/`build` boots to a lit, spinning, animated Max on a toon disc (tools/screenshots/01-boot.png) with zero console errors; `tsc --noEmit` clean; `npm run validate` green.

**Decisions (Decision Defaults §12 applied):**
- The repository previously held an unrelated "Pig Sports" game (preserved on branch `claude/pig-sports-game-lc24v3` and in git history). This branch builds Max & the Star Fossils at the repo root per BUILD_PROMPT §2.2.
- Registry rows for hub/w1/w2 carried `comingSoon: true` until each level landed, so `validate` stayed honestly green between phases. Worlds 3–7 + Sky Citadel remain `comingSoon`: their doors stand in the hub with fossil costs and a friendly "sealed by Vex" dialog.
- UI is DOM-overlay (HTML/CSS): bigger fonts, real focus handling, cheap accessibility wins (§9.3).
- Music engine is a 16th-note step sequencer; W2's waltz uses 12-step (3/4) patterns. All audio procedural — zero audio files.

## P1 · Movement & feel

**Done:** full move set (§4.1): analog run, jump/double-jump with **coyote 0.12s + buffer 0.15s + variable height**, tail spin, stomp (hop→slam, breaks excavation plates), chomp, Mega Roar; squash & stretch, hit-pause, footstep dust, landing rings; orbit camera with wall probe, 3 zoom steps, recentre, mouse-drag + wheel; moving platforms (lift/rotor/conveyor/crumble/bounce/pendulum/excavation) that carry the player including rotation; graybox playground (`?level=playground`).

**Gate evidence:** `tests/movement.test.ts` — 7 tests against the real controller + real BVH physics: run speed, coyote ground-jump, post-coyote air-jump spend, jump buffering on touchdown, variable apex (~2.3 m per spec — jumpVelocity retuned 9.6→11.0 to hit it), double-jump once-only, stomp slam. Playground traversal screenshot (tools/screenshots/playground.png).

**Decisions:** falling off past coyote time still leaves the air jump ("always one rescue" — kid-fair). No fall damage; falling out of the world respawns at the last checkpoint with sparkles, zero cost. Ledge-grab and swim deferred to their curriculum worlds (swim = W4).

## P2 · Dialogue & voice

**Done:** VoiceDirector with delivery pools + **no-repeat memory persisted per save slot**, priority queue (combat warnings > hints > flavour) with the one barge-in exception, per-character bark cooldowns, subtitles (portrait + colour, resizable, never fully off), cutscene player (letterbox, talking rigs, Esc-skippable), banter scheduler (≤1/90s, world-scoped pairs), companion party follow AI (Digger drifts toward unfound secrets and sniffs — behavioural hinting), TTS: WebSpeech per-character profiles (rate/pitch/lang prefs incl. en-AU preference for Digger), NullProvider silent pacing, ElevenLabs stub behind `VITE_ELEVENLABS_KEY`.

**Gate evidence:** `tests/dialogue.test.ts` proves the no-repeat rule (never repeats until pool exhausted; reset avoids instant repeats; even usage; single-line pools safe). Voice pool minimums are enforced by `npm run validate` (§3.6 table). Hub scene shows all four heroes conversing (intro cutscene + banter).

**Content:** ~60 lines each for Kenji/Marcus/Digger, 33 for Max, 18 for Vex (his 25-line launch bar lands with P8 when he is actually fought), 25+ each for Bruno/Cogwheel, ~12 each for the mini-bosses, small packs for Bastion/Nightshade (their data ships now for the AI proofs; their worlds later).

## P3 · Hub & persistence

**Done:** Dino Plaza — plaza + fountain spiral climb to a rooftop fossil, 8 world doors on the registry's angles with cost labels and lock/coming-soon flows, Kenji's Workshop (practice bench + Spring Boots build), Marcus's Arena (Roman-numeral scoreboard task), Digger's Dig Site + garden (mastery-grown fossil), Fossil Café zone (opens as champions are freed), Vex Gate (38⭐, Vex taunts through it). Title → 3 save slots (summaries, erase-with-confirm, JSON export/import) → difficulty select (Explorer default, changeable any time). Pause/settings/controls/Grown-Ups' Corner (hold-3s gate, per-topic plain-English summaries, playtime). Intro cutscene with a translucent Vex hologram. Autosave every 25 s + on every fossil/travel.

**Gate evidence:** smoke test drives title → new game → skip intro → hub, walks and jumps, then **reloads the page and continues from the surviving slot** (tools/screenshots/01–06). Fossil persistence uses the same save path (award → persist → slotSummary).

**Decisions:** menus optionally read aloud by Digger (settings). "Hub chips" exist for fun but only themed worlds have the 80-chip bonus fossil (`bonusFossilId` in the level manifest). Marcus's adjustable-personality sparring dummies are logged as a hub nicety for the P7 banter pass — the AI showcase they demonstrate is already proven in `test:ai`.

## P4 · Education engine + W1

**Done:** task-archetype registry with self-registration (§5.3) — **QUICK-FIRE** (in-world stompable answer podiums + modal panel variant for café/orbs, 🔊 re-read button), **SORT-IT** (chomp-carry items onto labelled pads, per-item facts), **NUMBER-PATH** (multiples/sequence tiles, wrong tiles boing harmlessly), **MEASURE-IT** (jug pouring), **BUILD-IT** (gear ratios / counterweight balancing / spring-boots engineering with the wobble trade-off). Warm failure loop everywhere: miss → in-character gentle + hint → retry → teach + re-roll, nothing ever lost (§5.1.3). Adaptive tiers (3-streak promotes, quiet demotion), mastery XP → stars, spaced repetition (Quiz Orbs + café draw from weakest topics), rotating ask-speakers, parametric question instantiation with a safe expression evaluator (distractor rules, template maths like `{a*2}`). Grown-Ups' Corner reads the same mastery model. **Fossil Canyon**: Dust Gulch / Great Dig / Bonehenge, 6 fossils + bonus, secret bone-cave behind a stompable cracked wall, excavation plates, canyon-rim climb, 100 placed chips, 8 question-pack topics (place value, add/sub, ×tables, Roman numerals, symmetry, rocks, skeletons, gears) each tiered 1–3 with hints + explains.

**Decisions:** per-tier question counts lean on parametric templates (each entry re-rolls infinitely, distractors always plausible); the ≥10-per-topic-per-tier launch bar is tracked for P8 as more handwritten variants accumulate. Money-mode MEASURE-IT ships with W6's chandler. W1's third station (Number Steps) pays Brain Power rather than a fossil — keeps the 6+bonus fossil economy exact.

## P5 · Combat & the AI framework

**Done:** combat feel (hit-pause, knockback, i-frame flicker, shake, ≥0.6 s telegraphs always paired flash+sound, Explorer windups ×1.5); Cogling Scout/Brute/Tinkerer with spawn-time trait noise, scout flee-and-alert, brute miss-dizzy punish window, tinkerer repair-priority lesson; chomp-capture scouts and spit them; **BossBrain**: trait-vector utility AI (§6.3 loop verbatim: baseWeight × traitMultiplier × contextMultiplier, top-3 softmax with trickery-scaled temperature), rolling player-habit histogram with spam-reading, ban-repeat rule with the aggression exemption, data-driven ability triggers (all six §6.3 types), fairness governor (threat budget + rubber-banding); boss runtime executing decisions as windup/active/recover with motion styles, feints that dart sideways, flourishes that fire taunt voice pools, phase banners, heavy-move overextension windows (Bruno's third-swing tell); arena flow (barrier ring, boss music + intensity, lock-on camera, Quiz Orbs orbiting, victory → **Obedience Cog shatters, champion freed** → café unlock); Explorer phase-checkpoint on dizzy; Bruno + Quarry Foreman fights in W1; café v1 with freed-champion quiz hosting in their own voice.

**Gate evidence:** `npm run test:ai` — all four §6.6 proofs green over the real content JSON: divergence (Bruno strike-share ≥2.5× Bastion; Bastion defend/reposition ≥2× Bruno — same `sword_and_board` file), Nightshade cloak trigger ≤2 s past 40% HP in ≥95% of 100 runs, adaptation (caution .9 boss block rate +≥50% once spam starts), variety (≥18/20 unique sequences).

**Decisions:** caution's *baseline* defend affinity is deliberately moderate — cautious bosses wall up **reactively** (habit spam, hit streaks, low HP) rather than turtling constantly; this keeps fights fair for button-mashers and makes the adaptation proof visible. Bastion + Nightshade ship as data now (per P5's "her data can't wait") and are excluded from reachable worlds until their levels arrive.

## P6 (partial) · World 2 — Gearworks Gorge

**Done:** Gear Yard / Steamworks / Conveyor Gauntlet zones; rideable rotor gears, counter-running conveyors, steam-vent hazards with pause-timing (secret alcove behind them), counterweight lift; BUILD-IT Great Gear Train (tiered: speed → force → exact compound ratio, with live world-gear spin test) and Counterweight Lift (exact-sum loading); symmetry SORT-IT bench; ×tables NUMBER-PATH; Tinkerer Prime mini-boss (drone summons — priority-target lesson); **Baroness Cogwheel**: spanner-lance moveset, repair swarm, phase-2 turrets, and the **gear-shield gimmick** — her shield only falls when the arena-edge 3-cog puzzle is solved (education inside the boss fight, re-armed each phase); Spring Boots gadget powers every bounce pad; café hosts Bruno's Rock Sorter + the Baroness's Gear Ratio Workshop topics; W2 banter pairs incl. Kenji starstruck.

**Decisions:** chain-pull switches folded into the counterweight/lift beats (logged scope trim — cut polish, never systems). W2's "intro circuits" curriculum row is covered conceptually in gears Q&A; CIRCUIT-IT the archetype ships with W3's Magno-Mitt + W5 per the phase plan.

## Cross-cutting verification

Screenshots referenced below live in `tools/screenshots/` locally (git-ignored); regenerate any of them with `npm run test:smoke` (golden path) or `node tools/shot.mjs "?level=w1&at=x,y,z,yawDeg" name.png "w:2000"` (any spot in any world). Boss fights verified on-screen headlessly: Quarry Foreman arena (barrier + quiz orbs + fight), Baroness Cogwheel (shield bubble armed, red telegraph ring mid-windup, phase-2 turret support visible). The scripted "7-year-old-shaped" 25-minute W1 playtest of the P4 gate is covered headlessly (task flows + warm loop unit-tested; worlds walked by bot); a human playtest remains the recommended next step before handing to an actual seven-year-old.

- `npm run ci` = typecheck + validate + 19 unit/sim tests, all green.
- `npm run validate` cross-checks: every ref resolves (tasks/bosses/movesets/voices/levels/music), fossil ids unique + 6 per themed world, ask-styles are companions, §3.6 pool minimums, **no hardcoded world ids in /src** (the content-only expansion invariant, also proven by `tests/content.test.ts`'s drop-in-w9 test).
- Headless golden-path smoke with screenshots + zero-console-error assertion; `tools/shot.mjs "?level=w2&at=x,y,z"` for eyeballing any spot.

## Known deferrals (all post-W2 scope)

Worlds 3–7 + Sky Citadel (doors present, sealed); swim/ledge-grab; CIRCUIT-IT/SHADOW-IT/FRACTION-FORGE archetypes; money MEASURE-IT; Marcus's live sparring dummies; full key-rebinding UI (defaults are one-handed-friendly; bindings structure supports it); Playwright suite as CI stage rather than tool script; Vex full voice pool.
