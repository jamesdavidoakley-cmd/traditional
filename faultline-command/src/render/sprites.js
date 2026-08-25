// Procedural isometric artwork. Everything is drawn from primitives so turrets
// rotate, barrels recoil and every coalition's buildings look subtly different.

import { isoBox, isoQuad, isoEllipse, isoLine, sx, sy } from './iso.js';
import { mixHex, shadeHex, TAU } from '../core/util.js';

const cache = new Map();
function pal(colour) {
  let p = cache.get(colour);
  if (p) return p;
  const hull = mixHex(colour, '#3d3f38', 0.66);
  p = {
    team: colour,
    teamLight: shadeHex(colour, 0.3),
    top: shadeHex(hull, 0.20),
    side: hull,
    dark: shadeHex(hull, -0.28),
    line: 'rgba(0,0,0,0.35)',
    accent: shadeHex(colour, 0.12),
    glass: 'rgba(180,220,255,0.55)',
  };
  cache.set(colour, p);
  return p;
}

function boxCols(p, tint) {
  if (!tint) return { top: p.top, side: p.side, dark: p.dark, line: p.line };
  return { top: shadeHex(tint, 0.2), side: tint, dark: shadeHex(tint, -0.25), line: p.line };
}

function shadow(ctx, view, x, y, rx, ry) {
  isoEllipse(ctx, view, x, y, rx, ry, 'rgba(0,0,0,0.22)');
}

// ------------------------------------------------------------------- units
export function drawUnit(ctx, view, u, colour, time) {
  const p = pal(colour);
  const a = u.def.art;
  switch (a.body) {
    case 'squad': return drawSquad(ctx, view, u, p, a, time);
    case 'tank': return drawTank(ctx, view, u, p, a);
    case 'ifv': return drawIFV(ctx, view, u, p, a);
    case 'tank90': return drawTank90(ctx, view, u, p, a);
    case 'ifv90': return drawIFV90(ctx, view, u, p, a);
    case 'apc90': return drawAPC90(ctx, view, u, p, a);
    case 'spg90': return drawSPG90(ctx, view, u, p, a);
    case 'mlrs90': return drawMLRS90(ctx, view, u, p, a);
    case 'aa90': return drawAA90(ctx, view, u, p, a);
    case 'rhomboid': return drawRhomboid(ctx, view, u, p, a);
    case 'heavygun': return drawHeavyGun(ctx, view, u, p, a);
    case 'apc': return drawAPC(ctx, view, u, p, a);
    case 'scout': return drawScout(ctx, view, u, p, a);
    case 'spg': return drawSPG(ctx, view, u, p, a);
    case 'mlrs': return drawMLRS(ctx, view, u, p, a);
    case 'aa': return drawAA(ctx, view, u, p, a);
    case 'engv': return drawEngV(ctx, view, u, p, a);
    case 'boat': return drawBoat(ctx, view, u, p, a, time);
    case 'landing': return drawLanding(ctx, view, u, p, a, time);
    case 'ship': return drawShip(ctx, view, u, p, a, time);
    default: return drawTank(ctx, view, u, p, a);
  }
}

function drawSquad(ctx, view, u, p, a, time) {
  const n = a.figures;
  const spread = 0.24;
  shadow(ctx, view, u.x, u.y, 0.55, 0.55);
  for (let i = 0; i < n; i++) {
    const ang = (i / n) * TAU + u.facing * 0.4;
    const fx = u.x + Math.cos(ang) * spread * (i % 2 ? 1 : 0.6);
    const fy = u.y + Math.sin(ang) * spread * (i % 2 ? 1 : 0.6);
    const bob = u.moving ? Math.sin(time * 9 + i * 1.9) * 0.035 : 0;
    const X = sx(view, fx, fy), Y = sy(view, fx, fy);
    const s = view.zoom;
    // torso
    ctx.fillStyle = p.side;
    ctx.fillRect(X - 1.9 * s, Y - (10 + bob * 60) * s, 3.8 * s, 7.2 * s);
    // helmet
    ctx.fillStyle = p.dark;
    ctx.beginPath();
    ctx.ellipse(X, Y - (11.4 + bob * 60) * s, 2.3 * s, 1.7 * s, 0, 0, TAU);
    ctx.fill();
    // team flash on the shoulder
    ctx.fillStyle = p.team;
    ctx.fillRect(X - 1.9 * s, Y - (9.6 + bob * 60) * s, 3.8 * s, 1.5 * s);
    // legs
    ctx.fillStyle = p.dark;
    ctx.fillRect(X - 1.5 * s, Y - (3.2 + bob * 60) * s, 1.2 * s, 3.4 * s);
    ctx.fillRect(X + 0.4 * s, Y - (3.2 + bob * 60) * s, 1.2 * s, 3.4 * s);
    // weapon
    if (a.weapon !== 'tools') {
      ctx.strokeStyle = '#26241f';
      ctx.lineWidth = Math.max(0.8, 1.1 * s);
      ctx.beginPath();
      const wl = a.weapon === 'launcher' ? 6.5 : 4.6;
      ctx.moveTo(X + 1.4 * s, Y - (8 + bob * 60) * s);
      ctx.lineTo(X + (1.4 + wl) * s * Math.cos(u.turret * 0.35), Y - (8 + bob * 60) * s + wl * s * 0.28);
      ctx.stroke();
    } else if (i === 0) {
      ctx.fillStyle = '#d8c25a';
      ctx.fillRect(X + 1.6 * s, Y - 7 * s, 2 * s, 2 * s);
    }
    if (a.elite && i === 0) {
      ctx.fillStyle = p.teamLight;
      ctx.fillRect(X - 2.6 * s, Y - 13.4 * s, 5.2 * s, 1.1 * s);
    }
  }
}

function tracks(ctx, view, u, p, len, wid) {
  isoQuad(ctx, view, u.x, u.y, len * 1.03, wid * 1.16, u.facing, 'rgba(24,22,20,0.85)');
}

function wheels(ctx, view, u, p, len, wid, count) {
  const c = Math.cos(u.facing), s = Math.sin(u.facing);
  for (let i = 0; i < count; i++) {
    const t = (i / (count - 1) - 0.5) * 2 * len * 0.82;
    for (const side of [-1, 1]) {
      const wx = u.x + t * c - side * wid * s;
      const wy = u.y + t * s + side * wid * c;
      isoEllipse(ctx, view, wx, wy, 0.16, 0.16, '#1c1a17', 0.03);
    }
  }
}

function hullPlate(ctx, view, u, p, len, wid, h) {
  isoBox(ctx, view, u.x, u.y, len, wid, h, u.facing, boxCols(p));
}

function teamStripe(ctx, view, u, p, len, wid, h) {
  isoQuad(ctx, view, u.x, u.y, len * 0.34, wid * 0.9, u.facing, p.team, h + 0.001);
}

function barrel(ctx, view, u, p, from, length, thickness, height) {
  const c = Math.cos(u.turret), s = Math.sin(u.turret);
  const recoil = (u.recoil || 0) * 0.14;
  const x1 = u.x + c * (from - recoil), y1 = u.y + s * (from - recoil);
  const x2 = u.x + c * (from + length - recoil), y2 = u.y + s * (from + length - recoil);
  isoLine(ctx, view, x1, y1, height, x2, y2, height, '#2a2823', Math.max(1, thickness * view.zoom));
}

function drawTank(ctx, view, u, p, a) {
  shadow(ctx, view, u.x, u.y, a.len * 1.25, a.wid * 1.9);
  tracks(ctx, view, u, p, a.len, a.wid);
  hullPlate(ctx, view, u, p, a.len * 0.92, a.wid * 0.9, 0.34);
  teamStripe(ctx, view, u, p, a.len * 0.92, a.wid * 0.9, 0.34);
  isoBox(ctx, view, u.x, u.y, a.len * 0.46, a.wid * 0.64, 0.26, u.turret, boxCols(p), 0.34);
  barrel(ctx, view, u, p, a.len * 0.44, a.len * 1.05, 1.7, 0.52);
  isoEllipse(ctx, view, u.x - Math.cos(u.turret) * 0.12, u.y - Math.sin(u.turret) * 0.12, 0.14, 0.14, p.dark, 0.61);
}

