# AUTHORING.md — how to add things to Max & the Star Fossils

*Written for a motivated non-programmer. Everything in this guide happens inside the `/content` folder — you never touch `/src`.*

After any change, run `npm run validate`. It checks every file against its schema and tells you exactly what's missing (a misspelled category, a fossil without a hint, a boss without a voice pack…). If validate is green, the game will pick your content up automatically — there is no list of worlds or bosses hidden in the code.

---

## 1 · Add a question pack (easiest first mod!)

Create `content/questions/my-topic.json`:

```json
{
  "id": "maths-doubling",
  "strand": "maths",
  "topic": "doubling",
  "topicNameKey": "topic.doubling.name",
  "questions": [
    {
      "id": "dbl-t1-basic",
      "tier": 1,
      "type": "quickfire",
      "template": "What is double {a}?",
      "params": { "a": { "min": 3, "max": 12 } },
      "answerExpr": "a*2",
      "distractorRules": ["a*2+1", "a+2"],
      "askStyles": ["kenji", "digger"],
      "hint": "Double means add it to itself: {a} + {a}.",
      "explain": "Double {a} is {a} + {a} = {answer}."
    }
  ]
}
```

Then add `"topic.doubling.name": "Doubling"` to `content/strings/en-GB.json`.

Rules of thumb:
- **tier** 1 = Year 3 entry, 2 = Year 4, 3 = stretch. Author some of each; the adaptive system moves children between tiers automatically (3 right in a row promotes, struggles demote quietly).
- **params + answerExpr** make a question effectively infinite — `{a}` is re-rolled every time, so nobody can memorise answer positions. Expressions support `+ - * / % ( )`, `round()`, `floor()`, `abs()`, and you can use them inside any text: `"hint": "Double it: {a} → {a*2}!"`.
- **distractorRules** are expressions for the wrong answers. Make them *plausible mistakes* (off-by-one-table, forgot-to-carry), not random numbers.
- **askStyles** lists which companions may ask it (at least 2). The game rotates them so the same fact arrives as Kenji's calibration check one day and Digger's treasure count the next.
- **hint** and **explain** are compulsory — they are the warm failure loop.

The pack joins Quiz Orbs, the café and the practice benches automatically via its `topic` id.

## 2 · Add a world

1. Create `content/levels/w9.json` (copy `w2.json` as a template). A level is: palette + spawn + `geometry` (boxes, cylinders, ramps, and `gen` recipes like `floor`, `ring`, `path`, `stairs`, `wall`, `canyon`) + decor + platforms + collectibles + 6 fossils + doors/triggers/enemies/arenas/tasks.
2. Add a row to `content/registry.json`:
   ```json
   { "id": "w9", "name": "world.w9.name", "doorCost": 44, "level": "w9", "hubDoorAngle": 190, "colour": "#44cc88", "icon": "🔌" }
   ```
3. Add strings: the world name, six fossil names + hints (`fossil.w9-f1.name` …), zone names.
4. Add `content/music/w9.json` (copy one; change `bpm`, `mode`, and the step patterns — numbers are scale degrees, `null` is a rest).
5. `npm run validate` → the door appears in Dino Plaza at your chosen angle, with your fossil cost, automatically.

**Fossil mix per world (§4.4 of the design):** 2 task fossils, 1 Digger secret, 1 platforming, 1 arena (mini-boss), 1 world boss, + the bonus fossil for banking 80 Amber Chips (`"bonusFossilId": "w9-bonus"`).

### Worked example — World 9: "Circuit City" (electricity)

*Authored here as the §11 expansion exercise — drop these files in and it plays.*

- **registry row:** as above (cost 44 — after the finale).
- **levels/w9.json:** neon-city palette (`sky: ["#1a1a3a", "#4a2a6a"]`), a `floor` disc, `ring` of tower blocks, conveyor "circuit traces", excavation plates hiding "fuse" chips. Fossils: `w9-f1` CIRCUIT-IT task "The Blackout Bridge" (wire battery→switch→bulb to light a crossing), `w9-f2` SORT-IT "Conductor or Insulator?" (spoon/coin/rubber/cork onto two pads), `w9-f3` Digger secret behind a flickering hoarding, `w9-f4` platforming "The Pylon Climb", `w9-f5` arena vs a `fuse_golem` mini-boss (`wrench_kit`, random traits), `w9-f6` boss **"Amp the Live Wire"** — traits `agg .75 / tri .6 / show .8`, moveset `twin_daggers`, ability `onPlayerStreak(3) → summon_turrets`.
- **questions/science-circuits.json:** topic `circuits`, e.g. "Which of these lets electricity flow: metal spoon / rubber duck / wooden brick?" with hint "Metals are conductors!".
- **tasks/w9_sort_conductors.json:** a `sort` task with categories `conductor`/`insulator`.
- **voices/amp.json:** pools `boss_intro`, `taunt_mid`, `hit_react`, `low_hp`, `defeat_freed` — crackly rock-star energy.

