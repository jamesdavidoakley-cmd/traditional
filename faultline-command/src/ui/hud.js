// The in-game interface: resource bar, construction sidebar, selection panel,
// tactical alerts, radio log and the minimap panel.

import { clamp, formatMoney, formatClock } from '../core/util.js';
import { getUnit } from '../data/units.js';
import { getBuilding } from '../data/buildings.js';
import { ABILITIES, abilityName } from '../data/abilities.js';
import { queueUnit, cancelUnit, producersFor, unitBlockReason, structureBlockReason } from '../sim/economy.js';
import { unitIcon, buildingIcon, abilityIcon } from './icons.js';
import { TERRAIN } from '../core/terrain.js';

const TABS = [
  { key: 'build', label: 'Build' },
  { key: 'defence', label: 'Defence' },
  { key: 'strike', label: 'Strike' },
  { key: 'infantry', label: 'Infantry' },
  { key: 'vehicle', label: 'Vehicles' },
  { key: 'naval', label: 'Naval' },
];

export class HUD {
  constructor(session) {
    this.s = session;
    this.game = session.game;
    this.tab = 'build';
    this.cards = [];
    this.lastAlertAt = 0;
    this.shownMessages = 0;
    this.el = {
      top: document.getElementById('topbar'),
      tabs: document.getElementById('sb-tabs'),
      list: document.getElementById('sb-list'),
      sel: document.getElementById('selpanel'),
      alerts: document.getElementById('alerts'),
      radio: document.getElementById('radio'),
      hint: document.getElementById('hint'),
      minimap: document.getElementById('minimap'),
      tip: document.getElementById('tip'),
    };
    this.buildTop();
    this.buildTabs();
    this.rebuild();
    this.hintTimer = 0;
  }

  get player() { return this.game.players[this.game.humanIndex]; }

  // ------------------------------------------------------------- top bar
  buildTop() {
    const p = this.player;
    this.el.top.innerHTML = `
      <div class="tb-item" style="border-left:3px solid ${p.colour}">
        <div class="tb-col"><span class="tb-lab">${p.factionDef.abbr}</span>
        <span class="tb-val" style="font-size:13px">${p.factionDef.name.split(' ').slice(0, 2).join(' ')}</span></div>
      </div>
      <div class="tb-item" title="Treasury and net income per second">
        <div class="tb-col"><span class="tb-lab">Funds</span><span class="tb-val" id="tb-credits">$0</span></div>
        <span id="tb-income" style="font-size:11px;color:var(--good)"></span>
      </div>
      <div class="tb-item" title="Generated versus consumed electricity">
        <div class="tb-col"><span class="tb-lab">Power</span><span class="tb-val" id="tb-power">0/0</span>
        <span class="tb-bar"><i id="tb-power-bar"></i></span></div>
      </div>
      <div class="tb-item" title="Data links available to networked weapons">
        <div class="tb-col"><span class="tb-lab">Data</span><span class="tb-val" id="tb-data">0/0</span></div>
      </div>
      <div class="tb-item" title="Ammunition stockpile and manufacturing rate">
        <div class="tb-col"><span class="tb-lab">Munitions</span><span class="tb-val" id="tb-ammo">0</span>
        <span class="tb-bar"><i id="tb-ammo-bar" style="background:var(--accent2)"></i></span></div>
      </div>
      <div class="tb-item" title="Oil sites held versus the number your administration can run at full yield">
        <div class="tb-col"><span class="tb-lab">Oil Sites</span><span class="tb-val" id="tb-oil">0</span></div>
      </div>
      <div class="tb-item" title="Elapsed battle time">
        <div class="tb-col"><span class="tb-lab">Elapsed</span><span class="tb-val" id="tb-clock">00:00</span></div>
      </div>
      <div class="tb-spacer"></div>
      <button class="tb-btn" id="tb-pause" title="Pause (Space / P)">❚❚ Pause</button>
      <button class="tb-btn" data-speed="0.5" title="Half speed">0.5×</button>
      <button class="tb-btn on" data-speed="1" title="Normal speed">1×</button>
      <button class="tb-btn" data-speed="2" title="Double speed">2×</button>
      <button class="tb-btn" data-speed="3" title="Triple speed">3×</button>
      <button class="tb-btn" id="tb-menu" title="Menu (Esc)">☰ Menu</button>`;

    this.el.top.querySelectorAll('[data-speed]').forEach((b) => {
      b.addEventListener('click', () => {
        this.game.speed = +b.dataset.speed;
        this.el.top.querySelectorAll('[data-speed]').forEach((o) => o.classList.toggle('on', o === b));
        this.s.audio.click();
      });
    });
    document.getElementById('tb-pause').addEventListener('click', () => this.s.togglePause());
    document.getElementById('tb-menu').addEventListener('click', () => this.s.openMenu());
  }

