// Faultline Command — bootstrap, session state and the main loop.

import { Game } from './sim/game.js';
import { createAIs } from './ai/ai.js';
import { Renderer } from './render/renderer.js';
import { Renderer3D, webglAvailable } from './render/renderer3d.js';
import { Audio } from './audio/audio.js';
import { HUD } from './ui/hud.js';
import { Input } from './ui/input.js';
import { Setup, FORMATS } from './ui/setup.js';
import { getUnit } from './data/units.js';
import { getBuilding } from './data/buildings.js';
import { ABILITIES, abilityName } from './data/abilities.js';
import { queueUnit, cancelUnit, producersFor, unitBlockReason, structureBlockReason } from './sim/economy.js';
import { COMMANDERS } from './data/commanders.js';
import { formatClock, formatMoney, clamp, dist } from './core/util.js';

class Session {
  constructor() {
    this.canvas = document.getElementById('battlefield');
    this.audio = new Audio();
    this.screen = 'main';
    this.game = null;
    this.renderer = null;
    this.hud = null;
    this.input = null;
    this.selection = [];
    this.groups = {};
    this.placement = null;
    this.abilityArmed = null;
    this.menuOpen = false;
    this.lastFrame = performance.now();
    this.settings = { master: 0.75, sfx: 0.85, music: 0.5, muted: false, edgeScroll: true, renderer3d: true };
    this.loadSettings();
    this.setup = new Setup(this);
    this.bindGlobal();
    requestAnimationFrame(() => this.frame());
  }

  // ------------------------------------------------------------- settings
  loadSettings() {
    try {
      const raw = localStorage.getItem('faultline.settings');
      if (raw) Object.assign(this.settings, JSON.parse(raw));
    } catch (e) { /* settings will not persist */ }
    this.audio.setMaster(this.settings.master);
    this.audio.setSfx(this.settings.sfx);
    this.audio.setMusic(this.settings.music);
    this.audio.setMuted(this.settings.muted);
  }

  saveSettings() {
    try { localStorage.setItem('faultline.settings', JSON.stringify(this.settings)); } catch (e) { /* ignore */ }
  }

  bindGlobal() {
    window.addEventListener('resize', () => { if (this.renderer) this.renderer.resize(); });
    const start = () => { this.audio.init(); this.audio.resume(); window.removeEventListener('pointerdown', start); };
    window.addEventListener('pointerdown', start);
    document.getElementById('mm-ranges').addEventListener('click', () => {
      this.renderer.showRanges = !this.renderer.showRanges;
      document.getElementById('mm-ranges').classList.toggle('on', this.renderer.showRanges);
    });
    document.getElementById('mm-centre').addEventListener('click', () => this.renderer.centreOnPlayer());
    document.getElementById('mm-help').addEventListener('click', () => this.openControls());
  }

  show(name) {
    this.screen = name;
    for (const id of ['main', 'setup', 'dossier', 'systems', 'help', 'brief']) {
      const el = document.getElementById('screen-' + id);
      if (el) el.classList.toggle('active', id === name);
    }
    document.getElementById('game').classList.toggle('active', name === 'game');
    if (name !== 'game') this.closeOverlay();
  }

  // ------------------------------------------------------------ lifecycle
  prepareGame(cfg) {
    this.pendingConfig = cfg;
    this.game = new Game(cfg);
    this.game.audio = this.audio;
    const fx = this.game.fx;
    const baseExplosion = fx.explosion.bind(fx);
    fx.explosion = (x, y, r, type) => { baseExplosion(x, y, r, type); this.audio.explosion(x, y, r); };
    this.selection = [];
    this.groups = {};
    this.placement = null;
    this.abilityArmed = null;
  }

  prepareAI() { createAIs(this.game); }

  /**
   * The 3D renderer where WebGL is available, the isometric one where it is not.
   * A machine without WebGL still gets the whole game, just drawn flat.
   */
  makeRenderer() {
    if (this.settings.renderer3d !== false && webglAvailable()) {
      try { return new Renderer3D(this.canvas, this.game); }
      catch (e) {
        console.warn('3D renderer unavailable, falling back to isometric:', e);
        // A canvas that has held a WebGL context can never hand out a 2D one.
        this.replaceCanvas();
      }
    }
    const overlay = document.getElementById('battlefield-overlay');
    if (overlay) overlay.remove();
    return new Renderer(this.canvas, this.game);
  }

