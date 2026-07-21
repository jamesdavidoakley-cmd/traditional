/* Shared world plumbing: lighting, terrain, collectible Spark Seeds,
   interactables, objective beacon, ambient critters. Each world module
   builds on top of this. */
PIP.worldkit = (function () {
  var U = PIP.util, A = PIP.assets;

  function createWorld(opts) {
    // opts: {id, sky, fog, sun, groundFn, colorFn, size, bounds, music}
    var group = new THREE.Group();
    var world = {
      id: opts.id,
      group: group,
      music: opts.music || 'hub',
      sky: opts.sky || 0x8fd8ff,
      terrain: opts.groundFn || function () { return 0; },
      platforms: [], colliders: [], water: [], interactables: [],
      updaters: [], seeds: [],
      bounds: opts.bounds || null,
      killY: opts.killY != null ? opts.killY : -18,
      spawn: opts.spawn || { x: 0, z: 0, angle: 0 },
      onStomp: null,
      beacon: null
    };

    // lighting
    var hemi = new THREE.HemisphereLight(0xeafff2, 0x5a7d62, 0.75);
    var sun = new THREE.DirectionalLight(0xfff2d0, 0.9);
    sun.position.set(18, 30, 12);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = -40; sun.shadow.camera.right = 40;
    sun.shadow.camera.top = 40; sun.shadow.camera.bottom = -40;
    sun.shadow.camera.far = 90;
    group.add(hemi, sun);

    if (opts.groundFn && opts.size) {
      var ground = A.groundMesh(opts.size, opts.segs || 90, opts.groundFn, opts.colorFn || function () { return '#7cc96f'; });
      group.add(ground);
    }

    /* ---------- helpers ---------- */
    world.add = function (obj, x, y, z) {
      if (x !== undefined) obj.position.set(x, y, z);
      group.add(obj);
      return obj;
    };
    world.addAt = function (obj, x, z, extraY) {
      obj.position.set(x, world.terrain(x, z) + (extraY || 0), z);
      group.add(obj);
      return obj;
    };
    world.block = function (x, z, r) { world.colliders.push({ x: x, z: z, r: r }); };
    world.platform = function (minX, maxX, minZ, maxZ, topY, extra) {
      var p = { minX: minX, maxX: maxX, minZ: minZ, maxZ: maxZ, topY: topY };
      if (extra) for (var k in extra) p[k] = extra[k];
      world.platforms.push(p);
      return p;
    };
    world.interact = function (o) { world.interactables.push(o); return o; };
    world.tick = function (fn) { world.updaters.push(fn); };

    /* Spark Seeds */
    world.seed = function (id, x, z, extraY) {
      if (PIP.save.hasSeed(world.id, id)) return;
      var m = A.makeSeed();
      var y = world.terrain(x, z) + (extraY != null ? extraY : 0.6);
      m.position.set(x, y, z);
      group.add(m);
      world.seeds.push({ id: id, mesh: m, x: x, y: y, z: z, t: U.rand(0, 6) });
    };
    world.tick(function (dt) {
      var ps = PIP.player.state.pos;
      for (var i = world.seeds.length - 1; i >= 0; i--) {
        var s = world.seeds[i];
        s.t += dt;
        s.mesh.position.y = s.y + Math.sin(s.t * 2.4) * 0.12;
        s.mesh.rotation.y += dt * 2;
        var dx = ps.x - s.x, dy = ps.y + 0.8 - s.mesh.position.y, dz = ps.z - s.z;
        if (dx * dx + dy * dy + dz * dz < 1.2) {
          group.remove(s.mesh);
          world.seeds.splice(i, 1);
          if (PIP.save.collectSeed(world.id, s.id)) {
            PIP.audio.play('collect');
            PIP.ui.updateHUD();
          }
        }
      }
    });

    /* pull-able by Pip's vine: seeds within range fly in */
    world.vinePull = function () {
      var ps = PIP.player.state.pos;
      var best = null, bestD = 49;
      world.seeds.forEach(function (s) {
        var d = U.dist2(ps.x, ps.z, s.x, s.z);
        if (d < bestD) { best = s; bestD = d; }
      });
      if (best) {
        PIP.audio.play('whoosh');
        var s = best;
        var from = s.mesh.position.clone();
        var t = 0;
        world.tick(function (dt) {
          if (t >= 1 || world.seeds.indexOf(s) === -1) return;
          t = Math.min(1, t + dt * 3);
          var pp = PIP.player.state.pos;
          s.mesh.position.lerpVectors(from, new THREE.Vector3(pp.x, pp.y + 0.8, pp.z), t);
          s.x = s.mesh.position.x; s.y = s.mesh.position.y; s.z = s.mesh.position.z;
        });
        return true;
      }
      return false;
    };

    /* objective beacon: a soft pillar of light showing where to go */
    var beaconMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.5, 0.9, 14, 12, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xffe27a, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false })
    );
    beaconMesh.visible = false;
    group.add(beaconMesh);
    world.setBeacon = function (x, z) {
      beaconMesh.visible = true;
      beaconMesh.position.set(x, world.terrain(x, z) + 7, z);
    };
    world.clearBeacon = function () { beaconMesh.visible = false; };
    world.tick(function (dt) {
      if (beaconMesh.visible) beaconMesh.rotation.y += dt * 0.5;
    });

    /* butterflies / ambient sparkle */
    world.butterflies = function (n, cx, cz, radius) {
      for (var i = 0; i < n; i++) {
        (function () {
          var b = A.makeButterfly(U.pick([0xffb1d0, 0x9fd8ff, 0xffe27a, 0xc9a6ff]));
          var ox = cx + U.rand(-radius, radius), oz = cz + U.rand(-radius, radius);
          var t = U.rand(0, 20), h = U.rand(1, 2.6);
          group.add(b);
          world.tick(function (dt) {
            t += dt;
            var x = ox + Math.sin(t * 0.6) * 2.4, z = oz + Math.cos(t * 0.43) * 2.4;
            b.position.set(x, world.terrain(x, z) + h + Math.sin(t * 2) * 0.3, z);
            b.rotation.y = Math.atan2(Math.cos(t * 0.6), -Math.sin(t * 0.43));
            b.userData.wL.rotation.y = Math.sin(t * 14) * 0.9;
            b.userData.wR.rotation.y = -Math.sin(t * 14) * 0.9;
          });
        })();
      }
    };

    world.update = function (dt) {
      for (var i = 0; i < world.updaters.length; i++) world.updaters[i](dt);
    };
    return world;
  }

  /* scatter helper */
  function scatter(world, n, maker, cx, cz, radius, blockR) {
    for (var i = 0; i < n; i++) {
      var a = U.rand(0, Math.PI * 2), r = U.rand(radius * 0.25, radius);
      var x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
      var m = maker();
      world.addAt(m, x, z);
      if (blockR) world.block(x, z, blockR);
    }
  }

  return { createWorld: createWorld, scatter: scatter };
})();
