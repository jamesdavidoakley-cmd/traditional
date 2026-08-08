/**
 * Custom kinematic character physics (§2.1): capsule-vs-mesh resolution
 * using three-mesh-bvh shapecasts. No physics engine — precise platformer
 * feel, deterministic enough to unit-test headlessly.
 */
import * as THREE from 'three';
import { MeshBVH, acceleratedRaycast, computeBoundsTree, disposeBoundsTree } from 'three-mesh-bvh';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// Enable BVH raycast acceleration globally.
THREE.Mesh.prototype.raycast = acceleratedRaycast;
(THREE.BufferGeometry.prototype as unknown as { computeBoundsTree: typeof computeBoundsTree }).computeBoundsTree =
  computeBoundsTree;
(THREE.BufferGeometry.prototype as unknown as { disposeBoundsTree: typeof disposeBoundsTree }).disposeBoundsTree =
  disposeBoundsTree;

export interface CapsuleBody {
  /** Foot position (bottom of the capsule). */
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  radius: number;
  /** Total height, caps included. */
  height: number;
}

export interface MoveResult {
  grounded: boolean;
  groundNormal: THREE.Vector3;
  hitCeiling: boolean;
  hitWall: boolean;
  platform: DynamicCollider | null;
}

export class DynamicCollider {
  mesh: THREE.Mesh;
  prevMatrix = new THREE.Matrix4();
  currMatrix = new THREE.Matrix4();
  /** Extra surface velocity (conveyors) in world space, m/s. */
  surfaceVelocity = new THREE.Vector3();
  enabled = true;

  constructor(mesh: THREE.Mesh) {
    this.mesh = mesh;
    const geom = mesh.geometry;
    if (!(geom as unknown as { boundsTree?: MeshBVH }).boundsTree) {
      (geom as unknown as { boundsTree: MeshBVH }).boundsTree = new MeshBVH(geom);
    }
    mesh.updateWorldMatrix(true, false);
    this.prevMatrix.copy(mesh.matrixWorld);
    this.currMatrix.copy(mesh.matrixWorld);
  }

  /** Call after moving the mesh each frame. */
  commitMotion(): void {
    this.prevMatrix.copy(this.currMatrix);
    this.mesh.updateWorldMatrix(true, false);
    this.currMatrix.copy(this.mesh.matrixWorld);
  }

  /** World-space transform that carries riders: curr * prev⁻¹. */
  riderDelta(target: THREE.Matrix4): THREE.Matrix4 {
    return target.copy(this.currMatrix).multiply(tmpMat.copy(this.prevMatrix).invert());
  }
}

const tmpMat = new THREE.Matrix4();
const tmpMat2 = new THREE.Matrix4();
const tmpSeg = new THREE.Line3();
const tmpTriPoint = new THREE.Vector3();
const tmpCapPoint = new THREE.Vector3();
const tmpDir = new THREE.Vector3();
const tmpBox = new THREE.Box3();
const tmpVec = new THREE.Vector3();

const GROUND_NORMAL_Y = 0.62; // ≈ 52° slope limit

export class PhysicsWorld {
  private staticMesh: THREE.Mesh | null = null;
  dynamics: DynamicCollider[] = [];
  private raycaster = new THREE.Raycaster();

  buildStatic(geometries: THREE.BufferGeometry[]): void {
    this.disposeStatic();
    if (geometries.length === 0) return;
    const cleaned = geometries.map((g) => {
      const c = g.index ? g.toNonIndexed() : g.clone();
      for (const attr of Object.keys(c.attributes)) {
        if (attr !== 'position') c.deleteAttribute(attr);
      }
      return c;
    });
    const merged = mergeGeometries(cleaned, false);
    cleaned.forEach((c) => c.dispose());
    if (!merged) return;
    (merged as unknown as { boundsTree: MeshBVH }).boundsTree = new MeshBVH(merged);
    this.staticMesh = new THREE.Mesh(merged);
    this.staticMesh.updateMatrixWorld(true);
  }

  disposeStatic(): void {
    if (this.staticMesh) {
      this.staticMesh.geometry.dispose();
      this.staticMesh = null;
    }
    this.dynamics = [];
  }

  addDynamic(mesh: THREE.Mesh): DynamicCollider {
    const d = new DynamicCollider(mesh);
    this.dynamics.push(d);
    return d;
  }