function drawIFV(ctx, view, u, p, a) {
  shadow(ctx, view, u.x, u.y, a.len * 1.2, a.wid * 1.8);
  tracks(ctx, view, u, p, a.len, a.wid);
  hullPlate(ctx, view, u, p, a.len * 0.9, a.wid * 0.86, 0.34);
  teamStripe(ctx, view, u, p, a.len * 0.9, a.wid * 0.86, 0.34);
  isoBox(ctx, view, u.x + Math.cos(u.facing) * 0.06, u.y + Math.sin(u.facing) * 0.06, a.len * 0.32, a.wid * 0.46, 0.22, u.turret, boxCols(p), 0.34);
  barrel(ctx, view, u, p, a.len * 0.32, a.len * 0.8, 1.1, 0.5);
  // ATGM box on the turret cheek
  const c = Math.cos(u.turret + 1.35), s = Math.sin(u.turret + 1.35);
  isoQuad(ctx, view, u.x + c * 0.22, u.y + s * 0.22, 0.12, 0.07, u.turret, p.dark, 0.38);
}

// 1926: the lozenge heavy tank. Tracks run all the way round the hull, the guns
// sit in side sponsons and nothing rotates — it fights whichever way it drives.
function drawRhomboid(ctx, view, u, p, a) {
  const c = Math.cos(u.facing), s = Math.sin(u.facing);
  shadow(ctx, view, u.x, u.y, a.len * 1.45, a.wid * 2.1);
  // all-round track run: one long quad plus raised nose and tail plates
  isoQuad(ctx, view, u.x, u.y, a.len * 1.18, a.wid * 1.32, u.facing, 'rgba(24,22,20,0.88)');
  isoQuad(ctx, view, u.x + c * a.len * 0.86, u.y + s * a.len * 0.86, a.len * 0.30, a.wid * 1.12, u.facing, 'rgba(20,18,16,0.9)', 0.20);
  isoQuad(ctx, view, u.x - c * a.len * 0.86, u.y - s * a.len * 0.86, a.len * 0.30, a.wid * 1.12, u.facing, 'rgba(20,18,16,0.9)', 0.16);
  // riveted hull, low and long
  hullPlate(ctx, view, u, p, a.len * 1.02, a.wid * 0.82, 0.30);
  teamStripe(ctx, view, u, p, a.len * 1.02, a.wid * 0.82, 0.30);
  // commander's cupola on the roof
  isoBox(ctx, view, u.x + c * a.len * 0.10, u.y + s * a.len * 0.10, a.len * 0.22, a.wid * 0.34, 0.16, u.facing, boxCols(p), 0.30);
  // sponson guns, one each flank, firing across the beam
  const recoil = (u.recoil || 0) * 0.12;
  for (const side of [-1, 1]) {
    const bx = u.x - s * side * a.wid * 0.72, by = u.y + c * side * a.wid * 0.72;
    isoBox(ctx, view, bx, by, a.len * 0.24, a.wid * 0.22, 0.20, u.facing, boxCols(p, '#4a4b42'), 0.24);
    const gx = -s * side, gy = c * side;
    isoLine(ctx, view, bx + gx * (0.06 - recoil), by + gy * (0.06 - recoil), 0.36,
      bx + gx * (a.len * 0.62 - recoil), by + gy * (a.len * 0.62 - recoil), 0.36,
      '#2a2823', Math.max(1, 1.5 * view.zoom));
  }
  // exhaust silencer along the spine
  isoQuad(ctx, view, u.x - c * a.len * 0.24, u.y - s * a.len * 0.24, a.len * 0.34, a.wid * 0.12, u.facing, p.dark, 0.47);
}

// 1926: a heavy piece on a wheeled carriage — gun shield, split trail, and a
// barrel that elevates rather than a turret that spins.
function drawHeavyGun(ctx, view, u, p, a) {
  const c = Math.cos(u.turret), s = Math.sin(u.turret);
  const fc = Math.cos(u.facing), fs = Math.sin(u.facing);
  shadow(ctx, view, u.x, u.y, a.len * 1.2, a.wid * 1.8);
  // trail legs dug in behind the piece
  for (const side of [-1, 1]) {
    isoLine(ctx, view, u.x - c * 0.10, u.y - s * 0.10, 0.10,
      u.x - c * a.len * 0.9 - s * side * a.wid * 0.5, u.y - s * a.len * 0.9 + c * side * a.wid * 0.5, 0.02,
      p.dark, Math.max(1, 2.2 * view.zoom));
  }
  // carriage wheels, large and spoked
  for (const side of [-1, 1]) {
    isoEllipse(ctx, view, u.x - fs * side * a.wid * 0.72, u.y + fc * side * a.wid * 0.72, 0.21, 0.21, '#1c1a17', 0.02);
    isoEllipse(ctx, view, u.x - fs * side * a.wid * 0.72, u.y + fc * side * a.wid * 0.72, 0.11, 0.11, p.dark, 0.05);
  }
  // cradle and gun shield
  isoBox(ctx, view, u.x, u.y, a.len * 0.30, a.wid * 0.62, 0.24, u.turret, boxCols(p), 0.10);
  isoQuad(ctx, view, u.x + c * a.len * 0.22, u.y + s * a.len * 0.22, 0.06, a.wid * 0.86, u.turret, p.side, 0.50);
  teamStripe(ctx, view, u, p, a.len * 0.30, a.wid * 0.62, 0.34);
  // long high-angle barrel with a counterweight at the breech
  barrel(ctx, view, u, p, a.len * 0.24, a.len * 1.55, 2.4, 0.44);
  isoEllipse(ctx, view, u.x - c * a.len * 0.26, u.y - s * a.len * 0.26, 0.15, 0.15, p.dark, 0.42);
}

/** Visible road wheels, drive sprocket and idler along the track run. */
function roadwheels(ctx, view, u, p, len, wid, n) {
  const c = Math.cos(u.facing), sn = Math.sin(u.facing);
  isoQuad(ctx, view, u.x, u.y, len * 1.02, wid * 1.14, u.facing, 'rgba(22,20,18,0.9)');
  for (const side of [-1, 1]) {
    for (let i = 0; i < n; i++) {
      const t = (i / (n - 1) - 0.5) * 2 * len * 0.78;
      const wx = u.x + t * c - side * wid * 1.02 * sn;
      const wy = u.y + t * sn + side * wid * 1.02 * c;
      const big = i === 0 || i === n - 1;             // sprocket and idler sit higher
      isoEllipse(ctx, view, wx, wy, big ? 0.15 : 0.12, big ? 0.15 : 0.12, big ? '#3a3630' : '#2b2824', 0.04);
    }
  }
}

/** A whip aerial, the thing that most says "this vehicle has a radio in it". */
function aerial(ctx, view, u, p, ox, oy, h, sway) {
  const t = sway || 0;
  isoLine(ctx, view, u.x + ox, u.y + oy, h, u.x + ox + t, u.y + oy + t, h + 0.85,
    'rgba(40,38,34,0.85)', Math.max(0.7, 0.9 * view.zoom));
}

/** Engine-deck louvres across the rear of the hull. */
function deckGrille(ctx, view, u, p, len, wid, h) {
  const c = Math.cos(u.facing), sn = Math.sin(u.facing);
  for (let i = -1; i <= 1; i++) {
    isoQuad(ctx, view, u.x - c * len * 0.62 - sn * i * wid * 0.26,
      u.y - sn * len * 0.62 + c * i * wid * 0.26,
      len * 0.1, wid * 0.1, u.facing, 'rgba(30,28,25,0.55)', h + 0.002);
  }
}

