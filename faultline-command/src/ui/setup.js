// Front end: main menu, skirmish deployment, dossiers, systems reference,
// field manual and the pre-battle intelligence briefing.

import { FACTIONS, FACTION_KEYS, TEAM_COLOURS, ERAS } from '../data/factions.js';
import { COMMANDERS, COMMANDER_KEYS, DIFFICULTIES, DIFFICULTY_KEYS, resolveCommander } from '../data/commanders.js';
import { MAPS, MAP_KEYS, loadMap } from '../maps/maps.js';
import { SIGNATURE_SYSTEMS } from '../data/abilities.js';

import { drawPortrait, doctrineIconCanvas } from './portraits.js';
import { TERRAIN, T } from '../core/terrain.js';
import { makeRng } from '../core/util.js';

export const FORMATS = {
  '1v1': { name: '1 v 1', teams: [1, 2], note: 'A straight duel. Expect first contact around three to five minutes and a decision inside twenty.' },
  '1v2': { name: '1 v 2', teams: [1, 2, 2], note: 'Two allied AI commanders against you. Hold a chokepoint early — you cannot trade evenly with both.' },
  '1v3': { name: '1 v 3', teams: [1, 2, 2, 2], note: 'Three allied AI commanders. Brutal. Turtle, take the oil behind you, and win on infrastructure.' },
  '2v2': { name: '2 v 2', teams: [1, 2, 1, 2], note: 'You and an AI ally against two opponents. Your ally shares its vision with you.' },
  'ffa': { name: 'Free-for-all', teams: [1, 2, 3, 4], note: 'Every commander for themselves. The AI will fight each other as readily as they fight you.' },
};

export class Setup {
  constructor(session) {
    this.s = session;
    this.config = this.defaultConfig();
    this.load();
    this.bind();
    this.renderMainCards();
  }

  defaultConfig() {
    return {
      era: 'modern', map: 'ardenne', format: '1v1',
      players: [
        { faction: 'arc', isHuman: true, commanderKey: null, difficultyKey: 'officer', team: 1, colourKey: 'blue', startIndex: 0 },
        { faction: 'esd', isHuman: false, commanderKey: 'hammer', difficultyKey: 'officer', team: 2, colourKey: 'red', startIndex: 2, unknownCommander: false },
        { faction: 'pdc', isHuman: false, commanderKey: 'viper', difficultyKey: 'officer', team: 2, colourKey: 'green', startIndex: 1, unknownCommander: false },
        { faction: 'mrl', isHuman: false, commanderKey: 'longbow', difficultyKey: 'officer', team: 2, colourKey: 'gold', startIndex: 3, unknownCommander: false },
      ],
    };
  }

  save() {
    try {
      localStorage.setItem('faultline.config', JSON.stringify(this.config));
    } catch (e) { /* private browsing: settings simply will not persist */ }
  }

  load() {
    try {
      const raw = localStorage.getItem('faultline.config');
      if (!raw) return;
      const c = JSON.parse(raw);
      if (c && c.players && c.players.length === 4 && MAPS[c.map] && ERAS[c.era] && FORMATS[c.format]) this.config = c;
    } catch (e) { /* ignore malformed saved config */ }
  }

  bind() {
    const go = (id) => document.getElementById(id);
    go('btn-skirmish').addEventListener('click', () => { this.s.show('setup'); this.renderSetup(); });
    go('btn-dossier').addEventListener('click', () => { this.s.show('dossier'); this.renderDossiers(); });
    go('btn-systems').addEventListener('click', () => { this.s.show('systems'); this.renderSystems(); });
    go('btn-help').addEventListener('click', () => { this.s.show('help'); this.renderHelp(); });
    go('btn-settings').addEventListener('click', () => this.s.openSettings());
    go('setup-back').addEventListener('click', () => this.s.show('main'));
    go('dossier-back').addEventListener('click', () => this.s.show('main'));
    go('systems-back').addEventListener('click', () => this.s.show('main'));
    go('help-back').addEventListener('click', () => this.s.show('main'));
    go('setup-start').addEventListener('click', () => this.start());
    go('setup-random').addEventListener('click', () => { this.randomise(); this.renderSetup(); });
    go('build-stamp').textContent = 'Faultline Command · single-player skirmish build';
  }

