/**
 * Renderer: scene, toon-look post chain (SMAA → bloom → vignette + outline,
 * §2.4), per-world sky/fog/lighting palettes, quality presets with fps
 * auto-detect (§2.5).
 */
import * as THREE from 'three';
import {
  BloomEffect,
  EffectComposer,
  EffectPass,
  OutlineEffect,
  RenderPass,
  SMAAEffect,
  VignetteEffect,
} from 'postprocessing';
import type { LevelDef } from '../game/content-types';

export type Quality = 'low' | 'medium' | 'high';

const SKY_VERT = /* glsl */ `
varying vec3 vWorld;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorld = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;
const SKY_FRAG = /* glsl */ `
uniform vec3 topColor;
uniform vec3 horizonColor;
varying vec3 vWorld;
void main() {
  float h = normalize(vWorld - cameraPosition).y;
  float t = smoothstep(-0.08, 0.45, h);
  vec3 c = mix(horizonColor, topColor, t);
  gl_FragColor = vec4(c, 1.0);
}
`;

/** Shared 3-step toon gradient map (§2.4). */
let gradientMap: THREE.DataTexture | null = null;
export function getToonGradient(): THREE.DataTexture {
  if (!gradientMap) {
    const data = new Uint8Array([90, 90, 90, 255, 170, 170, 170, 255, 255, 255, 255, 255]);
    gradientMap = new THREE.DataTexture(data, 3, 1, THREE.RGBAFormat);
    gradientMap.needsUpdate = true;
    gradientMap.minFilter = THREE.NearestFilter;
    gradientMap.magFilter = THREE.NearestFilter;
  }
  return gradientMap;
}

const matCache = new Map<string, THREE.MeshToonMaterial>();
export function toonMat(colour: string | number): THREE.MeshToonMaterial {
  const key = typeof colour === 'number' ? `#${colour.toString(16)}` : colour;
  let m = matCache.get(key);
  if (!m) {
    m = new THREE.MeshToonMaterial({ color: new THREE.Color(colour as THREE.ColorRepresentation), gradientMap: getToonGradient() });
    matCache.set(key, m);
  }
  return m;
}

export class Renderer {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  private composer: EffectComposer | null = null;
  private outline: OutlineEffect | null = null;
  private sky: THREE.Mesh;
  private skyMat: THREE.ShaderMaterial;
  readonly sun: THREE.DirectionalLight;
  readonly hemi: THREE.HemisphereLight;
  quality: Quality = 'high';
  private fpsSamples: number[] = [];
  private autoDetectDone = false;
  onAutoQuality: ((q: Quality) => void) | null = null;
  /** Screen-shake state (respects reduce-shake). */
  private shakeAmp = 0;
  private shakeTime = 0;
  reduceShake = false;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      powerPreference: 'high-performance',
      stencil: false,
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NoToneMapping;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    this.camera = new THREE.PerspectiveCamera(58, 16 / 9, 0.1, 600);
    this.camera.position.set(0, 3, 8);

    this.sun = new THREE.DirectionalLight('#fff3d6', 2.2);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.camera.near = 1;
    this.sun.shadow.camera.far = 160;
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.03;
    this.setShadowArea(40);
    this.scene.add(this.sun);
    this.scene.add(this.sun.target);
    this.hemi = new THREE.HemisphereLight('#bfd9ff', '#8a6a4c', 0.9);
    this.scene.add(this.hemi);

