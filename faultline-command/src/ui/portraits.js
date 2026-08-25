// Original commander portraits and doctrine icons, drawn procedurally.

import { TAU, shadeHex } from '../core/util.js';

export function drawPortrait(canvas, cmd, size) {
  const ctx = canvas.getContext('2d');
  const S = size || canvas.width;
  canvas.width = S; canvas.height = S;
  const p = cmd.portrait;
  ctx.clearRect(0, 0, S, S);

  // backdrop
  const g = ctx.createLinearGradient(0, 0, 0, S);
  g.addColorStop(0, '#1b242e');
  g.addColorStop(1, '#0c1116');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  ctx.strokeStyle = 'rgba(255,255,255,0.05)';
  ctx.lineWidth = 1;
  for (let i = 1; i < 5; i++) {
    ctx.beginPath(); ctx.moveTo(0, S * i / 5); ctx.lineTo(S, S * i / 5); ctx.stroke();
  }
  // doctrine glow
  const rg = ctx.createRadialGradient(S * 0.5, S * 0.42, 0, S * 0.5, S * 0.42, S * 0.6);
  rg.addColorStop(0, hexA(cmd.accent, 0.22));
  rg.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = rg;
  ctx.fillRect(0, 0, S, S);

  const u = S / 100;   // portrait unit
  ctx.save();
  ctx.translate(S * 0.5, S * 0.06);

  // shoulders / tunic
  ctx.fillStyle = p.tunic;
  ctx.beginPath();
  ctx.moveTo(-42 * u, 96 * u);
  ctx.quadraticCurveTo(-40 * u, 66 * u, -17 * u, 60 * u);
  ctx.lineTo(17 * u, 60 * u);
  ctx.quadraticCurveTo(40 * u, 66 * u, 42 * u, 96 * u);
  ctx.closePath();
  ctx.fill();
  // collar + insignia bars
  ctx.fillStyle = shadeHex(p.tunic, -0.22);
  ctx.beginPath();
  ctx.moveTo(-17 * u, 60 * u); ctx.lineTo(0, 78 * u); ctx.lineTo(17 * u, 60 * u);
  ctx.lineTo(9 * u, 58 * u); ctx.lineTo(0, 68 * u); ctx.lineTo(-9 * u, 58 * u);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = p.insignia;
  for (let i = 0; i < 3; i++) ctx.fillRect(-38 * u, (70 + i * 5) * u, 12 * u, 2.6 * u);
  ctx.fillRect(26 * u, 70 * u, 12 * u, 7 * u);

  // neck
  ctx.fillStyle = shadeHex(p.skin, -0.16);
  ctx.fillRect(-9 * u, 48 * u, 18 * u, 16 * u);

  // head
  ctx.fillStyle = p.skin;
  ctx.beginPath();
  ctx.ellipse(0, 33 * u, 20 * u, 25 * u, 0, 0, TAU);
  ctx.fill();
  // jaw shading
  ctx.fillStyle = hexA(shadeHex(p.skin, -0.3), 0.35);
  ctx.beginPath();
  ctx.ellipse(0, 44 * u, 16 * u, 12 * u, 0, 0, TAU);
  ctx.fill();

  // eyes / brow
  ctx.fillStyle = '#1a1512';
  ctx.fillRect(-12 * u, 30 * u, 8 * u, 2.4 * u);
  ctx.fillRect(4 * u, 30 * u, 8 * u, 2.4 * u);
  ctx.fillStyle = 'rgba(20,16,12,0.55)';
  ctx.fillRect(-13 * u, 25 * u, 10 * u, 2 * u);
  ctx.fillRect(3 * u, 25 * u, 10 * u, 2 * u);
  // mouth
  ctx.strokeStyle = 'rgba(60,35,28,0.7)';
  ctx.lineWidth = 1.8 * u;
  ctx.beginPath(); ctx.moveTo(-6 * u, 45 * u); ctx.lineTo(6 * u, 45 * u); ctx.stroke();

  if (p.scar) {
    ctx.strokeStyle = hexA('#8a5a4a', 0.8);
    ctx.lineWidth = 1.6 * u;
    ctx.beginPath(); ctx.moveTo(11 * u, 21 * u); ctx.lineTo(15 * u, 40 * u); ctx.stroke();
  }
  if (p.visor) {
    ctx.fillStyle = hexA(cmd.accent, 0.4);
    ctx.fillRect(-19 * u, 26 * u, 38 * u, 8 * u);
    ctx.strokeStyle = hexA(cmd.accent, 0.9);
    ctx.lineWidth = 1.2 * u;
    ctx.strokeRect(-19 * u, 26 * u, 38 * u, 8 * u);
  }

  // hair
  if (p.cap === 'none') {
    ctx.fillStyle = p.hair;
    ctx.beginPath();
    ctx.ellipse(0, 20 * u, 20.5 * u, 14 * u, 0, Math.PI, TAU);
    ctx.fill();
  }
  drawHeadgear(ctx, u, p, cmd);
  ctx.restore();

  // frame + rank flash
  ctx.strokeStyle = hexA(cmd.accent, 0.45);
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, S - 2, S - 2);
  ctx.fillStyle = hexA(cmd.accent, 0.9);
  ctx.fillRect(0, 0, S * 0.16, 3);
  ctx.fillRect(S - S * 0.16, S - 3, S * 0.16, 3);
}