  updateTop() {
    const p = this.player, g = this.game;
    document.getElementById('tb-credits').textContent = formatMoney(p.credits);
    document.getElementById('tb-income').textContent = '+' + Math.round(p.income) + '/s';
    const pw = document.getElementById('tb-power');
    pw.textContent = p.powerSupply + '/' + p.powerDemand;
    pw.classList.toggle('tb-warn', p.lowPower);
    const bar = document.getElementById('tb-power-bar');
    bar.style.width = Math.round(clamp(p.powerDemand ? p.powerSupply / p.powerDemand : 1, 0, 1) * 100) + '%';
    bar.style.background = p.lowPower ? 'var(--bad)' : 'var(--good)';
    const dt = document.getElementById('tb-data');
    dt.textContent = p.dataUsed + '/' + p.dataCapacity;
    dt.classList.toggle('tb-warn', !p.dataOnline && p.dataCapacity === 0 && p.dataUsed > 0);
    dt.style.color = p.dataOnline ? '' : 'var(--ink-faint)';
    const am = document.getElementById('tb-ammo');
    am.textContent = Math.round(p.ammoStock) + (p.ammoRate > 0 ? ' (+' + p.ammoRate.toFixed(1) + ')' : ' (no supply)');
    am.classList.toggle('tb-warn', p.ammoRate <= 0 && p.ammoStock < 10);
    document.getElementById('tb-ammo-bar').style.width = Math.round(clamp(p.ammoStock / p.ammoMax, 0, 1) * 100) + '%';
    const oilEl = document.getElementById('tb-oil');
    oilEl.textContent = p.oilSites + '/' + (p.oilCapacity || 2);
    oilEl.style.color = p.oilSites > (p.oilCapacity || 2) ? 'var(--warn)' : '';
    document.getElementById('tb-clock').textContent = formatClock(g.elapsed);
    const pb = document.getElementById('tb-pause');
    pb.textContent = g.paused ? '▶ Resume' : '❚❚ Pause';
    pb.classList.toggle('on', g.paused);
  }

  // -------------------------------------------------------------- sidebar
  buildTabs() {
    const naval = this.game.mapData.naval;
    this.el.tabs.innerHTML = '';
    for (const t of TABS) {
      if (t.key === 'naval' && !naval) continue;
      const b = document.createElement('button');
      b.className = 'sb-tab' + (t.key === this.tab ? ' on' : '');
      b.textContent = t.label;
      b.dataset.tab = t.key;
      b.addEventListener('click', () => { this.setTab(t.key); this.s.audio.click(); });
      this.el.tabs.appendChild(b);
    }
  }

  setTab(t) {
    this.tab = t;
    this.el.tabs.querySelectorAll('.sb-tab').forEach((b) => b.classList.toggle('on', b.dataset.tab === t));
    this.rebuild();
  }

  rebuild() {
    const g = this.game, p = this.player;
    const list = this.el.list;
    list.innerHTML = '';
    this.cards = [];

    if (this.tab === 'build' || this.tab === 'defence') {
      const keys = this.tab === 'build' ? g.structureListFor(p) : g.defenceListFor(p);
      for (const key of keys) this.cards.push(this.structureCard(key));
    } else if (this.tab === 'strike') {
      const keys = Object.keys(p.abilities);
      if (!keys.length) list.appendChild(this.emptyNote('No theatre fires available to this coalition in this era.'));
      for (const key of keys) this.cards.push(this.abilityCard(key));
    } else {
      const cat = this.tab;
      const keys = g.rosterFor(p, cat);
      if (!keys.length) list.appendChild(this.emptyNote('Nothing available.'));
      for (const key of keys) this.cards.push(this.unitCard(key));
    }
    for (const c of this.cards) list.appendChild(c.el);
    this.refreshCards();
  }

  emptyNote(text) {
    const d = document.createElement('div');
    d.style.cssText = 'padding:14px 8px;font-size:12px;color:var(--ink-faint);line-height:1.6';
    d.textContent = text;
    return d;
  }

  makeCard(icon, name, meta) {
    const el = document.createElement('button');
    el.className = 'card';
    const wrap = document.createElement('div');
    wrap.className = 'card-main';
    const n = document.createElement('div'); n.className = 'card-name'; n.textContent = name;
    const m = document.createElement('div'); m.className = 'card-meta'; m.innerHTML = meta;
    const blk = document.createElement('div'); blk.className = 'card-block';
    wrap.appendChild(n); wrap.appendChild(m); wrap.appendChild(blk);
    el.appendChild(icon); el.appendChild(wrap);
    const prog = document.createElement('div'); prog.className = 'card-prog'; prog.style.width = '0';
    el.appendChild(prog);
    const q = document.createElement('div'); q.className = 'card-q'; q.style.display = 'none';
    el.appendChild(q);
    return { el, blk, prog, q, meta: m };
  }

