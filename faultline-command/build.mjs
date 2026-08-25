// Production build: bundle, minify and inline everything into self-contained HTML.
import * as esbuild from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync, statSync } from 'node:fs';

mkdirSync('dist', { recursive: true });

const result = await esbuild.build({
  entryPoints: ['src/main.js'],
  bundle: true,
  minify: true,
  format: 'iife',
  target: ['chrome100', 'firefox100', 'safari15', 'edge100'],
  write: false,
  legalComments: 'none',
});
const js = result.outputFiles[0].text;

const html = readFileSync('index.html', 'utf8');
const style = html.match(/<style>([\s\S]*?)<\/style>/)[1];
const body = html.match(/<body>([\s\S]*?)<script/)[1].trim();

const TITLE = 'Faultline Command';
const DESC = 'An original isometric real-time strategy game: four fictional coalitions, two eras, three maps and eight AI commanders.';

// 1. Standalone page — open the file directly, or host it anywhere.
const standalone = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="description" content="${DESC}">
<title>${TITLE}</title>
<link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><rect width=%22100%22 height=%22100%22 fill=%22%230a0d12%22/><path d=%22M50 14 L80 50 L50 86 L20 50 Z%22 fill=%22none%22 stroke=%22%234fd1c5%22 stroke-width=%228%22/></svg>">
<style>${style}</style>
</head>
<body>
${body}
<script>${js}</script>
</body>
</html>`;
writeFileSync('dist/index.html', standalone);
writeFileSync('dist/faultline-command.html', standalone);

// 2. Artifact page — same content, but the host supplies the document skeleton.
const artifact = `<title>${TITLE}</title>
<style>${style}</style>
${body}
<script>${js}</script>`;
writeFileSync('dist/artifact.html', artifact);

const kb = (p) => (statSync(p).size / 1024).toFixed(0) + ' KB';
console.log('bundle      ', (js.length / 1024).toFixed(0) + ' KB');
console.log('dist/index.html            ', kb('dist/index.html'));
console.log('dist/faultline-command.html', kb('dist/faultline-command.html'));
console.log('dist/artifact.html         ', kb('dist/artifact.html'));
