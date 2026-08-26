// Isometric projection helpers and the primitive solids everything is drawn from.
//
// Solids are lit by a single directional sun. Every vertical face gets its own
// tone from the angle between its normal and the light, so a box reads as a
// solid object rather than a flat sticker, and a turret visibly catches the
// light differently as it traverses. Shaded colours are cached by tone bucket:
// the shading is a string lookup in the hot path, not a per-face gradient.

import { shadeHex } from '../core/util.js';

// Sun direction in world (tile) space, and how hard it is.
export const SUN = { x: -0.6, y: -0.8, ambient: 0.42, diffuse: 0.62 };
const SUN_LEN = Math.hypot(SUN.x, SUN.y) || 1;
SUN.nx = SUN.x / SUN_LEN;
SUN.ny = SUN.y / SUN_LEN;

const shadeCache = new Map();
/** Shade a base colour by a signed amount, memoised in coarse buckets. */
export function litColour(hex, amount) {
  const bucket = Math.round(amount * 24);
  const key = hex + '|' + bucket;
  let v = shadeCache.get(key);
  if (v === undefined) {
    v = shadeHex(hex, bucket / 24);
    shadeCache.set(key, v);
  }
  return v;
}

/** Lambert term for a world-space face normal, in 0..1. */
function lambert(nx, ny) {
  const d = nx * SUN.nx + ny * SUN.ny;
  return d > 0 ? d : 0;
}


export const BASE_TW = 64;   // tile width in screen pixels at zoom 1
export const BASE_TH = 32;   // tile height in screen pixels at zoom 1

export function makeView(canvasW, canvasH) {
  return { camX: 64, camY: 64, zoom: 1, tw: BASE_TW, th: BASE_TH, w: canvasW, h: canvasH, ox: 0, oy: 0 };
}

export function syncView(view) {
  view.tw = BASE_TW * view.zoom;
  view.th = BASE_TH * view.zoom;
  view.ox = (view.camX - view.camY) * view.tw * 0.5 - view.w * 0.5;
  view.oy = (view.camX + view.camY) * view.th * 0.5 - view.h * 0.5;
}

export function sx(view, wx, wy) { return (wx - wy) * view.tw * 0.5 - view.ox; }
export function sy(view, wx, wy, wz) { return (wx + wy) * view.th * 0.5 - (wz || 0) * view.th - view.oy; }

export function screenToWorld(view, px, py) {
  const a = (px + view.ox) * 2 / view.tw;
  const b = (py + view.oy) * 2 / view.th;
  return { x: (a + b) * 0.5, y: (b - a) * 0.5 };
}

/** Filled iso diamond for one tile. */
export function tileDiamond(ctx, x, y, tw, th) {
  ctx.beginPath();
  ctx.moveTo(x, y - th * 0.5);
  ctx.lineTo(x + tw * 0.5, y);
  ctx.lineTo(x, y + th * 0.5);
  ctx.lineTo(x - tw * 0.5, y);
  ctx.closePath();
}

/**
 * A rotated box standing on the ground. Faces are depth-sorted so it reads as a
 * solid from any facing, which is what makes turret rotation legible.
 */
