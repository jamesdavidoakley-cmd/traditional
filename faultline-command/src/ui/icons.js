// Sidebar and panel icons: the same procedural artwork, framed in a small canvas.

import { drawUnit, drawBuilding, drawNeutral } from '../render/sprites.js';
import { makeView, syncView } from '../render/iso.js';
import { getUnit } from '../data/units.js';
import { getBuilding } from '../data/buildings.js';
import { TAU } from '../core/util.js';

const cache = new Map();

function frame(size) {
  const c = document.createElement('canvas');
  c.width = size; c.height = size;
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, size);
  g.addColorStop(0, '#151d26'); g.addColorStop(1, '#0d1218');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return { c, ctx };
}

function miniView(size, zoom, cx, cy) {
  const v = makeView(size, size);
  v.zoom = zoom; v.camX = cx; v.camY = cy;
  syncView(v);
  return v;
}

export function unitIcon(faction, era, key, colour, size = 42) {
  const id = 'u|' + faction + era + key + colour + size;
  if (cache.has(id)) return cache.get(id);
  const def = getUnit(faction, era, key);
  const { c, ctx } = frame(size);
  if (def) {
    const scale = def.class === 'naval' ? 0.42 : (def.class === 'infantry' ? 0.8 : 0.62);
    const v = miniView(size, (size / 64) * scale * 2.1, 64, 64);
    const stub = {
      x: 64, y: 64, def, key, facing: -0.72, turret: -0.72, moving: false, recoil: 0,
      hp: def.hp, hpMax: def.hp, cargo: [], owner: 0,
    };
    ctx.save();
    ctx.translate(0, size * 0.16);
    drawUnit(ctx, v, stub, colour, 0);
    ctx.restore();
  }
  cache.set(id, c);
  return c;
}

export function buildingIcon(key, faction, era, colour, arch, size = 42) {
  const id = 'b|' + key + faction + era + colour + arch + size;
  if (cache.has(id)) return cache.get(id);
  const def = getBuilding(key, faction, era);
  const { c, ctx } = frame(size);
  if (def) {
    const v = miniView(size, (size / 64) * (2.0 / Math.max(2, def.size)), 64, 64);
    const stub = {
      x: 64, y: 64, size: def.size, key, def, state: 'active', progress: 1,
      turret: -0.7, online: true, owner: 0, hp: def.hp, hpMax: def.hp,
    };
    ctx.save();
    ctx.translate(0, size * 0.2);
    drawBuilding(ctx, v, stub, colour, 0.4, arch);
    ctx.restore();
  }
  cache.set(id, c);
  return c;
}

export function neutralIcon(type, colour, size = 42) {
  const id = 'n|' + type + colour + size;
  if (cache.has(id)) return cache.get(id);
  const { c, ctx } = frame(size);
  const v = miniView(size, (size / 64) * 0.9, 64, 64);
  const stub = { x: 64, y: 64, type, radius: 1.4, owner: colour ? 0 : -1 };
  ctx.save();
  ctx.translate(0, size * 0.22);
  drawNeutral(ctx, v, stub, colour, 0.4);
  ctx.restore();
  cache.set(id, c);
  return c;
}

/** Strike-system icons: schematic rather than literal, so they read at 42px. */
export function abilityIcon(kind, colour, size = 42) {
  const id = 'a|' + kind + colour + size;
  if (cache.has(id)) return cache.get(id);
  const { c, ctx } = frame(size);
  const s = size;
  ctx.strokeStyle = colour; ctx.fillStyle = colour;
  ctx.lineWidth = Math.max(1.4, s * 0.05);
  ctx.lineJoin = 'round';
  ctx.save();
  ctx.translate(s / 2, s / 2);
  if (kind === 'jet') {
    ctx.beginPath();
    ctx.moveTo(0, -s * 0.34); ctx.lineTo(s * 0.10, -s * 0.05); ctx.lineTo(s * 0.34, s * 0.12);
    ctx.lineTo(s * 0.34, s * 0.2); ctx.lineTo(s * 0.09, s * 0.14); ctx.lineTo(s * 0.07, s * 0.3);
    ctx.lineTo(s * 0.16, s * 0.36); ctx.lineTo(0, s * 0.34);
    ctx.lineTo(-s * 0.16, s * 0.36); ctx.lineTo(-s * 0.07, s * 0.3); ctx.lineTo(-s * 0.09, s * 0.14);
    ctx.lineTo(-s * 0.34, s * 0.2); ctx.lineTo(-s * 0.34, s * 0.12); ctx.lineTo(-s * 0.10, -s * 0.05);
    ctx.closePath(); ctx.fill();
  } else if (kind === 'cruise') {
    ctx.beginPath();
    ctx.moveTo(-s * 0.36, s * 0.06); ctx.lineTo(s * 0.18, s * 0.06);
    ctx.lineTo(s * 0.36, 0); ctx.lineTo(s * 0.18, -s * 0.06); ctx.lineTo(-s * 0.36, -s * 0.06);
    ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-s * 0.06, -s * 0.06); ctx.lineTo(-s * 0.02, -s * 0.26); ctx.lineTo(s * 0.06, -s * 0.06);
    ctx.moveTo(-s * 0.06, s * 0.06); ctx.lineTo(-s * 0.02, s * 0.26); ctx.lineTo(s * 0.06, s * 0.06);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath(); ctx.moveTo(-s * 0.44, s * 0.22); ctx.lineTo(-s * 0.16, s * 0.1); ctx.stroke();
  } else if (kind === 'ballistic') {
    ctx.beginPath();
    ctx.moveTo(0, -s * 0.36); ctx.lineTo(s * 0.1, -s * 0.1); ctx.lineTo(s * 0.1, s * 0.22);
    ctx.lineTo(s * 0.22, s * 0.36); ctx.lineTo(-s * 0.22, s * 0.36); ctx.lineTo(-s * 0.1, s * 0.22);
    ctx.lineTo(-s * 0.1, -s * 0.1); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.beginPath(); ctx.arc(0, s * 0.5, s * 0.42, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke();
  } else if (kind === 'drone') {
    ctx.beginPath(); ctx.ellipse(0, 0, s * 0.1, s * 0.26, 0, 0, TAU); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-s * 0.4, -s * 0.02); ctx.lineTo(s * 0.4, -s * 0.02);
    ctx.lineTo(s * 0.34, s * 0.05); ctx.lineTo(-s * 0.34, s * 0.05); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath(); ctx.arc(0, 0, s * 0.42, 0, TAU); ctx.stroke();
  }
  ctx.restore();
  cache.set(id, c);
  return c;
}
