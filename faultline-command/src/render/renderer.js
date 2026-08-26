// The isometric renderer: terrain tiles, depth-sorted props and entities,
// projectiles, particles, fog of war and the minimap.

import { clamp, dist, lerp, TAU, mixHex, shadeHex } from '../core/util.js';
import { T, TERRAIN } from '../core/terrain.js';
import { makeView, syncView, sx, sy, screenToWorld, tileDiamond, isoQuad, isoEllipse, isoLine, isoBox, BASE_TW, BASE_TH } from './iso.js';
import { drawUnit, drawBuilding, drawNeutral, buildingHeight, pal } from './sprites.js';
import { makeRng } from '../core/util.js';

// Zooming out is nearly free — the terrain is cached per chunk — so the outer
// limit is generous. Zooming in past ~1.75 rebuilds the tile atlas at a size
// that costs a third of the frame rate, so the inner limit stays where it is.
const MIN_ZOOM = 0.45, MAX_ZOOM = 1.75;
const CHUNK = 8;   // tiles per cached terrain chunk
const TILE_VARIANTS = 6;

export class Renderer {
  constructor(canvas, game) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.game = game;
    this.view = makeView(canvas.width, canvas.height);
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.tileSprites = null;
    this.spriteZoom = -1;
    this.props = [];
    this.drawList = [];
    this.showRanges = false;
    this.placement = null;      // {key, def, pads}
    this.abilityTarget = null;  // {key, radius}
    this.selectionBox = null;
    this.hover = null;
    this.time = 0;
    this.frames = 0;
    this.fps = 60;
    this._fpsAcc = 0;
    this.quality = 1;

    this.chunkCols = Math.ceil(game.world.width / CHUNK);
    this.chunkRows = Math.ceil(game.world.height / CHUNK);
    this.chunkExplored = new Uint8Array(this.chunkCols * this.chunkRows);

    this.fogCanvas = document.createElement('canvas');
    this.fogCanvas.width = game.world.width;
    this.fogCanvas.height = game.world.height;
    this.fogCtx = this.fogCanvas.getContext('2d', { willReadFrequently: true });
    this.fogImage = this.fogCtx.createImageData(game.world.width, game.world.height);
    this.fogTimer = 0;