  /** Swap in a clean <canvas> and re-point everything that holds the old one. */
  replaceCanvas() {
    const old = this.canvas;
    const fresh = document.createElement('canvas');
    fresh.id = old.id;
    fresh.className = old.className;
    old.parentNode.replaceChild(fresh, old);
    this.canvas = fresh;
    if (this.input) this.input.rebind(fresh);
  }

  /** Switch between the 3D and isometric battlefields without leaving the match. */
  switchRenderer(want3d) {
    this.settings.renderer3d = want3d;
    this.saveSettings();
    if (!this.game || this.screen !== 'game') return;
    const keep = this.renderer ? { x: this.renderer.view.camX, y: this.renderer.view.camY } : null;
    if (this.renderer && this.renderer.dispose) this.renderer.dispose();
    this.replaceCanvas();
    this.renderer = this.makeRenderer();
    this.renderer.resize();
    if (keep) this.renderer.panWorld(keep.x, keep.y); else this.renderer.centreOnPlayer();
    this.renderer.placement = this.placement;
    this.audio.view = this.renderer.view;
  }

  beginBattle() {
    this.show('game');
    if (this.renderer && this.renderer.dispose) this.renderer.dispose();
    // A canvas keeps whichever context type it was first given, so every battle
    // starts from a clean element.
    this.replaceCanvas();
    this.renderer = this.makeRenderer();
    this.renderer.resize();
    this.renderer.centreOnPlayer();
    this.audio.init();
    this.audio.view = this.renderer.view;
    this.audio.startMusic();
    this.hud = new HUD(this);
    // One Input for the session: re-creating it would stack duplicate window listeners.
    if (!this.input) this.input = new Input(this);
    this.input.keys.clear();
    this.input.pendingCommand = null;
    this.input.dragStart = null;
    this.input.dragging = false;
    this.input.mouse.moved = false;
    this.input.edgeScroll = this.settings.edgeScroll;
    this.game.paused = false;
    this.menuOpen = false;
    this.resultShown = false;
    this.hud.hint('Build a Power Station, then a Barracks. Send your engineer to the nearest oil derrick.', 11000);
    this.lastFrame = performance.now();
  }

  restart() {
    const cfg = this.pendingConfig;
    this.closeOverlay();
    this.audio.stopMusic();
    this.prepareGame({ ...cfg });
    this.prepareAI();
    this.beginBattle();
  }

  quitToMenu() {
    this.audio.stopMusic();
    this.game = null;
    this.closeOverlay();
    this.show('main');
  }

  // ---------------------------------------------------------------- loop
  frame() {
    requestAnimationFrame(() => this.frame());
    const now = performance.now();
    let dt = (now - this.lastFrame) / 1000;
    this.lastFrame = now;
    dt = Math.min(dt, 0.1);

    if (this.screen !== 'game' || !this.game) return;
    if (!this.menuOpen) this.input.update(dt);
    this.game.update(dt);
    this.renderer.render(dt);
    this.renderer.drawMinimap(document.getElementById('minimap'));
    this.hud.update(dt);
    this.pruneSelection();
    if (this.game.over && !this.resultShown) { this.resultShown = true; this.showResult(); }
  }

  // ----------------------------------------------------------- selection
  pruneSelection() {
    let changed = false;
    for (let i = this.selection.length - 1; i >= 0; i--) {
      const e = this.selection[i];
      if (e.dead || (e.kind === 'unit' && e.loaded)) { e.selected = false; this.selection.splice(i, 1); changed = true; }
    }
    if (changed) this.hud._selSig = null;
  }

  setSelection(list, additive) {
    if (!additive) for (const e of this.selection) e.selected = false;
    const next = additive ? this.selection.slice() : [];
    for (const e of list) {
      const i = next.indexOf(e);
      if (additive && i >= 0) { next.splice(i, 1); e.selected = false; }
      else if (i < 0) { next.push(e); e.selected = true; }
    }
    for (const e of next) e.selected = true;
    this.selection = next;
    if (list.length) this.audio.select();
    this.hud && (this.hud._selSig = null);
  }