  // ------------------------------------------------------------ main menu
  renderMainCards() {
    const el = document.getElementById('main-cards');
    const cards = [
      ['Objective', 'Destroy every opposing Command Headquarters. Losing your own ends the battle immediately.'],
      ['Infrastructure', 'Power drives production. Radar and the data centre drive precision weapons and missile defence. The munitions complex keeps every gun in your army loaded.'],
      ['Eight Commanders', 'Each AI opponent has a doctrine that genuinely changes how it builds, expands, attacks and reacts — separate from its difficulty setting.'],
    ];
    el.innerHTML = cards.map(([h, b]) => `<div class="panel"><div class="panel-h">${h}</div>
      <div style="font-size:12.5px;color:var(--ink-dim);line-height:1.65">${b}</div></div>`).join('');
  }

  // -------------------------------------------------------------- skirmish
  activeCount() { return FORMATS[this.config.format].teams.length; }

  randomise() {
    const rng = makeRng((Date.now() & 0xffffff) ^ 0x5eed);
    const c = this.config;
    c.era = rng.pick(['modern', 'nineties']);
    c.map = rng.pick(MAP_KEYS);
    c.format = rng.pick(Object.keys(FORMATS));
    const facs = rng.shuffle(FACTION_KEYS.slice());
    const cmds = rng.shuffle(COMMANDER_KEYS.slice());
    const starts = rng.shuffle([0, 1, 2, 3]);
    c.players.forEach((p, i) => {
      p.faction = facs[i];
      p.startIndex = starts[i];
      if (!p.isHuman) {
        p.commanderKey = cmds[i % cmds.length];
        p.difficultyKey = rng.pick(['officer', 'officer', 'general']);
      }
    });
    this.applyFormat();
  }

  applyFormat() {
    const teams = FORMATS[this.config.format].teams;
    this.config.players.forEach((p, i) => { if (i < teams.length) p.team = teams[i]; });
    // Keep starting positions unique.
    const used = new Set();
    this.config.players.forEach((p) => {
      let s = p.startIndex;
      while (used.has(s)) s = (s + 1) % 4;
      p.startIndex = s; used.add(s);
    });
    // Keep colours unique.
    const uc = new Set();
    this.config.players.forEach((p) => {
      let k = p.colourKey;
      while (uc.has(k)) k = TEAM_COLOURS[(TEAM_COLOURS.findIndex((c) => c.key === k) + 1) % TEAM_COLOURS.length].key;
      p.colourKey = k; uc.add(k);
    });
    this.save();
  }

  renderSetup() {
    this.applyFormat();
    const c = this.config;

    // Era
    const eraRow = document.getElementById('era-row');
    eraRow.innerHTML = '';
    for (const k of Object.keys(ERAS)) {
      const e = ERAS[k];
      const b = document.createElement('button');
      b.className = 'chip' + (c.era === k ? ' on' : '');
      b.innerHTML = `${e.name}<span style="color:var(--ink-faint);margin-left:6px;font-size:10px">${e.year}</span>`;
      b.title = e.blurb;
      b.addEventListener('click', () => { c.era = k; this.renderSetup(); this.s.audio.click(); });
      eraRow.appendChild(b);
    }

    // Maps
    const mapRow = document.getElementById('map-row');
    mapRow.innerHTML = '';
    for (const k of MAP_KEYS) {
      const m = MAPS[k];
      const card = document.createElement('button');
      card.className = 'mapcard' + (c.map === k ? ' on' : '');
      const cv = document.createElement('canvas');
      cv.width = 240; cv.height = 96;
      card.appendChild(cv);
      const body = document.createElement('div');
      body.className = 'mc-body';
      body.innerHTML = `<div class="mc-name">${m.name}</div><div class="mc-sub">${m.subtitle}</div>
        ${m.naval ? '<span class="mc-tag">Naval units available</span>' : '<span class="mc-tag">Land battle</span>'}`;
      card.appendChild(body);
      card.addEventListener('click', () => { c.map = k; this.renderSetup(); this.s.audio.click(); });
      mapRow.appendChild(card);
      this.drawMapPreview(cv, k);
    }
    const m = MAPS[c.map];
    document.getElementById('map-brief').innerHTML =
      `<div style="font-size:12.5px;color:var(--ink-dim);line-height:1.65">${m.blurb}</div>
       <ul style="margin-top:8px;padding-left:0">${m.tips.map((t) => `<li style="list-style:none;font-size:12px;color:var(--ink-faint);padding:3px 0">▸ ${t}</li>`).join('')}</ul>`;

    // Format
    const fRow = document.getElementById('format-row');
    fRow.innerHTML = '';
    for (const k of Object.keys(FORMATS)) {
      const b = document.createElement('button');
      b.className = 'chip' + (c.format === k ? ' on' : '');
      b.textContent = FORMATS[k].name;
      b.addEventListener('click', () => { c.format = k; this.applyFormat(); this.renderSetup(); this.s.audio.click(); });
      fRow.appendChild(b);
    }
    document.getElementById('format-note').textContent = FORMATS[c.format].note;

    this.renderSlots();
    this.save();
  }