function drawHeadgear(ctx, u, p, cmd) {
  const cap = p.cap;
  if (cap === 'peaked' || cap === 'naval') {
    ctx.fillStyle = cap === 'naval' ? '#e8ecf1' : shadeHex(p.tunic, -0.1);
    ctx.beginPath();
    ctx.ellipse(0, 12 * u, 24 * u, 13 * u, 0, Math.PI, TAU);
    ctx.fill();
    ctx.fillRect(-24 * u, 11 * u, 48 * u, 5 * u);
    ctx.fillStyle = '#15181d';
    ctx.beginPath();
    ctx.ellipse(0, 17 * u, 26 * u, 5 * u, 0, 0, Math.PI);
    ctx.fill();
    ctx.fillStyle = p.insignia;
    ctx.beginPath();
    ctx.arc(0, 8 * u, 4.2 * u, 0, TAU);
    ctx.fill();
  } else if (cap === 'beret') {
    ctx.fillStyle = shadeHex(p.tunic, 0.05);
    ctx.beginPath();
    ctx.ellipse(2 * u, 12 * u, 25 * u, 12 * u, -0.18, Math.PI, TAU);
    ctx.fill();
    ctx.fillRect(-22 * u, 12 * u, 46 * u, 3.4 * u);
    ctx.fillStyle = p.insignia;
    ctx.beginPath(); ctx.arc(-13 * u, 8 * u, 3.6 * u, 0, TAU); ctx.fill();
  } else if (cap === 'garrison') {
    ctx.fillStyle = shadeHex(p.tunic, -0.05);
    ctx.beginPath();
    ctx.moveTo(-22 * u, 16 * u);
    ctx.quadraticCurveTo(0, -2 * u, 22 * u, 16 * u);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = p.insignia;
    ctx.fillRect(-3 * u, 6 * u, 6 * u, 6 * u);
  } else if (cap === 'flight') {
    ctx.fillStyle = '#2e3742';
    ctx.beginPath();
    ctx.ellipse(0, 16 * u, 23 * u, 20 * u, 0, Math.PI, TAU);
    ctx.fill();
    ctx.fillStyle = '#1c222a';
    ctx.fillRect(-23 * u, 14 * u, 46 * u, 4 * u);
    ctx.fillStyle = hexA(cmd.accent, 0.8);
    ctx.fillRect(-20 * u, 4 * u, 40 * u, 2.4 * u);
  } else if (cap === 'helmet') {
    ctx.fillStyle = '#4b5348';
    ctx.beginPath();
    ctx.ellipse(0, 18 * u, 24 * u, 22 * u, 0, Math.PI, TAU);
    ctx.fill();
  }
}

function hexA(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
}

