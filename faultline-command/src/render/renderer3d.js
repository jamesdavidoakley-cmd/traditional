// The 3D battlefield renderer.
//
// The world is drawn with WebGL — instanced, shadow-casting meshes under a
// directional sun — and everything that belongs to the interface rather than the
// world (health bars, selection rings, range circles, the construction grid) is
// drawn on a transparent 2D canvas laid over the top and projected through the
// same camera, so it stays crisp at any zoom.

import * as THREE from 'three';
import { clamp, TAU, makeRng, mixHex } from '../core/util.js';
import { T, TERRAIN } from '../core/terrain.js';
import {
  makeScene, buildTerrain, buildWater, placeCamera, tileHeight, MIN_DIST, MAX_DIST, CHUNK,
} from './scene3d.js';
import { unitGeometry, buildingGeometry, neutralGeometry, propGeometry } from './models3d.js';
import { buildingHeight } from './sprites.js';

const MIN_ZOOM = 0.45, MAX_ZOOM = 3.2;
const REF_DIST = 46;           // camera distance at zoom 1
const START_CAP = 48;          // instances allocated per pool before it grows

// Structures are built of concrete and steel, not painted in faction colours;
// the shade varies by role so a base is not one repeated block.
const CONCRETE = {
  _: '#8a8781',
  hq: '#93908a', power: '#83837e', barracks: '#7f8272', factory: '#7c7a74',
  artillery: '#7a786f', repair: '#85837a', radar: '#8e8d88', data: '#8b8a86',
  awc: '#8d8a84', oiladmin: '#8a8175', navalyard: '#7f8286',
  mg: '#7d7b73', atgun: '#7d7b73', sam: '#82817b', coastal: '#7f7e78',
  patriot: '#82817b', s400: '#82817b', hq9: '#82817b', irondome: '#82817b',
};

export class Renderer3D {
  constructor(canvas, game) {
    this.canvas = canvas;
    this.game = game;
    this.is3D = true;
    this.view = { camX: 64, camY: 64, zoom: 1.1, w: 1, h: 1 };
    this.dpr = Math.min(window.devicePixelRatio || 1, 1.75);
    this.showRanges = false;
    this.placement = null;
    this.abilityTarget = null;
    this.selectionBox = null;
    this.hover = null;
    this.mouseWorld = null;
    this.time = 0;
    this.frames = 0;
    this.fps = 60;
    this._fpsAcc = 0;

    const { renderer, scene, camera, sun } = makeScene(canvas);
    this.gl = renderer; this.scene = scene; this.camera = camera; this.sun = sun;

    this.scene.add(buildTerrain(game.world));
    if (game.mapData.hasWater) this.scene.add(buildWater(game.world));

    this.pools = new Map();
    this.pickPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this.ray = new THREE.Raycaster();
    this._v = new THREE.Vector3();
    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._e = new THREE.Euler();
    this._s = new THREE.Vector3(1, 1, 1);
    this._col = new THREE.Color();

    this.buildOverlay();
    this.buildFog();
    this.buildProps();
    this.buildParticles();
    this.buildTrails();
    this.resize();
    this.centreOnPlayer();
    this.syncCamera();
  }

  // ------------------------------------------------------------------ setup
  /** A transparent 2D canvas over the top for world-anchored interface. */
  buildOverlay() {
    let o = document.getElementById('battlefield-overlay');
    if (!o) {
      o = document.createElement('canvas');
      o.id = 'battlefield-overlay';
      this.canvas.parentNode.insertBefore(o, this.canvas.nextSibling);
    }
    o.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;display:block;pointer-events:none;z-index:2';
    this.overlay = o;
    this.ctx = o.getContext('2d');
  }

  /**
   * Fog of war, as a texture laid just above the ground with depth testing off:
   * it dims the terrain exactly, at the cost of a little parallax on tall
   * scenery, which is a far better trade than tree tops punching holes in it.
   */
  buildFog() {
    const w = this.game.world;
    this.fogData = new Uint8Array(w.width * w.height * 4);
    this.fogTex = new THREE.DataTexture(this.fogData, w.width, w.height, THREE.RGBAFormat);
    this.fogTex.magFilter = THREE.LinearFilter;
    this.fogTex.minFilter = THREE.LinearFilter;
    this.fogTex.needsUpdate = true;
    const geo = new THREE.PlaneGeometry(w.width, w.height, 1, 1);
    geo.rotateX(-Math.PI / 2);
    // A DataTexture ignores flipY, so the plane's V axis is flipped instead —
    // without this the whole fog layer is mirrored north to south.
    const uv = geo.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setY(i, 1 - uv.getY(i));
    const mat = new THREE.MeshBasicMaterial({
      map: this.fogTex, transparent: true, depthWrite: false, depthTest: false,
    });
    this.fogMesh = new THREE.Mesh(geo, mat);
    this.fogMesh.position.set(w.width / 2, 0.02, w.height / 2);
    this.fogMesh.renderOrder = 20;
    this.fogMesh.frustumCulled = false;
    this.scene.add(this.fogMesh);
    this.fogTimer = 0;
  }