    this.chunks = new Map();
    this.chunkOrder = [];
    this.propSprites = new Map();
    this.buildProps();
    this.resize();
    this.centreOnPlayer();
  }

  // ------------------------------------------------------------------ setup
  resize() {
    const rect = this.canvas.getBoundingClientRect();
    const w = Math.max(320, Math.round(rect.width)), h = Math.max(240, Math.round(rect.height));
    this.canvas.width = Math.round(w * this.dpr);
    this.canvas.height = Math.round(h * this.dpr);
    this.cssW = w; this.cssH = h;
    this.view.w = w; this.view.h = h;
    syncView(this.view);
  }

  centreOnPlayer() {
    const p = this.game.players[this.game.humanIndex];
    const hq = p && p.hq ? p.hq : { x: 64, y: 64 };
    this.view.camX = hq.x; this.view.camY = hq.y;
    syncView(this.view);
  }

  /** Trees, rocks, houses and pipelines: static scenery, depth-sorted with units. */
  buildProps() {
    const w = this.game.world, map = this.game.mapData;
    const rng = makeRng(0xbeef01);
    const props = [];
    for (let y = 0; y < w.height; y++) {
      for (let x = 0; x < w.width; x++) {
        const t = w.tiles[y * w.width + x];
        if (t === T.WOOD) {
          if (rng() < 0.85) props.push({ type: 'tree', x: x + 0.15 + rng() * 0.7, y: y + 0.15 + rng() * 0.7, s: 0.8 + rng() * 0.5, v: rng() });
        } else if (t === T.ROCK) {
          if (rng() < 0.7) props.push({ type: 'rock', x: x + 0.2 + rng() * 0.6, y: y + 0.2 + rng() * 0.6, s: 0.7 + rng() * 0.7, v: rng() });
        } else if (t === T.URBAN) {
          if (rng() < 0.30) props.push({ type: 'house', x: x + 0.5, y: y + 0.5, s: 0.8 + rng() * 0.5, v: rng() });
        } else if (t === T.FARM) {
          if (rng() < 0.035) props.push({ type: 'haystack', x: x + 0.5, y: y + 0.5, s: 0.8 + rng() * 0.4, v: rng() });
        }
      }
    }
    for (const d of map.decor) {
      if (d.type === 'house') props.push({ type: 'house', x: d.x, y: d.y, s: 1.15, v: 0.4, big: true });
      else if (d.type === 'farm') props.push({ type: 'barn', x: d.x, y: d.y, s: 1.4, v: 0.2 });
      else if (d.type === 'pipe') props.push({ type: 'pipe', x: d.x, y: d.y, s: 1, v: 0.5, rot: d.rot || 0 });
      else if (d.type === 'refinery') props.push({ type: 'stack', x: d.x, y: d.y, s: 1.2, v: 0.6 });
    }
    props.sort((a, b) => (a.x + a.y) - (b.x + b.y));
    this.props = props;
  }

  /** Tile artwork, regenerated whenever the zoom changes materially. */
  buildTileSprites() {
    const z = this.view.zoom;
    const tw = Math.ceil(BASE_TW * z) + 2, th = Math.ceil(BASE_TH * z) + 2;
    const sprites = {};
    const rng = makeRng(0x1234);
    for (const key of Object.keys(TERRAIN)) {
      const t = +key;
      const def = TERRAIN[t];
      sprites[t] = [];
      // Six variants rather than three, and the spread between them pulled in:
      // ground should vary, not alternate. Drawn at full tile size, because a
      // diamond inset by two pixels leaves the background showing through as a
      // grid and that is what made the whole map read as a board game.
      for (let v = 0; v < TILE_VARIANTS; v++) {
        const c = document.createElement('canvas');
        c.width = tw; c.height = th;
        const g = c.getContext('2d');
        const cx = tw / 2, cy = th / 2;
        const mix = (v / (TILE_VARIANTS - 1)) * 0.34;
        const base = shadeHex(mixHex(def.colour, def.alt, mix), (rng() - 0.5) * 0.07);
        tileDiamond(g, cx, cy, tw + 1, th + 1);
        g.fillStyle = base;
        g.fill();
        this.textureTile(g, t, cx, cy, tw, th, v, rng);
        this.grainTile(g, t, cx, cy, tw, th, rng);
        sprites[t].push(c);
      }
    }
    this.tileSprites = sprites;
    this.spriteZoom = z;
    this.spriteW = tw; this.spriteH = th;
    this.chunks.clear();
    this.chunkOrder.length = 0;
    this.propSprites.clear();
  }

  /**
   * Terrain is baked into 8x8-tile canvases at the current zoom. A full screen is
   * then a few dozen blits instead of several thousand.
   */
  chunkFor(cx, cy) {
    const key = cx * 1024 + cy;
    const hit = this.chunks.get(key);
    if (hit) return hit;

    const v = this.view, w = this.game.world;
    const CS = CHUNK;
    const x0 = cx * CS, y0 = cy * CS;
    const halfW = v.tw * 0.5, halfH = v.th * 0.5;
    const sw = this.spriteW, sh = this.spriteH;
    let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
    for (let dy = 0; dy < CS; dy++) {
      for (let dx = 0; dx < CS; dx++) {
        const lx = ((x0 + dx) - (y0 + dy)) * halfW;
        const ly = ((x0 + dx) + (y0 + dy) + 1) * halfH;
        if (lx - sw * 0.5 < minX) minX = lx - sw * 0.5;
        if (lx + sw * 0.5 > maxX) maxX = lx + sw * 0.5;
        if (ly - sh * 0.5 < minY) minY = ly - sh * 0.5;
        if (ly + sh * 0.5 > maxY) maxY = ly + sh * 0.5;
      }
    }
    const cw = Math.ceil(maxX - minX), ch = Math.ceil(maxY - minY);
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, cw); canvas.height = Math.max(1, ch);
    const g = canvas.getContext('2d');
    for (let dy = 0; dy < CS; dy++) {
      const ty = y0 + dy;
      if (ty >= w.height) continue;
      for (let dx = 0; dx < CS; dx++) {
        const tx = x0 + dx;
        if (tx >= w.width) continue;
        const i = ty * w.width + tx;
        const t = w.bridge[i] ? T.CONCRETE : w.tiles[i];
        // Hashed, not linear: a linear index lays down visible diagonal banding.
        let hsh = (tx * 73856093) ^ (ty * 19349663);
        hsh = (hsh ^ (hsh >>> 13)) >>> 0;
        const variant = hsh % TILE_VARIANTS;
        const lx = (tx - ty) * halfW, ly = (tx + ty + 1) * halfH;
        g.drawImage(this.tileSprites[t][variant], lx - minX - sw * 0.5, ly - minY - sh * 0.5);
      }
    }
    const entry = { canvas, offX: minX, offY: minY, key };
    this.chunks.set(key, entry);
    this.chunkOrder.push(key);
    while (this.chunkOrder.length > 190) {
      const old = this.chunkOrder.shift();
      this.chunks.delete(old);
    }
    return entry;
  }

  /** Fine grain so ground reads as a surface rather than a flat fill. */
  grainTile(g, t, cx, cy, tw, th, rng) {
    if (t === T.WATER || t === T.SHALLOW) return;
    g.save();
    tileDiamond(g, cx, cy, tw + 1, th + 1);
    g.clip();
    const n = Math.max(8, Math.round(tw * th / 90));
    for (let i = 0; i < n; i++) {
      const a = rng() * Math.PI * 2, r = Math.sqrt(rng());
      const px = cx + Math.cos(a) * r * tw * 0.46;
      const py = cy + Math.sin(a) * r * th * 0.46;
      const dark = rng() < 0.5;
      g.fillStyle = dark ? 'rgba(0,0,0,0.10)' : 'rgba(255,252,240,0.075)';
      const sz = Math.max(1, tw * 0.022 * (0.6 + rng()));
      g.fillRect(px, py, sz, Math.max(1, sz * 0.5));
    }
    g.restore();
  }

  textureTile(g, t, cx, cy, tw, th, v, rng) {
    g.save();
    tileDiamond(g, cx, cy, tw + 1, th + 1);
    g.clip();
    const scale = tw / BASE_TW;
    if (t === T.GRASS || t === T.FARM) {
      g.strokeStyle = t === T.FARM ? 'rgba(60,60,25,0.28)' : 'rgba(35,50,25,0.20)';
      g.lineWidth = Math.max(0.6, scale);
      for (let i = -3; i <= 3; i++) {
        g.beginPath();
        g.moveTo(cx + i * 8 * scale - tw * 0.5, cy - th * 0.5);
        g.lineTo(cx + i * 8 * scale + tw * 0.5, cy + th * 0.5);
        g.stroke();
      }
    } else if (t === T.ROAD || t === T.CONCRETE) {
      // Expansion joints run along the slab edges. A fixed highlight over the top
      // half of every tile just repeats into diagonal stripes.
      g.strokeStyle = 'rgba(0,0,0,0.13)';
      g.lineWidth = Math.max(0.5, scale * 0.7);
      g.beginPath();
      g.moveTo(cx - tw * 0.5, cy); g.lineTo(cx, cy - th * 0.5);
      g.moveTo(cx, cy + th * 0.5); g.lineTo(cx + tw * 0.5, cy);
      g.stroke();
    } else if (t === T.WATER || t === T.SHALLOW) {
      g.strokeStyle = t === T.WATER ? 'rgba(140,190,235,0.16)' : 'rgba(180,225,245,0.24)';
      g.lineWidth = Math.max(0.6, scale);
      for (let i = 0; i < 3; i++) {
        const yy = cy + (i - 1) * th * 0.26 + (v - 1) * 2;
        g.beginPath();
        g.moveTo(cx - tw * 0.34, yy);
        g.quadraticCurveTo(cx, yy - 3 * scale, cx + tw * 0.34, yy);
        g.stroke();
      }
    } else if (t === T.SAND || t === T.DUNE) {
      g.strokeStyle = 'rgba(255,240,200,0.18)';
      g.lineWidth = Math.max(0.6, scale);
      for (let i = 0; i < 2; i++) {
        const yy = cy + (i - 0.5) * th * 0.4;
        g.beginPath();
        g.moveTo(cx - tw * 0.4, yy);
        g.quadraticCurveTo(cx, yy - 4 * scale, cx + tw * 0.4, yy);
        g.stroke();
      }
    } else if (t === T.TRENCH) {
      g.fillStyle = 'rgba(20,18,12,0.5)';
      g.fillRect(cx - tw * 0.34, cy - th * 0.14, tw * 0.68, th * 0.28);
      g.fillStyle = 'rgba(120,110,80,0.35)';
      g.fillRect(cx - tw * 0.36, cy - th * 0.22, tw * 0.72, th * 0.09);
    } else if (t === T.RUBBLE || t === T.URBAN) {
      g.fillStyle = 'rgba(0,0,0,0.16)';
      for (let i = 0; i < 5; i++) {
        g.fillRect(cx - tw * 0.3 + ((i * 37) % 40) * scale * 0.6, cy - th * 0.2 + ((i * 23) % 18) * scale * 0.5, 5 * scale, 3 * scale);
      }
    } else if (t === T.WOOD) {
      g.fillStyle = 'rgba(20,32,16,0.35)';
      g.beginPath(); g.ellipse(cx, cy, tw * 0.34, th * 0.34, 0, 0, TAU); g.fill();
    }
    g.restore();
    g.strokeStyle = 'rgba(0,0,0,0.10)';
    g.lineWidth = 1;
    tileDiamond(g, cx, cy, tw - 2, th - 2);
    g.stroke();
  }

  // ----------------------------------------------------------------- camera
  pan(dx, dy) {
    const v = this.view;
    // Convert a screen-space drag into world tiles.
    const a = dx * 2 / v.tw, b = dy * 2 / v.th;
    v.camX += (a + b) * 0.5;
    v.camY += (b - a) * 0.5;
    this.clampCamera();
  }

  panWorld(x, y) { this.view.camX = x; this.view.camY = y; this.clampCamera(); }

  clampCamera() {
    const v = this.view, w = this.game.world;
    v.camX = clamp(v.camX, 2, w.width - 2);
    v.camY = clamp(v.camY, 2, w.height - 2);
    syncView(v);
  }

  zoomBy(f, anchorX, anchorY) {
    const v = this.view;
    // No anchor (keyboard zoom) means zoom about the middle of the view.
    if (anchorX === undefined || anchorY === undefined) { anchorX = v.w * 0.5; anchorY = v.h * 0.5; }
    const before = screenToWorld(v, anchorX, anchorY);
    v.zoom = clamp(v.zoom * f, MIN_ZOOM, MAX_ZOOM);
    syncView(v);
    const after = screenToWorld(v, anchorX, anchorY);
    v.camX += before.x - after.x;
    v.camY += before.y - after.y;
    this.clampCamera();
  }

  screenToWorld(px, py) { return screenToWorld(this.view, px, py); }
  worldToScreen(wx, wy, wz) { return { x: sx(this.view, wx, wy), y: sy(this.view, wx, wy, wz || 0) }; }

  // ----------------------------------------------------------------- render
  render(dt) {
    this.time += dt;
    this._fpsAcc += dt; this.frames++;
    if (this._fpsAcc >= 0.5) { this.fps = this.frames / this._fpsAcc; this.frames = 0; this._fpsAcc = 0; }

    const ctx = this.ctx, v = this.view, g = this.game;
    syncView(v);
    if (!this.tileSprites || Math.abs(this.spriteZoom - v.zoom) > 0.015) this.buildTileSprites();

    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.fillStyle = '#0b0f14';
    ctx.fillRect(0, 0, v.w, v.h);

    // Screen shake from nearby heavy impacts.
    const shake = g.fx.shake;
    if (shake > 0.01) {
      const s = shake * 3.5;
      ctx.translate((Math.random() - 0.5) * s, (Math.random() - 0.5) * s);
    }

    this.drawTerrain();
    this.drawDecals();
    this.buildDrawList();
    this.drawSorted();
    this.drawProjectiles();
    this.drawParticles();
    this.drawFog(dt);
    this.drawOverlays();
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }

  visibleTileBounds() {
    const v = this.view;
    const pad = 3;
    const corners = [
      screenToWorld(v, 0, 0), screenToWorld(v, v.w, 0),
      screenToWorld(v, 0, v.h), screenToWorld(v, v.w, v.h),
    ];
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    for (const c of corners) {
      x0 = Math.min(x0, c.x); x1 = Math.max(x1, c.x);
      y0 = Math.min(y0, c.y); y1 = Math.max(y1, c.y);
    }
    return {
      x0: Math.max(0, Math.floor(x0) - pad), x1: Math.min(this.game.world.width - 1, Math.ceil(x1) + pad),
      y0: Math.max(0, Math.floor(y0) - pad), y1: Math.min(this.game.world.height - 1, Math.ceil(y1) + pad),
    };
  }

  drawTerrain() {
    const ctx = this.ctx, v = this.view, w = this.game.world;
    const b = this.visibleTileBounds();
    this.bounds = b;
    const cx0 = Math.floor(b.x0 / CHUNK), cx1 = Math.floor(b.x1 / CHUNK);
    const cy0 = Math.floor(b.y0 / CHUNK), cy1 = Math.floor(b.y1 / CHUNK);
    let count = 0;
    for (let cy = cy0; cy <= cy1; cy++) {
      for (let cx = cx0; cx <= cx1; cx++) {
        if (cx < 0 || cy < 0 || cx * CHUNK >= w.width || cy * CHUNK >= w.height) continue;
        // Ground nobody has ever seen is covered by opaque fog anyway.
        if (this.chunkExplored && !this.chunkExplored[cy * this.chunkCols + cx]) continue;
        const c = this.chunkFor(cx, cy);
        const dx = c.offX - v.ox, dy = c.offY - v.oy;
        if (dx > v.w || dy > v.h || dx + c.canvas.width < 0 || dy + c.canvas.height < 0) continue;
        ctx.drawImage(c.canvas, dx, dy);
        count++;
      }
    }
    this.tilesDrawn = count;
  }

  drawDecals() {
    const ctx = this.ctx, v = this.view, w = this.game.world;
    for (const s of w.scorch) {
      const X = sx(v, s.x, s.y), Y = sy(v, s.x, s.y);
      if (X < -60 || X > v.w + 60 || Y < -40 || Y > v.h + 40) continue;
      ctx.save();
      ctx.globalAlpha = 0.34;
      ctx.fillStyle = '#221c15';
      ctx.beginPath();
      ctx.ellipse(X, Y, s.r * v.tw * 0.5, s.r * v.th * 0.5, 0, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
  }

  /** Everything that needs correct back-to-front ordering. */
  buildDrawList() {
    const list = this.drawList;
    list.length = 0;
    const g = this.game, v = this.view, b = this.bounds;
    const me = g.humanIndex;
    const inView = (x, y) => x >= b.x0 - 2 && x <= b.x1 + 2 && y >= b.y0 - 2 && y <= b.y1 + 2;

    for (const p of this.props) {
      if (!inView(p.x, p.y)) continue;
      if (me >= 0 && !g.fog.isExplored(me, p.x, p.y)) continue;
      list.push({ d: p.x + p.y, kind: 'prop', e: p });
    }
    for (const wk of g.world.wrecks) {
      if (!inView(wk.x, wk.y)) continue;
      list.push({ d: wk.x + wk.y, kind: 'wreck', e: wk });
    }
    for (const n of g.world.neutrals) {
      if (!inView(n.x, n.y)) continue;
      if (me >= 0 && !g.fog.isExplored(me, n.x, n.y)) continue;
      list.push({ d: n.x + n.y + 0.2, kind: 'neutral', e: n });
    }
    for (const bl of g.world.buildings) {
      if (bl.dead || !inView(bl.x, bl.y)) continue;
      if (me >= 0 && !g.fog.isExplored(me, bl.x, bl.y)) continue;
      list.push({ d: bl.x + bl.y + bl.size * 0.35, kind: 'building', e: bl });
    }
    for (const u of g.world.units) {
      if (u.dead || u.loaded || !inView(u.x, u.y)) continue;
      if (me >= 0 && u.owner !== me && !g.isAllied(me, u.owner) && !g.fog.isVisible(me, u.x, u.y)) continue;
      list.push({ d: u.x + u.y + 0.05, kind: 'unit', e: u });
    }
    list.sort((a, c) => a.d - c.d);
  }

  drawSorted() {
    const ctx = this.ctx, v = this.view, g = this.game;
    for (const item of this.drawList) {
      switch (item.kind) {
        case 'prop': this.drawProp(item.e); break;
        case 'wreck': this.drawWreck(item.e); break;
        case 'neutral': {
          const n = item.e;
          drawNeutral(ctx, v, n, n.owner >= 0 ? g.players[n.owner].colour : null, this.time);
          this.neutralOverlay(n);
          break;
        }
        case 'building': {
          const b = item.e;
          const p = g.players[b.owner];
          drawBuilding(ctx, v, b, p.colour, this.time, p.factionDef.architecture);
          this.buildingOverlay(b);
          break;
        }
        case 'unit': {
          const u = item.e;
          const p = g.players[u.owner];
          if (u.selected) this.selectionRing(u);
          drawUnit(ctx, v, u, p.colour, this.time);
          this.unitOverlay(u);
          break;
        }
      }
    }
  }

  /** Scenery is baked once per zoom level; drawing it is then a single blit. */
  propSprite(type, v, s) {
    const bucket = Math.round(s * 4) / 4;
    const key = type + '|' + v + '|' + bucket;
    const hit = this.propSprites.get(key);
    if (hit) return hit;
    const z = this.view.zoom;
    let W, H, ax, ay;
    if (type === 'tree') { W = 26 * bucket * z; H = 30 * bucket * z; ax = W / 2; ay = H - 4 * z; }
    else if (type === 'rock') { W = 26 * bucket * z; H = 18 * bucket * z; ay = H - 3 * z; ax = W / 2; }
    else if (type === 'haystack') { W = 20 * bucket * z; H = 16 * bucket * z; ax = W / 2; ay = H - 2 * z; }
    else { W = 62 * bucket * z; H = 58 * bucket * z; ax = W / 2; ay = H - 10 * z; }
    W = Math.max(4, Math.ceil(W)); H = Math.max(4, Math.ceil(H));
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const g = c.getContext('2d');
    const X = ax, Y = ay;
    if (type === 'tree') {
      g.fillStyle = 'rgba(0,0,0,0.24)';
      g.beginPath(); g.ellipse(X, Y, 7 * bucket * z, 3.6 * bucket * z, 0, 0, TAU); g.fill();
      g.fillStyle = '#3f3226';
      g.fillRect(X - 1.4 * z, Y - 9 * bucket * z, 2.8 * z, 9 * bucket * z);
      g.fillStyle = v < 0.5 ? '#2f4a28' : '#3a5730';
      g.beginPath(); g.ellipse(X, Y - 14 * bucket * z, 8 * bucket * z, 9 * bucket * z, 0, 0, TAU); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.10)';
      g.beginPath(); g.ellipse(X - 2.4 * bucket * z, Y - 16.5 * bucket * z, 4 * bucket * z, 4.2 * bucket * z, 0, 0, TAU); g.fill();
    } else if (type === 'rock') {
      g.fillStyle = 'rgba(0,0,0,0.22)';
      g.beginPath(); g.ellipse(X, Y, 9 * bucket * z, 4 * bucket * z, 0, 0, TAU); g.fill();
      g.fillStyle = '#6d6558';
      g.beginPath();
      g.moveTo(X - 10 * bucket * z, Y + 1 * z); g.lineTo(X - 4 * bucket * z, Y - 10 * bucket * z);
      g.lineTo(X + 5 * bucket * z, Y - 8 * bucket * z); g.lineTo(X + 10 * bucket * z, Y + 1 * z);
      g.closePath(); g.fill();
      g.fillStyle = '#877e6e';
      g.beginPath();
      g.moveTo(X - 4 * bucket * z, Y - 10 * bucket * z); g.lineTo(X + 5 * bucket * z, Y - 8 * bucket * z);
      g.lineTo(X + 1 * bucket * z, Y - 3 * bucket * z); g.closePath(); g.fill();
    } else if (type === 'haystack') {
      g.fillStyle = 'rgba(0,0,0,0.2)';
      g.beginPath(); g.ellipse(X, Y, 7 * bucket * z, 3 * bucket * z, 0, 0, TAU); g.fill();
      g.fillStyle = '#c6b062';
      g.beginPath(); g.ellipse(X, Y - 5 * bucket * z, 7 * bucket * z, 6 * bucket * z, 0, 0, TAU); g.fill();
    } else {
      // house or barn: a small iso block drawn through a temporary local view
      const lv = { tw: this.view.tw, th: this.view.th, ox: -X, oy: -Y, zoom: z, w: W, h: H };
      const wall = v < 0.33 ? '#b3a894' : (v < 0.66 ? '#a89a86' : '#c0b49e');
      const roof = type === 'barn' ? '#7d4a33' : (v < 0.5 ? '#6d4f43' : '#5b5a58');
      const cols = { top: roof, side: wall, dark: shadeHex(wall, -0.3), line: 'rgba(0,0,0,0.3)' };
      isoEllipse(g, lv, 0, 0, 1.0 * bucket, 1.0 * bucket, 'rgba(0,0,0,0.22)');
      isoBox(g, lv, 0, 0, 0.42 * bucket, 0.34 * bucket, 0.5 * bucket, 0, cols);
      isoQuad(g, lv, 0, 0, 0.5 * bucket, 0.42 * bucket, 0, roof, 0.5 * bucket);
      isoBox(g, lv, 0, 0, 0.16 * bucket, 0.16 * bucket, 0.22 * bucket, 0,
        { top: shadeHex(roof, -0.2), side: shadeHex(roof, -0.1), dark: shadeHex(roof, -0.4), line: null }, 0.5 * bucket);
    }
    const entry = { canvas: c, ax, ay };
    this.propSprites.set(key, entry);
    return entry;
  }

  drawProp(p) {
    const ctx = this.ctx, v = this.view;
    const X = sx(v, p.x, p.y), Y = sy(v, p.x, p.y);
    if (p.type === 'pipe') {
      isoQuad(ctx, v, p.x, p.y, 1.4, 0.14, p.rot || 0, '#8b8272', 0.12);
      isoQuad(ctx, v, p.x, p.y, 1.4, 0.06, p.rot || 0, '#a49a88', 0.2);
      isoBox(ctx, v, p.x, p.y, 0.12, 0.12, 0.14, 0, { top: '#7d7466', side: '#69614f', dark: '#4d4739', line: null });
      return;
    }
    if (p.type === 'stack') {
      isoEllipse(ctx, v, p.x, p.y, 0.9, 0.9, 'rgba(0,0,0,0.2)');
      isoBox(ctx, v, p.x, p.y, 0.3, 0.3, 1.8, 0, { top: '#b3a893', side: '#948a76', dark: '#6b6355', line: 'rgba(0,0,0,0.3)' });
      isoBox(ctx, v, p.x + 1.1, p.y + 0.6, 0.55, 0.55, 0.7, 0, { top: '#a89e8a', side: '#8b8270', dark: '#655d4f', line: 'rgba(0,0,0,0.3)' });
      return;
    }
    const sp = this.propSprite(p.type, p.v, p.s);
    ctx.drawImage(sp.canvas, X - sp.ax, Y - sp.ay);
  }

  drawWreck(w) {
    const ctx = this.ctx, v = this.view;
    const fade = clamp(1 - w.age / 90, 0.25, 1);
    ctx.save();
    ctx.globalAlpha = fade * 0.85;
    isoEllipse(ctx, v, w.x, w.y, 0.6, 0.6, 'rgba(20,16,12,0.5)');
    const cols = { top: '#4a443c', side: '#3b362f', dark: '#282520', line: 'rgba(0,0,0,0.4)' };
    isoBox(ctx, v, w.x, w.y, (w.art.len || 0.9) * 0.7, (w.art.wid || 0.55) * 0.7, 0.14, w.facing, cols);
    ctx.restore();
  }

  // ---------------------------------------------------------- entity chrome
  selectionRing(u) {
    const ctx = this.ctx, v = this.view;
    const r = (u.def.class === 'naval' ? 1.3 : (u.def.class === 'infantry' ? 0.55 : 0.75));
    ctx.strokeStyle = 'rgba(140,255,170,0.9)';
    ctx.lineWidth = Math.max(1.2, 1.6 * v.zoom);
    const X = sx(v, u.x, u.y), Y = sy(v, u.x, u.y);
    ctx.beginPath();
    ctx.ellipse(X, Y, r * v.tw * 0.5, r * v.th * 0.5, 0, 0, TAU);
    ctx.stroke();
  }

  bar(X, Y, w, h, frac, colour, back) {
    const ctx = this.ctx;
    ctx.fillStyle = back || 'rgba(0,0,0,0.6)';
    ctx.fillRect(X - w / 2, Y, w, h);
    ctx.fillStyle = colour;
    ctx.fillRect(X - w / 2 + 1, Y + 1, Math.max(0, (w - 2) * frac), h - 2);
  }

  unitOverlay(u) {
    const ctx = this.ctx, v = this.view, g = this.game;
    const me = g.humanIndex;
    const hurt = u.hp < u.hpMax * 0.995;
    const show = u.selected || (hurt && (u.owner === me || v.zoom > 1.0)) || this.hover === u;
    if (!show) return;
    const X = sx(v, u.x, u.y);
    const top = sy(v, u.x, u.y) - (u.def.class === 'infantry' ? 17 : 15) * v.zoom;
    const w = Math.max(16, 22 * v.zoom);
    const frac = clamp(u.hp / u.hpMax, 0, 1);
    const col = frac > 0.6 ? '#5ed17a' : frac > 0.3 ? '#e0c33a' : '#e0533a';
    this.bar(X, top, w, Math.max(3, 4 * v.zoom), frac, col);
    if (u.selected && u.ammoMax > 0) {
      this.bar(X, top + Math.max(3, 4 * v.zoom) + 1, w, Math.max(2, 3 * v.zoom), clamp(u.ammo / u.ammoMax, 0, 1), '#7fb4ff');
    }
    if (u.selected && (u.mobility < 0.99 || u.weaponHealth < 0.99)) {
      ctx.fillStyle = '#ffb347';
      ctx.font = (8 * v.zoom).toFixed(0) + 'px system-ui';
      ctx.textAlign = 'center';
      let s = '';
      if (u.mobility < 0.99) s += 'M';
      if (u.weaponHealth < 0.99) s += 'W';
      ctx.fillText(s, X + w * 0.72, top + 4 * v.zoom);
    }
  }

  buildingOverlay(b) {
    const ctx = this.ctx, v = this.view, g = this.game;
    const me = g.humanIndex;
    const X = sx(v, b.x, b.y);
    const top = sy(v, b.x, b.y) - (buildingHeight(b.key) + 0.55) * v.th;
    if (b.state !== 'active') {
      const w = Math.max(24, 34 * v.zoom);
      this.bar(X, top, w, Math.max(4, 5 * v.zoom), b.progress, '#ffd257');
      ctx.fillStyle = '#ffe9a8';
      ctx.font = (9 * v.zoom).toFixed(0) + 'px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText(Math.round(b.progress * 100) + '%', X, top - 3 * v.zoom);
      return;
    }
    if (b.hp < b.hpMax * 0.995 || b.selected || this.hover === b) {
      const w = Math.max(24, 32 * v.zoom);
      const frac = clamp(b.hp / b.hpMax, 0, 1);
      this.bar(X, top, w, Math.max(4, 5 * v.zoom), frac, frac > 0.6 ? '#5ed17a' : frac > 0.3 ? '#e0c33a' : '#e0533a');
    }
    if (b.owner === me && b.def.needsPower && !b.online) {
      ctx.fillStyle = '#ff6b5a';
      ctx.font = 'bold ' + (10 * v.zoom).toFixed(0) + 'px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText('⚡', X, top - 4 * v.zoom);
    }
    if (b.selected) this.selectionSquare(b);
  }

  selectionSquare(b) {
    const ctx = this.ctx, v = this.view;
    ctx.strokeStyle = 'rgba(140,255,170,0.9)';
    ctx.lineWidth = Math.max(1.2, 1.6 * v.zoom);
    const h = b.size * 0.5;
    ctx.beginPath();
    const pts = [[h, h], [h, -h], [-h, -h], [-h, h]];
    pts.forEach(([lx, ly], i) => {
      const X = sx(v, b.x + lx, b.y + ly), Y = sy(v, b.x + lx, b.y + ly);
      if (i === 0) ctx.moveTo(X, Y); else ctx.lineTo(X, Y);
    });
    ctx.closePath();
    ctx.stroke();
  }

  neutralOverlay(n) {
    const ctx = this.ctx, v = this.view, g = this.game;
    const X = sx(v, n.x, n.y), top = sy(v, n.x, n.y) - (n.type === 'derrick' ? 2.1 : 2.4) * v.th;
    if (n.disabled > 0) {
      ctx.fillStyle = '#ff8a5a';
      ctx.font = 'bold ' + (9 * v.zoom).toFixed(0) + 'px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText('OFFLINE ' + Math.ceil(n.disabled) + 's', X, top);
      return;
    }
    if (n.captureProgress > 0.02) {
      const c = n.capturingBy >= 0 ? g.players[n.capturingBy].colour : '#fff';
      this.bar(X, top, Math.max(22, 30 * v.zoom), Math.max(4, 5 * v.zoom), n.captureProgress, c);
    } else if (n.hp < n.hpMax * 0.99) {
      this.bar(X, top, Math.max(22, 30 * v.zoom), Math.max(3, 4 * v.zoom), n.hp / n.hpMax, '#e0c33a');
    }
    if (n.owner >= 0 && this.hover === n) {
      ctx.fillStyle = g.players[n.owner].colour;
      ctx.font = (10 * v.zoom).toFixed(0) + 'px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText(g.players[n.owner].name, X, top - 6 * v.zoom);
    }
  }

  // ------------------------------------------------------------ projectiles
  drawProjectiles() {
    const ctx = this.ctx, v = this.view, g = this.game;
    const me = g.humanIndex;
    for (const p of g.world.projectiles) {
      if (p.dead) continue;
      const X = sx(v, p.x, p.y), Y = sy(v, p.x, p.y, p.z);
      if (X < -40 || X > v.w + 40 || Y < -60 || Y > v.h + 60) continue;
      const visible = me < 0 || g.fog.isVisible(me, p.x, p.y) || p.threat;
      if (!visible) continue;

      if (p.z > 0.4) {
        // ground shadow for anything in flight
        isoEllipse(ctx, v, p.x, p.y, 0.18, 0.18, 'rgba(0,0,0,0.18)');
      }
      if (p.trail && p.trail.length > 3) {
        ctx.strokeStyle = p.type === 'interceptor' ? 'rgba(150,230,255,0.55)' : 'rgba(230,220,200,0.35)';
        ctx.lineWidth = Math.max(1, 1.6 * v.zoom);
        ctx.beginPath();
        for (let i = 0; i < p.trail.length; i += 2) {
          const tx = p.trail[i], ty = p.trail[i + 1];
          const TX = sx(v, tx, ty), TY = sy(v, tx, ty, p.z);
          if (i === 0) ctx.moveTo(TX, TY); else ctx.lineTo(TX, TY);
        }
        ctx.stroke();
      }
      switch (p.type) {
        case 'bullet': {
          const back = 0.55;
          const bx = p.x - (p.tx - p.sx) * 0.0, by = p.y;
          ctx.strokeStyle = 'rgba(255,225,150,0.9)';
          ctx.lineWidth = Math.max(1, 1.4 * v.zoom);
          const dx = p.tx - p.sx, dy = p.ty - p.sy;
          const l = Math.hypot(dx, dy) || 1;
          ctx.beginPath();
          ctx.moveTo(X, Y);
          ctx.lineTo(sx(v, p.x - dx / l * back, p.y - dy / l * back), sy(v, p.x - dx / l * back, p.y - dy / l * back, p.z));
          ctx.stroke();
          break;
        }
        case 'interceptor': {
          ctx.fillStyle = '#bfe9ff';
          ctx.beginPath(); ctx.arc(X, Y, Math.max(1.6, 2.4 * v.zoom), 0, TAU); ctx.fill();
          break;
        }
        case 'shell': case 'arc': {
          ctx.fillStyle = '#f2e2b8';
          ctx.beginPath(); ctx.arc(X, Y, Math.max(1.4, 2.2 * v.zoom), 0, TAU); ctx.fill();
          break;
        }
        case 'rocket': case 'missile': {
          ctx.fillStyle = '#ffd9a0';
          ctx.beginPath(); ctx.arc(X, Y, Math.max(1.6, 2.6 * v.zoom), 0, TAU); ctx.fill();
          ctx.fillStyle = 'rgba(255,150,60,0.8)';
          ctx.beginPath(); ctx.arc(X, Y, Math.max(2.6, 4 * v.zoom), 0, TAU); ctx.fill();
          break;
        }
        default: {
          // Strike weapons: big, obvious, and clearly identifiable in flight.
          const isBallistic = p.threat === 'ballistic';
          const r = Math.max(3, (isBallistic ? 4.5 : 3.6) * v.zoom);
          ctx.fillStyle = isBallistic ? '#ffd0d0' : '#d8e8ff';
          ctx.beginPath(); ctx.arc(X, Y, r, 0, TAU); ctx.fill();
          ctx.strokeStyle = p.owner === me ? 'rgba(120,255,180,0.7)' : 'rgba(255,110,90,0.85)';
          ctx.lineWidth = Math.max(1, 1.6 * v.zoom);
          ctx.beginPath(); ctx.arc(X, Y, r + 3 * v.zoom, 0, TAU); ctx.stroke();
          // target marker on the ground
          const TX = sx(v, p.tx, p.ty), TY = sy(v, p.tx, p.ty);
          ctx.strokeStyle = p.owner === me ? 'rgba(120,255,180,0.5)' : 'rgba(255,90,70,0.55)';
          ctx.setLineDash([4, 4]);
          ctx.beginPath(); ctx.ellipse(TX, TY, (p.splash + 0.5) * v.tw * 0.5, (p.splash + 0.5) * v.th * 0.5, 0, 0, TAU); ctx.stroke();
          ctx.setLineDash([]);
          break;
        }
      }
    }
  }

  drawParticles() {
    const ctx = this.ctx, v = this.view, fx = this.game.fx;
    for (const f of fx.flashes) {
      const a = 1 - f.life / f.maxLife;
      const X = sx(v, f.x, f.y), Y = sy(v, f.x, f.y, f.z || 0.3);
      ctx.save();
      ctx.globalAlpha = a;
      const r = (f.big ? f.size * 14 : 7) * v.zoom;
      const grd = ctx.createRadialGradient(X, Y, 0, X, Y, r);
      grd.addColorStop(0, f.air ? 'rgba(220,245,255,0.95)' : 'rgba(255,240,190,0.95)');
      grd.addColorStop(0.5, f.air ? 'rgba(140,210,255,0.5)' : 'rgba(255,150,50,0.55)');
      grd.addColorStop(1, 'rgba(255,120,40,0)');
      ctx.fillStyle = grd;
      ctx.beginPath(); ctx.arc(X, Y, r, 0, TAU); ctx.fill();
      ctx.restore();
    }
    for (const p of fx.particles) {
      const t = p.life / p.maxLife;
      const X = sx(v, p.x, p.y), Y = sy(v, p.x, p.y, p.z);
      if (X < -30 || X > v.w + 30 || Y < -30 || Y > v.h + 30) continue;
      ctx.save();
      if (p.type === 'smoke' || p.type === 'dust') {
        ctx.globalAlpha = (1 - t) * 0.75;
        ctx.fillStyle = p.colour;
        ctx.beginPath();
        ctx.arc(X, Y, p.size * v.tw * 0.5, 0, TAU);
        ctx.fill();
      } else {
        ctx.globalAlpha = 1 - t * t;
        ctx.fillStyle = p.colour;
        const s = p.size * v.tw * 0.5;
        ctx.fillRect(X - s * 0.5, Y - s * 0.5, s, s);
      }
      ctx.restore();
    }
    for (const t of fx.texts) {
      const X = sx(v, t.x, t.y), Y = sy(v, t.x, t.y, 1.2);
      ctx.save();
      ctx.globalAlpha = clamp(1 - t.life / t.maxLife, 0, 1);
      ctx.fillStyle = t.colour;
      ctx.font = 'bold ' + Math.round(11 * v.zoom) + 'px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText(t.text, X, Y);
      ctx.restore();
    }
  }

  // -------------------------------------------------------------------- fog
  drawFog(dt) {
    const g = this.game, me = g.humanIndex;
    if (me < 0) return;
    this.fogTimer -= dt;
    if (this.fogTimer <= 0 || !this._fogReady) {
      this.fogTimer = 0.12;
      this._fogReady = true;
      const vis = g.fog.visible[me], exp = g.fog.explored[me];
      const d = this.fogImage.data;
      const W = g.world.width;
      this.chunkExplored.fill(0);
      for (let i = 0, j = 0; i < vis.length; i++, j += 4) {
        d[j] = 4; d[j + 1] = 7; d[j + 2] = 11;
        const e = exp[i];
        d[j + 3] = vis[i] ? 0 : (e ? 130 : 240);
        if (e) {
          const x = i % W, y = (i / W) | 0;
          this.chunkExplored[((y / CHUNK) | 0) * this.chunkCols + ((x / CHUNK) | 0)] = 1;
        }
      }
      this.fogCtx.putImageData(this.fogImage, 0, 0);
    }
    const ctx = this.ctx, v = this.view;
    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'low';
    // The isometric projection is an affine transform, so the whole fog layer is
    // a single draw call rather than sixteen thousand diamonds.
    ctx.setTransform(
      this.dpr * v.tw * 0.5, this.dpr * v.th * 0.5,
      -this.dpr * v.tw * 0.5, this.dpr * v.th * 0.5,
      -this.dpr * v.ox, -this.dpr * v.oy,
    );
    ctx.drawImage(this.fogCanvas, 0, 0);
    ctx.restore();
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }

  // --------------------------------------------------------------- overlays
  drawOverlays() {
    const ctx = this.ctx, v = this.view, g = this.game;

    if (this.showRanges) this.drawRangeCircles();

    // Construction placement: highlight every valid construction point.
    if (this.placement) {
      const { pads, hoverPad, def } = this.placement;
      for (const pad of pads) {
        const ok = pad === hoverPad;
        const size = def.size;
        isoQuad(ctx, v, pad.cx, pad.cy, size * 0.5, size * 0.5, 0,
          ok ? 'rgba(120,255,170,0.35)' : 'rgba(120,200,255,0.16)', 0.02);
        ctx.strokeStyle = ok ? 'rgba(150,255,190,0.95)' : 'rgba(140,210,255,0.5)';
        ctx.lineWidth = ok ? 2 : 1;
        const h = size * 0.5;
        ctx.beginPath();
        [[h, h], [h, -h], [-h, -h], [-h, h]].forEach(([lx, ly], i) => {
          const X = sx(v, pad.cx + lx, pad.cy + ly), Y = sy(v, pad.cx + lx, pad.cy + ly);
          if (i === 0) ctx.moveTo(X, Y); else ctx.lineTo(X, Y);
        });
        ctx.closePath();
        ctx.stroke();
      }
      if (hoverPad) {
        const ghost = {
          x: hoverPad.cx, y: hoverPad.cy, size: def.size, key: def.key,
          state: 'ghost', progress: 1, turret: 0, online: true,
        };
        ctx.save();
        ctx.globalAlpha = 0.55;
        const p = g.players[g.humanIndex];
        drawBuilding(ctx, v, ghost, p.colour, this.time, p.factionDef.architecture);
        ctx.restore();
      }
    }

    // Strike targeting reticle.
    if (this.abilityTarget && this.mouseWorld) {
      const { radius } = this.abilityTarget;
      const X = sx(v, this.mouseWorld.x, this.mouseWorld.y), Y = sy(v, this.mouseWorld.x, this.mouseWorld.y);
      ctx.strokeStyle = 'rgba(255,120,90,0.95)';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 5]);
      ctx.beginPath();
      ctx.ellipse(X, Y, radius * v.tw * 0.5, radius * v.th * 0.5, 0, 0, TAU);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(X - 14, Y); ctx.lineTo(X + 14, Y);
      ctx.moveTo(X, Y - 8); ctx.lineTo(X, Y + 8);
      ctx.stroke();
    }

    // Rally lines for selected production buildings.
    for (const b of g.world.buildings) {
      if (!b.selected || !b.rally || b.owner !== g.humanIndex) continue;
      const X = sx(v, b.x, b.y), Y = sy(v, b.x, b.y, 0.4);
      const RX = sx(v, b.rally.x, b.rally.y), RY = sy(v, b.rally.x, b.rally.y);
      ctx.strokeStyle = 'rgba(150,255,190,0.6)';
      ctx.setLineDash([5, 5]);
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(X, Y); ctx.lineTo(RX, RY); ctx.stroke();
      ctx.setLineDash([]);
      isoEllipse(ctx, v, b.rally.x, b.rally.y, 0.4, 0.4, 'rgba(150,255,190,0.5)');
    }

    if (this.selectionBox) {
      const s = this.selectionBox;
      ctx.strokeStyle = 'rgba(150,255,190,0.9)';
      ctx.fillStyle = 'rgba(150,255,190,0.12)';
      ctx.lineWidth = 1.5;
      const x = Math.min(s.x0, s.x1), y = Math.min(s.y0, s.y1);
      const w = Math.abs(s.x1 - s.x0), h = Math.abs(s.y1 - s.y0);
      ctx.fillRect(x, y, w, h);
      ctx.strokeRect(x, y, w, h);
    }

    // Off-screen inbound-missile markers.
    for (const p of g.world.projectiles) {
      if (p.dead || !p.threat || p.owner === g.humanIndex || g.isAllied(g.humanIndex, p.owner)) continue;
      const X = sx(v, p.x, p.y), Y = sy(v, p.x, p.y, p.z);
      if (X > 0 && X < v.w && Y > 0 && Y < v.h) continue;
      const cx = v.w / 2, cy = v.h / 2;
      const a = Math.atan2(Y - cy, X - cx);
      const mx = cx + Math.cos(a) * Math.min(v.w, v.h) * 0.42;
      const my = cy + Math.sin(a) * Math.min(v.w, v.h) * 0.42;
      ctx.save();
      ctx.translate(mx, my); ctx.rotate(a);
      ctx.fillStyle = 'rgba(255,90,70,0.9)';
      ctx.beginPath(); ctx.moveTo(12, 0); ctx.lineTo(-8, 7); ctx.lineTo(-8, -7); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
  }

  drawRangeCircles() {
    const ctx = this.ctx, v = this.view, g = this.game;
    const me = g.humanIndex;
    ctx.save();
    ctx.lineWidth = 1.2;
    for (const b of g.world.buildings) {
      if (b.owner !== me || b.dead || b.state !== 'active') continue;
      const ic = b.def.interceptor;
      const wr = b.def.weapons.length ? Math.max(...b.def.weapons.map((w) => w.range)) : 0;
      const r = Math.max(ic ? ic.range : 0, wr);
      if (r <= 0) continue;
      ctx.strokeStyle = ic ? 'rgba(120,220,255,0.30)' : 'rgba(255,200,120,0.25)';
      const X = sx(v, b.x, b.y), Y = sy(v, b.x, b.y);
      ctx.beginPath(); ctx.ellipse(X, Y, r * v.tw * 0.5, r * v.th * 0.5, 0, 0, TAU); ctx.stroke();
    }
    for (const u of g.world.units) {
      if (u.owner !== me || u.dead || !u.selected) continue;
      const wr = u.def.weapons.length ? Math.max(...u.def.weapons.map((w) => w.range)) : 0;
      if (wr <= 0) continue;
      ctx.strokeStyle = 'rgba(255,200,120,0.30)';
      const X = sx(v, u.x, u.y), Y = sy(v, u.x, u.y);
      ctx.beginPath(); ctx.ellipse(X, Y, wr * v.tw * 0.5, wr * v.th * 0.5, 0, 0, TAU); ctx.stroke();
    }
    ctx.restore();
  }

  // -------------------------------------------------------------- minimap
  drawMinimap(canvas) {
    const g = this.game, me = g.humanIndex;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    const w = g.world;
    if (!this._miniTerrain || this._miniDirty) {
      this._miniTerrain = document.createElement('canvas');
      this._miniTerrain.width = w.width; this._miniTerrain.height = w.height;
      const mc = this._miniTerrain.getContext('2d');
      const img = mc.createImageData(w.width, w.height);
      for (let i = 0, j = 0; i < w.tiles.length; i++, j += 4) {
        const col = TERRAIN[w.bridge[i] ? T.CONCRETE : w.tiles[i]].colour;
        const n = parseInt(col.slice(1), 16);
        img.data[j] = (n >> 16) & 255; img.data[j + 1] = (n >> 8) & 255; img.data[j + 2] = n & 255; img.data[j + 3] = 255;
      }
      mc.putImageData(img, 0, 0);
      this._miniDirty = false;
    }
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this._miniTerrain, 0, 0, W, H);

    const sxr = W / w.width, syr = H / w.height;
    // Unexplored ground stays dark.
    if (me >= 0) {
      const exp = g.fog.explored[me], vis = g.fog.visible[me];
      ctx.save();
      ctx.fillStyle = 'rgba(6,9,13,0.94)';
      for (let y = 0; y < w.height; y += 2) {
        for (let x = 0; x < w.width; x += 2) {
          if (!exp[y * w.width + x]) ctx.fillRect(x * sxr, y * syr, sxr * 2 + 0.5, syr * 2 + 0.5);
        }
      }
      ctx.fillStyle = 'rgba(6,9,13,0.35)';
      for (let y = 0; y < w.height; y += 2) {
        for (let x = 0; x < w.width; x += 2) {
          const i = y * w.width + x;
          if (exp[i] && !vis[i]) ctx.fillRect(x * sxr, y * syr, sxr * 2 + 0.5, syr * 2 + 0.5);
        }
      }
      ctx.restore();
    }

    for (const n of g.world.neutrals) {
      if (me >= 0 && !g.fog.isExplored(me, n.x, n.y)) continue;
      ctx.fillStyle = n.owner >= 0 ? g.players[n.owner].colour : '#e8d48a';
      ctx.fillRect(n.x * sxr - 1.5, n.y * syr - 1.5, 3.5, 3.5);
    }
    for (const b of g.world.buildings) {
      if (b.dead) continue;
      if (me >= 0 && !g.fog.isExplored(me, b.x, b.y)) continue;
      ctx.fillStyle = g.players[b.owner].colour;
      const s = Math.max(2.5, b.size * sxr * 0.8);
      ctx.fillRect(b.x * sxr - s / 2, b.y * syr - s / 2, s, s);
    }
    const p = me >= 0 ? g.players[me] : null;
    const radar = p && p.radarOnline;
    for (const u of g.world.units) {
      if (u.dead || u.loaded) continue;
      const own = me < 0 || u.owner === me || g.isAllied(me, u.owner);
      if (!own) {
        const seen = g.fog.isVisible(me, u.x, u.y);
        if (!seen && !radar) continue;
      }
      ctx.fillStyle = g.players[u.owner].colour;
      ctx.fillRect(u.x * sxr - 1, u.y * syr - 1, 2.4, 2.4);
    }
    // Live strike tracks are always visible: you are meant to see them coming.
    for (const pr of g.world.projectiles) {
      if (pr.dead || !pr.threat) continue;
      ctx.fillStyle = (me >= 0 && (pr.owner === me || g.isAllied(me, pr.owner))) ? '#8fffc0' : '#ff5a46';
      ctx.beginPath(); ctx.arc(pr.x * sxr, pr.y * syr, 2.6, 0, TAU); ctx.fill();
    }

    // Camera frustum.
    const v = this.view;
    const cs = [screenToWorld(v, 0, 0), screenToWorld(v, v.w, 0), screenToWorld(v, v.w, v.h), screenToWorld(v, 0, v.h)];
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    cs.forEach((c, i) => { const X = c.x * sxr, Y = c.y * syr; if (i === 0) ctx.moveTo(X, Y); else ctx.lineTo(X, Y); });
    ctx.closePath();
    ctx.stroke();
  }

  minimapToWorld(canvas, px, py) {
    const w = this.game.world;
    return { x: (px / canvas.width) * w.width, y: (py / canvas.height) * w.height };
  }
}

export { MIN_ZOOM, MAX_ZOOM };