  structureCard(key) {
    const p = this.player, g = this.game;
    const def = getBuilding(key, p.faction, p.era);
    const icon = buildingIcon(key, p.faction, p.era, p.colour, p.factionDef.architecture);
    const powerTxt = def.power > 0 ? `<b>+${def.power}MW</b>` : (def.power < 0 ? `${def.power}MW` : '');
    const c = this.makeCard(icon, def.name, `<b>${formatMoney(def.cost)}</b> · ${def.buildTime}s ${powerTxt}`);
    c.key = key; c.type = 'structure'; c.def = def;
    c.el.addEventListener('click', () => this.s.startPlacement(key));
    this.attachTip(c.el, () => this.structureTip(key));
    return c;
  }

  unitCard(key) {
    const p = this.player;
    const def = getUnit(p.faction, p.era, key);
    const icon = unitIcon(p.faction, p.era, key, p.colour);
    const c = this.makeCard(icon, def.name, `<b>${formatMoney(def.cost)}</b> · ${def.buildTime}s`);
    c.key = key; c.type = 'unit'; c.def = def;
    c.el.addEventListener('click', () => this.s.queueUnit(key));
    c.el.addEventListener('contextmenu', (e) => { e.preventDefault(); this.s.dequeueUnit(key); });
    this.attachTip(c.el, () => this.unitTip(key));
    return c;
  }

  abilityCard(key) {
    const p = this.player;
    const a = ABILITIES[key];
    const icon = abilityIcon(a.icon, p.colour);
    const c = this.makeCard(icon, abilityName(key, p.faction), `<b>${formatMoney(a.cost)}</b> · ${a.cooldown}s cycle`);
    c.key = key; c.type = 'ability'; c.def = a;
    c.el.addEventListener('click', () => this.s.armAbility(key));
    this.attachTip(c.el, () => this.abilityTip(key));
    return c;
  }

  refreshCards() {
    const p = this.player, g = this.game;
    for (const c of this.cards) {
      if (c.type === 'structure') {
        const reason = structureBlockReason(g, p, c.key);
        c.el.classList.toggle('disabled', !!reason);
        c.blk.textContent = reason || '';
        const b = p.construction.find((x) => x.key === c.key);
        c.prog.style.width = b ? (b.progress * 100) + '%' : '0';
      } else if (c.type === 'unit') {
        const reason = unitBlockReason(g, p, c.key);
        c.el.classList.toggle('disabled', !!reason);
        c.blk.textContent = reason || '';
        let queued = 0, prog = 0;
        for (const b of producersFor(p, c.key)) {
          for (const item of b.queue) if (item.key === c.key) queued++;
          if (b.queue.length && b.queue[0].key === c.key) prog = Math.max(prog, b.produceProgress);
        }
        c.q.style.display = queued ? 'block' : 'none';
        c.q.textContent = queued;
        c.prog.style.width = (prog * 100) + '%';
      } else {
        const st = g.abilityState(p, c.key);
        c.el.classList.toggle('disabled', !st.ok);
        const a = ABILITIES[c.key];
        const cd = p.abilities[c.key].cooldown;
        c.blk.textContent = st.ok ? '' : (st.reason + (cd > 0 ? ' ' + Math.ceil(cd) + 's' : ''));
        c.prog.style.width = cd > 0 ? ((1 - cd / a.cooldown) * 100) + '%' : '100%';
        c.prog.style.background = st.ok ? 'var(--good)' : 'var(--warn)';
      }
    }
  }

  // ----------------------------------------------------------- tooltips
  attachTip(el, build) {
    el.addEventListener('mouseenter', () => {
      const t = this.el.tip;
      t.innerHTML = build();
      t.classList.add('on');
      this._tipEl = el;
      this.positionTip();
    });
    el.addEventListener('mousemove', () => this.positionTip());
    el.addEventListener('mouseleave', () => { this.el.tip.classList.remove('on'); this._tipEl = null; });
  }

  positionTip() {
    if (!this._tipEl) return;
    const r = this._tipEl.getBoundingClientRect();
    const t = this.el.tip;
    t.style.left = Math.max(6, r.left - t.offsetWidth - 10) + 'px';
    t.style.top = Math.min(window.innerHeight - t.offsetHeight - 8, r.top) + 'px';
  }

  row(l, v) { return `<div class="st"><span>${l}</span><span>${v}</span></div>`; }