// ---------------------------------------------------------- 1990s bodies
// Cold-war armour reads differently from a modern vehicle: welded slab turrets
// rather than faceted wedges, stowage racks and side skirts rather than applique
// blocks, dish radars rather than flat panels, and boxed launchers rather than
// exposed rails. These are drawn as their own silhouettes, not recoloured ones.

function skirts(ctx, view, u, p, a) {
  const fc = Math.cos(u.facing), fs = Math.sin(u.facing);
  for (const side of [-1, 1]) {
    isoQuad(ctx, view, u.x - fs * side * a.wid * 0.94, u.y + fc * side * a.wid * 0.94,
      a.len * 0.9, 0.06, u.facing, p.dark, 0.19);
  }
}

function stowage(ctx, view, u, p, a, back) {
  const c = Math.cos(u.turret), s = Math.sin(u.turret);
  isoBox(ctx, view, u.x - c * a.len * back, u.y - s * a.len * back,
    a.len * 0.18, a.wid * 0.5, 0.17, u.turret, boxCols(p, '#55564c'), 0.31);
}

function drawTank90(ctx, view, u, p, a) {
  const c = Math.cos(u.turret), s = Math.sin(u.turret);
  shadow(ctx, view, u.x, u.y, a.len * 1.3, a.wid * 2.0);
  roadwheels(ctx, view, u, p, a.len, a.wid * 0.86, 7);
  skirts(ctx, view, u, p, a);
  hullPlate(ctx, view, u, p, a.len * 0.94, a.wid * 0.88, 0.30);
  teamStripe(ctx, view, u, p, a.len * 0.94, a.wid * 0.88, 0.30);
  // squat welded turret, wider than it is long
  isoBox(ctx, view, u.x, u.y, a.len * 0.40, a.wid * 0.62, 0.26, u.turret, boxCols(p), 0.30);
  stowage(ctx, view, u, p, a, 0.50);
  // gun with a thermal sleeve over the inner half and a fume extractor
  barrel(ctx, view, u, p, a.len * 0.38, a.len * 1.12, 1.8, 0.48);
  isoLine(ctx, view, u.x + c * a.len * 0.46, u.y + s * a.len * 0.46, 0.48,
    u.x + c * a.len * 0.86, u.y + s * a.len * 0.86, 0.48, '#3c3a34', Math.max(1.3, 2.9 * view.zoom));
  isoEllipse(ctx, view, u.x + c * a.len * 1.0, u.y + s * a.len * 1.0, 0.09, 0.09, '#2a2823', 0.48);
  // commander's cupola, offset, with a pintle machine gun
  const ox = -s * 0.2, oy = c * 0.2;
  isoBox(ctx, view, u.x + ox, u.y + oy, 0.15, 0.15, 0.13, u.turret, boxCols(p), 0.56);
  isoLine(ctx, view, u.x + ox, u.y + oy, 0.70, u.x + ox + c * 0.34, u.y + oy + s * 0.34, 0.70,
    '#2f2c27', Math.max(1, 1.2 * view.zoom));
  deckGrille(ctx, view, u, p, a.len, a.wid, 0.30);
  aerial(ctx, view, u, p, -s * 0.30, c * 0.30, 0.52, 0.10);
  aerial(ctx, view, u, p, s * 0.26, -c * 0.26, 0.52, -0.07);
}

function drawIFV90(ctx, view, u, p, a) {
  const c = Math.cos(u.turret), s = Math.sin(u.turret);
  shadow(ctx, view, u.x, u.y, a.len * 1.2, a.wid * 1.85);
  roadwheels(ctx, view, u, p, a.len, a.wid * 0.84, 6);
  skirts(ctx, view, u, p, a);
  // tall sloped hull
  hullPlate(ctx, view, u, p, a.len * 0.9, a.wid * 0.84, 0.40);
  teamStripe(ctx, view, u, p, a.len * 0.9, a.wid * 0.84, 0.40);
  // small one-man turret set forward
  isoBox(ctx, view, u.x + Math.cos(u.facing) * a.len * 0.12, u.y + Math.sin(u.facing) * a.len * 0.12,
    a.len * 0.24, a.wid * 0.38, 0.20, u.turret, boxCols(p), 0.40);
  barrel(ctx, view, u, p, a.len * 0.26, a.len * 0.74, 1.0, 0.54);
  // twin ATGM tubes bolted to the turret flank
  const mx = c * 0.1 - s * 0.24, my = s * 0.1 + c * 0.24;
  isoBox(ctx, view, u.x + mx, u.y + my, 0.15, 0.09, 0.12, u.turret, boxCols(p, '#4a4b42'), 0.52);
  isoBox(ctx, view, u.x + mx, u.y + my, 0.15, 0.09, 0.10, u.turret, boxCols(p, '#3f4038'), 0.64);
  deckGrille(ctx, view, u, p, a.len, a.wid, 0.40);
  aerial(ctx, view, u, p, -Math.sin(u.facing) * 0.28, Math.cos(u.facing) * 0.28, 0.60, 0.09);
}

function drawAPC90(ctx, view, u, p, a) {
  shadow(ctx, view, u.x, u.y, a.len * 1.2, a.wid * 1.8);
  if (a.tracks) tracks(ctx, view, u, p, a.len, a.wid);
  else wheels(ctx, view, u, p, a.len, a.wid * 0.92, 4);
  // tall boxy troop compartment with a sloped glacis
  hullPlate(ctx, view, u, p, a.len * 0.86, a.wid * 0.82, 0.44);
  teamStripe(ctx, view, u, p, a.len * 0.86, a.wid * 0.82, 0.44);
  isoQuad(ctx, view, u.x + Math.cos(u.facing) * a.len * 0.5, u.y + Math.sin(u.facing) * a.len * 0.5,
    a.len * 0.2, a.wid * 0.78, u.facing, p.top, 0.30);
  // open cupola with a pintle gun
  isoBox(ctx, view, u.x, u.y, 0.15, 0.15, 0.12, u.turret, boxCols(p), 0.44);
  const c = Math.cos(u.turret), s = Math.sin(u.turret);
  isoLine(ctx, view, u.x, u.y, 0.58, u.x + c * 0.38, u.y + s * 0.38, 0.58, '#2f2c27', Math.max(1, 1.2 * view.zoom));
}

function drawSPG90(ctx, view, u, p, a) {
  const c = Math.cos(u.turret), s = Math.sin(u.turret);
  shadow(ctx, view, u.x, u.y, a.len * 1.3, a.wid * 1.95);
  roadwheels(ctx, view, u, p, a.len, a.wid * 0.84, 7);
  hullPlate(ctx, view, u, p, a.len * 0.88, a.wid * 0.86, 0.30);
  teamStripe(ctx, view, u, p, a.len * 0.88, a.wid * 0.86, 0.30);
  // enormous slab-sided turret that overhangs the hull at the back
  isoBox(ctx, view, u.x - c * a.len * 0.14, u.y - s * a.len * 0.14,
    a.len * 0.54, a.wid * 0.66, 0.40, u.turret, boxCols(p), 0.30);
  // long howitzer with a bore evacuator and a muzzle brake
  barrel(ctx, view, u, p, a.len * 0.46, a.len * 1.5, 2.1, 0.62);
  isoEllipse(ctx, view, u.x + c * a.len * 0.95, u.y + s * a.len * 0.95, 0.12, 0.12, '#3a3730', 0.62);
  isoBox(ctx, view, u.x + c * a.len * 1.6, u.y + s * a.len * 1.6, 0.1, 0.13, 0.13, u.turret,
    boxCols(p, '#3f3c35'), 0.56);
  // spade folded on the rear plate
  isoQuad(ctx, view, u.x - c * a.len * 0.72, u.y - s * a.len * 0.72, 0.1, a.wid * 0.5, u.turret, p.dark, 0.24);
  aerial(ctx, view, u, p, -s * 0.34, c * 0.34, 0.70, 0.11);
}