  clickSelect(hit, additive) {
    if (!hit) { if (!additive) this.setSelection([], false); return; }
    this.setSelection([hit], additive);
    if (hit.kind === 'building' && hit.owner === this.game.humanIndex && hit.def.produces) {
      const tab = { barracks: 'infantry', factory: 'vehicle', artillery: 'vehicle', navalyard: 'naval' }[hit.key];
      if (tab && this.hud) this.hud.setTab(tab);
    }
  }

  selectSameTypeNear(u) {
    const list = [];
    for (const o of this.game.world.units) {
      if (o.dead || o.loaded || o.owner !== u.owner || o.key !== u.key) continue;
      const sp = this.renderer.worldToScreen(o.x, o.y);
      if (sp.x > -50 && sp.x < this.renderer.cssW + 50 && sp.y > -50 && sp.y < this.renderer.cssH + 50) list.push(o);
    }
    this.setSelection(list, false);
  }

  selectAllArmy() {
    const me = this.game.humanIndex;
    this.setSelection(this.game.world.units.filter((u) => !u.dead && !u.loaded && u.owner === me && u.def.weapons.length), false);
  }

  selectIdleEngineer() {
    const me = this.game.humanIndex;
    const eng = this.game.world.units.filter((u) => !u.dead && u.owner === me && u.def.canCapture);
    if (!eng.length) return;
    const idle = eng.filter((u) => u.order.type === 'idle' || u.order.type === 'guard');
    const pick = (idle.length ? idle : eng)[0];
    this.setSelection([pick], false);
    this.renderer.panWorld(pick.x, pick.y);
  }

  selectSubgroup(key) {
    const sub = this.selection.filter((e) => e.key === key);
    if (sub.length) this.setSelection(sub, false);
  }

  assignGroup(n) {
    this.groups[n] = this.selection.filter((e) => !e.dead).slice();
    this.hud.hint('Control group ' + n + ' assigned (' + this.groups[n].length + ')', 1600);
    this.audio.click();
  }

  recallGroup(n, additive) {
    const g = (this.groups[n] || []).filter((e) => !e.dead);
    this.groups[n] = g;
    if (!g.length) return;
    this.setSelection(g, additive);
    const cx = g.reduce((a, e) => a + e.x, 0) / g.length;
    const cy = g.reduce((a, e) => a + e.y, 0) / g.length;
    if (this._lastGroupRecall === n && performance.now() - (this._lastGroupAt || 0) < 400) this.renderer.panWorld(cx, cy);
    this._lastGroupRecall = n; this._lastGroupAt = performance.now();
  }

  pingOrder(x, y) {
    this.game.fx.text(x, y, '▾', '#8fffc0');
  }

  selectionAction(act, arg) {
    const g = this.game;
    const units = this.selection.filter((u) => u.kind === 'unit' && u.owner === g.humanIndex);
    switch (act) {
      case 'stop': g.commandStop(units); this.audio.order(); break;
      case 'guard': for (const u of units) u.order = { type: 'guard', x: u.x, y: u.y }; this.audio.order(); break;
      case 'attackmove':
        if (units.length) { this.input.pendingCommand = 'attackmove'; this.hud.hint('ATTACK-MOVE — click a destination'); }
        break;
      case 'unload': g.commandUnload(units.filter((u) => u.cargo && u.cargo.length), units[0] ? units[0].x : 0, units[0] ? units[0].y + 2 : 0); break;
      case 'rally': this.input.pendingCommand = 'rally'; this.hud.hint('SET RALLY POINT — click a destination'); break;
      case 'sell': {
        const b = this.selection.find((e) => e.kind === 'building' && e.owner === g.humanIndex && e.key !== 'hq');
        if (b) { g.sellBuilding(g.players[g.humanIndex], b); this.setSelection([], false); this.audio.click(); }
        break;
      }
    }
  }

  // ---------------------------------------------------------- construction
  startPlacement(key) {
    const g = this.game, p = g.players[g.humanIndex];
    const reason = structureBlockReason(g, p, key);
    if (reason) { this.hud.hint(reason, 2600); this.audio.deny(); return; }
    const def = getBuilding(key, p.faction, p.era);
    const pads = g.validPadsFor(p, key);
    if (!pads.length) { this.hud.hint('No free construction point of the right type', 2600); this.audio.deny(); return; }
    this.abilityArmed = null;
    this.placement = { key, def, pads, hoverPad: null };
    this.renderer.placement = this.placement;
    this.canvas.classList.add('placing');
    this.hud.hint('Click a highlighted construction point to lay down the ' + def.name + ' (Esc to cancel)');
    this.audio.click();
  }