  drawMapPreview(cv, key) {
    const data = loadMap(key);
    const ctx = cv.getContext('2d');
    const W = cv.width, H = cv.height;
    const n = data.width;
    const img = ctx.createImageData(n, n);
    for (let i = 0, j = 0; i < data.tiles.length; i++, j += 4) {
      const col = TERRAIN[data.bridge[i] ? T.CONCRETE : data.tiles[i]].colour;
      const v = parseInt(col.slice(1), 16);
      img.data[j] = (v >> 16) & 255; img.data[j + 1] = (v >> 8) & 255; img.data[j + 2] = v & 255; img.data[j + 3] = 255;
    }
    const tmp = document.createElement('canvas');
    tmp.width = n; tmp.height = n;
    tmp.getContext('2d').putImageData(img, 0, 0);
    ctx.imageSmoothingEnabled = false;
    const side = Math.min(W, H);
    ctx.fillStyle = '#0c1118';
    ctx.fillRect(0, 0, W, H);
    ctx.drawImage(tmp, (W - side) / 2, 0, side, side);
    const ox = (W - side) / 2, sc = side / n;
    for (const o of data.oil) {
      ctx.fillStyle = o.type === 'refinery' ? '#ffd257' : (o.type === 'port' ? '#7fd6ff' : '#e8b24a');
      ctx.fillRect(ox + o.x * sc - 1.5, o.y * sc - 1.5, 3, 3);
    }
    data.starts.forEach((st, i) => {
      ctx.strokeStyle = TEAM_COLOURS[i].hex;
      ctx.lineWidth = 1.6;
      ctx.strokeRect(ox + st.x * sc - 5, st.y * sc - 5, 10, 10);
    });
  }