/** Small doctrine glyph drawn into a canvas or an inline SVG-ish path. */
export function drawDoctrineIcon(ctx, icon, x, y, s, colour) {
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = colour; ctx.fillStyle = colour;
  ctx.lineWidth = Math.max(1, s * 0.13);
  ctx.lineJoin = 'round';
  switch (icon) {
    case 'shield':
      ctx.beginPath();
      ctx.moveTo(0, -s); ctx.lineTo(s * 0.8, -s * 0.55); ctx.lineTo(s * 0.8, s * 0.25);
      ctx.quadraticCurveTo(s * 0.8, s, 0, s); ctx.quadraticCurveTo(-s * 0.8, s, -s * 0.8, s * 0.25);
      ctx.lineTo(-s * 0.8, -s * 0.55); ctx.closePath(); ctx.stroke();
      break;
    case 'tank':
      ctx.strokeRect(-s * 0.85, -s * 0.1, s * 1.7, s * 0.6);
      ctx.strokeRect(-s * 0.4, -s * 0.55, s * 0.8, s * 0.45);
      ctx.beginPath(); ctx.moveTo(s * 0.1, -s * 0.33); ctx.lineTo(s * 1.0, -s * 0.33); ctx.stroke();
      break;
    case 'fang':
      ctx.beginPath();
      ctx.moveTo(-s * 0.8, -s * 0.7); ctx.lineTo(0, s); ctx.lineTo(s * 0.8, -s * 0.7);
      ctx.lineTo(s * 0.3, -s * 0.2); ctx.lineTo(0, -s * 0.7); ctx.lineTo(-s * 0.3, -s * 0.2);
      ctx.closePath(); ctx.stroke();
      break;
    case 'circuit':
      ctx.beginPath(); ctx.arc(0, 0, s * 0.32, 0, TAU); ctx.stroke();
      for (let i = 0; i < 4; i++) {
        const a = i * Math.PI / 2 + Math.PI / 4;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * s * 0.32, Math.sin(a) * s * 0.32);
        ctx.lineTo(Math.cos(a) * s * 0.95, Math.sin(a) * s * 0.95);
        ctx.stroke();
        ctx.beginPath(); ctx.arc(Math.cos(a) * s * 0.95, Math.sin(a) * s * 0.95, s * 0.13, 0, TAU); ctx.fill();
      }
      break;
    case 'wing':
      ctx.beginPath();
      ctx.moveTo(-s, s * 0.4); ctx.quadraticCurveTo(-s * 0.1, -s * 0.9, s, -s * 0.5);
      ctx.quadraticCurveTo(-s * 0.1, -s * 0.1, -s, s * 0.4);
      ctx.closePath(); ctx.stroke();
      break;
    case 'arc':
      ctx.beginPath(); ctx.arc(0, s * 0.6, s * 0.95, Math.PI, 0); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, s * 0.6); ctx.lineTo(s * 0.55, -s * 0.4); ctx.stroke();
      break;
    case 'cog':
      ctx.beginPath(); ctx.arc(0, 0, s * 0.42, 0, TAU); ctx.stroke();
      for (let i = 0; i < 8; i++) {
        const a = i * TAU / 8;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * s * 0.55, Math.sin(a) * s * 0.55);
        ctx.lineTo(Math.cos(a) * s * 0.95, Math.sin(a) * s * 0.95);
        ctx.stroke();
      }
      break;
    case 'anchor':
      ctx.beginPath(); ctx.moveTo(0, -s * 0.75); ctx.lineTo(0, s * 0.85); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-s * 0.45, -s * 0.35); ctx.lineTo(s * 0.45, -s * 0.35); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, -s * 0.75, s * 0.2, 0, TAU); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, s * 0.2, s * 0.72, 0.35, Math.PI - 0.35); ctx.stroke();
      break;
    default:
      ctx.beginPath();
      ctx.moveTo(-s * 0.9, 0); ctx.lineTo(s * 0.4, 0); ctx.moveTo(s * 0.0, -s * 0.5); ctx.lineTo(s * 0.9, 0);
      ctx.lineTo(s * 0.0, s * 0.5); ctx.stroke();
  }
  ctx.restore();
}

export function doctrineIconCanvas(icon, colour, size) {
  const c = document.createElement('canvas');
  c.width = size; c.height = size;
  const ctx = c.getContext('2d');
  drawDoctrineIcon(ctx, icon, size / 2, size / 2, size * 0.36, colour);
  return c;
}