function drawMLRS90(ctx, view, u, p, a) {
  const c = Math.cos(u.turret), s = Math.sin(u.turret);
  shadow(ctx, view, u.x, u.y, a.len * 1.3, a.wid * 1.95);
  if (a.tracks) tracks(ctx, view, u, p, a.len, a.wid); else wheels(ctx, view, u, p, a.len, a.wid * 0.9, 3);
  hullPlate(ctx, view, u, p, a.len * 0.9, a.wid * 0.84, 0.34);
  teamStripe(ctx, view, u, p, a.len * 0.9, a.wid * 0.84, 0.34);
  // armoured cab forward
  isoBox(ctx, view, u.x + Math.cos(u.facing) * a.len * 0.56, u.y + Math.sin(u.facing) * a.len * 0.56,
    a.len * 0.24, a.wid * 0.7, 0.34, u.facing, boxCols(p), 0.34);
  // a boxed launcher, elevated — not exposed rails
  deckGrille(ctx, view, u, p, a.len, a.wid, 0.34);
  const px = u.x - c * a.len * 0.22, py = u.y - s * a.len * 0.22;
  isoBox(ctx, view, px, py, a.len * 0.42, a.wid * 0.6, 0.40, u.turret, boxCols(p, '#4a4b42'), 0.36);
  // the two pods of tubes in the box face
  for (const side of [-1, 1]) {
    isoQuad(ctx, view, px + c * a.len * 0.34 - s * side * a.wid * 0.26,
      py + s * a.len * 0.34 + c * side * a.wid * 0.26, 0.06, a.wid * 0.22, u.turret, '#2f2d28', 0.60);
  }
}

function drawAA90(ctx, view, u, p, a) {
  const c = Math.cos(u.turret), s = Math.sin(u.turret);
  shadow(ctx, view, u.x, u.y, a.len * 1.25, a.wid * 1.9);
  if (a.tracks) tracks(ctx, view, u, p, a.len, a.wid); else wheels(ctx, view, u, p, a.len, a.wid * 0.9, 3);
  hullPlate(ctx, view, u, p, a.len * 0.88, a.wid * 0.86, 0.32);
  teamStripe(ctx, view, u, p, a.len * 0.88, a.wid * 0.86, 0.32);
  isoBox(ctx, view, u.x, u.y, a.len * 0.36, a.wid * 0.56, 0.26, u.turret, boxCols(p), 0.32);
  // twin missile boxes either side of the turret
  for (const side of [-1, 1]) {
    isoBox(ctx, view, u.x - s * side * a.wid * 0.5, u.y + c * side * a.wid * 0.5,
      a.len * 0.22, 0.09, 0.16, u.turret, boxCols(p, '#4a4b42'), 0.50);
  }
  // rotating dish search radar on a mast behind the turret — the period giveaway
  const rx = u.x - c * a.len * 0.34, ry = u.y - s * a.len * 0.34;
  isoLine(ctx, view, rx, ry, 0.56, rx, ry, 0.96, '#4c4740', Math.max(1, 1.4 * view.zoom));
  isoQuad(ctx, view, rx, ry, 0.30, 0.05, u.turret + 1.2, '#8c8578', 0.98);
  isoQuad(ctx, view, rx, ry, 0.10, 0.10, u.turret + 1.2, p.dark, 1.0);
  aerial(ctx, view, u, p, -s * 0.30, c * 0.30, 0.50, 0.08);
}

function drawAPC(ctx, view, u, p, a) {
  shadow(ctx, view, u.x, u.y, a.len * 1.2, a.wid * 1.8);
  wheels(ctx, view, u, p, a.len, a.wid * 0.92, 4);
  hullPlate(ctx, view, u, p, a.len * 0.88, a.wid * 0.84, 0.38);
  teamStripe(ctx, view, u, p, a.len * 0.88, a.wid * 0.84, 0.38);
  isoBox(ctx, view, u.x, u.y, a.len * 0.18, a.wid * 0.32, 0.14, u.turret, boxCols(p), 0.38);
  barrel(ctx, view, u, p, a.len * 0.18, a.len * 0.38, 0.9, 0.5);
  isoQuad(ctx, view, u.x + Math.cos(u.facing) * a.len * 0.6, u.y + Math.sin(u.facing) * a.len * 0.6, 0.08, a.wid * 0.6, u.facing, p.glass, 0.36);
}

function drawScout(ctx, view, u, p, a) {
  shadow(ctx, view, u.x, u.y, a.len * 1.1, a.wid * 1.7);
  wheels(ctx, view, u, p, a.len, a.wid * 0.9, 2);
  hullPlate(ctx, view, u, p, a.len * 0.85, a.wid * 0.8, 0.3);
  teamStripe(ctx, view, u, p, a.len * 0.85, a.wid * 0.8, 0.3);
  isoBox(ctx, view, u.x, u.y, a.len * 0.16, a.wid * 0.28, 0.13, u.turret, boxCols(p), 0.3);
  barrel(ctx, view, u, p, a.len * 0.16, a.len * 0.34, 0.8, 0.4);
  // mast-mounted optics
  isoLine(ctx, view, u.x, u.y, 0.3, u.x, u.y, 0.68, '#33302a', Math.max(0.8, view.zoom));
  isoEllipse(ctx, view, u.x, u.y, 0.08, 0.08, p.teamLight, 0.70);
}

function drawSPG(ctx, view, u, p, a) {
  shadow(ctx, view, u.x, u.y, a.len * 1.25, a.wid * 1.9);
  tracks(ctx, view, u, p, a.len, a.wid);
  hullPlate(ctx, view, u, p, a.len * 0.9, a.wid * 0.88, 0.32);
  teamStripe(ctx, view, u, p, a.len * 0.9, a.wid * 0.88, 0.32);
  isoBox(ctx, view, u.x - Math.cos(u.turret) * 0.1, u.y - Math.sin(u.turret) * 0.1, a.len * 0.48, a.wid * 0.64, 0.34, u.turret, boxCols(p), 0.32);
  // long howitzer with a fume extractor
  barrel(ctx, view, u, p, a.len * 0.44, a.len * 1.45, 2.0, 0.62);
  const c = Math.cos(u.turret), s = Math.sin(u.turret);
  isoEllipse(ctx, view, u.x + c * a.len * 0.85, u.y + s * a.len * 0.85, 0.13, 0.13, p.dark, 0.4);
}

function drawMLRS(ctx, view, u, p, a) {
  shadow(ctx, view, u.x, u.y, a.len * 1.25, a.wid * 1.9);
  if (a.tracks) tracks(ctx, view, u, p, a.len, a.wid); else wheels(ctx, view, u, p, a.len, a.wid * 0.9, a.wheels ? a.wheels / 2 : 3);
  hullPlate(ctx, view, u, p, a.len * 0.9, a.wid * 0.86, 0.34);
  teamStripe(ctx, view, u, p, a.len * 0.9, a.wid * 0.86, 0.34);
  // cab
  isoBox(ctx, view, u.x + Math.cos(u.facing) * a.len * 0.55, u.y + Math.sin(u.facing) * a.len * 0.55, a.len * 0.26, a.wid * 0.72, 0.3, u.facing, boxCols(p), 0.34);
  // elevated launcher pod
  const px = u.x - Math.cos(u.turret) * a.len * 0.2, py = u.y - Math.sin(u.turret) * a.len * 0.2;
  isoBox(ctx, view, px, py, a.len * 0.44, a.wid * 0.64, 0.38, u.turret, boxCols(p, '#4a4b42'), 0.34);
  const c = Math.cos(u.turret), s = Math.sin(u.turret);
  for (let i = -1; i <= 1; i++) {
    const ox = -s * i * a.wid * 0.32, oy = c * i * a.wid * 0.32;
    isoLine(ctx, view, px + ox - c * 0.2, py + oy - s * 0.2, 0.70,
      px + ox + c * 0.42, py + oy + s * 0.42, 0.90, '#3a3730', Math.max(1, 1.6 * view.zoom));
  }
}