  renderSlots() {
    const c = this.config;
    const host = document.getElementById('slots');
    host.innerHTML = '';
    const count = this.activeCount();
    const naval = MAPS[c.map].naval;

    for (let i = 0; i < count; i++) {
      const p = c.players[i];
      const colour = TEAM_COLOURS.find((x) => x.key === p.colourKey) || TEAM_COLOURS[i];
      const slot = document.createElement('div');
      slot.className = 'slot';
      const head = document.createElement('div');
      head.className = 'slot-head';
      head.innerHTML = `<span class="slot-swatch" style="background:${colour.hex}"></span>
        <span class="slot-title">${p.isHuman ? 'You — Field Command' : 'AI Opponent ' + i}</span>
        <span style="font-size:11px;color:var(--ink-faint)">Team ${p.team} · Start ${p.startIndex + 1}</span>`;
      slot.appendChild(head);

      const body = document.createElement('div');
      body.className = 'slot-body';

      body.appendChild(this.selectField('Coalition', FACTION_KEYS.map((k) => [k, FACTIONS[k].name]), p.faction, (v) => { p.faction = v; this.renderSetup(); }));

      if (!p.isHuman) {
        const opts = [['random', '⟲ Random commander'], ['unknown', '？ Unknown commander']].concat(
          COMMANDER_KEYS.map((k) => [k, COMMANDERS[k].codename + ' — ' + COMMANDERS[k].doctrine]));
        const cur = p.unknownCommander ? 'unknown' : (p.randomCommander ? 'random' : p.commanderKey);
        body.appendChild(this.selectField('Commander', opts, cur, (v) => {
          p.unknownCommander = v === 'unknown';
          p.randomCommander = v === 'random';
          if (v !== 'unknown' && v !== 'random') p.commanderKey = v;
          this.renderSetup();
        }));
        body.appendChild(this.selectField('Difficulty', DIFFICULTY_KEYS.map((k) => [k, DIFFICULTIES[k].name]), p.difficultyKey, (v) => { p.difficultyKey = v; this.renderSetup(); }));
      }

      body.appendChild(this.selectField('Team', [[1, 'Team 1'], [2, 'Team 2'], [3, 'Team 3'], [4, 'Team 4']], p.team, (v) => { p.team = +v; this.renderSlots(); this.save(); }));
      body.appendChild(this.selectField('Starting Position', [[0, 'North-west'], [1, 'North-east'], [2, 'South-east'], [3, 'South-west']], p.startIndex, (v) => {
        const other = c.players.find((q, j) => j < count && q !== p && q.startIndex === +v);
        if (other) other.startIndex = p.startIndex;
        p.startIndex = +v; this.renderSetup();
      }));

      const cw = document.createElement('div');
      cw.innerHTML = '<div class="mini-label">Team Colour</div>';
      const sws = document.createElement('div');
      sws.className = 'swatches';
      for (const col of TEAM_COLOURS) {
        const b = document.createElement('button');
        const taken = c.players.some((q, j) => j < count && q !== p && q.colourKey === col.key);
        b.className = 'sw' + (p.colourKey === col.key ? ' on' : '') + (taken ? ' taken' : '');
        b.style.background = col.hex;
        b.title = col.name;
        if (!taken) b.addEventListener('click', () => { p.colourKey = col.key; this.renderSetup(); });
        sws.appendChild(b);
      }
      cw.appendChild(sws);
      body.appendChild(cw);
      slot.appendChild(body);

      if (!p.isHuman) {
        const cmd = p.unknownCommander ? null : COMMANDERS[p.commanderKey];
        const info = document.createElement('div');
        info.style.cssText = 'padding:0 11px 10px;display:flex;gap:10px;align-items:flex-start';
        if (p.unknownCommander) {
          info.innerHTML = `<div style="width:56px;height:56px;border:1px dashed var(--line2);display:flex;align-items:center;justify-content:center;font-size:26px;color:var(--ink-faint)">?</div>
            <div style="font-size:11.5px;color:var(--ink-dim);line-height:1.55">Identity withheld. Scout this opponent's activity during the battle to identify their doctrine.</div>`;
        } else if (p.randomCommander) {
          info.innerHTML = `<div style="width:56px;height:56px;border:1px dashed var(--line2);display:flex;align-items:center;justify-content:center;font-size:24px;color:var(--ink-faint)">⟲</div>
            <div style="font-size:11.5px;color:var(--ink-dim);line-height:1.55">A commander will be drawn at random when the battle starts, and revealed in the briefing.</div>`;
        } else if (cmd) {
          const pc = document.createElement('canvas');
          pc.width = 56; pc.height = 56;
          pc.style.cssText = 'width:56px;height:56px;border:1px solid var(--line2);flex:none';
          drawPortrait(pc, cmd, 56);
          info.appendChild(pc);
          const d = document.createElement('div');
          const diff = DIFFICULTIES[p.difficultyKey];
          d.style.cssText = 'font-size:11.5px;color:var(--ink-dim);line-height:1.55';
          d.innerHTML = `<b style="color:var(--ink)">${cmd.codename}</b> · ${cmd.name}<br>
            <span style="color:${cmd.accent}">${cmd.doctrine.toUpperCase()} DOCTRINE</span><br>${cmd.dossier.split('.')[0]}.
            <div style="margin-top:5px;color:var(--ink-faint)">${diff.name}: ${diff.note}</div>`;
          info.appendChild(d);
        }
        slot.appendChild(info);
      }
      host.appendChild(slot);
    }
  }

  selectField(label, options, value, onChange) {
    const w = document.createElement('div');
    w.innerHTML = `<div class="mini-label">${label}</div>`;
    const sel = document.createElement('select');
    for (const [v, t] of options) {
      const o = document.createElement('option');
      o.value = v; o.textContent = t;
      if (String(v) === String(value)) o.selected = true;
      sel.appendChild(o);
    }
    sel.addEventListener('change', () => { onChange(sel.value); this.save(); });
    w.appendChild(sel);
    return w;
  }