  structureTip(key) {
    const p = this.player;
    const d = getBuilding(key, p.faction, p.era);
    let h = `<h5>${d.name}</h5><div>${d.desc}</div><div style="margin-top:6px">`;
    h += this.row('Cost', formatMoney(d.cost));
    h += this.row('Build time', d.buildTime + 's');
    h += this.row('Power', d.power > 0 ? '+' + d.power + ' MW' : d.power + ' MW');
    if (d.dataLinks) h += this.row('Provides', d.dataLinks + ' data links');
    if (d.dataUse) h += this.row('Data links used', d.dataUse);
    if (d.ammoRate) h += this.row('Ammunition', '+' + d.ammoRate + '/s');
    if (d.oilBonus) h += this.row('Oil yield', '+' + Math.round(d.oilBonus * 100) + '%');
    if (d.repairRate) h += this.row('Repairs', d.repairRate + ' hp/s within ' + d.repairRadius);
    if (d.weapons && d.weapons.length) {
      h += this.row('Weapon', d.weapons[0].name);
      h += this.row('Range', d.weapons[0].range.toFixed(1));
      h += this.row('Damage', d.weapons[0].damage + ' ' + d.weapons[0].type);
    }
    if (d.interceptor) {
      const i = d.interceptor;
      h += `</div><div style="margin-top:6px;color:var(--accent2)">Interception (range ${i.range})</div><div>`;
      h += this.row('Ballistic', Math.round(i.ballistic * 100) + '%');
      h += this.row('Cruise', Math.round(i.cruise * 100) + '%');
      h += this.row('Rockets', Math.round(i.rocket * 100) + '%');
      h += this.row('Drones', Math.round(i.loiter * 100) + '%');
      h += this.row('Aircraft', Math.round(i.aircraft * 100) + '%');
    }
    h += '</div>';
    if (d.prereq.length) {
      h += `<div class="req">Requires: ${d.prereq.map((k) => getBuilding(k, p.faction, p.era).name).join(', ')}</div>`;
    }
    const reason = structureBlockReason(this.game, this.player, key);
    if (reason) h += `<div class="req">${reason}</div>`;
    return h;
  }

  unitTip(key) {
    const p = this.player;
    const d = getUnit(p.faction, p.era, key);
    let h = `<h5>${d.name}</h5><div style="color:var(--ink-faint);font-size:10.5px;letter-spacing:.1em;text-transform:uppercase">${d.key === 'himars' || d.key === 'phl16' ? 'Signature system' : d.class}</div>`;
    h += `<div style="margin-top:5px">${d.flavour}</div>`;
    h += `<div style="margin-top:5px;color:var(--ink-faint)">${d.desc}</div><div style="margin-top:6px">`;
    h += this.row('Cost', formatMoney(d.cost));
    h += this.row('Build time', d.buildTime + 's');
    h += this.row('Hull', d.hp);
    h += this.row('Armour class', d.armour);
    h += this.row('Speed', d.speed.toFixed(2));
    h += this.row('Vision', d.vision.toFixed(1));
    if (d.ammoMax) h += this.row('Ammunition', d.ammoMax + ' rounds');
    if (d.cargo) h += this.row('Capacity', d.cargo);
    for (const w of d.weapons) {
      h += `</div><div style="margin-top:6px;color:var(--accent2)">${w.name}</div><div>`;
      h += this.row('Range', w.range.toFixed(1) + (w.minRange ? ' (min ' + w.minRange + ')' : ''));
      h += this.row('Damage', w.damage + ' ' + w.type + (w.salvo > 1 ? ' ×' + w.salvo : ''));
      h += this.row('Reload', w.rof.toFixed(1) + 's');
      if (w.splash) h += this.row('Blast radius', w.splash.toFixed(1));
    }
    h += '</div>';
    if (d.needsSpotting) h += '<div class="req">Indirect fire — needs a spotter to see the target.</div>';
    if (d.needsData) h += '<div class="req">Needs an operational data link.</div>';
    const reason = unitBlockReason(this.game, this.player, key);
    if (reason) h += `<div class="req">${reason}</div>`;
    return h;
  }