  /**
   * Static scenery: woodland, villages, farms, refinery stacks. Instanced per
   * chunk so that off-screen scenery is frustum-culled rather than submitted.
   */
  buildProps() {
    const w = this.game.world, d = this.game.mapData;
    const rng = makeRng(0xbeef01);
    const groups = new Map();
    const push = (type, x, z, rot, scale) => {
      const key = type + '@' + ((z / CHUNK) | 0) + ',' + ((x / CHUNK) | 0);
      let g = groups.get(key);
      if (!g) { g = { type, list: [] }; groups.set(key, g); }
      g.list.push({ x, z, rot, scale });
    };
    for (let y = 0; y < w.height; y++) {
      for (let x = 0; x < w.width; x++) {
        const t = w.tiles[y * w.width + x];
        if (t === T.WOOD) {
          if (rng() > 0.34) continue;
          push('tree', x + rng(), y + rng(), rng() * TAU, 0.85 + rng() * 0.6);
        } else if (t === T.URBAN && rng() < 0.20) {
          push('house', x + 0.25 + rng() * 0.5, y + 0.25 + rng() * 0.5,
            Math.round(rng() * 4) * Math.PI / 2, 0.85 + rng() * 0.45);
        }
      }
    }
    for (const dec of d.decor || []) {
      if (dec.type === 'house') push('house', dec.x, dec.y, dec.rot || 0, 1);
      else if (dec.type === 'farm') push('barn', dec.x, dec.y, dec.rot || 0, 1);
      else if (dec.type === 'refinery') push('stack', dec.x, dec.y, 0, 1);
    }
    // Two shades per family, drifted per instance, so a wood is not one green
    // and a village is not one rendered block repeated eighty times.
    const TINT = {
      tree: ['#4f7a3c', '#7ba055'], house: ['#a4907a', '#cabaa6'],
      barn: ['#8d6742', '#b98a5c'], stack: ['#7f7c76', '#9d9a94'],
    };
    const mats = new Map();
    const a = new THREE.Color(), b = new THREE.Color(), c = new THREE.Color();
    for (const { type, list } of groups.values()) {
      if (!mats.has(type)) {
        mats.set(type, new THREE.MeshStandardMaterial({
          vertexColors: true, roughness: 0.94, metalness: 0.02,
        }));
      }
      const pair = TINT[type] || ['#8d8a84', '#a5a29b'];
      a.set(pair[0]); b.set(pair[1]);
      const mesh = new THREE.InstancedMesh(propGeometry(type).hull, mats.get(type), list.length);
      mesh.castShadow = true; mesh.receiveShadow = true;
      mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(list.length * 3), 3);
      list.forEach((p, i) => {
        this._e.set(0, p.rot, 0);
        this._q.setFromEuler(this._e);
        this._s.set(p.scale, p.scale, p.scale);
        this._v.set(p.x, this.groundAt(p.x, p.z), p.z);
        this._m.compose(this._v, this._q, this._s);
        mesh.setMatrixAt(i, this._m);
        const t = ((((p.x * 977) | 0) ^ (((p.z * 631) | 0) << 3)) >>> 0) % 1000 / 1000;
        c.copy(a).lerp(b, t);
        mesh.instanceColor.setXYZ(i, c.r, c.g, c.b);
      });
      mesh.instanceMatrix.needsUpdate = true;
      mesh.instanceColor.needsUpdate = true;
      mesh.computeBoundingSphere();
      this.scene.add(mesh);
    }
    this._s.set(1, 1, 1);
  }

  /**
   * Two point clouds: one additive for muzzle flash, fire and sparks, one
   * ordinary for smoke and dust. Both are depth tested, so an explosion behind
   * a factory is correctly hidden by it.
   */
  buildParticles() {
    const VERT = `
      attribute float psize;
      attribute float alpha;
      attribute vec3 tint;
      varying vec3 vTint; varying float vAlpha;
      void main() {
        vTint = tint; vAlpha = alpha;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = max(1.0, psize * 320.0 / max(1.0, -mv.z));
        gl_Position = projectionMatrix * mv;
      }`;
    const FRAG = `
      varying vec3 vTint; varying float vAlpha;
      void main() {
        float r = length(gl_PointCoord - vec2(0.5));
        if (r > 0.5) discard;
        gl_FragColor = vec4(vTint, vAlpha * smoothstep(0.5, 0.08, r));
      }`;
    const make = (cap, blending) => {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(cap * 3), 3));
      geo.setAttribute('tint', new THREE.BufferAttribute(new Float32Array(cap * 3), 3));
      geo.setAttribute('psize', new THREE.BufferAttribute(new Float32Array(cap), 1));
      geo.setAttribute('alpha', new THREE.BufferAttribute(new Float32Array(cap), 1));
      geo.setDrawRange(0, 0);
      geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(64, 0, 64), 400);
      const mat = new THREE.ShaderMaterial({
        vertexShader: VERT, fragmentShader: FRAG,
        transparent: true, depthWrite: false, blending,
      });
      const pts = new THREE.Points(geo, mat);
      pts.frustumCulled = false;
      pts.renderOrder = 12;
      this.scene.add(pts);
      return { pts, geo, cap, n: 0 };
    };
    this.smoke = make(1200, THREE.NormalBlending);
    this.fire = make(700, THREE.AdditiveBlending);
  }

  /** Projectile trails, as one dynamic line-segment buffer. */
  buildTrails() {
    const cap = 3000;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(cap * 3), 3));
    geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(cap * 3), 3));
    geo.setDrawRange(0, 0);
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(64, 0, 64), 400);
    const mat = new THREE.LineBasicMaterial({
      vertexColors: true, transparent: true, opacity: 0.55, depthWrite: false,
    });
    this.trails = { line: new THREE.LineSegments(geo, mat), geo, cap, n: 0 };
    this.trails.line.frustumCulled = false;
    this.trails.line.renderOrder = 11;
    this.scene.add(this.trails.line);
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    const w = Math.max(1, Math.round(rect.width)), h = Math.max(1, Math.round(rect.height));
    this.cssW = w; this.cssH = h;
    this.view.w = w; this.view.h = h;
    this.gl.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.overlay.width = Math.round(w * this.dpr);
    this.overlay.height = Math.round(h * this.dpr);
    this.overlay.style.width = w + 'px';
    this.overlay.style.height = h + 'px';
  }

  centreOnPlayer() {
    const p = this.game.players[this.game.humanIndex];
    const hq = p && p.hq ? p.hq : { x: this.game.world.width / 2, y: this.game.world.height / 2 };
    this.view.camX = hq.x; this.view.camY = hq.y;
    this.clampCamera();
    this.syncCamera();
  }

  /** Ground height under a world position, so nothing floats or sinks. */
  groundAt(x, y) {
    const w = this.game.world;
    const tx = clamp(x | 0, 0, w.width - 1), ty = clamp(y | 0, 0, w.height - 1);
    return tileHeight(w.tiles[ty * w.width + tx]);
  }

  // ------------------------------------------------------------- camera api
  zoomDist() { return clamp(REF_DIST / this.view.zoom, MIN_DIST, MAX_DIST); }

  /**
   * Screen-pixel drag, resolved against the ground itself rather than through a
   * trigonometric approximation. Under perspective the mapping is not linear,
   * so the camera offset is solved for: the ground the pointer grabbed ends up
   * under the pointer at any pitch or zoom.
   *
   * `ax, ay` is where the drag started; without it the screen centre is used,
   * which is what keyboard and edge scrolling want.
   */
  pan(dx, dy, ax, ay) {
    // Callers may write view.camX/camY straight before panning (the drag path
    // rewinds to where the drag began), so the camera is re-derived first.
    this.syncCamera();
    const gx = ax === undefined ? this.cssW / 2 : ax;
    const gy = ay === undefined ? this.cssH / 2 : ay;
    const grab = this.screenToWorld(gx, gy);
    const tx = gx - dx, ty = gy - dy;
    for (let i = 0; i < 4; i++) {
      const p = this.worldToScreen(grab.x, grab.y, 0);
      if (Math.hypot(p.x - tx, p.y - ty) < 0.4) break;
      const at = this.screenToWorld(tx, ty);
      const now = this.screenToWorld(p.x, p.y);
      this.view.camX += now.x - at.x;
      this.view.camY += now.y - at.y;
      this.syncCamera();
    }
    this.clampCamera();
    this.syncCamera();
  }

  panWorld(x, y) { this.view.camX = x; this.view.camY = y; this.clampCamera(); this.syncCamera(); }

  clampCamera() {
    const w = this.game.world;
    this.view.camX = clamp(this.view.camX, 1, w.width - 1);
    this.view.camY = clamp(this.view.camY, 1, w.height - 1);
  }

  zoomBy(f, anchorX, anchorY) {
    const before = anchorX !== undefined ? this.screenToWorld(anchorX, anchorY) : null;
    this.view.zoom = clamp(this.view.zoom * f, MIN_ZOOM, MAX_ZOOM);
    this.syncCamera();
    if (before) {
      const after = this.screenToWorld(anchorX, anchorY);
      this.view.camX += before.x - after.x;
      this.view.camY += before.y - after.y;
      this.clampCamera();
      this.syncCamera();
    }
  }

  syncCamera() {
    this._camAt = this.view.camX + this.view.camY * 4096 + this.view.zoom * 7919;
    const shake = this.game.fx ? this.game.fx.shake : 0;
    let jx = 0, jz = 0;
    if (shake > 0.01) {
      jx = (Math.sin(this.time * 71) + Math.sin(this.time * 37)) * shake * 0.5;
      jz = (Math.cos(this.time * 63) + Math.cos(this.time * 41)) * shake * 0.5;
    }
    placeCamera(this.camera, this.sun, this.view.camX + jx, this.view.camY + jz, this.zoomDist());
  }

  /**
   * Adaptive quality. Shadow mapping and render scale are the two things that
   * cost real money on a weak GPU, so they are what gets traded away — and both
   * come back if the frame rate recovers.
   *
   *   2 — full: 1024px shadow map at the display's pixel ratio
   *   1 — reduced: 512px shadow map, render scale capped at 1.25
   *   0 — no shadows, render scale 1
   */
  setQuality(level) {
    if (level === this._quality) return;
    this._quality = level;
    this.gl.shadowMap.enabled = level > 0;
    if (level > 0) {
      const px = level === 2 ? 1024 : 512;
      this.sun.shadow.mapSize.set(px, px);
      if (this.sun.shadow.map) { this.sun.shadow.map.dispose(); this.sun.shadow.map = null; }
    }
    const cap = level === 2 ? 1.75 : level === 1 ? 1.25 : 1;
    this.gl.setPixelRatio(Math.min(window.devicePixelRatio || 1, cap));
    this.resize();
    this.scene.traverse((o) => { if (o.material) o.material.needsUpdate = true; });
  }

  autoQuality() {
    const now = performance.now();
    if (this._quality === undefined) { this.setQuality(2); this._qAt = now + 1500; return; }
    // Wall clock, not frame dt: the main loop clips dt, so a stalling machine
    // would otherwise never reach the next review.
    if (now < this._qAt) return;
    this._qAt = now + 1500;
    if (this.fps < 30 && this._quality > 0) this.setQuality(this._quality - 1);
    else if (this.fps > 58 && this._quality < 2) this.setQuality(this._quality + 1);
  }

  /** Screen pixel to the point on the ground plane under it. */
  screenToWorld(px, py) {
    if (this._camAt !== this.view.camX + this.view.camY * 4096 + this.view.zoom * 7919) this.syncCamera();
    const ndc = new THREE.Vector2((px / this.cssW) * 2 - 1, -(py / this.cssH) * 2 + 1);
    this.ray.setFromCamera(ndc, this.camera);
    const hit = new THREE.Vector3();
    if (!this.ray.ray.intersectPlane(this.pickPlane, hit)) return { x: this.view.camX, y: this.view.camY };
    return { x: hit.x, y: hit.z };
  }

  worldToScreen(wx, wy, wz) {
    this._v.set(wx, wz || 0, wy);
    this._v.project(this.camera);
    return { x: (this._v.x * 0.5 + 0.5) * this.cssW, y: (-this._v.y * 0.5 + 0.5) * this.cssH };
  }

  /** Pixels per world tile at the ground, used to size overlay chrome. */
  pxPerTile() {
    return this.cssH / (2 * this.zoomDist() * Math.tan(this.camera.fov * Math.PI / 360));
  }

  // ------------------------------------------------------------- instancing
  /** An instanced mesh for one geometry, grown when it runs out of room. */
  pool(key, geo, opts) {
    let p = this.pools.get(key);
    if (!p) {
      const mat = new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: opts && opts.roughness !== undefined ? opts.roughness : 0.68,
        metalness: opts && opts.metalness !== undefined ? opts.metalness : 0.16,
      });
      p = { geo, mat, mesh: null, cap: 0, n: 0 };
      this.pools.set(key, p);
      this.growPool(p, START_CAP);
    }
    return p;
  }

  growPool(p, cap) {
    if (p.mesh) { this.scene.remove(p.mesh); p.mesh.dispose(); }
    const mesh = new THREE.InstancedMesh(p.geo, p.mat, cap);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;
    mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3);
    mesh.count = 0;
    this.scene.add(mesh);
    p.mesh = mesh; p.cap = cap;
  }

  place(p, x, y, z, rotY, colour, scale, scaleY) {
    if (p.n >= p.cap) this.growPool(p, p.cap * 2);
    // Model space points +X forward; the sim measures facing anticlockwise from
    // +X in the x/y plane, which is a clockwise rotation about the world +Y.
    this._e.set(0, -rotY, 0);
    this._q.setFromEuler(this._e);
    const sc = scale || 1;
    this._s.set(sc, scaleY === undefined ? sc : scaleY, sc);
    this._v.set(x, z, y);
    this._m.compose(this._v, this._q, this._s);
    p.mesh.setMatrixAt(p.n, this._m);
    this._col.set(colour);
    p.mesh.instanceColor.setXYZ(p.n, this._col.r, this._col.g, this._col.b);
    p.n++;
  }

  // ------------------------------------------------------------------ frame
  render(dt) {
    this.time += dt;
    const wall = performance.now();
    if (this._wall === undefined) this._wall = wall;
    this._fpsAcc += (wall - this._wall) / 1000; this._wall = wall; this.frames++;
    if (this._fpsAcc >= 0.5) {
      this.fps = this.frames / this._fpsAcc;
      this.frames = 0; this._fpsAcc = 0;
    }

    this.syncCamera();
    for (const p of this.pools.values()) p.n = 0;

    const g = this.game, me = g.humanIndex;
    const seen = (x, y) => me < 0 || g.fog.isVisible(me, x, y);
    const explored = (x, y) => me < 0 || g.fog.isExplored(me, x, y);

    for (const w of g.world.wrecks) {
      if (!explored(w.x, w.y)) continue;
      const geo = unitGeometry(w.art);
      if (!geo.hull) continue;
      this.place(this.pool('w|' + this.unitKey(w.art), geo.hull, { roughness: 0.95, metalness: 0.1 }),
        w.x, w.y, this.groundAt(w.x, w.y) - 0.06, w.facing, '#3a352d', 0.92);
    }

    for (const n of g.world.neutrals) {
      if (n.dead || !explored(n.x, n.y)) continue;
      const geo = neutralGeometry(n.type);
      this.place(this.pool('n|' + n.type, geo.hull, { roughness: 0.85, metalness: 0.16 }),
        n.x, n.y, this.groundAt(n.x, n.y), 0,
        n.owner >= 0 ? this.livery(g.players[n.owner].colour) : '#b3a884');
    }

    for (const b of g.world.buildings) {
      if (b.dead || !explored(b.x, b.y)) continue;
      const h = buildingHeight(b.key) * 1.25 + 0.35;
      const geo = buildingGeometry(b.key, b.def.size, h);
      const key = 'b|' + b.key + '|' + b.def.size;
      const z = this.groundAt(b.x, b.y);
      // Under construction a structure rises out of the ground rather than
      // growing sideways, so only the vertical axis is scaled.
      const done = b.state === 'active';
      const rise = done ? 1 : clamp(0.16 + b.progress * 0.84, 0.16, 1);
      const body = done ? CONCRETE[b.key] || CONCRETE._ : '#5f5c55';
      const team = done ? g.players[b.owner].colour : '#77736a';
      this.place(this.pool(key, geo.hull, { roughness: 0.9, metalness: 0.06 }), b.x, b.y, z, 0, body, 1, rise);
      if (geo.trim) {
        this.place(this.pool(key + '|m', geo.trim, { roughness: 0.7, metalness: 0.14 }),
          b.x, b.y, z, 0, team, 1, rise);
      }
      if (geo.turret && done) {
        this.place(this.pool(key + '|t', geo.turret, { roughness: 0.66, metalness: 0.3 }),
          b.x, b.y, z, b.turret || 0, this.livery(team));
      }
    }

    for (const u of g.world.units) {
      if (u.dead || u.loaded || !seen(u.x, u.y)) continue;
      const art = u.def.art;
      const geo = unitGeometry(art);
      const col = this.livery(g.players[u.owner].colour);
      const key = this.unitKey(art);
      const naval = u.def.class === 'naval';
      const z = naval ? -0.24 : this.groundAt(u.x, u.y);
      const sc = u.def.class === 'infantry' ? 1.1 : naval ? 1.0 : 1.0;
      if (geo.hull) this.place(this.pool('u|' + key, geo.hull), u.x, u.y, z, u.facing, col, sc);
      if (geo.turret) this.place(this.pool('t|' + key, geo.turret), u.x, u.y, z, u.turret, col, sc);
    }

    this.drawProjectiles3D();

    for (const p of this.pools.values()) {
      p.mesh.count = p.n;
      p.mesh.instanceMatrix.needsUpdate = true;
      p.mesh.instanceColor.needsUpdate = true;
    }

    this.updateParticles();
    this.updateGhost();
    this.updateFog(dt);
    this.autoQuality();
    this.gl.render(this.scene, this.camera);
    this.drawOverlay();
  }

  /** Team colour knocked back toward service paint, cached per player. */
  livery(colour) {
    if (!this._livery) this._livery = new Map();
    let v = this._livery.get(colour);
    if (!v) { v = mixHex(colour, '#6f6a5c', 0.26); this._livery.set(colour, v); }
    return v;
  }

  unitKey(art) {
    return (art.body || 'tank') + '|' + (art.len || 1).toFixed(2) + '|'
      + (art.wid || 1).toFixed(2) + '|' + (art.tracks === false ? 0 : 1);
  }

  // ------------------------------------------------------------ projectiles
  drawProjectiles3D() {
    const g = this.game, me = g.humanIndex;
    const tr = this.trails, tp = tr.geo.attributes.position.array, tc = tr.geo.attributes.color.array;
    tr.n = 0;
    const seg = (ax, ay, az, bx, by, bz, r, gr, bl) => {
      if (tr.n + 2 > tr.cap) return;
      let i = tr.n * 3;
      tp[i] = ax; tp[i + 1] = az; tp[i + 2] = ay;
      tc[i] = r; tc[i + 1] = gr; tc[i + 2] = bl;
      i += 3;
      tp[i] = bx; tp[i + 1] = bz; tp[i + 2] = by;
      tc[i] = r; tc[i + 1] = gr; tc[i + 2] = bl;
      tr.n += 2;
    };

    for (const p of g.world.projectiles) {
      if (p.dead) continue;
      if (!(me < 0 || g.fog.isVisible(me, p.x, p.y) || p.threat)) continue;
      const shell = p.type === 'shell' || p.type === 'arc';
      const rocket = p.type === 'rocket' || p.type === 'missile';
      const strike = !shell && !rocket && p.type !== 'bullet' && p.type !== 'interceptor';

      if (p.type === 'bullet') {
        const dx = p.tx - p.sx, dy = p.ty - p.sy;
        const l = Math.hypot(dx, dy) || 1;
        seg(p.x, p.y, p.z, p.x - dx / l * 0.7, p.y - dy / l * 0.7, p.z, 1.0, 0.86, 0.5);
        continue;
      }
      if (p.trail && p.trail.length > 3) {
        const warm = p.type === 'interceptor';
        for (let i = 0; i + 3 < p.trail.length; i += 2) {
          seg(p.trail[i], p.trail[i + 1], p.z, p.trail[i + 2], p.trail[i + 3], p.z,
            warm ? 0.55 : 0.85, warm ? 0.85 : 0.8, warm ? 1.0 : 0.68);
        }
      }
      const r = strike ? 0.20 : rocket ? 0.13 : p.type === 'interceptor' ? 0.10 : 0.11;
      const col = strike ? (p.threat === 'ballistic' ? '#ffd0d0' : '#d8e8ff')
        : rocket ? '#ffd9a0' : p.type === 'interceptor' ? '#bfe9ff' : '#f2e2b8';
      this.place(this.pool('proj|' + r.toFixed(2), this.projGeo(r), { roughness: 0.4, metalness: 0.1 }),
        p.x, p.y, p.z, 0, col);
      if (rocket || strike) this.spark(p.x, p.y, p.z, 0.24, 1.0, 0.55, 0.18, 0.7);
    }
    tr.geo.attributes.position.needsUpdate = true;
    tr.geo.attributes.color.needsUpdate = true;
    tr.geo.setDrawRange(0, tr.n);
  }

  projGeo(r) {
    if (!this._projGeos) this._projGeos = new Map();
    const k = r.toFixed(2);
    let g = this._projGeos.get(k);
    if (!g) {
      const geo = new THREE.SphereGeometry(r, 8, 6);
      const n = geo.attributes.position.count;
      const c = new Float32Array(n * 3).fill(1);
      geo.setAttribute('color', new THREE.BufferAttribute(c, 3));
      this._projGeos.set(k, geo);
      g = geo;
    }
    return g;
  }

  // -------------------------------------------------------------- particles
  spark(x, y, z, size, r, gr, b, a) {
    const f = this.fire;
    if (f.n >= f.cap) return;
    const i = f.n;
    f.geo.attributes.position.setXYZ(i, x, z, y);
    f.geo.attributes.tint.setXYZ(i, r, gr, b);
    f.geo.attributes.psize.setX(i, size);
    f.geo.attributes.alpha.setX(i, a);
    f.n++;
  }

  updateParticles() {
    const fx = this.game.fx;
    const s = this.smoke;
    s.n = 0;
    const sp = s.geo.attributes;
    for (const p of fx.particles) {
      if (s.n >= s.cap) break;
      const t = p.life / p.maxLife;
      const smoky = p.type === 'smoke' || p.type === 'dust';
      this._col.set(p.colour);
      const i = s.n;
      sp.position.setXYZ(i, p.x, p.z + this.groundAt(p.x, p.y), p.y);
      sp.tint.setXYZ(i, this._col.r, this._col.g, this._col.b);
      sp.psize.setX(i, p.size * (smoky ? 1.6 : 0.7));
      sp.alpha.setX(i, smoky ? (1 - t) * 0.62 : 1 - t * t);
      s.n++;
    }
    for (const k of ['position', 'tint', 'psize', 'alpha']) sp[k].needsUpdate = true;
    s.geo.setDrawRange(0, s.n);

    // Muzzle flashes and explosions on the additive cloud, on top of any rocket
    // exhaust already queued this frame.
    for (const f of fx.flashes) {
      const a = 1 - f.life / f.maxLife;
      const big = !!f.big;
      const size = big ? f.size * 2.2 : 0.55;
      const z = (f.z || 0.35) + (big ? 0 : 0);
      if (f.air) this.spark(f.x, f.y, z, size, 0.78, 0.92, 1.0, a);
      else this.spark(f.x, f.y, z, size, 1.0, big ? 0.62 : 0.9, big ? 0.24 : 0.5, a);
      if (big) this.spark(f.x, f.y, z + 0.4, size * 0.55, 1.0, 0.94, 0.78, a);
    }
    const fp = this.fire.geo.attributes;
    for (const k of ['position', 'tint', 'psize', 'alpha']) fp[k].needsUpdate = true;
    this.fire.geo.setDrawRange(0, this.fire.n);
    this.fire.n = 0;
  }

  // ----------------------------------------------------------- build ghost
  /** A translucent preview of the structure being sited. */
  updateGhost() {
    const pl = this.placement;
    if (!pl || !pl.hoverPad) { if (this.ghost) this.ghost.visible = false; return; }
    const def = pl.def;
    const h = buildingHeight(def.key) * 1.25 + 0.35;
    const key = def.key + '|' + def.size;
    if (!this.ghost || this._ghostKey !== key) {
      if (this.ghost) this.scene.remove(this.ghost);
      const geo = buildingGeometry(def.key, def.size, h);
      const mat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(this.game.players[this.game.humanIndex].colour),
        vertexColors: true, transparent: true, opacity: 0.45,
        roughness: 0.8, metalness: 0.1, depthWrite: false,
      });
      this.ghost = new THREE.Mesh(geo.hull, mat);
      this.ghost.renderOrder = 9;
      this.scene.add(this.ghost);
      this._ghostKey = key;
    }
    this.ghost.visible = true;
    this.ghost.position.set(pl.hoverPad.cx, this.groundAt(pl.hoverPad.cx, pl.hoverPad.cy), pl.hoverPad.cy);
  }

  updateFog(dt) {
    this.fogTimer -= dt;
    if (this.fogTimer > 0) return;
    this.fogTimer = 0.12;
    const g = this.game, me = g.humanIndex;
    if (me < 0) { this.fogMesh.visible = false; return; }
    this.fogMesh.visible = true;
    const d = this.fogData;
    const exp = g.fog.explored[me], vis = g.fog.visible[me];
    for (let i = 0, j = 0; i < exp.length; i++, j += 4) {
      d[j] = 4; d[j + 1] = 7; d[j + 2] = 11;
      d[j + 3] = exp[i] ? (vis[i] ? 0 : 118) : 242;
    }
    this.fogTex.needsUpdate = true;
  }

  // ---------------------------------------------------------------- overlay
  drawOverlay() {
    const ctx = this.ctx, g = this.game, me = g.humanIndex;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.cssW, this.cssH);
    const k = clamp(this.pxPerTile() / 26, 0.55, 1.9);   // chrome scale factor

    if (this.showRanges) this.rangeRings(ctx);

    // Construction grid.
    if (this.placement) {
      const { pads, hoverPad, def } = this.placement;
      for (const pad of pads) {
        const hot = pad === hoverPad;
        ctx.strokeStyle = hot ? 'rgba(150,255,190,0.95)' : 'rgba(140,210,255,0.45)';
        ctx.lineWidth = hot ? 2.2 : 1.1;
        this.groundSquare(ctx, pad.cx, pad.cy, def.size * 0.5);
        if (hot) { ctx.fillStyle = 'rgba(120,255,170,0.16)'; ctx.fill(); }
        ctx.stroke();
      }
    }

    // Strike targeting reticle.
    if (this.abilityTarget && this.mouseWorld) {
      const p = this.worldToScreen(this.mouseWorld.x, this.mouseWorld.y, 0.05);
      ctx.strokeStyle = 'rgba(255,120,90,0.95)';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 5]);
      this.groundCircle(ctx, this.mouseWorld.x, this.mouseWorld.y, this.abilityTarget.radius);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(p.x - 14, p.y); ctx.lineTo(p.x + 14, p.y);
      ctx.moveTo(p.x, p.y - 8); ctx.lineTo(p.x, p.y + 8);
      ctx.stroke();
    }

    // Rally lines.
    for (const b of g.world.buildings) {
      if (!b.selected || !b.rally || b.owner !== me) continue;
      const a = this.worldToScreen(b.x, b.y, 0.6), r = this.worldToScreen(b.rally.x, b.rally.y, 0.05);
      ctx.strokeStyle = 'rgba(150,255,190,0.6)';
      ctx.setLineDash([5, 5]);
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(r.x, r.y); ctx.stroke();
      ctx.setLineDash([]);
      ctx.strokeStyle = 'rgba(150,255,190,0.7)';
      this.groundCircle(ctx, b.rally.x, b.rally.y, 0.4);
      ctx.stroke();
    }

    for (const n of g.world.neutrals) {
      if (n.dead || (me >= 0 && !g.fog.isExplored(me, n.x, n.y))) continue;
      this.neutralOverlay(ctx, n, k);
    }
    for (const b of g.world.buildings) {
      if (b.dead || (me >= 0 && !g.fog.isExplored(me, b.x, b.y))) continue;
      this.buildingOverlay(ctx, b, k);
    }
    for (const u of g.world.units) {
      if (u.dead || u.loaded || (me >= 0 && !g.fog.isVisible(me, u.x, u.y))) continue;
      this.unitOverlay(ctx, u, k);
    }

    // Floating damage and capture text.
    for (const t of g.fx.texts) {
      const p = this.worldToScreen(t.x, t.y, 1.4);
      ctx.save();
      ctx.globalAlpha = clamp(1 - t.life / t.maxLife, 0, 1);
      ctx.fillStyle = t.colour;
      ctx.font = 'bold ' + Math.round(11 * k) + 'px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(t.text, p.x, p.y);
      ctx.restore();
    }

    if (this.selectionBox) {
      const b = this.selectionBox;
      ctx.strokeStyle = 'rgba(150,255,190,0.9)';
      ctx.fillStyle = 'rgba(150,255,190,0.12)';
      ctx.lineWidth = 1.5;
      const x = Math.min(b.x0, b.x1), y = Math.min(b.y0, b.y1);
      const w = Math.abs(b.x1 - b.x0), h = Math.abs(b.y1 - b.y0);
      ctx.fillRect(x, y, w, h);
      ctx.strokeRect(x, y, w, h);
    }

    // Off-screen inbound-missile markers.
    for (const p of g.world.projectiles) {
      if (p.dead || !p.threat || p.owner === me || g.isAllied(me, p.owner)) continue;
      const s = this.worldToScreen(p.x, p.y, p.z);
      if (s.x > 0 && s.x < this.cssW && s.y > 0 && s.y < this.cssH) continue;
      const cx = this.cssW / 2, cy = this.cssH / 2;
      const a = Math.atan2(s.y - cy, s.x - cx);
      ctx.save();
      ctx.translate(cx + Math.cos(a) * Math.min(this.cssW, this.cssH) * 0.42,
        cy + Math.sin(a) * Math.min(this.cssW, this.cssH) * 0.42);
      ctx.rotate(a);
      ctx.fillStyle = 'rgba(255,90,70,0.9)';
      ctx.beginPath(); ctx.moveTo(12, 0); ctx.lineTo(-8, 7); ctx.lineTo(-8, -7); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
  }

  // -------------------------------------------------------- overlay pieces
  groundCircle(ctx, wx, wy, r) {
    ctx.beginPath();
    for (let i = 0; i <= 24; i++) {
      const a = (i / 24) * TAU;
      const p = this.worldToScreen(wx + Math.cos(a) * r, wy + Math.sin(a) * r, 0.05);
      if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
    }
    ctx.closePath();
  }

  groundSquare(ctx, wx, wy, h) {
    ctx.beginPath();
    [[h, h], [h, -h], [-h, -h], [-h, h]].forEach(([lx, ly], i) => {
      const p = this.worldToScreen(wx + lx, wy + ly, 0.05);
      if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
    });
    ctx.closePath();
  }

  bar(ctx, X, Y, w, h, frac, colour) {
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(X - w / 2, Y, w, h);
    ctx.fillStyle = colour;
    ctx.fillRect(X - w / 2 + 1, Y + 1, Math.max(0, (w - 2) * frac), h - 2);
  }

  hpColour(frac) { return frac > 0.6 ? '#5ed17a' : frac > 0.3 ? '#e0c33a' : '#e0533a'; }

  unitOverlay(ctx, u, k) {
    const me = this.game.humanIndex;
    const hurt = u.hp < u.hpMax * 0.995;
    if (!(u.selected || (hurt && (u.owner === me || k > 1.0)) || this.hover === u)) return;
    const p = this.worldToScreen(u.x, u.y, u.def.class === 'infantry' ? 1.0 : 1.15);
    const w = Math.max(16, 22 * k), bh = Math.max(3, 4 * k);
    if (u.selected) {
      ctx.strokeStyle = 'rgba(140,255,170,0.9)';
      ctx.lineWidth = Math.max(1.2, 1.6 * k);
      this.groundCircle(ctx, u.x, u.y, u.def.class === 'naval' ? 1.3 : u.def.class === 'infantry' ? 0.55 : 0.75);
      ctx.stroke();
    }
    this.bar(ctx, p.x, p.y, w, bh, clamp(u.hp / u.hpMax, 0, 1), this.hpColour(u.hp / u.hpMax));
    if (u.selected && u.ammoMax > 0) {
      this.bar(ctx, p.x, p.y + bh + 1, w, Math.max(2, 3 * k), clamp(u.ammo / u.ammoMax, 0, 1), '#7fb4ff');
    }
    if (u.selected && (u.mobility < 0.99 || u.weaponHealth < 0.99)) {
      ctx.fillStyle = '#ffb347';
      ctx.font = Math.round(8 * k) + 'px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText((u.mobility < 0.99 ? 'M' : '') + (u.weaponHealth < 0.99 ? 'W' : ''), p.x + w * 0.72, p.y + 4 * k);
    }
  }

  buildingOverlay(ctx, b, k) {
    const g = this.game, me = g.humanIndex;
    const top = buildingHeight(b.key) * 1.25 + 0.9;
    const p = this.worldToScreen(b.x, b.y, top);
    if (b.selected) {
      ctx.strokeStyle = 'rgba(140,255,170,0.9)';
      ctx.lineWidth = Math.max(1.2, 1.6 * k);
      this.groundSquare(ctx, b.x, b.y, b.def.size * 0.5);
      ctx.stroke();
    }
    if (b.state !== 'active') {
      const w = Math.max(24, 34 * k);
      this.bar(ctx, p.x, p.y, w, Math.max(4, 5 * k), b.progress, '#ffd257');
      ctx.fillStyle = '#ffe9a8';
      ctx.font = Math.round(9 * k) + 'px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(Math.round(b.progress * 100) + '%', p.x, p.y - 3 * k);
      return;
    }
    if (b.hp < b.hpMax * 0.995 || b.selected || this.hover === b) {
      const frac = clamp(b.hp / b.hpMax, 0, 1);
      this.bar(ctx, p.x, p.y, Math.max(24, 32 * k), Math.max(4, 5 * k), frac, this.hpColour(frac));
    }
    if (b.owner === me && b.def.needsPower && !b.online) {
      ctx.fillStyle = '#ff6b5a';
      ctx.font = 'bold ' + Math.round(11 * k) + 'px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('⚡', p.x, p.y - 4 * k);
    }
  }

  neutralOverlay(ctx, n, k) {
    const g = this.game;
    const p = this.worldToScreen(n.x, n.y, 2.6);
    if (n.disabled > 0) {
      ctx.fillStyle = '#ff8a5a';
      ctx.font = 'bold ' + Math.round(9 * k) + 'px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('OFFLINE ' + Math.ceil(n.disabled) + 's', p.x, p.y);
      return;
    }
    if (n.captureProgress > 0.02) {
      const c = n.capturingBy >= 0 ? g.players[n.capturingBy].colour : '#fff';
      this.bar(ctx, p.x, p.y, Math.max(22, 30 * k), Math.max(4, 5 * k), n.captureProgress, c);
    } else if (n.hp < n.hpMax * 0.99) {
      this.bar(ctx, p.x, p.y, Math.max(22, 30 * k), Math.max(3, 4 * k), n.hp / n.hpMax, '#e0c33a');
    }
    if (n.owner >= 0 && this.hover === n) {
      ctx.fillStyle = g.players[n.owner].colour;
      ctx.font = Math.round(10 * k) + 'px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(g.players[n.owner].name, p.x, p.y - 6 * k);
    }
  }

  rangeRings(ctx) {
    const g = this.game, me = g.humanIndex;
    ctx.save();
    ctx.lineWidth = 1.2;
    for (const b of g.world.buildings) {
      if (b.owner !== me || b.dead || b.state !== 'active') continue;
      const ic = b.def.interceptor;
      const wr = b.def.weapons.length ? Math.max(...b.def.weapons.map((w) => w.range)) : 0;
      const r = Math.max(ic ? ic.range : 0, wr);
      if (r <= 0) continue;
      ctx.strokeStyle = ic ? 'rgba(120,220,255,0.30)' : 'rgba(255,200,120,0.25)';
      this.groundCircle(ctx, b.x, b.y, r);
      ctx.stroke();
    }
    for (const u of g.world.units) {
      if (u.owner !== me || u.dead || !u.selected) continue;
      const wr = u.def.weapons.length ? Math.max(...u.def.weapons.map((w) => w.range)) : 0;
      if (wr <= 0) continue;
      ctx.strokeStyle = 'rgba(255,200,120,0.30)';
      this.groundCircle(ctx, u.x, u.y, wr);
      ctx.stroke();
    }
    ctx.restore();
  }

  // ---------------------------------------------------------------- minimap
  drawMinimap(canvas) {
    if (this._miniAt !== undefined && this.time - this._miniAt < 0.1) return;
    this._miniAt = this.time;
    const g = this.game, me = g.humanIndex, w = g.world;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    if (!this._miniTerrain) {
      this._miniTerrain = document.createElement('canvas');
      this._miniTerrain.width = w.width; this._miniTerrain.height = w.height;
      const mc = this._miniTerrain.getContext('2d');
      const img = mc.createImageData(w.width, w.height);
      for (let i = 0, j = 0; i < w.tiles.length; i++, j += 4) {
        const col = TERRAIN[w.bridge[i] ? T.CONCRETE : w.tiles[i]].colour;
        const n = parseInt(col.slice(1), 16);
        img.data[j] = (n >> 16) & 255; img.data[j + 1] = (n >> 8) & 255;
        img.data[j + 2] = n & 255; img.data[j + 3] = 255;
      }
      mc.putImageData(img, 0, 0);
    }
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this._miniTerrain, 0, 0, W, H);
    const sxr = W / w.width, syr = H / w.height;
    if (me >= 0) {
      if (!this._miniFog) {
        this._miniFog = document.createElement('canvas');
        this._miniFog.width = w.width; this._miniFog.height = w.height;
        this._miniFogCtx = this._miniFog.getContext('2d');
        this._miniFogImg = this._miniFogCtx.createImageData(w.width, w.height);
      }
      const d = this._miniFogImg.data;
      const exp = g.fog.explored[me], vis = g.fog.visible[me];
      for (let i = 0, j = 0; i < exp.length; i++, j += 4) {
        d[j] = 6; d[j + 1] = 9; d[j + 2] = 13;
        d[j + 3] = exp[i] ? (vis[i] ? 0 : 90) : 240;
      }
      this._miniFogCtx.putImageData(this._miniFogImg, 0, 0);
      ctx.drawImage(this._miniFog, 0, 0, W, H);
    }
    for (const n of g.world.neutrals) {
      if (n.dead || (me >= 0 && !g.fog.isExplored(me, n.x, n.y))) continue;
      ctx.fillStyle = n.owner >= 0 ? g.players[n.owner].colour : '#e8d48a';
      ctx.fillRect(n.x * sxr - 1.5, n.y * syr - 1.5, 3.5, 3.5);
    }
    for (const b of g.world.buildings) {
      if (b.dead || (me >= 0 && !g.fog.isExplored(me, b.x, b.y))) continue;
      ctx.fillStyle = g.players[b.owner].colour;
      ctx.fillRect(b.x * sxr - 2, b.y * syr - 2, 4, 4);
    }
    for (const u of g.world.units) {
      if (u.dead || u.loaded || (me >= 0 && !g.fog.isVisible(me, u.x, u.y))) continue;
      ctx.fillStyle = g.players[u.owner].colour;
      ctx.fillRect(u.x * sxr - 1, u.y * syr - 1, 2.5, 2.5);
    }
    // Camera footprint: the four screen corners projected onto the ground.
    ctx.strokeStyle = 'rgba(230,240,255,0.85)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    [[0, 0], [this.cssW, 0], [this.cssW, this.cssH], [0, this.cssH]].forEach(([px, py], i) => {
      const p = this.screenToWorld(px, py);
      const X = clamp(p.x, 0, w.width) * sxr, Y = clamp(p.y, 0, w.height) * syr;
      if (i === 0) ctx.moveTo(X, Y); else ctx.lineTo(X, Y);
    });
    ctx.closePath();
    ctx.stroke();
  }

  minimapToWorld(canvas, px, py) {
    const w = this.game.world;
    return { x: (px / canvas.width) * w.width, y: (py / canvas.height) * w.height };
  }

  dispose() {
    for (const p of this.pools.values()) if (p.mesh) p.mesh.dispose();
    this.gl.dispose();
    if (this.overlay) this.overlay.remove();
  }
}

/** True when this browser can actually run the 3D renderer. */
export function webglAvailable() {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch (e) { return false; }
}