  // ------------------------------------------------------------ dossiers
  renderDossiers() {
    const host = document.getElementById('dossier-body');
    host.innerHTML = `<div style="font-size:12.5px;color:var(--ink-dim);max-width:820px;line-height:1.65;margin-bottom:16px">
      Doctrine and difficulty are independent settings. Difficulty changes planning quality, reaction time and aggression;
      doctrine changes what a commander builds, where it attacks and what it considers worth killing. Every commander
      retains basic combined-arms capability and will adapt if you produce an obvious counter.</div>
      <div class="cmd-grid" id="dossier-grid"></div>`;
    const grid = document.getElementById('dossier-grid');
    for (const k of COMMANDER_KEYS) {
      const c = COMMANDERS[k];
      const card = document.createElement('div');
      card.className = 'cmd-card';
      card.style.cursor = 'default';
      const top = document.createElement('div');
      top.className = 'cmd-top';
      const pc = document.createElement('canvas');
      pc.className = 'cmd-portrait';
      pc.width = 56; pc.height = 56;
      drawPortrait(pc, c, 56);
      top.appendChild(pc);
      const nm = document.createElement('div');
      nm.innerHTML = `<div class="cmd-name">${c.codename}</div><div class="cmd-real">${c.name}</div>
        <div class="cmd-doc" style="color:${c.accent}"><span id="ico-${k}"></span>${c.doctrine} doctrine</div>`;
      top.appendChild(nm);
      card.appendChild(top);
      const body = document.createElement('div');
      body.className = 'cmd-body';
      body.innerHTML = `<div style="color:var(--ink-faint);font-style:italic;margin-bottom:6px">${c.background}</div>
        ${c.dossier}
        <div style="margin-top:7px"><b class="tagline-good">Strengths</b><br>${c.strengths.map((s) => '▸ ' + s).join('<br>')}</div>
        <div style="margin-top:6px"><b class="tagline-bad">Exploitable weakness</b><br>▸ ${c.weakness}</div>
        <div style="margin-top:6px"><b style="color:var(--accent2)">Preferred systems</b><br>${(c.signature || []).map((x) => '▸ ' + x).join('<br>')}</div>
        ${c.landlockedFallback ? '<div style="margin-top:6px;color:var(--ink-faint)">On a landlocked map this commander switches to a mobile combined-arms doctrine.</div>' : ''}`;
      card.appendChild(body);
      grid.appendChild(card);
      const holder = document.getElementById('ico-' + k);
      if (holder) holder.appendChild(doctrineIconCanvas(c.icon, c.accent, 15));
    }
  }

  // ------------------------------------------------------------- systems
  renderSystems() {
    const host = document.getElementById('systems-body');
    host.innerHTML = `<div class="panel" style="max-width:1000px">
      <div class="panel-h">Ten Signature Systems</div>
      <div style="font-size:12.5px;color:var(--ink-dim);line-height:1.65;margin-bottom:12px">
        Each behaves differently in flight and is defeated differently. Interception is always a roll, never a certainty,
        and every launcher needs the right buildings, spare power, a live data link and ammunition in the magazine.</div>
      <ul class="sys-list">${SIGNATURE_SYSTEMS.map((s) => `<li>
        <b>${s.id}. ${s.name}</b> <span style="color:var(--ink-faint)">— ${s.kind}</span><br>
        <span class="who">${s.who} · ${s.era}</span><br>${s.note}</li>`).join('')}</ul>
      </div>
      <div class="panel" style="max-width:1000px;margin-top:14px">
        <div class="panel-h">Interception Matrix</div>
        <div style="font-size:12.5px;color:var(--ink-dim);line-height:1.7">
          <b style="color:var(--ink)">Patriot / S-400 / HQ-9</b> — long reach, strong against ballistic missiles, cruise missiles and air strikes; nearly useless against a cheap rocket salvo.<br>
          <b style="color:var(--ink)">Iron Dome-style interception</b> — short reach, superb against rockets and loitering munitions, poor against ballistic missiles.<br>
          <b style="color:var(--ink)">Air &amp; Missile Defence site</b> — the general-purpose middle ground; needs radar, power and a data link.<br>
          <b style="color:var(--ink)">Mobile AA and MANPADS</b> — travel with the army, work with the power grid down, and are the only air defence you have while attacking.<br>
          <span style="color:var(--warn)">Lose your data centre and every networked interceptor drops to roughly a third of its hit probability.</span>
        </div>
      </div>`;
  }