  abilityTip(key) {
    const p = this.player;
    const a = ABILITIES[key];
    let h = `<h5>${abilityName(key, p.faction)}</h5><div>${a.desc}</div>`;
    h += `<div style="margin-top:6px;color:var(--ink-faint)">${a.tip}</div><div style="margin-top:6px">`;
    h += this.row('Cost', formatMoney(a.cost));
    h += this.row('Cycle time', a.cooldown + 's');
    if (a.payload.count) h += this.row('Munitions', a.payload.count);
    if (a.payload.damage) h += this.row('Warhead', a.payload.damage);
    if (a.payload.splash) h += this.row('Blast radius', a.payload.splash.toFixed(1));
    if (a.threat) h += this.row('Flight profile', a.threat);
    if (a.requires.ammo) h += this.row('Ammunition drawn', a.requires.ammo);
    if (a.requires.data) h += this.row('Data links', a.requires.data);
    h += '</div>';
    const req = [];
    if (a.requires.buildings) req.push(...a.requires.buildings.map((k) => getBuilding(k, p.faction, p.era).name));
    if (a.requires.units) req.push('a ' + a.requires.units.join(', '));
    if (req.length) h += `<div class="req">Requires: ${req.join(', ')}</div>`;
    const st = this.game.abilityState(p, key);
    if (!st.ok) h += `<div class="req">${st.reason}</div>`;
    return h;
  }

  // ------------------------------------------------------ selection panel
  updateSelection() {
    const sel = this.s.selection;
    const el = this.el.sel;
    if (!sel.length) { el.classList.remove('on'); this._selSig = null; return; }
    el.classList.add('on');
    const p = this.player;
    const sig = sel.map((e) => e.id).join(',') + '|' + sel.length;
    const first = sel[0];

    if (sig !== this._selSig) {
      this._selSig = sig;
      el.innerHTML = this.selectionHTML(sel);
      el.querySelectorAll('[data-act]').forEach((b) => {
        b.addEventListener('click', () => this.s.selectionAction(b.dataset.act, b.dataset.arg));
      });
      el.querySelectorAll('[data-qcancel]').forEach((b) => {
        b.addEventListener('click', () => {
          const bld = this.game.world.byId.get(+b.dataset.bid);
          if (bld) { cancelUnit(this.game, p, bld, +b.dataset.qcancel); this._selSig = null; }
        });
      });
      el.querySelectorAll('[data-sub]').forEach((b) => {
        b.addEventListener('click', () => { this.s.selectSubgroup(b.dataset.sub); this._selSig = null; });
      });
      const cnv = el.querySelector('canvas.sel-icon');
      if (cnv) {
        const src = first.kind === 'unit'
          ? unitIcon(p.faction, p.era, first.key, this.game.players[first.owner].colour, 40)
          : (first.kind === 'building'
            ? buildingIcon(first.key, this.game.players[first.owner] ? this.game.players[first.owner].faction : p.faction, p.era,
              this.game.players[first.owner] ? this.game.players[first.owner].colour : '#888',
              this.game.players[first.owner] ? this.game.players[first.owner].factionDef.architecture : 'atlantic', 40)
            : null);
        if (src) cnv.getContext('2d').drawImage(src, 0, 0, 40, 40);
      }
    }
    this.updateSelectionLive(sel);
  }

  selectionHTML(sel) {
    const g = this.game, p = this.player;
    const first = sel[0];
    if (sel.length > 1) {
      const groups = {};
      for (const e of sel) {
        const k = e.kind === 'unit' ? e.key : e.key;
        groups[k] = (groups[k] || 0) + 1;
      }
      const chips = Object.entries(groups).map(([k, n]) => {
        const d = first.kind === 'unit' || sel.find((x) => x.key === k).kind === 'unit'
          ? getUnit(p.faction, p.era, k) : getBuilding(k, p.faction, p.era);
        return `<button class="sel-chip" data-sub="${k}">${d ? d.name : k}<b>${n}</b></button>`;
      }).join('');
      const hp = sel.reduce((a, e) => a + e.hp, 0), hpM = sel.reduce((a, e) => a + e.hpMax, 0);
      const ammoUnits = sel.filter((e) => e.ammoMax > 0);
      const ammo = ammoUnits.reduce((a, e) => a + e.ammo, 0), ammoM = ammoUnits.reduce((a, e) => a + e.ammoMax, 0);
      return `<div class="sel-head"><div><div class="sel-title">${sel.length} units selected</div>
        <div class="sel-sub">Click a type below to narrow the selection</div></div></div>
        <div class="sel-body">
          <div class="stat"><div class="stat-l">Condition</div><div class="stat-v" id="sel-hp">${Math.round(hp / hpM * 100)}%</div>
            <div class="meter"><i id="sel-hp-bar" style="width:${(hp / hpM * 100)}%;background:var(--good)"></i></div></div>
          ${ammoM ? `<div class="stat"><div class="stat-l">Ammunition</div><div class="stat-v" id="sel-ammo">${Math.round(ammo)}/${ammoM}</div>
            <div class="meter"><i id="sel-ammo-bar" style="width:${(ammo / ammoM * 100)}%;background:var(--accent2)"></i></div></div>` : ''}
        </div>
        <div class="sel-group">${chips}</div>
        <div class="sel-actions">
          <button class="btn small" data-act="attackmove">Attack-Move</button>
          <button class="btn small" data-act="stop">Stop</button>
          <button class="btn small" data-act="guard">Hold</button>
        </div>`;
    }

    if (first.kind === 'unit') return this.unitPanel(first);
    if (first.kind === 'building') return this.buildingPanel(first);
    return this.neutralPanel(first);
  }

