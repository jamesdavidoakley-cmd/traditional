import './styles.css';
import { Renderer } from './engine/renderer';
import { Input } from './engine/input';
import { SaveManager } from './engine/save';
import { Particles } from './engine/particles';
import { PhysicsWorld } from './engine/physics';
import { loadContentFromBundle, setActiveContent } from './engine/loader';
import { initCtx } from './game/ctx';
import { Game } from './game/game';

const bootStatus = document.getElementById('boot-status');
const setStatus = (s: string) => {
  if (bootStatus) bootStatus.textContent = s;
};

async function boot(): Promise<void> {
  setStatus('Reading the fossil record…');
  const { db, issues } = loadContentFromBundle();
  if (issues.length > 0) {
    console.warn(`[content] ${issues.length} validation issue(s):`);
    for (const i of issues) console.warn(`  - ${i.file}: ${i.message}`);
  }
  setActiveContent(db);

  setStatus('Polishing Star Fossils…');
  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
  const renderer = new Renderer(canvas);
  const input = new Input();
  const save = new SaveManager();
  const physics = new PhysicsWorld();
  const particles = new Particles(renderer.scene);
  initCtx({ renderer, input, save, particles, physics, content: db });

  const game = new Game();
  await game.start();

  document.getElementById('boot-screen')?.classList.add('hidden');
}

boot().catch((err) => {
  console.error('boot failed', err);
  setStatus('Oh no — something went wrong starting the game. Try refreshing?');
});