Nothing else. No code.

## 3 · Add a boss

One `content/bosses/<id>.json` + a voice pack (+ optionally a new moveset):

- **Traits do the personality work.** Recipes:
  - *landslide:* `aggression .9, patience .1` — never stops coming.
  - *fortress:* `caution .9, patience .9` — punishes impatience, walls up when you spam one attack.
  - *coward-king:* `aggression .2, trickery .8` + a moveset with `retreat`/`summon` moves — flees and summons.
  - *showstopper:* `showmanship .95` — taunts constantly (flourish moves trigger the boss's `taunt_mid` voice pool).
- **Abilities are data:** `{ "trigger": {"type": "onHpBelow", "value": 0.4}, "effect": "quake" }`. Triggers: `onHpBelow`, `onTimer`, `onPlayerStreak`, `onDistanceHeld`, `onPhaseEnter`, `onAllyDown`. Effects shipped so far: `quake`, `repair_swarm`, `summon_turrets`, `invisible`.
- **Sharing movesets is encouraged** — Bruno and Dame Bastion both use `sword_and_board` and fight like different people. That's the whole point.
- Add the boss to a level's `arenas` array + an `arenaGate` trigger, and give it `cafeGameKey`/`cafeTopics` so the freed champion hosts a café quiz.
- `characters.json` needs a matching cast entry (name key, colours, TTS voice profile).

## 4 · Add a task (BUILD-IT, SORT-IT, …)

Create `content/tasks/<id>.json` with an `archetype` of `sort`, `measure`, `path`, `quickfire` or `build`, fill in that archetype's block (see existing files — they're short), then place it in a level:

```json
"tasks": [{ "ref": "my_task", "pos": [10, 0.8, 4], "faceDeg": 90 }]
```

`faceDeg` is where world-space props (answer podiums, number-path tiles, sort pads) will spawn relative to the station. Attach a fossil by giving the task `"reward": { "fossilId": "w9-f1" }` and listing that fossil in the level with `"kind": "task", "taskRef": "my_task"`.

## 5 · Add a task **archetype** (the one code-touching path)

Implement the `ActiveTask` interface in `src/game/education/archetypes.ts` (or a new file), then register it:

```ts
registerArchetype('circuit', (ctx) => new CircuitTask(ctx));
```

`ctx` gives you the task JSON, the adaptive tier, the station's world position, `ctx.engine.runWarmLoop(...)` for the warm failure loop, `ctx.engine.recordRaw(...)` for mastery, and `ctx.finish(true)` to award the reward. Copy `SortTask` for a world-space archetype or `MeasureTask` for a panel one. Document it here when you're done.

## 6 · Voices

- **New lines for an existing character:** append to their pool in `content/voices/<id>.json`. The no-repeat memory handles rotation automatically.
- **Minimum pool sizes are enforced** for companions by `npm run validate` (ask_intro ≥6, correct/incorrect pools ≥4, idle ≥6 — §3.6).
- **New character:** add to `characters.json` (the `voice` block controls TTS: `rate`, `pitch`, `langPref` like `en-AU`, `namePref` name hints), create their voice pack, build their look in `src/game/rigs.ts` if they appear in 3D.
- **Premium voices:** set `VITE_ELEVENLABS_KEY` in a `.env` file and add `elevenVoiceId` to a character's voice profile. Without the key the game never loads the ElevenLabs provider and uses the browser's free speech synthesis. No key, no network calls — the game stays fully offline.
- Writing rule (§3): accents live in **vocabulary and rhythm**, never phonetic spelling. Characters are never punchlines about where they're from.

## 7 · Re-tune the game

Every gameplay number lives in `content/config.json`: jump height, coyote time, boss decision cadence, softmax temperature, threat budget, brain-power segments, chip targets, mastery thresholds, telegraph minimums. Change, save, refresh.

## 8 · Dialogue & banter

- Cutscenes: `content/dialogue/<id>.json` — an id + a list of `{speaker, text}` lines. Play order is top to bottom; every line is spoken and subtitled; Esc skips.
- Banter: add pairs to `content/dialogue/banter.json`; scope to worlds with `"worlds": ["w2"]` or leave global. Max one banter per 90 s, never over other speech.
