// The 3D battlefield: a real WebGL scene with a directional sun, shadow mapping
// and physically-shaded materials, in place of drawing flat polygons.
//
// The camera looks down the classic RTS diagonal, but it is a perspective camera
// rather than an isometric projection, so the ground carries genuine depth and
// vehicles nearer the viewer are larger than those at the far end of the map.

import * as THREE from 'three';
import { T, TERRAIN } from '../core/terrain.js';
import { clamp } from '../core/util.js';

export const PITCH = 0.88;          // radians above the horizon
export const YAW = Math.PI * 0.25;  // the diagonal everything is drawn along
export const MIN_DIST = 14;
export const MAX_DIST = 96;
export const CHUNK = 16;            // terrain tiles per drawn chunk

const SUN_COLOUR = 0xfff1dc;
const SKY_COLOUR = 0x9dc2e8;
const GROUND_BOUNCE = 0x4b4636;

/** Height of the ground under a tile, in world units. */
export function tileHeight(t) {
  if (t === T.WATER) return -0.55;
  if (t === T.SHALLOW) return -0.18;
  if (t === T.ROCK) return 0.55;
  if (t === T.DUNE) return 0.30;
  if (t === T.TRENCH) return -0.22;
  if (t === T.RUBBLE) return 0.10;
  return 0;
}

