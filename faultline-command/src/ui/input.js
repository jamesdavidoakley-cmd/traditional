// Mouse, keyboard and minimap handling: the classic control scheme.

import { dist } from '../core/util.js';

const EDGE = 26;            // edge-scroll margin in pixels
const EDGE_SPEED = 26;      // tiles per second at full deflection
const KEY_SPEED = 24;

export class Input {
  constructor(session) {
    this.s = session;
    this.canvas = session.canvas;
    this.keys = new Set();
    this.mouse = { x: -999, y: -999, inside: false, down: false, button: 0, moved: false };
    this.dragStart = null;
    this.dragging = false;
    this.panStart = null;
    this.lastClickAt = 0;
    this.lastClickPos = { x: 0, y: 0 };
    this.pendingCommand = null;   // 'attackmove' | 'rally' | 'ability'
    this.edgeScroll = true;
    this.attach();
  }

  attach() {
    const c = this.canvas;
    c.addEventListener('mousedown', (e) => this.onDown(e));
    window.addEventListener('mouseup', (e) => this.onUp(e));
    window.addEventListener('mousemove', (e) => this.onMove(e));
    c.addEventListener('contextmenu', (e) => e.preventDefault());
    c.addEventListener('wheel', (e) => this.onWheel(e), { passive: false });
    c.addEventListener('mouseleave', () => { this.mouse.inside = false; });
    c.addEventListener('mouseenter', () => { this.mouse.inside = true; });
    window.addEventListener('keydown', (e) => this.onKeyDown(e));
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());