  // ----------------------------------------------------------- field manual
  renderHelp() {
    const host = document.getElementById('help-body');
    host.innerHTML = `<div class="panel" style="max-width:1100px">
      <div class="help-grid">
        <div>
          <h4>Selection</h4>
          <ul>
            <li><b>Left-click</b> select a unit or building</li>
            <li><b>Drag</b> box-select multiple units</li>
            <li><b>Shift-click</b> add or remove from the selection</li>
            <li><b>Double-click</b> select all nearby units of the same type</li>
            <li><span class="kbd">Ctrl</span>+<span class="kbd">1</span>–<span class="kbd">9</span> assign a control group</li>
            <li><span class="kbd">1</span>–<span class="kbd">9</span> recall a control group</li>
            <li><span class="kbd">&#96;</span> select the whole army</li>
            <li><span class="kbd">E</span> jump to an idle combat engineer</li>
          </ul>
          <h4>Orders</h4>
          <ul>
            <li><b>Right-click</b> move, attack, capture or interact — whichever fits the target</li>
            <li><span class="kbd">A</span> then click — attack-move</li>
            <li><span class="kbd">S</span> stop · <span class="kbd">G</span> hold position · <span class="kbd">U</span> unload transport</li>
            <li><span class="kbd">R</span> then click — set a production building's rally point</li>
            <li>Right-click a friendly transport with infantry selected to embark</li>
            <li>Right-click an oil site with an engineer selected to capture it</li>
          </ul>
        </div>
        <div>
          <h4>Camera</h4>
          <ul>
            <li><span class="kbd">W</span><span class="kbd">A</span><span class="kbd">S</span><span class="kbd">D</span> or arrow keys — scroll</li>
            <li>Push the mouse to a screen edge — edge scroll</li>
            <li><b>Mouse wheel</b> zoom · <b>middle-drag</b> pan</li>
            <li><b>Click the minimap</b> to jump · <b>right-click it</b> to order units there</li>
            <li><span class="kbd">H</span> centre on your headquarters</li>
            <li><span class="kbd">T</span> toggle weapon and interception range rings</li>
          </ul>
          <h4>Economy</h4>
          <ul>
            <li>Income is a modest defence budget plus whatever oil you hold</li>
            <li><b>Administration capacity</b> starts at 2 sites; each Oil Administration Facility adds 4 more at full yield (+35% output)</li>
            <li>Sites past that capacity still pay, but only 42% — take ground you can actually run</li>
            <li>Strategic objectives appear periodically and pay a one-off bounty to whoever captures them</li>
          </ul>
          <h4>Battle</h4>
          <ul>
            <li><span class="kbd">Space</span> or <span class="kbd">P</span> pause · <span class="kbd">[</span> <span class="kbd">]</span> game speed</li>
            <li><span class="kbd">Esc</span> menu, or cancel whatever you are placing</li>
            <li><span class="kbd">Tab</span> cycle the sidebar</li>
          </ul>
          <h4>Things that will kill you</h4>
          <ul>
            <li>Building past your power supply — production slows and every radar-guided system shuts down</li>
            <li>Seizing more oil than you can administer — sites beyond your capacity yield only 42%. Build more Oil Administration Facilities</li>
            <li>Losing your data centre — precision strikes stop and interception collapses</li>
            <li>Losing the munitions complex — your army fires what it is carrying and then stops</li>
            <li>Parking artillery without a screen — it cannot defend itself at all</li>
            <li>Driving armour into woodland or a town without infantry</li>
          </ul>
        </div>
      </div>
    </div>`;
  }