  removeDynamic(d: DynamicCollider): void {
    const i = this.dynamics.indexOf(d);
    if (i >= 0) this.dynamics.splice(i, 1);
  }

  /**
   * Resolve a capsule against the world. Mutates body.position, leaves
   * velocity to the caller except for ground/ceiling zeroing hints in result.
   */
  resolveCapsule(body: CapsuleBody): MoveResult {
    const result: MoveResult = {
      grounded: false,
      groundNormal: new THREE.Vector3(0, 1, 0),
      hitCeiling: false,
      hitWall: false,
      platform: null,
    };
    for (let iter = 0; iter < 4; iter++) {
      let any = false;
      if (this.staticMesh) {
        any = this.resolveAgainst(body, this.staticMesh, null, result) || any;
      }
      for (const d of this.dynamics) {
        if (!d.enabled) continue;
        any = this.resolveAgainst(body, d.mesh, d, result) || any;
      }
      if (!any) break;
    }
    return result;
  }

  private resolveAgainst(
    body: CapsuleBody,
    mesh: THREE.Mesh,
    dyn: DynamicCollider | null,
    result: MoveResult,
  ): boolean {
    const geom = mesh.geometry as unknown as { boundsTree?: MeshBVH };
    const bvh = geom.boundsTree;
    if (!bvh) return false;

    // Capsule segment in world space.
    const r = body.radius;
    tmpSeg.start.copy(body.position).y += r;
    tmpSeg.end.copy(body.position).y += body.height - r;

    // Into mesh local space.
    const inv = tmpMat2.copy(mesh.matrixWorld).invert();
    tmpSeg.start.applyMatrix4(inv);
    tmpSeg.end.applyMatrix4(inv);
    // NOTE: assumes platforms are not scaled non-uniformly (level loader bakes scale).

    tmpBox.makeEmpty();
    tmpBox.expandByPoint(tmpSeg.start);
    tmpBox.expandByPoint(tmpSeg.end);
    tmpBox.min.addScalar(-r);
    tmpBox.max.addScalar(r);

    let collided = false;
    bvh.shapecast({
      intersectsBounds: (box) => box.intersectsBox(tmpBox),
      intersectsTriangle: (tri) => {
        const dist = tri.closestPointToSegment(tmpSeg, tmpTriPoint, tmpCapPoint);
        if (dist < r) {
          const depth = r - dist;
          if (dist > 1e-7) {
            tmpDir.copy(tmpCapPoint).sub(tmpTriPoint).normalize();
          } else {
            tri.getNormal(tmpDir);
          }
          tmpSeg.start.addScaledVector(tmpDir, depth);
          tmpSeg.end.addScaledVector(tmpDir, depth);
          collided = true;

          // Classify contact using the push direction transformed to world.
          tmpVec.copy(tmpDir).transformDirection(mesh.matrixWorld);
          if (tmpVec.y > GROUND_NORMAL_Y) {
            result.grounded = true;
            result.groundNormal.copy(tmpVec);
            if (dyn) result.platform = dyn;
          } else if (tmpVec.y < -0.5) {
            result.hitCeiling = true;
          } else {
            result.hitWall = true;
          }
        }
      },
    });

    if (collided) {
      // Back to world space; body position from segment start.
      tmpSeg.start.applyMatrix4(mesh.matrixWorld);
      body.position.copy(tmpSeg.start);
      body.position.y -= r;
    }
    return collided;
  }

  /** Raycast against static + dynamic colliders. Returns nearest hit or null. */
  raycast(origin: THREE.Vector3, dir: THREE.Vector3, far: number): THREE.Intersection | null {
    this.raycaster.set(origin, dir);
    this.raycaster.far = far;
    const meshes: THREE.Object3D[] = [];
    if (this.staticMesh) meshes.push(this.staticMesh);
    for (const d of this.dynamics) if (d.enabled) meshes.push(d.mesh);
    const hits = this.raycaster.intersectObjects(meshes, false);
    return hits.length > 0 ? hits[0] : null;
  }

  /** Distance to ground below a point (probes 0..far). Infinity when nothing beneath. */
  groundBelow(point: THREE.Vector3, far = 50): number {
    const hit = this.raycast(tmpVec.copy(point).add(new THREE.Vector3(0, 0.1, 0)), DOWN, far);
    return hit ? hit.distance - 0.1 : Infinity;
  }
}

const DOWN = new THREE.Vector3(0, -1, 0);