    const mm = document.getElementById('minimap');
    let mmDown = false;
    const mmGo = (e, order) => {
      const r = mm.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width * mm.width;
      const py = (e.clientY - r.top) / r.height * mm.height;
      const w = this.s.renderer.minimapToWorld(mm, px, py);
      if (order) this.issueAt(w.x, w.y, e.shiftKey);
      else this.s.renderer.panWorld(w.x, w.y);
    };
    mm.addEventListener('mousedown', (e) => {
      e.preventDefault();
      if (e.button === 2) { mmGo(e, true); return; }
      mmDown = true; mmGo(e, false);
    });
    mm.addEventListener('mousemove', (e) => { if (mmDown) mmGo(e, false); });
    window.addEventListener('mouseup', () => { mmDown = false; });
    mm.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  localPos(e) {
    const r = this.canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  // ------------------------------------------------------------- pointer
  onDown(e) {
    const s = this.s;
    if (s.game.over) return;
    const p = this.localPos(e);
    this.mouse.x = p.x; this.mouse.y = p.y;
    s.audio.resume();

    if (e.button === 2) {
      // Right button cancels any armed mode, otherwise issues a contextual order.
      if (s.placement) { s.cancelPlacement(); return; }
      if (s.abilityArmed) { s.cancelAbility(); return; }
      if (this.pendingCommand) { this.pendingCommand = null; s.hud.hint(''); return; }
      const w = s.renderer.screenToWorld(p.x, p.y);
      this.issueAt(w.x, w.y, e.shiftKey);
      return;
    }
    if (e.button === 1) { this.panStart = { ...p, camX: s.renderer.view.camX, camY: s.renderer.view.camY }; return; }

    const w = s.renderer.screenToWorld(p.x, p.y);
    if (s.placement) { s.tryPlace(w.x, w.y); return; }
    if (s.abilityArmed) { s.fireAbility(w.x, w.y); return; }
    if (this.pendingCommand === 'attackmove') {
      s.game.commandMove(s.selection.filter((u) => u.kind === 'unit'), w.x, w.y, true);
      s.audio.order(); this.pendingCommand = null; s.hud.hint('');
      return;
    }
    if (this.pendingCommand === 'rally') {
      for (const b of s.selection) if (b.kind === 'building' && b.def.produces) b.rally = { x: w.x, y: w.y };
      s.audio.order(); this.pendingCommand = null; s.hud.hint('');
      return;
    }
    this.dragStart = { ...p };
    this.dragging = false;
    this.mouse.down = true;
  }

  onMove(e) {
    const s = this.s;
    const p = this.localPos(e);
    this.mouse.x = p.x; this.mouse.y = p.y;
    this.mouse.moved = true;
    const inCanvas = e.target === this.canvas;
    this.mouse.inside = inCanvas;
    const w = s.renderer.screenToWorld(p.x, p.y);
    s.renderer.mouseWorld = w;

    if (this.panStart) {
      const dx = p.x - this.panStart.x, dy = p.y - this.panStart.y;
      s.renderer.view.camX = this.panStart.camX; s.renderer.view.camY = this.panStart.camY;
      s.renderer.pan(-dx, -dy);
      return;
    }
    if (s.placement) {
      let best = null, bd = 1e9;
      for (const pad of s.placement.pads) {
        const d = dist(pad.cx, pad.cy, w.x, w.y);
        if (d < bd) { bd = d; best = pad; }
      }
      s.placement.hoverPad = bd < 6 ? best : null;
      return;
    }
    if (this.mouse.down && this.dragStart) {
      if (Math.hypot(p.x - this.dragStart.x, p.y - this.dragStart.y) > 5) {
        this.dragging = true;
        s.renderer.selectionBox = { x0: this.dragStart.x, y0: this.dragStart.y, x1: p.x, y1: p.y };
      }
    }
    if (inCanvas && !this.dragging) {
      s.renderer.hover = s.game.entityAt(w.x, w.y);
    }
  }

  onUp(e) {
    const s = this.s;
    if (e.button === 1) { this.panStart = null; return; }
    if (e.button !== 0) return;
    this.mouse.down = false;
    if (!this.dragStart) return;
    const p = this.localPos(e);

    if (this.dragging) {
      this.boxSelect(this.dragStart, p, e.shiftKey);
      s.renderer.selectionBox = null;
      this.dragging = false;
      this.dragStart = null;
      return;
    }
    this.dragStart = null;
    if (e.target !== this.canvas) return;

    const w = s.renderer.screenToWorld(p.x, p.y);
    const now = performance.now();
    const isDouble = now - this.lastClickAt < 320 && Math.hypot(p.x - this.lastClickPos.x, p.y - this.lastClickPos.y) < 8;
    this.lastClickAt = now; this.lastClickPos = { ...p };

    const hit = s.game.entityAt(w.x, w.y);
    if (isDouble && hit && hit.kind === 'unit' && hit.owner === s.game.humanIndex) {
      s.selectSameTypeNear(hit);
      return;
    }
    s.clickSelect(hit, e.shiftKey);
  }

  boxSelect(a, b, additive) {
    const s = this.s;
    const x0 = Math.min(a.x, b.x), x1 = Math.max(a.x, b.x);
    const y0 = Math.min(a.y, b.y), y1 = Math.max(a.y, b.y);
    const picked = [];
    for (const u of s.game.world.units) {
      if (u.dead || u.loaded || u.owner !== s.game.humanIndex) continue;
      const sp = s.renderer.worldToScreen(u.x, u.y);
      if (sp.x >= x0 && sp.x <= x1 && sp.y >= y0 && sp.y <= y1) picked.push(u);
    }
    if (!picked.length) {
      // A box that catches no units of your own may still catch one building.
      for (const bl of s.game.world.buildings) {
        if (bl.dead || bl.owner !== s.game.humanIndex) continue;
        const sp = s.renderer.worldToScreen(bl.x, bl.y);
        if (sp.x >= x0 && sp.x <= x1 && sp.y >= y0 && sp.y <= y1) { picked.push(bl); break; }
      }
    }
    s.setSelection(picked, additive);
  }

  /** Right-click: work out what the player meant from what is under the cursor. */
  issueAt(wx, wy, queue) {
    const s = this.s, g = s.game;
    const units = s.selection.filter((u) => u.kind === 'unit' && u.owner === g.humanIndex);
    if (!units.length) {
      // Right-clicking with a production building selected sets its rally point.
      const blds = s.selection.filter((b) => b.kind === 'building' && b.owner === g.humanIndex && b.def.produces);
      if (blds.length) { for (const b of blds) b.rally = { x: wx, y: wy }; s.audio.order(); }
      return;
    }
    const target = g.entityAt(wx, wy);
    if (target && target.kind === 'neutral' && target.owner !== g.humanIndex && target.disabled <= 0) {
      const engineers = units.filter((u) => u.def.canCapture);
      if (engineers.length) {
        g.commandCapture(engineers, target);
        const rest = units.filter((u) => !u.def.canCapture);
        if (rest.length) g.commandMove(rest, target.x, target.y + 2, true);
        s.audio.order();
        return;
      }
    }
    if (target && target.owner !== undefined && target.owner >= 0 && !g.isAllied(g.humanIndex, target.owner)) {
      g.commandAttack(units, target);
      s.audio.order();
      return;
    }
    if (target && target.kind === 'unit' && target.owner === g.humanIndex && target.def.cargo > 0 && target !== units[0]) {
      const riders = units.filter((u) => u.def.class === 'infantry' && u !== target);
      if (riders.length) { g.commandLoad(riders, target); s.audio.order(); return; }
    }
    if (target && target.kind === 'building' && target.owner === g.humanIndex && target.hp < target.hpMax) {
      const eng = units.filter((u) => u.def.repairsStructures);
      if (eng.length) { g.commandRepair(eng, target); s.audio.order(); return; }
    }
    const loaded = units.filter((u) => u.cargo && u.cargo.length);
    if (loaded.length === units.length && loaded.length) {
      g.commandUnload(loaded, wx, wy);
      s.audio.order();
      return;
    }
    g.commandMove(units, wx, wy, false);
    s.audio.order();
    s.pingOrder(wx, wy);
  }

  onWheel(e) {
    e.preventDefault();
    const p = this.localPos(e);
    this.s.renderer.zoomBy(e.deltaY > 0 ? 0.9 : 1.111, p.x, p.y);
  }

  // ------------------------------------------------------------ keyboard
  onKeyDown(e) {
    const s = this.s;
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT')) return;
    this.keys.add(e.code);

    if (e.code === 'Escape') {
      if (s.placement) { s.cancelPlacement(); return; }
      if (s.abilityArmed) { s.cancelAbility(); return; }
      if (this.pendingCommand) { this.pendingCommand = null; s.hud.hint(''); return; }
      s.toggleMenu();
      e.preventDefault();
      return;
    }
    if (s.game.over) return;

    if (e.ctrlKey || e.metaKey) {
      const n = this.digit(e.code);
      if (n !== null) { s.assignGroup(n); e.preventDefault(); }
      return;
    }
    const n = this.digit(e.code);
    if (n !== null) { s.recallGroup(n, e.shiftKey); return; }

    switch (e.code) {
      case 'KeyA':
        if (s.selection.some((u) => u.kind === 'unit')) {
          this.pendingCommand = 'attackmove';
          s.hud.hint('ATTACK-MOVE — click a destination (right-click or Esc to cancel)');
        }
        break;
      case 'KeyS': if (!this.movementKey('KeyS')) s.selectionAction('stop'); break;
      case 'KeyG': s.selectionAction('guard'); break;
      case 'KeyU': s.selectionAction('unload'); break;
      case 'KeyH': s.renderer.centreOnPlayer(); break;
      case 'KeyE': s.selectIdleEngineer(); break;
      case 'KeyR':
        if (s.selection.some((b) => b.kind === 'building' && b.def.produces)) {
          this.pendingCommand = 'rally';
          s.hud.hint('SET RALLY POINT — click a destination');
        }
        break;
      case 'KeyT': s.renderer.showRanges = !s.renderer.showRanges; break;
      case 'Tab': s.cycleTab(e.shiftKey ? -1 : 1); e.preventDefault(); break;
      case 'Space': s.togglePause(); e.preventDefault(); break;
      case 'KeyP': s.togglePause(); break;
      case 'Backquote': s.selectAllArmy(); break;
      case 'BracketLeft': s.setSpeed(s.game.speed - 0.5); break;
      case 'BracketRight': s.setSpeed(s.game.speed + 0.5); break;
      case 'F2': s.hud.setTab('build'); e.preventDefault(); break;
      case 'F3': s.hud.setTab('infantry'); e.preventDefault(); break;
      case 'F4': s.hud.setTab('vehicle'); e.preventDefault(); break;
    }
  }

  movementKey(code) {
    // S is 'stop' unless it is being used to scroll the camera.
    return false;
  }

  digit(code) {
    if (code.startsWith('Digit')) return +code.slice(5);
    if (code.startsWith('Numpad') && /^\d$/.test(code.slice(6))) return +code.slice(6);
    return null;
  }

  // --------------------------------------------------------------- update
  update(dt) {
    const s = this.s, r = s.renderer;
    let dx = 0, dy = 0;
    const k = this.keys;
    if (k.has('KeyW') || k.has('ArrowUp')) dy -= 1;
    if (k.has('KeyS') || k.has('ArrowDown')) dy += 1;
    if (k.has('KeyA') || k.has('ArrowLeft')) dx -= 1;
    if (k.has('KeyD') || k.has('ArrowRight')) dx += 1;

    if (this.edgeScroll && this.mouse.inside && this.mouse.moved && !this.panStart) {
      const { x, y } = this.mouse;
      if (x < EDGE) dx -= (EDGE - x) / EDGE;
      else if (x > r.cssW - EDGE) dx += (x - (r.cssW - EDGE)) / EDGE;
      if (y < EDGE) dy -= (EDGE - y) / EDGE;
      else if (y > r.cssH - EDGE) dy += (y - (r.cssH - EDGE)) / EDGE;
    }
    if (dx || dy) {
      const len = Math.hypot(dx, dy) || 1;
      const speed = (k.has('ShiftLeft') || k.has('ShiftRight') ? 1.9 : 1) * (this.mouse.inside ? EDGE_SPEED : KEY_SPEED) / r.view.zoom;
      const sx = (dx / len) * speed * dt, sy = (dy / len) * speed * dt;
      // Screen-space movement converted into world tiles.
      const a = sx * 2 / r.view.tw * r.view.zoom * 32, b = sy * 2 / r.view.th * r.view.zoom * 16;
      r.view.camX += (a + b) * 0.5;
      r.view.camY += (b - a) * 0.5;
      r.clampCamera();
    }
  }
}