function drawAA(ctx, view, u, p, a) {
  shadow(ctx, view, u.x, u.y, a.len * 1.2, a.wid * 1.85);
  if (a.tracks) tracks(ctx, view, u, p, a.len, a.wid); else wheels(ctx, view, u, p, a.len, a.wid * 0.9, 3);
  hullPlate(ctx, view, u, p, a.len * 0.88, a.wid * 0.86, 0.34);
  teamStripe(ctx, view, u, p, a.len * 0.88, a.wid * 0.86, 0.34);
  isoBox(ctx, view, u.x, u.y, a.len * 0.36, a.wid * 0.58, 0.26, u.turret, boxCols(p), 0.34);
  const c = Math.cos(u.turret), s = Math.sin(u.turret);
  for (const side of [-1, 1]) {
    isoBox(ctx, view, u.x - s * side * a.wid * 0.36, u.y + c * side * a.wid * 0.36, 0.1, 0.06, 0.2, u.turret, boxCols(p, '#55564c'), 0.60);
  }
  // search radar dish
  isoLine(ctx, view, u.x - c * 0.2, u.y - s * 0.2, 0.60, u.x - c * 0.2, u.y - s * 0.2, 0.86, '#33302a', Math.max(0.8, view.zoom));
  isoQuad(ctx, view, u.x - c * 0.2, u.y - s * 0.2, 0.2, 0.05, u.turret + 1.57, p.teamLight, 0.86);
}

function drawEngV(ctx, view, u, p, a) {
  shadow(ctx, view, u.x, u.y, a.len * 1.2, a.wid * 1.85);
  tracks(ctx, view, u, p, a.len, a.wid);
  hullPlate(ctx, view, u, p, a.len * 0.9, a.wid * 0.88, 0.34);
  teamStripe(ctx, view, u, p, a.len * 0.9, a.wid * 0.88, 0.34);
  isoBox(ctx, view, u.x - Math.cos(u.facing) * 0.15, u.y - Math.sin(u.facing) * 0.15, a.len * 0.28, a.wid * 0.52, 0.26, u.facing, boxCols(p), 0.34);
  // dozer blade and crane jib
  isoQuad(ctx, view, u.x + Math.cos(u.facing) * a.len * 0.82, u.y + Math.sin(u.facing) * a.len * 0.82, 0.08, a.wid * 0.95, u.facing, '#6a6152', 0.04);
  const c = Math.cos(u.turret), s = Math.sin(u.turret);
  isoLine(ctx, view, u.x, u.y, 0.60, u.x + c * 0.75, u.y + s * 0.75, 0.90, '#d8b24a', Math.max(1, 1.5 * view.zoom));
}

// ------------------------------------------------------------------- naval
function wake(ctx, view, u, len, time) {
  if (!u.moving) return;
  const c = Math.cos(u.facing), s = Math.sin(u.facing);
  for (let i = 1; i <= 3; i++) {
    const t = i * 0.5;
    isoEllipse(ctx, view, u.x - c * (len + t), u.y - s * (len + t),
      0.5 + i * 0.18, 0.5 + i * 0.18, 'rgba(220,240,255,' + (0.16 / i) + ')');
  }
}

function hullShip(ctx, view, u, p, len, wid, h) {
  const c = Math.cos(u.facing), s = Math.sin(u.facing);
  // Tapered bow: two boxes rather than one, so the silhouette reads as a ship.
  isoBox(ctx, view, u.x - c * len * 0.15, u.y - s * len * 0.15, len * 0.75, wid, h, u.facing, boxCols(p));
  isoBox(ctx, view, u.x + c * len * 0.72, u.y + s * len * 0.72, len * 0.3, wid * 0.5, h * 0.9, u.facing, boxCols(p));
}

function drawBoat(ctx, view, u, p, a, time) {
  wake(ctx, view, u, a.len * 0.6, time);
  shadow(ctx, view, u.x, u.y, a.len * 1.1, a.wid * 2.2);
  hullShip(ctx, view, u, p, a.len * 0.5, a.wid * 0.5, 0.18);
  isoBox(ctx, view, u.x, u.y, a.len * 0.16, a.wid * 0.34, 0.2, u.facing, boxCols(p), 0.18);
  teamStripe(ctx, view, u, p, a.len * 0.5, a.wid * 0.5, 0.18);
  barrel(ctx, view, u, p, a.len * 0.32, a.len * 0.3, 1.1, 0.34);
}

function drawLanding(ctx, view, u, p, a, time) {
  wake(ctx, view, u, a.len * 0.6, time);
  shadow(ctx, view, u.x, u.y, a.len * 1.15, a.wid * 2.3);
  isoBox(ctx, view, u.x, u.y, a.len * 0.52, a.wid * 0.56, 0.2, u.facing, boxCols(p));
  // open well deck
  isoQuad(ctx, view, u.x - Math.cos(u.facing) * 0.1, u.y - Math.sin(u.facing) * 0.1, a.len * 0.34, a.wid * 0.38, u.facing, p.dark, 0.205);
  isoBox(ctx, view, u.x - Math.cos(u.facing) * a.len * 0.44, u.y - Math.sin(u.facing) * a.len * 0.44, a.len * 0.1, a.wid * 0.4, 0.28, u.facing, boxCols(p), 0.2);
  teamStripe(ctx, view, u, p, a.len * 0.52, a.wid * 0.56, 0.2);
  if (u.cargo && u.cargo.length) {
    ctx.fillStyle = p.teamLight;
    const X = sx(view, u.x, u.y), Y = sy(view, u.x, u.y, 0.55);
    ctx.font = (7 * view.zoom).toFixed(0) + 'px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText(String(u.cargo.length), X, Y);
  }
}

function drawShip(ctx, view, u, p, a, time) {
  wake(ctx, view, u, a.len * 0.62, time);
  shadow(ctx, view, u.x, u.y, a.len * 1.1, a.wid * 2.4);
  hullShip(ctx, view, u, p, a.len * 0.5, a.wid * 0.52, 0.2);
  const c = Math.cos(u.facing), s = Math.sin(u.facing);
  // superstructure
  isoBox(ctx, view, u.x - c * a.len * 0.05, u.y - s * a.len * 0.05, a.len * 0.16, a.wid * 0.34, 0.34, u.facing, boxCols(p), 0.2);
  isoBox(ctx, view, u.x - c * a.len * 0.05, u.y - s * a.len * 0.05, a.len * 0.07, a.wid * 0.2, 0.22, u.facing, boxCols(p), 0.54);
  isoLine(ctx, view, u.x - c * a.len * 0.05, u.y - s * a.len * 0.05, 0.76, u.x - c * a.len * 0.05, u.y - s * a.len * 0.05, 1.15, '#43403a', Math.max(0.8, view.zoom));
  teamStripe(ctx, view, u, p, a.len * 0.5, a.wid * 0.52, 0.2);
  if (a.turret === 'vls') {
    // vertical launch cells forward
    for (let i = -1; i <= 1; i++) {
      isoQuad(ctx, view, u.x + c * (a.len * 0.42 + i * 0.14) - s * 0, u.y + s * (a.len * 0.42 + i * 0.14), 0.06, a.wid * 0.3, u.facing, '#2c2a26', 0.21);
    }
    isoBox(ctx, view, u.x + c * a.len * 0.66, u.y + s * a.len * 0.66, 0.16, 0.14, 0.14, u.turret, boxCols(p), 0.2);
    barrel(ctx, view, u, p, a.len * 0.66, 0.42, 1.4, 0.3);
  } else if (a.turret === 'howitzer') {
    isoBox(ctx, view, u.x + c * a.len * 0.5, u.y + s * a.len * 0.5, 0.2, 0.18, 0.18, u.turret, boxCols(p), 0.2);
    barrel(ctx, view, u, p, a.len * 0.5, 0.8, 1.8, 0.34);
  } else {
    isoBox(ctx, view, u.x + c * a.len * 0.5, u.y + s * a.len * 0.5, 0.18, 0.16, 0.16, u.turret, boxCols(p), 0.2);
    barrel(ctx, view, u, p, a.len * 0.5, 0.55, 1.4, 0.32);
  }
}