  cancelPlacement() {
    this.placement = null;
    this.renderer.placement = null;
    this.canvas.classList.remove('placing');
    this.hud.hint('');
  }

  tryPlace(wx, wy) {
    const g = this.game, p = g.players[g.humanIndex];
    const pad = this.placement.hoverPad;
    if (!pad) { this.audio.deny(); return; }
    const r = g.startConstruction(p, this.placement.key, pad);
    if (!r.ok) { this.hud.hint(r.reason, 2600); this.audio.deny(); return; }
    this.cancelPlacement();
    this.hud.rebuild();
  }

  queueUnit(key) {
    const g = this.game, p = g.players[g.humanIndex];
    const reason = unitBlockReason(g, p, key);
    if (reason) { this.hud.hint(reason, 2600); this.audio.deny(); return; }
    const producers = producersFor(p, key);
    // Prefer a building the player has explicitly selected, else the shortest queue.
    const selected = this.selection.filter((e) => e.kind === 'building' && producers.includes(e));
    const pool = selected.length ? selected : producers;
    pool.sort((a, b) => a.queue.length - b.queue.length);
    if (!queueUnit(g, p, pool[0], key)) { this.audio.deny(); return; }
    this.audio.click();
  }

  dequeueUnit(key) {
    const g = this.game, p = g.players[g.humanIndex];
    const producers = producersFor(p, key);
    for (let i = producers.length - 1; i >= 0; i--) {
      const b = producers[i];
      for (let j = b.queue.length - 1; j >= 0; j--) {
        if (b.queue[j].key === key) { cancelUnit(g, p, b, j); this.audio.click(); return; }
      }
    }
  }

  armAbility(key) {
    const g = this.game, p = g.players[g.humanIndex];
    const st = g.abilityState(p, key);
    if (!st.ok) { this.hud.hint(st.reason, 2600); this.audio.deny(); return; }
    this.cancelPlacement();
    const a = ABILITIES[key];
    this.abilityArmed = key;
    this.renderer.abilityTarget = { key, radius: (a.payload.reveal || a.payload.splash || 2) + (a.payload.spread || 0) };
    this.canvas.classList.add('targeting');
    this.hud.hint('SELECT TARGET for ' + abilityName(key, p.faction) + ' (right-click or Esc to cancel)');
    this.audio.click();
  }

  cancelAbility() {
    this.abilityArmed = null;
    this.renderer.abilityTarget = null;
    this.canvas.classList.remove('targeting');
    this.hud.hint('');
  }

  fireAbility(wx, wy) {
    const g = this.game, p = g.players[g.humanIndex];
    const key = this.abilityArmed;
    const r = g.useAbility(p, key, wx, wy);
    if (!r.ok) { this.hud.hint(r.reason, 2600); this.audio.deny(); return; }
    this.cancelAbility();
    this.hud.hint(abilityName(key, p.faction) + ' launched', 2400);
  }

  cycleTab(dir) {
    const tabs = [...document.querySelectorAll('.sb-tab')].map((b) => b.dataset.tab);
    const i = tabs.indexOf(this.hud.tab);
    this.hud.setTab(tabs[(i + dir + tabs.length) % tabs.length]);
  }

  // ------------------------------------------------------------- controls
  setSpeed(v) {
    this.game.speed = clamp(Math.round(v * 2) / 2, 0.5, 3);
    document.querySelectorAll('[data-speed]').forEach((b) => b.classList.toggle('on', +b.dataset.speed === this.game.speed));
    this.hud.hint('Game speed ' + this.game.speed + '×', 1400);
  }

  togglePause() {
    if (!this.game || this.game.over) return;
    this.game.paused = !this.game.paused;
    this.hud.hint(this.game.paused ? 'PAUSED' : '', this.game.paused ? 0 : 1);
  }