  unitPanel(u) {
    const g = this.game;
    const owner = g.players[u.owner];
    const d = u.def;
    const w = d.weapons[0];
    const cargo = u.cargo && u.cargo.length ? `<div class="stat"><div class="stat-l">Embarked</div><div class="stat-v">${u.cargo.length}/${d.cargo}</div></div>` : '';
    const mine = u.owner === g.humanIndex;
    return `<div class="sel-head">
        <canvas class="sel-icon" width="40" height="40"></canvas>
        <div><div class="sel-title">${d.name}</div>
        <div class="sel-sub">${owner.name} · ${owner.factionDef.abbr} · ${d.class}${u.def.signature ? ' · signature system' : ''}</div></div>
      </div>
      <div class="sel-body">
        <div class="stat"><div class="stat-l">Hull</div><div class="stat-v" id="sel-hp">${Math.round(u.hp)}/${u.hpMax}</div>
          <div class="meter"><i id="sel-hp-bar"></i></div></div>
        ${d.ammoMax ? `<div class="stat"><div class="stat-l">Ammunition</div><div class="stat-v" id="sel-ammo">${Math.round(u.ammo)}/${d.ammoMax}</div>
          <div class="meter"><i id="sel-ammo-bar" style="background:var(--accent2)"></i></div></div>` : ''}
        <div class="stat"><div class="stat-l">Mobility</div><div class="stat-v" id="sel-mob">100%</div></div>
        <div class="stat"><div class="stat-l">Weapon</div><div class="stat-v" id="sel-wpn">100%</div></div>
        ${w ? `<div class="stat"><div class="stat-l">Range</div><div class="stat-v">${w.range.toFixed(1)}</div></div>
        <div class="stat"><div class="stat-l">Damage</div><div class="stat-v">${w.damage}${w.salvo > 1 ? '×' + w.salvo : ''} <span style="color:var(--ink-faint);font-size:11px">${w.type}</span></div></div>` : ''}
        <div class="stat"><div class="stat-l">Speed</div><div class="stat-v" id="sel-spd">${d.speed.toFixed(2)}</div></div>
        <div class="stat"><div class="stat-l">Terrain</div><div class="stat-v" id="sel-terr">—</div></div>
        ${cargo}
      </div>
      <div class="sel-flavour">${d.flavour}</div>
      ${mine ? `<div class="sel-actions">
        <button class="btn small" data-act="attackmove">Attack-Move</button>
        <button class="btn small" data-act="stop">Stop</button>
        ${u.cargo && u.cargo.length ? '<button class="btn small" data-act="unload">Unload</button>' : ''}
      </div>` : ''}`;
  }

  buildingPanel(b) {
    const g = this.game, p = this.player;
    const owner = g.players[b.owner];
    const d = b.def;
    const mine = b.owner === g.humanIndex;
    let queue = '';
    if (mine && b.queue && b.queue.length) {
      queue = '<div class="sel-group">' + b.queue.map((q, i) => {
        const ud = getUnit(p.faction, p.era, q.key);
        return `<button class="sel-chip" data-qcancel="${i}" data-bid="${b.id}" title="Click to cancel">${ud.name}${i === 0 ? ' <b>' + Math.round(b.produceProgress * 100) + '%</b>' : ''}</button>`;
      }).join('') + '</div>';
    }
    let extra = '';
    if (d.power > 0) extra += `<div class="stat"><div class="stat-l">Output</div><div class="stat-v">${Math.round(d.power * clamp(b.hp / b.hpMax, 0.25, 1) * (0.5 + 0.5 * clamp(b.hp / b.hpMax, 0.25, 1)))} MW</div></div>`;
    else if (d.power < 0) extra += `<div class="stat"><div class="stat-l">Draw</div><div class="stat-v">${-d.power} MW</div></div>`;
    if (d.dataLinks) extra += `<div class="stat"><div class="stat-l">Data links</div><div class="stat-v">${d.dataLinks}</div></div>`;
    if (d.ammoRate) extra += `<div class="stat"><div class="stat-l">Ammo output</div><div class="stat-v">${d.ammoRate}/s</div></div>`;
    if (b.ammoMax) extra += `<div class="stat"><div class="stat-l">Magazine</div><div class="stat-v">${Math.round(b.ammo)}/${b.ammoMax}</div></div>`;
    return `<div class="sel-head">
        <canvas class="sel-icon" width="40" height="40"></canvas>
        <div><div class="sel-title">${d.name}</div>
        <div class="sel-sub">${owner.name} · ${b.state === 'active' ? (b.online ? 'Operational' : 'OFFLINE — insufficient power') : 'Under construction ' + Math.round(b.progress * 100) + '%'}</div></div>
      </div>
      <div class="sel-body">
        <div class="stat"><div class="stat-l">Structure</div><div class="stat-v" id="sel-hp">${Math.round(b.hp)}/${b.hpMax}</div>
          <div class="meter"><i id="sel-hp-bar"></i></div></div>
        ${extra}
      </div>
      <div class="sel-flavour">${d.desc}</div>
      ${queue}
      ${mine ? `<div class="sel-actions">
        ${d.produces ? '<button class="btn small" data-act="rally">Set Rally Point</button>' : ''}
        ${b.key !== 'hq' ? '<button class="btn small" data-act="sell">Demolish (50% back)</button>' : ''}
      </div>` : ''}`;
  }