// --------------------------------------------------------------- buildings
const ARCH = {
  atlantic: { wall: '#8d9299', roof: '#4e5a66', trim: '#c3ccd6', angle: 0.0, mast: true },
  eurasian: { wall: '#8b8468', roof: '#5a5540', trim: '#c9b98a', angle: 0.0, mast: false },
  pacific:  { wall: '#87938c', roof: '#41544c', trim: '#c6dbd2', angle: 0.0, mast: false },
  meridian: { wall: '#a9977a', roof: '#6d5a44', trim: '#e2cfa8', angle: 0.0, mast: true },
};

export function drawBuilding(ctx, view, b, colour, time, archKey) {
  const p = pal(colour);
  const arch = ARCH[archKey] || ARCH.atlantic;
  const s = b.size;
  const half = s * 0.5 - 0.12;
  const cx = b.x, cy = b.y;
  const built = b.state === 'active' ? 1 : Math.max(0.08, b.progress);

  isoQuad(ctx, view, cx, cy, half + 0.16, half + 0.16, 0, 'rgba(0,0,0,0.22)');
  isoQuad(ctx, view, cx, cy, half + 0.1, half + 0.1, 0, '#6f6a61');

  const wallCols = { top: shadeHex(arch.roof, 0.05), side: arch.wall, dark: shadeHex(arch.wall, -0.3), line: 'rgba(0,0,0,0.32)' };
  const h = buildingHeight(b.key) * built;

  switch (b.key) {
    case 'hq': {
      isoBox(ctx, view, cx, cy, half, half, h * 0.55, 0, wallCols);
      isoBox(ctx, view, cx, cy, half * 0.62, half * 0.62, h * 0.5, 0, { top: shadeHex(arch.roof, 0.12), side: shadeHex(arch.wall, -0.08), dark: shadeHex(arch.wall, -0.36), line: wallCols.line }, h * 0.55);
      // command mast with a slowly rotating surveillance dish, plus the coalition flag
      const mx = cx + half * 0.55, my = cy - half * 0.55;
      isoLine(ctx, view, mx, my, h * 1.05, mx, my, h * 1.42, '#3c3a34', Math.max(1, 1.6 * view.zoom));
      isoQuad(ctx, view, mx, my, 0.22, 0.05, time * 0.5, '#9aa4ae', h * 1.42);
      isoQuad(ctx, view, mx, my, 0.05, 0.22, time * 0.5, '#9aa4ae', h * 1.44);
      isoBox(ctx, view, cx, cy, half * 0.24, half * 0.24, 0.16, 0, { top: shadeHex(arch.roof, 0.3), side: arch.wall, dark: shadeHex(arch.wall, -0.35), line: wallCols.line }, h * 1.05);
      isoQuad(ctx, view, cx, cy, half * 0.62, half * 0.12, 0, p.team, h * 1.05 + 0.01);
      drawFlag(ctx, view, cx - half * 0.62, cy + half * 0.62, h * 0.55, h * 1.1, p, time);
      break;
    }
    case 'power': {
      isoBox(ctx, view, cx, cy, half, half * 0.8, h * 0.7, 0, wallCols);
      for (const off of [-0.42, 0.42]) {
        isoBox(ctx, view, cx + off * s * 0.5, cy - s * 0.22, 0.2, 0.2, h * 1.25, 0, { top: '#8f8a80', side: '#787269', dark: '#575249', line: wallCols.line });
      }
      isoQuad(ctx, view, cx, cy, half * 0.7, half * 0.12, 0, p.team, h * 0.7 + 0.01);
      break;
    }
    case 'barracks': {
      isoBox(ctx, view, cx, cy, half, half * 0.72, h * 0.62, 0, wallCols);
      isoQuad(ctx, view, cx, cy + s * 0.3, half * 0.9, half * 0.2, 0, '#5c5750', 0.02);
      isoQuad(ctx, view, cx, cy, half * 0.8, half * 0.1, 0, p.team, h * 0.62 + 0.01);
      break;
    }
    case 'factory': case 'artillery': {
      isoBox(ctx, view, cx, cy, half, half, h * 0.62, 0, wallCols);
      // sawtooth industrial roof
      for (let i = -1; i <= 1; i++) {
        isoBox(ctx, view, cx + i * s * 0.28, cy, s * 0.11, half * 0.94, h * 0.2, 0, { top: shadeHex(arch.roof, 0.18), side: shadeHex(arch.roof, -0.1), dark: shadeHex(arch.roof, -0.35), line: wallCols.line }, h * 0.62);
      }
      isoQuad(ctx, view, cx, cy + s * 0.36, half * 0.5, half * 0.1, 0, p.team, h * 0.62 + 0.01);
      if (b.key === 'artillery') {
        isoBox(ctx, view, cx - s * 0.3, cy + s * 0.3, 0.24, 0.24, h * 0.9, 0, { top: '#9a8f5f', side: '#867c50', dark: '#645c3a', line: wallCols.line });
      }
      break;
    }
    case 'repair': {
      isoBox(ctx, view, cx, cy, half, half * 0.7, h * 0.42, 0, wallCols);
      isoQuad(ctx, view, cx, cy, half * 0.95, half * 0.95, 0, '#5a554d', 0.02);
      // gantry
      isoLine(ctx, view, cx - half, cy - half * 0.6, h * 0.6, cx + half, cy - half * 0.6, h * 0.6, '#d8b24a', Math.max(1, 1.6 * view.zoom));
      isoLine(ctx, view, cx - half, cy + half * 0.6, h * 0.6, cx + half, cy + half * 0.6, h * 0.6, '#d8b24a', Math.max(1, 1.6 * view.zoom));
      isoQuad(ctx, view, cx, cy, half * 0.4, half * 0.4, 0, p.team, 0.03);
      break;
    }
    case 'radar': {
      isoBox(ctx, view, cx, cy, half * 0.72, half * 0.72, h * 0.5, 0, wallCols);
      const spin = time * 0.9;
      isoLine(ctx, view, cx, cy, h * 0.5, cx, cy, h * 0.95, '#43403a', Math.max(1, 1.5 * view.zoom));
      isoQuad(ctx, view, cx, cy, 0.62, 0.1, spin, b.online ? p.teamLight : '#6b6b6b', h * 0.98);
      break;
    }
    case 'data': {
      isoBox(ctx, view, cx, cy, half, half * 0.8, h * 0.56, 0, wallCols);
      // cooling stacks and a link mast
      for (let i = -1; i <= 1; i++) {
        isoBox(ctx, view, cx + i * s * 0.26, cy + s * 0.24, 0.1, 0.1, h * 0.22, 0, { top: '#9aa3ad', side: '#7d858e', dark: '#5c636b', line: wallCols.line }, h * 0.56);
      }
      isoLine(ctx, view, cx, cy - s * 0.3, h * 0.56, cx, cy - s * 0.3, h * 1.2, '#43403a', Math.max(1, 1.4 * view.zoom));
      isoEllipse(ctx, view, cx, cy - s * 0.3, 0.18, 0.18, b.online ? '#6fe6c0' : '#7a3030', h * 1.22);
      isoQuad(ctx, view, cx, cy, half * 0.7, half * 0.1, 0, p.team, h * 0.56 + 0.01);
      break;
    }
    case 'awc': {
      isoBox(ctx, view, cx, cy, half, half, h * 0.4, 0, wallCols);
      isoBox(ctx, view, cx, cy, half * 0.55, half * 0.55, h * 0.72, 0, { top: shadeHex(arch.roof, 0.16), side: shadeHex(arch.wall, -0.12), dark: shadeHex(arch.wall, -0.4), line: wallCols.line }, h * 0.4);
      isoLine(ctx, view, cx - half * 0.7, cy + half * 0.7, h * 0.4, cx - half * 0.7, cy + half * 0.7, h * 1.35, '#43403a', Math.max(1, 1.5 * view.zoom));
      isoEllipse(ctx, view, cx, cy, 0.3, 0.3, b.online ? 'rgba(120,220,255,0.5)' : 'rgba(120,120,120,0.4)', h * 1.13);
      isoQuad(ctx, view, cx, cy, half * 0.5, half * 0.1, 0, p.team, h * 1.12 + 0.01);
      break;
    }
    case 'oiladmin': {
      isoBox(ctx, view, cx, cy, half * 0.85, half * 0.7, h * 0.5, 0, wallCols);
      for (const off of [-0.3, 0.3]) {
        isoEllipse(ctx, view, cx + off * s, cy + s * 0.28, 0.42, 0.42, '#5d5a52', h * 0.02);
        isoBox(ctx, view, cx + off * s, cy + s * 0.28, 0.3, 0.3, h * 0.34, 0, { top: '#a7a094', side: '#8b857a', dark: '#65605a', line: wallCols.line });
      }
      isoQuad(ctx, view, cx, cy, half * 0.6, half * 0.1, 0, p.team, h * 0.5 + 0.01);
      break;
    }
    case 'navalyard': {
      isoBox(ctx, view, cx, cy, half * 0.8, half * 0.55, h * 0.42, 0, wallCols);
      isoQuad(ctx, view, cx, cy + s * 0.4, half, half * 0.35, 0, '#66625a', 0.02);
      isoLine(ctx, view, cx - half * 0.7, cy - half * 0.2, h * 0.5, cx + half * 0.9, cy - half * 0.2, h * 0.85, '#c9a34e', Math.max(1, 1.8 * view.zoom));
      isoQuad(ctx, view, cx, cy, half * 0.5, half * 0.1, 0, p.team, h * 0.42 + 0.01);
      break;
    }
    // ---------------------------------------------------------- defences
    case 'mg': {
      isoBox(ctx, view, cx, cy, half * 0.7, half * 0.7, h * 0.42, 0, { top: '#6d6a5e', side: '#5c594f', dark: '#42403a', line: wallCols.line });
      isoBox(ctx, view, cx, cy, 0.16, 0.16, 0.14, b.turret, boxCols(p), h * 0.42);
      turretBarrel(ctx, view, b, 0.16, 0.4, 1.1, h * 0.42 + 0.14);
      break;
    }
    case 'atgun': {
      isoBox(ctx, view, cx, cy, half * 0.72, half * 0.72, h * 0.36, 0, { top: '#6a6656', side: '#585448', dark: '#403d35', line: wallCols.line });
      isoBox(ctx, view, cx, cy, 0.22, 0.3, 0.18, b.turret, boxCols(p), h * 0.36);
      turretBarrel(ctx, view, b, 0.24, 0.5, 1.4, h * 0.36 + 0.2);
      break;
    }
    case 'coastal': {
      isoBox(ctx, view, cx, cy, half * 0.85, half * 0.85, h * 0.4, 0, { top: '#6f6b60', side: '#5d5952', dark: '#43403a', line: wallCols.line });
      isoBox(ctx, view, cx, cy, 0.34, 0.4, 0.26, b.turret, boxCols(p), h * 0.4);
      turretBarrel(ctx, view, b, 0.36, 0.95, 2.0, h * 0.4 + 0.28);
      break;
    }
    case 'sam': case 'patriot': case 's400': case 'hq9': case 'irondome': {
      const big = b.key !== 'sam' && b.key !== 'irondome';
      isoBox(ctx, view, cx, cy, half * 0.85, half * 0.75, h * 0.3, 0, { top: '#6b6759', side: '#59564c', dark: '#403e37', line: wallCols.line });
      // erected launch canisters, angled skyward
      const rows = b.key === 'irondome' ? 3 : 2;
      for (let i = 0; i < rows; i++) {
        const off = (i - (rows - 1) / 2) * 0.42;
        const ox = -Math.sin(b.turret) * off, oy = Math.cos(b.turret) * off;
        isoBox(ctx, view, cx + ox, cy + oy, big ? 0.26 : 0.2, 0.12, big ? 0.75 : 0.55, b.turret, boxCols(p, b.online ? '#585b4e' : '#4a4a4a'), h * 0.3);
      }
      // engagement radar
      isoLine(ctx, view, cx + half * 0.6, cy + half * 0.5, h * 0.3, cx + half * 0.6, cy + half * 0.5, h * 0.78, '#43403a', Math.max(0.8, view.zoom));
      isoQuad(ctx, view, cx + half * 0.6, cy + half * 0.5, 0.28, 0.06, b.online ? time * 1.2 : 0, b.online ? p.teamLight : '#6b6b6b', h * 0.8);
      break;
    }
    default: {
      isoBox(ctx, view, cx, cy, half, half * 0.8, h * 0.55, 0, wallCols);
      isoQuad(ctx, view, cx, cy, half * 0.6, half * 0.1, 0, p.team, h * 0.55 + 0.01);
    }
  }

  if (b.state !== 'active') drawScaffold(ctx, view, b, half, h);
}