export function isoBox(ctx, view, wx, wy, halfLen, halfWid, height, rot, cols, wz) {
  const c = Math.cos(rot), s = Math.sin(rot);
  const corners = [
    [halfLen, halfWid], [halfLen, -halfWid], [-halfLen, -halfWid], [-halfLen, halfWid],
  ].map(([lx, ly]) => {
    const px = wx + lx * c - ly * s;
    const py = wy + lx * s + ly * c;
    return { wx: px, wy: py, x: sx(view, px, py), yb: sy(view, px, py, wz || 0), yt: sy(view, px, py, (wz || 0) + height) };
  });

  // Outward normal of each face in the box's own frame, rotated into the world.
  const LOCAL_N = [[1, 0], [0, -1], [-1, 0], [0, 1]];
  const faces = [];
  for (let i = 0; i < 4; i++) {
    const a = corners[i], b = corners[(i + 1) % 4];
    const ln = LOCAL_N[i];
    faces.push({
      a, b,
      depth: (a.wx + a.wy + b.wx + b.wy) * 0.5,
      nx: ln[0] * c - ln[1] * s,
      ny: ln[0] * s + ln[1] * c,
    });
  }
  faces.sort((p, q) => p.depth - q.depth);

  const detail = view.zoom > 0.75;
  for (let i = 0; i < 4; i++) {
    const f = faces[i];
    // Every face is lit on its own merits. Drawing all four in depth order costs
    // little and avoids seams where they meet.
    const l = SUN.ambient + SUN.diffuse * lambert(f.nx, f.ny);
    ctx.fillStyle = litColour(cols.side, l - 0.72);
    ctx.beginPath();
    ctx.moveTo(f.a.x, f.a.yb);
    ctx.lineTo(f.b.x, f.b.yb);
    ctx.lineTo(f.b.x, f.b.yt);
    ctx.lineTo(f.a.x, f.a.yt);
    ctx.closePath();
    ctx.fill();
    // Ambient occlusion where the face meets the ground, so it sits in the scene
    // instead of floating on it.
    if (detail) {
      const ha = (f.a.yb - f.a.yt) * 0.34, hb = (f.b.yb - f.b.yt) * 0.34;
      ctx.fillStyle = 'rgba(0,0,0,0.20)';
      ctx.beginPath();
      ctx.moveTo(f.a.x, f.a.yb);
      ctx.lineTo(f.b.x, f.b.yb);
      ctx.lineTo(f.b.x, f.b.yb - hb);
      ctx.lineTo(f.a.x, f.a.yb - ha);
      ctx.closePath();
      ctx.fill();
    }
  }
  // The upward face takes the full sun.
  ctx.fillStyle = litColour(cols.top, 0.06);
  ctx.beginPath();
  ctx.moveTo(corners[0].x, corners[0].yt);
  for (let i = 1; i < 4; i++) ctx.lineTo(corners[i].x, corners[i].yt);
  ctx.closePath();
  ctx.fill();
  if (cols.line) {
    ctx.strokeStyle = cols.line;
    ctx.lineWidth = Math.max(0.6, view.zoom * 0.8);
    ctx.stroke();
  }
  // A bright edge where the roof meets the sunlit side: the highlight that makes
  // a shape look like metal rather than paper.
  if (detail) {
    ctx.strokeStyle = 'rgba(255,250,235,0.30)';
    ctx.lineWidth = Math.max(0.7, view.zoom * 0.9);
    for (let i = 0; i < 4; i++) {
      const f = faces[i];
      if (lambert(f.nx, f.ny) < 0.55) continue;
      ctx.beginPath();
      ctx.moveTo(f.a.x, f.a.yt);
      ctx.lineTo(f.b.x, f.b.yt);
      ctx.stroke();
    }
  }
  return corners;
}

/** Flat rotated quad lying on the ground (shadows, decks, aprons). */
export function isoQuad(ctx, view, wx, wy, halfLen, halfWid, rot, fill, wz) {
  const c = Math.cos(rot), s = Math.sin(rot);
  ctx.beginPath();
  const pts = [[halfLen, halfWid], [halfLen, -halfWid], [-halfLen, -halfWid], [-halfLen, halfWid]];
  pts.forEach(([lx, ly], i) => {
    const px = wx + lx * c - ly * s;
    const py = wy + lx * s + ly * c;
    const X = sx(view, px, py), Y = sy(view, px, py, wz || 0);
    if (i === 0) ctx.moveTo(X, Y); else ctx.lineTo(X, Y);
  });
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}

export function isoEllipse(ctx, view, wx, wy, rx, ry, fill, wz) {
  const X = sx(view, wx, wy), Y = sy(view, wx, wy, wz || 0);
  ctx.beginPath();
  ctx.ellipse(X, Y, rx * view.tw * 0.5, ry * view.th * 0.5, 0, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
}

/** A line in world space, e.g. a gun barrel or a tracer. */
export function isoLine(ctx, view, x1, y1, z1, x2, y2, z2, colour, width) {
  ctx.strokeStyle = colour;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(sx(view, x1, y1), sy(view, x1, y1, z1));
  ctx.lineTo(sx(view, x2, y2), sy(view, x2, y2, z2));
  ctx.stroke();
}
