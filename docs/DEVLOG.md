# DEVLOG — Max & the Star Fossils

Decisions + progress log, per prime directive 7 and 10. Newest entries at the bottom of each phase.

## P0 · Skeleton (2026-08-08)

**Done:** Vite + TypeScript(strict) + Three.js skeleton; engine modules (renderer with toon/post chain + quality presets, custom capsule physics on three-mesh-bvh, input with rebindable actions, WebAudio buses + procedural SFX kit, procedural step-sequencer music engine, TTS `VoiceProvider` trio, 3-slot save manager, typed event bus, ajv content loader); content tree with JSON Schemas for every type; `tools/validate-content.mjs` (schema + cross-checks + hardcoded-registry guard); primitive character rig system with Max/Kenji/Marcus/Digger/Vex/bosses builders; smoke-test harness (Playwright + preinstalled Chromium, screenshots).

**Gate evidence:** `npm run dev`/`build` boots to a lit, spinning, animated Max on a toon disc (tools/screenshots/01-boot.png) with zero console errors; `tsc --noEmit` clean; `npm run validate` green (26 content files).

**Decisions (Decision Defaults §12 applied):**
- The repository previously held an unrelated "Pig Sports" game (preserved on its own branch `claude/pig-sports-game-lc24v3` and in git history). This branch builds Max & the Star Fossils at the repo root per BUILD_PROMPT §2.2's layout.
- Registry entries for hub/w1/w2 carry `comingSoon: true` until each level lands (flipped per phase) so `validate` stays honestly green between phases. Worlds 3–7 + Sky Citadel remain `comingSoon` at end-of-W2 scope: their doors appear in the hub with fossil costs and a friendly "sealed by Vex" message.
- Voice pools authored up-front for the four heroes + Vex (they are stable design data); boss packs land with their bosses. Vex's pool is sized for his pre-finale presence (~18 lines); the 25-line launch bar applies at P8 when he is actually fought.
- UI is DOM-overlay (HTML/CSS) rather than in-canvas: bigger fonts, real focus handling, cheap accessibility wins (§9.3). Subtitles/HUD/menus all live there.
- Music engine is a 16th-note step sequencer; W2's waltz uses 12-step (3/4) patterns. All audio procedural — zero audio files, per §12 defaults.
- Playwright smoke uses the environment's preinstalled Chromium via `playwright-core` (no browser download).

## P1 · Movement & feel

## P2 · Dialogue & voice

## P3 · Hub & persistence

## P4 · Education engine + W1

## P5 · Combat & AI framework

## P6 (partial: W2) · Gearworks Gorge