function turretBarrel(ctx, view, b, from, length, thick, height) {
  const c = Math.cos(b.turret), s = Math.sin(b.turret);
  isoLine(ctx, view, b.x + c * from, b.y + s * from, height,
    b.x + c * (from + length), b.y + s * (from + length), height, '#2c2a25', Math.max(1, thick * view.zoom));
}

function drawScaffold(ctx, view, b, half, h) {
  ctx.strokeStyle = 'rgba(240,200,90,0.75)';
  ctx.lineWidth = Math.max(1, view.zoom);
  const pts = [[half, half], [half, -half], [-half, -half], [-half, half]];
  for (const [lx, ly] of pts) {
    isoLine(ctx, view, b.x + lx, b.y + ly, 0, b.x + lx, b.y + ly, h + 0.25, 'rgba(240,200,90,0.7)', Math.max(1, view.zoom));
  }
  isoQuad(ctx, view, b.x, b.y, half, half, 0, 'rgba(240,200,90,0.10)', h + 0.25);
}

function drawFlag(ctx, view, x, y, z0, z1, p, time) {
  isoLine(ctx, view, x, y, z0, x, y, z1, '#3c3a34', Math.max(0.8, view.zoom));
  const X = sx(view, x, y), Y = sy(view, x, y, z1);
  const w = 9 * view.zoom, hgt = 5.5 * view.zoom;
  ctx.fillStyle = p.team;
  ctx.beginPath();
  ctx.moveTo(X, Y);
  for (let i = 0; i <= 4; i++) {
    const t = i / 4;
    ctx.lineTo(X + w * t, Y + Math.sin(time * 4 + t * 3) * 1.2 * view.zoom + hgt * 0.05);
  }
  for (let i = 4; i >= 0; i--) {
    const t = i / 4;
    ctx.lineTo(X + w * t, Y + Math.sin(time * 4 + t * 3) * 1.2 * view.zoom + hgt);
  }
  ctx.closePath();
  ctx.fill();
}