  // ------------------------------------------------------------- briefing
  start() {
    const c = this.config;
    const count = this.activeCount();
    const rng = makeRng((Date.now() & 0x7fffffff) ^ 0xa5a5);
    const hasWater = MAPS[c.map].navigable;
    const used = new Set();

    const players = [];
    for (let i = 0; i < count; i++) {
      const p = { ...c.players[i] };
      if (!p.isHuman) {
        if (p.randomCommander || p.unknownCommander) {
          const pool = COMMANDER_KEYS.filter((k) => !used.has(k));
          p.commanderKey = rng.pick(pool.length ? pool : COMMANDER_KEYS);
        }
        used.add(p.commanderKey);
      }
      players.push(p);
    }
    this.pending = {
      mapKey: c.map, era: c.era, seed: (Date.now() & 0xffffff) ^ 0x1234,
      players, format: c.format,
    };
    this.save();
    this.s.show('brief');
    this.renderBriefing();
  }

  renderBriefing() {
    const cfg = this.pending;
    const map = MAPS[cfg.mapKey];
    const era = ERAS[cfg.era];
    const host = document.getElementById('brief-body');
    const human = cfg.players.find((p) => p.isHuman);
    const hasWater = map.navigable;

    host.innerHTML = `
      <div class="setup-head"><h2>Intelligence Briefing</h2>
        <div class="tb-spacer"></div>
        <div style="font-family:var(--ui);letter-spacing:.16em;text-transform:uppercase;color:var(--accent);font-size:13px">${map.name} · ${era.name}</div>
      </div>
      <div class="brief-grid">
        <div class="panel">
          <div class="panel-h">Theatre</div>
          <div style="font-size:12.5px;color:var(--ink-dim);line-height:1.7">${map.blurb}</div>
          <div style="margin-top:10px;font-size:12px;color:var(--ink-faint);line-height:1.7">
            ${map.tips.map((t) => '▸ ' + t).join('<br>')}
          </div>
          <div class="panel-h" style="margin-top:16px">Your Command</div>
          <div style="font-size:12.5px;color:var(--ink-dim);line-height:1.7">
            <b style="color:${TEAM_COLOURS.find((c) => c.key === human.colourKey).hex}">${FACTIONS[human.faction].name}</b><br>
            ${FACTIONS[human.faction].doctrineNote}<br>
            <span style="color:var(--ink-faint)">Motto: ${FACTIONS[human.faction].motto} · ${FACTIONS[human.faction].homeland}</span>
          </div>
          <div style="margin-top:10px;font-size:12px;line-height:1.7">
            <span class="tagline-good">Strengths:</span> ${FACTIONS[human.faction].strengths.join('; ')}<br>
            <span class="tagline-bad">Weakness:</span> ${FACTIONS[human.faction].weakness}
          </div>
        </div>
        <div class="panel">
          <div class="panel-h">Known Opposing Commanders</div>
          <div id="brief-cmds"></div>
          <div class="panel-h" style="margin-top:14px">Opening Advice</div>
          <div style="font-size:12.5px;color:var(--ink-dim);line-height:1.7" id="brief-advice"></div>
        </div>
      </div>
      <div class="loadbar"><i id="brief-bar"></i></div>
      <div style="display:flex;gap:10px;margin-top:14px;align-items:center">
        <button class="btn primary" id="brief-go" disabled>Preparing theatre…</button>
        <button class="btn small" id="brief-back">◀ Change deployment</button>
        <div style="color:var(--ink-faint);font-size:11.5px" id="brief-status">Generating terrain and starting positions</div>
      </div>`;

    const cmdHost = document.getElementById('brief-cmds');
    for (const p of cfg.players) {
      if (p.isHuman) continue;
      const colour = TEAM_COLOURS.find((c) => c.key === p.colourKey).hex;
      const div = document.createElement('div');
      div.className = 'dossier';
      div.style.borderLeft = '3px solid ' + colour;
      if (p.unknownCommander) {
        div.innerHTML = `<div style="width:64px;height:64px;border:1px dashed var(--line2);display:flex;align-items:center;justify-content:center;font-size:28px;color:var(--ink-faint)">?</div>
          <div style="font-size:12px;line-height:1.6"><b style="color:var(--ink)">UNKNOWN COMMANDER</b> · ${FACTIONS[p.faction].abbr} · ${DIFFICULTIES[p.difficultyKey].name}<br>
          <span style="color:var(--ink-dim)">No dossier available. Scout their construction and their opening moves to identify the doctrine.</span></div>`;
      } else {
        const cmd = resolveCommander(p.commanderKey, hasWater);
        const cv = document.createElement('canvas');
        cv.width = 64; cv.height = 64;
        drawPortrait(cv, cmd, 64);
        div.appendChild(cv);
        const d = document.createElement('div');
        d.style.cssText = 'font-size:12px;line-height:1.6';
        d.innerHTML = `<b style="color:var(--ink)">${cmd.codename}</b> · ${cmd.name}<br>
          <span style="color:${cmd.accent};letter-spacing:.1em;font-size:10.5px;text-transform:uppercase">${cmd.doctrine} doctrine</span>
          <span style="color:var(--ink-faint)"> · ${FACTIONS[p.faction].abbr} · ${DIFFICULTIES[p.difficultyKey].name}</span><br>
          <span style="color:var(--ink-dim)">${cmd.dossier}</span><br>
          <span class="tagline-bad">Weakness:</span> <span style="color:var(--ink-dim)">${cmd.weakness}</span>
          <br><span style="color:var(--accent2)">Prefers:</span> <span style="color:var(--ink-dim)">${(cmd.signature || []).join(' · ')}</span>
          ${cmd.fallbackActive ? '<br><span style="color:var(--warn)">No navigable water here — switching to a mobile combined-arms doctrine.</span>' : ''}
          ${DIFFICULTIES[p.difficultyKey].disclosed ? '<br><span style="color:var(--warn)">' + DIFFICULTIES[p.difficultyKey].disclosed + '</span>' : ''}`;
        div.appendChild(d);
      }
      cmdHost.appendChild(div);
    }

    document.getElementById('brief-advice').innerHTML = this.advice(cfg);
    document.getElementById('brief-back').addEventListener('click', () => this.s.show('setup'));

    // Build the match while the briefing is on screen.
    const bar = document.getElementById('brief-bar');
    const status = document.getElementById('brief-status');
    const go = document.getElementById('brief-go');
    let step = 0;
    const steps = [
      ['Generating terrain and starting positions', () => { loadMap(cfg.mapKey); }],
      ['Deploying headquarters and initial forces', () => { this.s.prepareGame(cfg); }],
      ['Briefing opposing commanders', () => { this.s.prepareAI(); }],
      ['Theatre ready', () => {}],
    ];
    const tick = () => {
      if (step >= steps.length) {
        bar.style.width = '100%';
        go.disabled = false;
        go.textContent = 'Deploy ▶';
        go.classList.add('primary');
        status.textContent = 'All units in position.';
        go.onclick = () => this.s.beginBattle();
        return;
      }
      const [label, fn] = steps[step];
      status.textContent = label;
      bar.style.width = ((step + 1) / steps.length * 100) + '%';
      try { fn(); } catch (err) { status.textContent = 'Error: ' + err.message; console.error(err); return; }
      step++;
      setTimeout(tick, 260);
    };
    setTimeout(tick, 140);
  }

