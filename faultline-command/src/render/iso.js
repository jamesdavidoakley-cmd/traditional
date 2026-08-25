// Isometric projection helpers and the primitive solids everything is drawn from.

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

  const faces = [];
  for (let i = 0; i < 4; i++) {
    const a = corners[i], b = corners[(i + 1) % 4];
    faces.push({ a, b, depth: (a.wx + a.wy + b.wx + b.wy) * 0.5 });
  }
  faces.sort((p, q) => p.depth - q.depth);

  for (let i = 0; i < 4; i++) {
    const f = faces[i];
    // Only the two nearest faces are actually visible; drawing all four in depth
    // order costs little and avoids seams.
    ctx.fillStyle = i < 2 ? cols.dark : cols.side;
    ctx.beginPath();
    ctx.moveTo(f.a.x, f.a.yb);
    ctx.lineTo(f.b.x, f.b.yb);
    ctx.lineTo(f.b.x, f.b.yt);
    ctx.lineTo(f.a.x, f.a.yt);
    ctx.closePath();
    ctx.fill();
  }
  ctx.fillStyle = cols.top;
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