export function buildingHeight(key) {
  return {
    hq: 2.0, power: 1.5, barracks: 1.05, factory: 1.55, artillery: 1.45, repair: 1.15,
    radar: 1.35, data: 1.35, awc: 1.8, oiladmin: 1.3, navalyard: 1.3,
    mg: 0.72, atgun: 0.8, sam: 1.15, coastal: 1.05, patriot: 1.25, s400: 1.3, hq9: 1.25, irondome: 1.15,
  }[key] || 1.15;
}

// ------------------------------------------------------- neutral structures
export function drawNeutral(ctx, view, n, colour, time) {
  const p = colour ? pal(colour) : null;
  const c = { top: '#9a9184', side: '#7d7568', dark: '#5a544b', line: 'rgba(0,0,0,0.3)' };
  isoQuad(ctx, view, n.x, n.y, n.radius + 0.2, n.radius + 0.2, 0, 'rgba(0,0,0,0.2)');
  if (n.type === 'derrick') {
    isoQuad(ctx, view, n.x, n.y, 0.9, 0.9, 0, '#6b6459');
    // lattice derrick tower
    for (const [ax, ay] of [[0.5, 0.5], [0.5, -0.5], [-0.5, -0.5], [-0.5, 0.5]]) {
      isoLine(ctx, view, n.x + ax * 0.7, n.y + ay * 0.7, 0, n.x, n.y, 1.7, '#585349', Math.max(0.8, view.zoom));
    }
    isoBox(ctx, view, n.x, n.y, 0.28, 0.28, 0.35, 0, c);
    const pump = Math.sin(time * 1.6) * 0.12;
    isoLine(ctx, view, n.x - 0.6, n.y, 0.4 + pump, n.x + 0.6, n.y, 0.55 - pump, '#4c4740', Math.max(1, 1.6 * view.zoom));
  } else if (n.type === 'refinery') {
    isoBox(ctx, view, n.x, n.y, 1.1, 0.9, 0.5, 0, c);
    for (const off of [-0.6, 0, 0.6]) {
      isoBox(ctx, view, n.x + off, n.y - 0.7, 0.16, 0.16, 1.5 + Math.abs(off), 0, { top: '#a49a8b', side: '#8a8073', dark: '#655d53', line: c.line });
    }
    isoEllipse(ctx, view, n.x + 0.8, n.y + 0.8, 0.7, 0.7, '#7f7768', 0.02);
    isoBox(ctx, view, n.x + 0.8, n.y + 0.8, 0.5, 0.5, 0.5, 0, { top: '#b0a695', side: '#948b7c', dark: '#6c645a', line: c.line });
  } else if (n.type === 'fieldrefinery') {
    // Small skid-mounted plant: one still, a squat tank and a flare.
    isoQuad(ctx, view, n.x, n.y, 1.1, 0.9, 0, '#736c5e');
    isoBox(ctx, view, n.x - 0.35, n.y + 0.1, 0.5, 0.45, 0.38, 0, c);
    isoBox(ctx, view, n.x + 0.15, n.y - 0.15, 0.18, 0.18, 1.15, 0,
      { top: '#a49a8b', side: '#8a8073', dark: '#655d53', line: c.line });
    isoEllipse(ctx, view, n.x + 0.65, n.y + 0.55, 0.42, 0.42, '#7f7768', 0.02);
    isoBox(ctx, view, n.x + 0.65, n.y + 0.55, 0.32, 0.32, 0.34, 0,
      { top: '#b0a695', side: '#948b7c', dark: '#6c645a', line: c.line });
    // the flare burns whether or not anyone owns it
    const flare = 0.55 + Math.sin(time * 5.5) * 0.18;
    isoLine(ctx, view, n.x + 0.15, n.y - 0.15, 1.15, n.x + 0.15, n.y - 0.15, 1.15 + flare * 0.4,
      'rgba(255,168,72,0.85)', Math.max(1.4, 2.4 * view.zoom));
  } else if (n.type === 'railyard') {
    // Marshalling yard: ballast, two sidings, goods wagons and a water tower.
    isoQuad(ctx, view, n.x, n.y, 1.5, 1.2, 0, '#6a6355');
    for (const off of [-0.45, 0.45]) {
      isoLine(ctx, view, n.x - 1.35, n.y + off, 0.02, n.x + 1.35, n.y + off, 0.02, '#4a4640', Math.max(1, 1.5 * view.zoom));
    }
    const wagons = [[-0.85, -0.45], [0.15, -0.45], [-0.35, 0.45], [0.75, 0.45]];
    const tint = ['#6e6a5c', '#7a6b57', '#66705f', '#7a7060'];
    wagons.forEach(([wx, wy], i) => {
      isoBox(ctx, view, n.x + wx, n.y + wy, 0.42, 0.2, 0.34, 0,
        { top: shadeHex(tint[i], 0.18), side: tint[i], dark: shadeHex(tint[i], -0.3), line: c.line }, 0.02);
    });
    // water tower over the shed
    isoBox(ctx, view, n.x + 1.0, n.y - 0.95, 0.45, 0.4, 0.5, 0, c);
    for (const [ax, ay] of [[0.28, 0.28], [0.28, -0.28], [-0.28, -0.28], [-0.28, 0.28]]) {
      isoLine(ctx, view, n.x - 1.0 + ax, n.y + 0.95 + ay, 0, n.x - 1.0 + ax * 0.4, n.y + 0.95 + ay * 0.4, 1.15, '#585349', Math.max(0.8, view.zoom));
    }
    isoEllipse(ctx, view, n.x - 1.0, n.y + 0.95, 0.42, 0.42, '#8b8275', 1.15);
    isoBox(ctx, view, n.x - 1.0, n.y + 0.95, 0.34, 0.34, 0.34, 0,
      { top: '#9b9284', side: '#7f7669', dark: '#5c554c', line: c.line }, 1.15);
  } else if (n.type === 'port') {
    isoQuad(ctx, view, n.x, n.y, 1.4, 1.1, 0, '#75705f');
    isoBox(ctx, view, n.x - 0.5, n.y, 0.5, 0.6, 0.5, 0, c);
    isoLine(ctx, view, n.x + 0.2, n.y - 0.6, 0, n.x + 0.2, n.y - 0.6, 1.6, '#5d5850', Math.max(1, 1.4 * view.zoom));
    isoLine(ctx, view, n.x + 0.2, n.y - 0.6, 1.6, n.x + 1.2, n.y - 0.6, 1.35, '#c9a34e', Math.max(1, 1.6 * view.zoom));
    for (let i = 0; i < 3; i++) isoBox(ctx, view, n.x + 0.6 + (i % 2) * 0.5, n.y + 0.7, 0.25, 0.22, 0.28, 0, { top: '#7f8f7a', side: '#68765f', dark: '#4c5745', line: c.line });
  } else {
    // strategic objective: a marked depot
    isoQuad(ctx, view, n.x, n.y, 1.0, 1.0, 0, '#6e6a5c');
    isoBox(ctx, view, n.x, n.y, 0.5, 0.5, 0.45, 0, c);
    const pulse = 0.5 + Math.sin(time * 3) * 0.3;
    isoQuad(ctx, view, n.x, n.y, 0.9, 0.9, Math.PI / 4, 'rgba(255,214,102,' + (pulse * 0.5).toFixed(2) + ')', 0.02);
  }
  if (p) {
    isoQuad(ctx, view, n.x, n.y, n.radius * 0.75, 0.12, 0, p.team, 0.03);
    isoQuad(ctx, view, n.x, n.y, 0.12, n.radius * 0.75, 0, p.team, 0.03);
  }
}

export { pal };
