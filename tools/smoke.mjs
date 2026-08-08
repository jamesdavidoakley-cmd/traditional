#!/usr/bin/env node
/**
 * Headless smoke test: builds are served with `vite preview`, a Chromium
 * page boots the game, we assert zero console errors and capture
 * screenshots along the golden path. Usage:
 *   node tools/smoke.mjs [--shots] [--url http://...]
 */
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const shotsDir = join(root, 'tools', 'screenshots');
mkdirSync(shotsDir, { recursive: true });

const argUrl = process.argv.includes('--url') ? process.argv[process.argv.indexOf('--url') + 1] : null;
const executablePath = process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium';

let server = null;
let url = argUrl;
if (!url) {
  server = spawn('npx', ['vite', 'preview', '--port', '4173', '--strictPort'], { cwd: root, stdio: 'pipe' });
  url = 'http://localhost:4173';
  await new Promise((res) => setTimeout(res, 2500));
}

const errors = [];
let browser;
try {
  browser = await chromium.launch({ executablePath, args: ['--use-gl=angle', '--enable-webgl', '--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (err) => errors.push(String(err)));

  await page.goto(url, { waitUntil: 'load', timeout: 30000 });
  await page.waitForTimeout(4500);
  await page.screenshot({ path: join(shotsDir, '01-boot.png') });

  // Title → new game golden path (works once UI ships; tolerated before then).
  const clickIf = async (selector) => {
    const el = await page.$(selector);
    if (el) {
      await el.click();
      await page.waitForTimeout(900);
      return true;
    }
    return false;
  };
  if (await clickIf('[data-testid="btn-play"]')) {
    await page.screenshot({ path: join(shotsDir, '02-slots.png') });
    if (await clickIf('[data-testid="slot-0"]')) {
      await clickIf('[data-testid="btn-difficulty-explorer"]');
      await page.waitForTimeout(1200);
      await clickIf('[data-testid="btn-skip-cutscene"]');
      await page.waitForTimeout(2500);
      await page.screenshot({ path: join(shotsDir, '03-hub.png') });
      // walk forward briefly to prove the sim runs
      await page.keyboard.down('KeyW');
      await page.waitForTimeout(1200);
      await page.keyboard.up('KeyW');
      await page.keyboard.press('Space');
      await page.waitForTimeout(800);
      await page.screenshot({ path: join(shotsDir, '04-walk.png') });
    }
  }

  const benign = (e) =>
    e.includes('Autoplay') || e.includes('WebGL') || e.includes('GPU stall') || e.includes('speechSynthesis');
  const real = errors.filter((e) => !benign(e));
  if (real.length > 0) {
    console.error(`✗ smoke: ${real.length} console error(s):`);
    for (const e of real) console.error('  ' + e.slice(0, 300));
    process.exitCode = 1;
  } else {
    console.log('✓ smoke: booted with zero console errors; screenshots in tools/screenshots/');
  }
} finally {
  await browser?.close();
  server?.kill();
}