  // ------------------------------------------------------------ overlays
  openOverlay(html, wire) {
    const ov = document.getElementById('overlay');
    document.getElementById('ov-card').innerHTML = html;
    ov.classList.add('active');
    this.menuOpen = true;
    if (wire) wire(document.getElementById('ov-card'));
  }

  closeOverlay() {
    document.getElementById('overlay').classList.remove('active');
    this.menuOpen = false;
  }

  toggleMenu() {
    if (this.menuOpen) { this.closeOverlay(); if (this.game && this.wasPaused === false) this.game.paused = false; return; }
    this.openMenu();
  }

  openMenu() {
    if (!this.game) return;
    this.wasPaused = this.game.paused;
    this.game.paused = true;
    this.openOverlay(`
      <div class="ov-title">Battle Menu</div>
      <div class="ov-sub">${this.game.mapData.name} · ${formatClock(this.game.elapsed)} elapsed</div>
      <div class="ov-actions">
        <button class="btn primary" data-a="resume">Resume</button>
        <button class="btn" data-a="restart">Restart Battle</button>
        <button class="btn" data-a="settings">Settings</button>
        <button class="btn" data-a="controls">Controls</button>
        <button class="btn" data-a="quit">Abandon &amp; Return to Menu</button>
      </div>`, (card) => {
      card.querySelector('[data-a=resume]').onclick = () => { this.closeOverlay(); this.game.paused = this.wasPaused; };
      card.querySelector('[data-a=restart]').onclick = () => this.restart();
      card.querySelector('[data-a=settings]').onclick = () => this.openSettings(true);
      card.querySelector('[data-a=controls]').onclick = () => this.openControls(true);
      card.querySelector('[data-a=quit]').onclick = () => this.quitToMenu();
    });
  }

  openSettings(fromGame) {
    const s = this.settings;
    this.openOverlay(`
      <div class="ov-title">Settings</div>
      <div class="ov-sub">Saved to this browser. No account required.</div>
      <div class="slider-row"><label>Master</label><input type="range" id="v-master" min="0" max="1" step="0.05" value="${s.master}"><span class="slider-val" id="vv-master"></span></div>
      <div class="slider-row"><label>Effects</label><input type="range" id="v-sfx" min="0" max="1" step="0.05" value="${s.sfx}"><span class="slider-val" id="vv-sfx"></span></div>
      <div class="slider-row"><label>Music</label><input type="range" id="v-music" min="0" max="1" step="0.05" value="${s.music}"><span class="slider-val" id="vv-music"></span></div>
      <div class="ov-actions" style="margin-bottom:8px">
        <button class="btn small" id="v-mute">${s.muted ? '🔇 Unmute' : '🔊 Mute All'}</button>
        <button class="btn small" id="v-edge">Edge scrolling: ${s.edgeScroll ? 'On' : 'Off'}</button>
        <button class="btn small" id="v-view">Battlefield: ${s.renderer3d === false ? 'Isometric' : '3D'}</button>
      </div>
      <div class="ov-sub" style="margin:-4px 0 8px">The isometric battlefield is lighter on older machines.</div>
      <div class="ov-actions"><button class="btn primary" id="v-close">${fromGame ? 'Back' : 'Close'}</button></div>`, (card) => {
      const wire = (id, key, apply) => {
        const el = card.querySelector('#v-' + id), out = card.querySelector('#vv-' + id);
        const upd = () => { out.textContent = Math.round(el.value * 100) + '%'; };
        upd();
        el.addEventListener('input', () => { s[key] = +el.value; apply(+el.value); upd(); this.saveSettings(); });
      };
      wire('master', 'master', (v) => this.audio.setMaster(v));
      wire('sfx', 'sfx', (v) => this.audio.setSfx(v));
      wire('music', 'music', (v) => this.audio.setMusic(v));
      card.querySelector('#v-mute').onclick = (e) => {
        s.muted = !s.muted; this.audio.setMuted(s.muted); this.saveSettings();
        e.target.textContent = s.muted ? '🔇 Unmute' : '🔊 Mute All';
      };
      card.querySelector('#v-edge').onclick = (e) => {
        s.edgeScroll = !s.edgeScroll; this.saveSettings();
        if (this.input) this.input.edgeScroll = s.edgeScroll;
        e.target.textContent = 'Edge scrolling: ' + (s.edgeScroll ? 'On' : 'Off');
      };
      card.querySelector('#v-view').onclick = (e) => {
        this.switchRenderer(s.renderer3d === false);
        e.target.textContent = 'Battlefield: ' + (s.renderer3d === false ? 'Isometric' : '3D');
      };
      card.querySelector('#v-close').onclick = () => { if (fromGame) this.openMenu(); else this.closeOverlay(); };
    });
  }

