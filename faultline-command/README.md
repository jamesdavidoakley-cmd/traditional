# FAULTLINE COMMAND

An original isometric real-time strategy game for the browser. Four fictional
coalitions, three eras of recognisable real-world equipment, three balanced maps
and eight AI commanders whose doctrines genuinely change how they play.

**No install, no build step, no account.** Open `dist/index.html` in any modern
desktop browser and it runs offline.

## The game

You command one of four fictional coalitions against up to three AI opponents.
The objective is simple and absolute: destroy every opposing **Command
Headquarters**. Lose your own and the battle ends immediately.

* Formats: 1v1, 1v2, 1v3, 2v2 and free-for-all.
* Three eras — **1926**, **1990s** and **Modern Day** — with era-appropriate
  equipment. No Iron Dome or HIMARS in a 1994 battle, and no guided anything in
  a 1926 one.
* A normal battle runs roughly 15–25 minutes.
* Two-player local multiplayer is marked *Coming later* and is not implemented.

### Coalitions

| | Coalition | Equipment lineage | Plays like |
|---|---|---|---|
| ARC | Atlantic Response Coalition | US / British / French | Best heavy armour, deep precision fires, naval reach |
| ESD | Eurasian Security Directorate | Russian / Eastern European | Massed rocket and tube artillery, the densest air-defence umbrella |
| PDC | Pacific Defence Compact | Chinese / East Asian | Cheap, fast production echelons and reconnaissance-strike networking |
| MRL | Meridian League | European / Mediterranean / Middle Eastern | Very survivable armour and the best short-range interception |

All coalitions, commanders, flags, geography and conflicts are fictional.
Equipment designations are real; performance figures are gameplay
approximations, not simulations.

### The three eras

| Era | Reads as | Anti-tank | Air defence | Bombardment |
|---|---|---|---|---|
| **1926** | Rhomboid tanks, massed guns, wireless telegraphy, biplanes | Anti-tank rifles and field guns at knife range | Heavy AA guns and balloon barrages — aircraft only | Uninterceptable: heavy howitzers, railway guns, siege mortars |
| **1990s** | Cold-war stockpiles, analogue fire control, mechanised mass | Wire-guided ATGMs | Patriot, S-400, HQ-9 | MLRS, Iskander, Tomahawk — interceptable |
| **Modern Day** | Networked sensors, precision fires, layered missile defence | Top-attack ATGMs and loitering munitions | Layered, data-linked, and blinded when the data centre dies | Precision everything, and everything can be shot down |

Period naming runs all the way through: in 1926 the Data Centre is a **Signals
Corps Headquarters**, the Radar Station is a **Signals & Observation Post**, and
the Advanced Weapons Command is an **Ordnance Experimental Command**. Structures
are brick, sandbag and corrugated iron rather than hardened concrete, and take
damage accordingly.

### Infrastructure is the game

* **Power** drives production. Run a deficit and production crawls while every
  radar-guided system shuts down.
* **Radar + Data Centre** are required by precision weapons and networked
  missile defence. Lose the data centre and interception collapses to roughly a
  third of its hit probability until you rebuild.
* **The Artillery & Munitions Complex** manufactures replacement ammunition.
  Without one your army fires what it is already carrying and then stops.
* **Oil administration capacity** starts at two sites. Each Oil Administration
  Facility runs four more at full yield (+35%); anything beyond that produces
  42%. Taking the whole map is worth much less than taking what you can run.
* **Repair depots and engineering vehicles** restore hull, mobility, weapon
  damage and ammunition in the field.

### Ten signature systems

**1990s and Modern Day** — Patriot · Iron Dome-style interception · Storm
Shadow · HIMARS · M270 MLRS · S-400 · Iskander-M · Tomahawk · PHL-16 ·
Networked reconnaissance and loitering munitions.

**1926** — the same ten roles, resolved with what the decade actually had:
heavy anti-aircraft sectors · balloon barrages · night bomber raids · ground
attack flights · corps heavy artillery groups · railway guns · super-heavy
siege howitzers · battleship gunfire support · sound-ranging counter-battery ·
observation and reconnaissance flights.

Each has a distinct flight profile and is defeated differently. Interception is
always a roll, never a certainty, and every attempt is drawn as a real
interceptor leaving the launcher.

The 1926 era changes the shape of the battle rather than reskinning it.
Nothing in the decade can shoot a shell out of the air, so heavy artillery and
railway guns arrive **uninterceptable** — the only answer is to reach the guns.
Air defence is guns and balloons, effective against aircraft and useless
against everything else. Anti-tank work is done by anti-tank rifles and field
guns at very short range, so armour is genuinely frightening again until it
outruns its infantry. Ranges, speeds and turret traverse are all shorter and
slower, and every piece of period equipment is priced against what it can
actually do.

### Eight AI commanders

THE BASTION (defensive) · THE HAMMER (armoured) · THE VIPER (aggressive) ·
THE ARCHITECT (technical) · THE TEMPEST (air power) · THE LONGBOW (artillery) ·
THE QUARTERMASTER (economic) · THE ADMIRAL (naval).

Doctrine and difficulty are independent. Difficulty changes planning quality,
reaction time and aggression; doctrine changes the build order, the production
mix, the timing of attacks and what a commander considers worth killing.

Only the highest difficulty (**Marshal**) carries a resource advantage, and it
is disclosed in the interface: +25% income and +15% construction speed. No
difficulty grants map-wide vision — every AI plays with the same fog of war you
do.

## Controls

| | |
|---|---|
| Select / box-select | Left-click, drag |
| Add or remove from selection | Shift-click |
| Select nearby units of a type | Double-click |
| Contextual order | Right-click (move, attack, capture, embark, repair) |
| Attack-move | `A` then click |
| Stop / hold / unload | `S` / `G` / `U` |
| Rally point | `R` then click |
| Control groups | `Ctrl`+`1`–`9` to assign, `1`–`9` to recall |
| Camera | `WASD`, arrows, screen-edge scroll, middle-drag |
| Zoom | Mouse wheel |
| Centre on HQ / range rings | `H` / `T` |
| Pause / speed / menu | `Space` or `P` / `[` `]` / `Esc` |
| Minimap | Click to jump, right-click to order units there |

## Running and building

```bash
npm install          # only esbuild
npm run build        # produces dist/
npm run serve        # serves dist/ on http://localhost:8099
```

`npm run build` emits three files:

* `dist/index.html` — the playable game, fully self-contained.
* `dist/faultline-command.html` — the same file under a download-friendly name.
* `dist/artifact.html` — body-only variant for embedding.

Source lives in `src/` as plain ES modules with no runtime dependencies.

```
src/core/     maths, RNG, terrain vocabulary, A* pathfinding
src/data/     factions, units, buildings, commanders, abilities, damage matrix
src/maps/     the three battlefields (generated once, stamped with 4-fold symmetry)
src/sim/      world, entities, economy, combat, movement, strikes, match loop
src/ai/       the commander AI
src/render/   isometric renderer, procedural sprites, particle effects
src/ui/       menus, skirmish setup, HUD, input, portraits, icons
src/audio/    procedural WebAudio synthesis (all sound is generated at runtime)
```

Settings and your preferred deployment are saved to `localStorage`. Match state
is in memory only — there is no backend and nothing leaves the browser.
