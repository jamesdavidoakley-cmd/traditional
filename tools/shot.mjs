#!/usr/bin/env node
/**
 * Dev screenshot utility: boots the built game (vite preview), optionally
 * replays a key script, and saves screenshots. Used to eyeball levels
 * headlessly during development.
 *   node tools/shot.mjs "?level=playground" out.png "W:2000,Space:200,W:1500"
 */
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const shotsDir = join(root, 'tools', 'screenshots');
mkdirSync(shotsDir, { recursive: true });

const query = process.argv[2] ?? '';
const outName = process.argv[3] ?? 'shot.png';
const script = process.argv[4] ?? '';

const server = spawn('npx', ['vite', 'preview', '--port', '4181', '--strictPort'], { cwd: root, stdio: 'pipe' });
await new Promise((r) => setTimeout(r, 2200));

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium',
  args: ['--use-gl=angle', '--enable-webgl', '--no-sandbox'],
});
const errors = [];
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await page.goto(`http://localhost:4181/${query}`, { waitUntil: 'load', timeout: 30000 });
  await page.waitForTimeout(3800);
  let shotIdx = 0;
  for (const step of script ? script.split(',') : []) {
    const [key, msStr] = step.split(':');
    const ms = Number(msStr ?? 300);
    if (key === 'SHOT') {
      await page.screenshot({ path: join(shotsDir, outName.replace('.png', `-${++shotIdx}.png`)) });
      continue;
    }
    if (key === 'CLICK') {
      await page.mouse.click(640, 400);
      await page.waitForTimeout(ms);
      continue;
    }
    if (key.startsWith('SEL=')) {
      const el = await page.$(key.slice(4));
      if (el) await el.click();
      else console.log(`  (selector ${key.slice(4)} not found)`);
      await page.waitForTimeout(ms);
      continue;
    }
    await page.keyboard.down(key);
    await page.waitForTimeout(ms);
    await page.keyboard.up(key);
    await page.waitForTimeout(120);
  }
  await page.screenshot({ path: join(shotsDir, outName) });
  const benign = (e) => e.includes('Autoplay') || e.includes('WebGL') || e.includes('GPU stall');
  const real = errors.filter((e) => !benign(e));
  if (real.length) {
    console.log(`⚠ ${real.length} console error(s):`);
    for (const e of real.slice(0, 6)) console.log('  ' + e.slice(0, 240));
  } else {
    console.log(`✓ ${outName} saved, zero console errors`);
  }
} finally {
  await browser.close();
  server.kill();
}