  advice(cfg) {
    const era = cfg.era;
    const map = MAPS[cfg.mapKey];
    const human = cfg.players.find((p) => p.isHuman);
    const lines = [
      'Power station, then barracks, then an engineer onto the nearest oil derrick. Everything else waits.',
      'You can run two oil sites without an Oil Administration Facility; each one you build adds four more at full yield. Anything past that produces 42%.',
      'A vehicle factory needs a power station and a barracks. An artillery and munitions complex needs the factory.',
      'The munitions complex is not optional: without one your tanks and guns fire only what they already carry.',
    ];
    if (map.naval) lines.push('This map has navigable water. A naval yard opens up patrol craft, landing craft, frigates, coastal support ships and missile destroyers.');
    else lines.push('No navigable water here, so naval units and coastal batteries are unavailable to everyone.');
    if (era === 'nineties') lines.push('1990s theatre: no Iron Dome, HIMARS, S-400 or Storm Shadow. You have M270, Patriot PAC-2, Tomahawk, S-300, Tochka and drone reconnaissance instead.');
    else lines.push('Modern theatre: the full precision-strike and interception set is available once the Advanced Weapons Command is up.');
    const hard = cfg.players.some((p) => p.difficultyKey === 'marshal');
    if (hard) lines.push('One opponent is set to Marshal — it receives a disclosed +25% income and +15% construction speed on top of its better planning.');
    return lines.map((l) => '▸ ' + l).join('<br>');
  }
}