  neutralPanel(n) {
    const g = this.game;
    const owner = n.owner >= 0 ? g.players[n.owner] : null;
    return `<div class="sel-head"><div>
        <div class="sel-title">${n.def.name}</div>
        <div class="sel-sub">${owner ? owner.name + ' · ' + owner.factionDef.abbr : 'Unclaimed'}${n.disabled > 0 ? ' · OFFLINE ' + Math.ceil(n.disabled) + 's' : ''}</div></div></div>
      <div class="sel-body">
        <div class="stat"><div class="stat-l">Condition</div><div class="stat-v" id="sel-hp">${Math.round(n.hp)}/${n.hpMax}</div>
          <div class="meter"><i id="sel-hp-bar"></i></div></div>
        <div class="stat"><div class="stat-l">Yield</div><div class="stat-v">$${n.income}/s</div></div>
        <div class="stat"><div class="stat-l">Capture time</div><div class="stat-v">${n.def.captureTime}s</div></div>
      </div>
      <div class="sel-flavour">Send a Combat Engineer here to take it. Holding oil infrastructure is the difference between an army and a plan.</div>`;
  }

  updateSelectionLive(sel) {
    const first = sel[0];
    const hpEl = document.getElementById('sel-hp');
    if (!hpEl) return;
    if (sel.length > 1) {
      const hp = sel.reduce((a, e) => a + e.hp, 0), hpM = sel.reduce((a, e) => a + e.hpMax, 0);
      hpEl.textContent = Math.round(hp / hpM * 100) + '%';
      const bar = document.getElementById('sel-hp-bar');
      if (bar) bar.style.width = (hp / hpM * 100) + '%';
      const au = sel.filter((e) => e.ammoMax > 0);
      if (au.length) {
        const a = au.reduce((x, e) => x + e.ammo, 0), am = au.reduce((x, e) => x + e.ammoMax, 0);
        const ae = document.getElementById('sel-ammo');
        if (ae) ae.textContent = Math.round(a) + '/' + am;
        const ab = document.getElementById('sel-ammo-bar');
        if (ab) ab.style.width = (a / am * 100) + '%';
      }
      return;
    }
    const e = first;
    hpEl.textContent = Math.round(e.hp) + '/' + e.hpMax;
    const frac = clamp(e.hp / e.hpMax, 0, 1);
    const bar = document.getElementById('sel-hp-bar');
    if (bar) { bar.style.width = (frac * 100) + '%'; bar.style.background = frac > 0.6 ? 'var(--good)' : frac > 0.3 ? 'var(--warn)' : 'var(--bad)'; }
    if (e.kind === 'unit') {
      const ae = document.getElementById('sel-ammo');
      if (ae) {
        ae.textContent = Math.round(e.ammo) + '/' + e.ammoMax;
        ae.style.color = e.ammo <= 0 ? 'var(--bad)' : '';
        const ab = document.getElementById('sel-ammo-bar');
        if (ab) ab.style.width = (clamp(e.ammo / e.ammoMax, 0, 1) * 100) + '%';
      }
      const mo = document.getElementById('sel-mob');
      if (mo) { mo.textContent = Math.round(e.mobility * 100) + '%'; mo.style.color = e.mobility < 0.99 ? 'var(--warn)' : ''; }
      const wp = document.getElementById('sel-wpn');
      if (wp) { wp.textContent = Math.round(e.weaponHealth * 100) + '%'; wp.style.color = e.weaponHealth < 0.99 ? 'var(--warn)' : ''; }
      const sp = document.getElementById('sel-spd');
      const world = this.game.world;
      const f = world.speedFactor(e.x, e.y, e.domain, e.heavy);
      if (sp) sp.textContent = (e.def.speed * f * (0.34 + 0.66 * e.mobility)).toFixed(2);
      const te = document.getElementById('sel-terr');
      if (te) {
        const t = world.tileAt(e.x, e.y);
        const cover = world.coverAt(e.x, e.y);
        te.textContent = TERRAIN[t].name + (cover > 0.05 && e.def.class === 'infantry' ? ' (+' + Math.round(cover * 85) + '% cover)' : '');
        te.style.fontSize = '12px';
      }
    }
  }

