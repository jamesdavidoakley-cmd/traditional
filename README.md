# 🦖⭐ Max & the Star Fossils

*A joyful 3D collect-a-thon platformer where Max, a young blue T-Rex, wins back the stolen Star Fossils by playing — and learning — real Year 3/4 science, maths and engineering.*

The smooth-talking **General Vex** has stolen the Star Fossils to power his **Know-It-All Engine** — a machine that promises to do everyone's thinking for them. Max and his friends — **Kenji** the engineer, **Marcus** the gladiator, and **Digger** the cattle dog — set out to free the seven mind-controlled champions and prove that working things out yourself beats being told the answers.

**This build: the adventure through the end of World 2** — Dino Plaza (hub), Fossil Canyon, and Gearworks Gorge: 17 collectable Star Fossils, two boss battles, four freed-champion café games and practice benches, ~200 Amber Chips, and every word spoken aloud.

## Play it

```bash
npm install
npm run dev        # → http://localhost:5173
```

Chrome/Edge recommended (best free text-to-speech voices). Fully offline, no accounts, no telemetry. `npm run build` produces a static site in `dist/`.

## What's inside

- **Move joyfully:** run, double-jump (with coyote time + jump buffering), tail spin, stomp, chomp-and-spit, Mega Roar. Bounce pads, conveyors, spinning gears, crumbling ledges.
- **Learn by doing:** SORT-IT (chomp rocks onto the right slabs), BUILD-IT (choose gear ratios, balance counterweights, engineer Spring Boots), NUMBER-PATH (cross on multiples only), MEASURE-IT, QUICK-FIRE podiums — all inside the fiction, all spoken aloud, with a warm hint → retry → teach loop and **no game overs, ever**.
- **Every foe has a mind:** bosses run a utility AI over personality traits. Bruno the Landslide and Dame Bastion share the *same* sword-and-shield moveset and fight like different people — proven by automated simulation tests (`npm run test:ai`).
- **Voice everywhere:** four heroes and every boss speak with distinct voices (free browser TTS with per-character profiles), rotating delivery pools with no-repeat memory, subtitles always.
- **Kind by design:** Explorer mode, slow telegraphed attacks (never colour-only), dizzy-not-dead, adaptive difficulty tiers, dyslexia-friendly font toggle, reduced-shake/flash options, Grown-Ups' Corner with per-topic mastery.

## For grown-ups & tinkerers

- Curriculum: England KS2 Years 3–4 (place value, add/subtract, ×3/×4/×8 tables, Roman numerals, symmetry; rocks & fossils, skeletons; gears, levers & the design loop — more strands arrive with later worlds).
- **Everything is data:** worlds, bosses, questions, voices and tuning live in `/content` as JSON. Adding a world or boss needs zero engine changes — see `docs/AUTHORING.md` for recipes and a complete "Circuit City" worked example.
- `npm run ci` = typecheck + content validation + unit/AI-sim tests. `npm run test:smoke` boots the built game headlessly and screenshots the golden path.

## Repo map

```
/src/engine    renderer · physics (BVH capsule) · audio/music/TTS · input · save · loader
/src/game      player · camera · companions · rigs · world · combat+boss AI · education · dialogue · ui
/content       ← all game data: config, registry, levels, bosses, movesets, questions, tasks, voices, music, strings, schemas
/docs          DEVLOG · AUTHORING · CONTROLS
/tests         movement · dialogue no-repeat · AI proofs · content pipeline
/tools         validate-content · smoke & screenshot harnesses
```

Built from `BUILD_PROMPT.md`. Previous prototype (Pig Sports) lives on branch `claude/pig-sports-game-lc24v3`.
