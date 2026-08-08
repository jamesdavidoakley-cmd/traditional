/**
 * Game orchestrator: owns the frame loop and the top-level flow
 * (title showcase → play states arrive in later phases).
 */
import * as THREE from 'three';
import { C } from './ctx';
import { buildMax, type Rig } from './rigs';
import { toonMat } from '../engine/renderer';

export class Game {
  private clock = new THREE.Clock();
  private showcaseGroup: THREE.Group | null = null;
  private showcaseMax: Rig | null = null;

  async start(): Promise<void> {
    this.buildShowcase();
    const loop = () => {
      requestAnimationFrame(loop);
      const dt = Math.min(0.05, this.clock.getDelta());
      this.update(dt);
      C().renderer.render(dt);
    };
    loop();
  }

  /** Title-screen backdrop: Max on a sunny toon disc (also the P0 boot proof). */
  private buildShowcase(): void {
    const { renderer } = C();
    const g = new THREE.Group();
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 4.6, 0.6, 40), toonMat('#7dc95e'));
    disc.position.y = -0.3;
    disc.receiveShadow = true;
    g.add(disc);
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(4.65, 4.8, 0.35, 40), toonMat('#c99a5b'));
    rim.position.y = -0.5;
    g.add(rim);
    const max = buildMax();
    max.root.position.y = 0.02;
    g.add(max.root);
    renderer.addOutline(max.root);
    this.showcaseMax = max;
    renderer.scene.add(g);
    this.showcaseGroup = g;
    renderer.camera.position.set(0, 2.4, 6.4);
    renderer.camera.lookAt(0, 1, 0);
    renderer.applyPalette({
      sky: ['#5aa2e8', '#ffe6b3'],
      fog: '#bcd8f0',
      fogNear: 30,
      fogFar: 120,
      sun: '#fff3d6',
      sunIntensity: 2.2,
      ambient: '#bfd9ff',
      ambientIntensity: 0.9,
      ground: '#8a6a4c',
    });
    renderer.trackTarget(new THREE.Vector3(0, 0, 0));
  }

  private update(dt: number): void {
    const { input } = C();
    input.update();
    if (this.showcaseGroup && this.showcaseMax) {
      this.showcaseGroup.rotation.y += dt * 0.5;
      this.showcaseMax.update(dt, { mode: 'idle', speed: 0, talking: false, actionT: 0 });
    }
    C().particles.update(dt);
    input.lateUpdate();
  }
}