  openControls(fromGame) {
    this.openOverlay(`
      <div class="ov-title">Controls</div>
      <div class="help-grid" style="margin-top:10px">
        <div><h4>Selection &amp; Orders</h4><ul>
          <li><b>Left-click</b> select · <b>drag</b> box-select · <b>shift-click</b> add/remove</li>
          <li><b>Double-click</b> select nearby units of the same type</li>
          <li><b>Right-click</b> move, attack, capture or interact</li>
          <li><span class="kbd">A</span> attack-move · <span class="kbd">S</span> stop · <span class="kbd">G</span> hold · <span class="kbd">U</span> unload</li>
          <li><span class="kbd">R</span> set rally point · <span class="kbd">E</span> find idle engineer</li>
          <li><span class="kbd">Ctrl</span>+number assign group · number recall</li>
        </ul></div>
        <div><h4>Camera &amp; Battle</h4><ul>
          <li><span class="kbd">W</span><span class="kbd">A</span><span class="kbd">S</span><span class="kbd">D</span> / arrows · edge scroll · middle-drag</li>
          <li><b>Wheel</b> zoom · <span class="kbd">H</span> centre on HQ · <span class="kbd">T</span> range rings</li>
          <li><b>Minimap:</b> click to jump, right-click to order</li>
          <li><span class="kbd">Space</span> pause · <span class="kbd">[</span> <span class="kbd">]</span> speed · <span class="kbd">Esc</span> menu</li>
        </ul></div>
      </div>
      <div class="ov-actions"><button class="btn primary" id="c-close">Close</button></div>`, (card) => {
      card.querySelector('#c-close').onclick = () => { if (fromGame) this.openMenu(); else this.closeOverlay(); };
    });
  }

  showResult() {
    const g = this.game, r = g.result;
    this.audio.stopMusic();
    if (r.won) this.audio.victory(); else this.audio.defeat();
    const rows = r.stats.map((s) => `<tr>
        <td><span style="display:inline-block;width:10px;height:10px;background:${s.colour};margin-right:7px"></span>${s.name}</td>
        <td>${s.faction}</td><td>${s.commander}</td>
        <td>${s.kills}</td><td>${s.losses}</td><td>${s.built}</td><td>${formatMoney(s.earned)}</td>
        <td style="color:${s.alive ? 'var(--good)' : 'var(--bad)'}">${s.alive ? 'Standing' : 'Eliminated'}</td>
      </tr>`).join('');
    this.openOverlay(`
      <div class="ov-title" style="color:${r.won ? 'var(--good)' : 'var(--bad)'}">${r.won ? 'Victory' : 'Defeat'}</div>
      <div class="ov-sub">${r.won ? 'Every opposing Command Headquarters has been destroyed.' : 'Your Command Headquarters has been destroyed.'}
        Battle length ${formatClock(r.time)}.</div>
      <table class="result-table"><thead><tr>
        <th>Commander</th><th>Coalition</th><th>Doctrine</th><th>Kills</th><th>Losses</th><th>Built</th><th>Earned</th><th>Status</th>
      </tr></thead><tbody>${rows}</tbody></table>
      <div class="ov-actions">
        <button class="btn primary" data-a="again">Fight Again</button>
        <button class="btn" data-a="setup">Change Deployment</button>
        <button class="btn" data-a="menu">Main Menu</button>
      </div>`, (card) => {
      card.querySelector('[data-a=again]').onclick = () => this.restart();
      card.querySelector('[data-a=setup]').onclick = () => { this.audio.stopMusic(); this.game = null; this.closeOverlay(); this.show('setup'); this.setup.renderSetup(); };
      card.querySelector('[data-a=menu]').onclick = () => this.quitToMenu();
    });
  }
}

window.addEventListener('DOMContentLoaded', () => {
  window.__faultline = new Session();
});