export function makeScene(canvas) {
  const renderer = new THREE.WebGLRenderer({
    canvas, antialias: true, powerPreference: 'high-performance', stencil: false,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.94;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();

  // A procedural sky, used both as the backdrop and — through a pre-filtered
  // environment map — as the light that vehicle plating reflects. Without it
  // everything is lit by one lamp and reads as moulded plastic.
  const sky = new THREE.Scene();
  const dome = new THREE.SphereGeometry(1, 24, 16);
  const dp = dome.attributes.position;
  const dc = new Float32Array(dp.count * 3);
  const top = new THREE.Color(0x6ea3d6), horizon = new THREE.Color(0xd8d3c2), floor = new THREE.Color(0x4a4437);
  const tmp = new THREE.Color();
  for (let i = 0; i < dp.count; i++) {
    const y = dp.getY(i);
    if (y >= 0) tmp.copy(horizon).lerp(top, Math.min(1, Math.pow(y, 0.55)));
    else tmp.copy(horizon).lerp(floor, Math.min(1, Math.pow(-y, 0.4)));
    dc[i * 3] = tmp.r; dc[i * 3 + 1] = tmp.g; dc[i * 3 + 2] = tmp.b;
  }
  dome.setAttribute('color', new THREE.BufferAttribute(dc, 3));
  sky.add(new THREE.Mesh(dome, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromScene(sky, 0, 0.1, 100).texture;
  pmrem.dispose();
  scene.environment = env;
  scene.environmentIntensity = 0.34;
  scene.background = env;
  scene.backgroundBlurriness = 0.6;
  scene.fog = new THREE.Fog(0xb9bcb4, 130, 300);

  const camera = new THREE.PerspectiveCamera(36, 1, 0.8, 700);

  // Key light. The shadow camera is deliberately tight: a wide one over a 128
  // tile map gives shadows so coarse they read as noise.
  const sun = new THREE.DirectionalLight(SUN_COLOUR, 2.45);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 300;
  sun.shadow.bias = -0.0012;
  sun.shadow.normalBias = 0.035;
  scene.add(sun);
  scene.add(sun.target);

  // Sky and bounced ground light, so shadowed faces are not simply black.
  scene.add(new THREE.HemisphereLight(SKY_COLOUR, GROUND_BOUNCE, 0.85));

  return { renderer, scene, camera, sun };
}

/** A tiling grain texture: fine detail the vertex colours cannot carry. */
function grainTexture() {
  const N = 256;
  const cv = document.createElement('canvas');
  cv.width = N; cv.height = N;
  const ctx = cv.getContext('2d');
  const img = ctx.createImageData(N, N);
  let seed = 0x2f6e2b1;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  for (let i = 0; i < N * N; i++) {
    const x = i % N, y = (i / N) | 0;
    // Two octaves: broad blotches plus per-texel speckle.
    const blot = Math.sin(x * 0.09) * Math.cos(y * 0.077) + Math.sin((x + y) * 0.046);
    const v = 210 + blot * 9 + (rnd() - 0.5) * 30;
    const c = Math.max(150, Math.min(255, v)) | 0;
    img.data[i * 4] = c; img.data[i * 4 + 1] = c; img.data[i * 4 + 2] = c; img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/**
 * The battlefield ground, split into chunks so the GPU draws only what the
 * camera can see.
 *
 * Each tile is its own pair of triangles with a flat colour, so terrain reads
 * with clean edges rather than smearing one type into the next; the corner
 * heights and the normals are still sampled from a single continuous field, so
 * relief and lighting stay smooth across every tile and chunk boundary.
 */
export function buildTerrain(world) {
  const W = world.width, H = world.height;
  const tileAt = (tx, tz) => (world.bridge[tz * W + tx] ? T.CONCRETE : world.tiles[tz * W + tx]);

  // Continuous height field, one sample per tile corner.
  const VW = W + 1;
  const field = new Float32Array(VW * (H + 1));
  for (let gz = 0; gz <= H; gz++) {
    for (let gx = 0; gx <= W; gx++) {
      let h = 0, n = 0;
      for (const [ox, oz] of [[-1, -1], [0, -1], [-1, 0], [0, 0]]) {
        const ax = gx + ox, az = gz + oz;
        if (ax < 0 || az < 0 || ax >= W || az >= H) continue;
        h += tileHeight(tileAt(ax, az)); n++;
      }
      const noise = Math.sin(gx * 0.7) * Math.cos(gz * 0.63) + Math.sin((gx + gz) * 0.31) * 0.6;
      field[gz * VW + gx] = (n ? h / n : 0) + noise * 0.07;
    }
  }
  const at = (gx, gz) => field[clamp(gz, 0, H) * VW + clamp(gx, 0, W)];

  const group = new THREE.Group();
  const grain = grainTexture();
  grain.repeat.set(0.5, 0.5);
  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: 0.95, metalness: 0, map: grain,
  });
  const c = new THREE.Color();
  // Ground reads brighter under a real sun than it did flat-shaded, so the
  // palette is knocked back — hardstanding and sand most of all.
  const GRADE = { [T.CONCRETE]: 0.70, [T.SAND]: 0.80, [T.DUNE]: 0.78, [T.URBAN]: 0.86, [T.ROAD]: 0.84 };

  for (let cz = 0; cz < H; cz += CHUNK) {
    for (let cx = 0; cx < W; cx += CHUNK) {
      const cw = Math.min(CHUNK, W - cx), ch = Math.min(CHUNK, H - cz);
      const quads = cw * ch;
      const pos = new Float32Array(quads * 18);
      const nrm = new Float32Array(quads * 18);
      const col = new Float32Array(quads * 18);
      const uvs = new Float32Array(quads * 12);
      let o = 0, uo = 0;
      for (let z = 0; z < ch; z++) {
        for (let x = 0; x < cw; x++) {
          const gx = cx + x, gz = cz + z;
          const t = tileAt(gx, gz);
          c.set(TERRAIN[t].colour);
          const tint = (GRADE[t] || 0.9) * (0.9 + ((gx * 73856093 ^ gz * 19349663) >>> 0) % 100 / 100 * 0.22);
          const r = c.r * tint, g = c.g * tint, b = c.b * tint;
          const corner = (ox, oz) => {
            const vx = gx + ox, vz = gz + oz;
            const dx = at(vx + 1, vz) - at(vx - 1, vz);
            const dz = at(vx, vz + 1) - at(vx, vz - 1);
            const inv = 1 / Math.hypot(dx * 0.5, 1, dz * 0.5);
            return [vx - cx - cw / 2, at(vx, vz), vz - cz - ch / 2,
              -dx * 0.5 * inv, inv, -dz * 0.5 * inv];
          };
          const a = corner(0, 0), bq = corner(0, 1), d = corner(1, 1), e = corner(1, 0);
          const uvOf = [[gx, gz], [gx, gz + 1], [gx + 1, gz + 1], [gx, gz], [gx + 1, gz + 1], [gx + 1, gz]];
          let k = 0;
          for (const v of [a, bq, d, a, d, e]) {
            pos[o] = v[0]; pos[o + 1] = v[1]; pos[o + 2] = v[2];
            nrm[o] = v[3]; nrm[o + 1] = v[4]; nrm[o + 2] = v[5];
            col[o] = r; col[o + 1] = g; col[o + 2] = b;
            uvs[uo] = uvOf[k][0]; uvs[uo + 1] = uvOf[k][1];
            o += 3; uo += 2; k++;
          }
        }
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
      geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
      geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(cx + cw / 2, 0, cz + ch / 2);
      mesh.receiveShadow = true;
      group.add(mesh);
    }
  }
  return group;
}

/** Water sits as its own translucent surface so it can catch a specular. */
export function buildWater(world) {
  const geo = new THREE.PlaneGeometry(world.width, world.height, 1, 1);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshStandardMaterial({
    color: 0x2a5f86, roughness: 0.22, metalness: 0.25,
    transparent: true, opacity: 0.82,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(world.width / 2, -0.28, world.height / 2);
  mesh.receiveShadow = false;
  return mesh;
}

/** Place the camera for a look-at point and a distance from it. */
export function placeCamera(camera, sun, cx, cz, distance) {
  const dist = clamp(distance, MIN_DIST, MAX_DIST);
  const horiz = Math.cos(PITCH) * dist;
  // The camera sits on the +x/+y side looking back toward the origin, which is
  // the same diagonal the isometric renderer draws along: increasing x runs
  // down and to the right on screen in both views, so switching between them
  // does not flip the battlefield.
  camera.position.set(
    cx + Math.cos(YAW) * horiz,
    Math.sin(PITCH) * dist,
    cz + Math.sin(YAW) * horiz);
  camera.lookAt(cx, 0, cz);
  camera.updateMatrixWorld();

  // Keep the shadow frustum wrapped around what the camera can actually see.
  const span = clamp(dist * 0.62, 30, 115);
  sun.position.set(cx - 58, 96, cz - 30);
  sun.target.position.set(cx, 0, cz);
  sun.target.updateMatrixWorld();
  const sc = sun.shadow.camera;
  sc.left = -span; sc.right = span; sc.top = span; sc.bottom = -span;
  sc.updateProjectionMatrix();
}