    this.skyMat = new THREE.ShaderMaterial({
      vertexShader: SKY_VERT,
      fragmentShader: SKY_FRAG,
      uniforms: {
        topColor: { value: new THREE.Color('#5aa2e8') },
        horizonColor: { value: new THREE.Color('#ffe6b3') },
      },
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
    });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(480, 24, 12), this.skyMat);
    this.sky.frustumCulled = false;
    this.sky.renderOrder = -10;
    this.scene.add(this.sky);

    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.setQuality('high');
  }

  private setShadowArea(size: number): void {
    const c = this.sun.shadow.camera;
    c.left = -size;
    c.right = size;
    c.top = size;
    c.bottom = -size;
    c.updateProjectionMatrix();
  }

  setQuality(q: Quality): void {
    this.quality = q;
    this.composer?.dispose();
    this.composer = null;
    this.outline = null;
    this.renderer.shadowMap.enabled = q !== 'low';
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, q === 'high' ? 2 : 1.25));
    if (q === 'low') return;
    const composer = new EffectComposer(this.renderer);
    composer.addPass(new RenderPass(this.scene, this.camera));
    const smaa = new SMAAEffect();
    const vignette = new VignetteEffect({ darkness: 0.42, offset: 0.32 });
    if (q === 'high') {
      this.outline = new OutlineEffect(this.scene, this.camera, {
        edgeStrength: 2.2,
        visibleEdgeColor: 0x1c1830,
        hiddenEdgeColor: 0x1c1830,
        blur: false,
        xRay: false,
      });
      const bloom = new BloomEffect({ intensity: 0.35, luminanceThreshold: 0.72, mipmapBlur: true });
      composer.addPass(new EffectPass(this.camera, smaa, bloom, this.outline, vignette));
    } else {
      composer.addPass(new EffectPass(this.camera, smaa, vignette));
    }
    this.composer = composer;
    this.resize();
  }

  /** Add a mesh (recursively) to the character/interactable outline pass. */
  addOutline(obj: THREE.Object3D): void {
    if (!this.outline) return;
    obj.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) this.outline?.selection.add(o as THREE.Mesh);
    });
  }
  removeOutline(obj: THREE.Object3D): void {
    if (!this.outline) return;
    obj.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) this.outline?.selection.delete(o as THREE.Mesh);
    });
  }

  applyPalette(p: LevelDef['palette']): void {
    (this.skyMat.uniforms.topColor.value as THREE.Color).set(p.sky[0]);
    (this.skyMat.uniforms.horizonColor.value as THREE.Color).set(p.sky[1]);
    this.scene.fog = new THREE.Fog(p.fog, p.fogNear, p.fogFar);
    this.sun.color.set(p.sun);
    this.sun.intensity = p.sunIntensity;
    this.hemi.color.set(p.ambient);
    this.hemi.intensity = p.ambientIntensity;
    this.hemi.groundColor.set(p.ground);
  }

  shake(amp: number): void {
    if (this.reduceShake) return;
    this.shakeAmp = Math.max(this.shakeAmp, amp);
  }

  resize(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h);
    this.composer?.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  /** Follow the sun + sky to the camera target so shadows stay crisp anywhere. */
  trackTarget(target: THREE.Vector3): void {
    this.sun.position.set(target.x + 22, target.y + 38, target.z + 14);
    this.sun.target.position.copy(target);
    this.sky.position.copy(this.camera.position);
  }

  render(dt: number): void {
    if (this.shakeAmp > 0.001) {
      this.shakeTime += dt * 40;
      const a = this.shakeAmp;
      this.camera.position.x += Math.sin(this.shakeTime * 1.3) * a * 0.06;
      this.camera.position.y += Math.cos(this.shakeTime * 1.7) * a * 0.05;
      this.shakeAmp *= Math.exp(-6 * dt);
    }
    if (this.composer) this.composer.render(dt);
    else this.renderer.render(this.scene, this.camera);

    // fps auto-detect for quality:'auto' (§2.4)
    if (!this.autoDetectDone && dt > 0) {
      this.fpsSamples.push(1 / dt);
      if (this.fpsSamples.length === 150) {
        this.autoDetectDone = true;
        const sorted = [...this.fpsSamples].sort((a, b) => a - b);
        const median = sorted[Math.floor(sorted.length / 2)];
        if (median < 32 && this.quality !== 'low') {
          this.setQuality('low');
          this.onAutoQuality?.('low');
        } else if (median < 50 && this.quality === 'high') {
          this.setQuality('medium');
          this.onAutoQuality?.('medium');
        }
      }
    }
  }

  /** Skip auto-detect (user picked an explicit quality). */
  disableAutoDetect(): void {
    this.autoDetectDone = true;
  }
}