  // ------------------------------------------------------------- alerts
  ALERT_TEXT = {
    lowPower: ['INSUFFICIENT POWER — PRODUCTION SLOWED', 'warn'],
    dataLost: ['DATA LINK LOST — PRECISION SYSTEMS OFFLINE', ''],
    baseAttack: ['BASE UNDER ATTACK', ''],
    incoming: ['INCOMING MISSILE — INTERCEPTORS ENGAGING', ''],
    intercepted: ['INBOUND THREAT INTERCEPTED', 'good'],
    captured: ['OIL INFRASTRUCTURE CAPTURED', 'good'],
    objective: ['STRATEGIC OBJECTIVE SECURED', 'good'],
    mobility: ['VEHICLE IMMOBILISED', 'warn'],
    noAmmo: ['NO AMMUNITION — BUILD A MUNITIONS COMPLEX', 'warn'],
    identified: ['ENEMY COMMANDER IDENTIFIED', 'good'],
  };

  updateAlerts() {
    const g = this.game;
    const now = g.time;
    for (const a of g.alerts) {
      if (a.shown) continue;
      a.shown = true;
      if (a.type === 'strikeLaunched' && a.owner !== g.humanIndex) continue;
      if (a.type === 'captured' && a.owner !== g.humanIndex) continue;
      if (a.type === 'objective' && a.owner !== g.humanIndex) continue;
      const spec = this.ALERT_TEXT[a.type];
      if (!spec) continue;
      // Name the inbound for what it actually is: an air raid is not a missile,
      // and a 1926 siege shell cannot be intercepted by anything at all.
      const text = a.type === 'incoming' ? this.incomingText(a.key) : spec[0];
      this.pushAlert(text, spec[1], a.x, a.y);
    }
    // radio log
    while (this.shownMessages < g.messages.length) {
      const m = g.messages[this.shownMessages++];
      const d = document.createElement('div');
      d.className = 'rmsg' + (m.bad ? ' bad' : '') + (m.radio ? ' radio' : '');
      d.textContent = m.radio ? m.text : '▸ ' + m.text;
      if (m.colour) d.style.borderLeftColor = m.colour;
      this.el.radio.appendChild(d);
      setTimeout(() => d.remove(), 9000);
      while (this.el.radio.children.length > 7) this.el.radio.firstChild.remove();
    }
  }

  incomingText(key) {
    const ab = ABILITIES[key];
    switch (ab && ab.threat) {
      case 'aircraft': return 'ENEMY AIRCRAFT INBOUND — AIR DEFENCE ENGAGING';
      case 'loiter':   return 'LOITERING MUNITIONS INBOUND — AIR DEFENCE ENGAGING';
      case 'rocket':   return 'ROCKET SALVO INBOUND — INTERCEPTORS ENGAGING';
      case 'ballistic':
      case 'cruise':   return 'INCOMING MISSILE — INTERCEPTORS ENGAGING';
      default:         return 'HEAVY BOMBARDMENT INBOUND — NO INTERCEPTION POSSIBLE';
    }
  }

  pushAlert(text, kind, x, y) {
    const d = document.createElement('div');
    d.className = 'alert ' + (kind || '');
    d.textContent = text;
    if (x !== undefined) {
      d.style.pointerEvents = 'auto';
      d.style.cursor = 'pointer';
      d.title = 'Click to jump there';
      d.addEventListener('click', () => this.s.renderer.panWorld(x, y));
    }
    this.el.alerts.appendChild(d);
    setTimeout(() => { d.style.transition = 'opacity .4s'; d.style.opacity = '0'; }, 3600);
    setTimeout(() => d.remove(), 4200);
    while (this.el.alerts.children.length > 5) this.el.alerts.firstChild.remove();
  }

  hint(text, ms) {
    this.el.hint.textContent = text;
    this.el.hint.style.display = text ? 'block' : 'none';
    this.hintTimer = ms ? ms / 1000 : 0;
  }

  update(dt) {
    this.updateTop();
    this.refreshCards();
    this.updateSelection();
    this.updateAlerts();
    if (this.hintTimer > 0) {
      this.hintTimer -= dt;
      if (this.hintTimer <= 0) this.hint('');
    }
  }
}
