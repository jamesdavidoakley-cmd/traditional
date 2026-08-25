// Bakes the Barlow / Barlow Condensed latin subsets into src/ui/fonts.css as
// data URIs, so the game keeps its typography with no network access at all.
import { writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36';
const URL = 'https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600;700&family=Barlow:wght@400;600&display=swap';

const css = execFileSync('curl', ['-sS', '--max-time', '30', '-A', UA, URL]).toString();

// Google emits one @font-face per subset, each preceded by a /* subset */ comment.
const blocks = [...css.matchAll(/\/\*\s*([\w-]+)\s*\*\/\s*(@font-face\s*\{[\s\S]*?\})/g)];
const latin = blocks.filter(([, subset]) => subset === 'latin');
if (!latin.length) throw new Error('no latin subsets found in the Google Fonts response');

let out = '/* Barlow and Barlow Condensed (SIL Open Font License 1.1), embedded for offline use. */\n';
let total = 0;
for (const [, , block] of latin) {
  const url = block.match(/url\((https:[^)]+\.woff2)\)/)[1];
  const bin = execFileSync('curl', ['-sS', '--max-time', '30', '-A', UA, url], { maxBuffer: 1 << 24 });
  total += bin.length;
  const data = 'data:font/woff2;base64,' + bin.toString('base64');
  out += block.replace(/url\(https:[^)]+\.woff2\)/, `url(${data})`).replace(/\s+/g, ' ') + '\n';
}
writeFileSync('src/ui/fonts.css', out);
console.log('embedded', latin.length, 'faces,', (total / 1024).toFixed(0), 'KB of woff2 ->', (out.length / 1024).toFixed(0), 'KB of CSS');
