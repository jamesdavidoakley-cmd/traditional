/* World 3 — Shape Sail Harbour (short missions).
   Mission 1: Shape lighthouse   — 2D/3D shapes, stable stacking (DT structure)
   Mission 2: Captain Shell's boat — materials & floating, cargo counting
   Mission 3: Crane directions     — position & counting-on (algorithmic thinking)
   Hidden:    Shape spotter        — "which shape has 3 sides?"
   Reward:    the Harbour Idea Core

   A gentle water world: everything you need is joined by wooden boardwalks, and
   any splash into the sea just means a quick swim — never a fall. */
PIP.worlds = PIP.worlds || {};

PIP.worlds.harbour = function () {
  var U = PIP.util, A = PIP.assets, K = PIP.worldkit;

  var WATER_Y = -0.35, DOCK_Y = 0.4;
  function terrainFn(x, z) {
    var y = -2.2 + Math.sin(x * 0.2) * Math.cos(z * 0.2) * 0.2;
    var d = Math.sqrt(x * x + z * z);
    if (d > 26) y -= (d - 26) * 1.5;
    return y;
  }
  function colorFn(x, z, y) {
    var d = Math.sqrt(x * x + z * z);
    return d < 8 ? '#e6d6a8' : d < 18 ? '#7fc9c4' : '#4fa6b8';
  }

  var world = K.createWorld({
    id: 'harbour', music: 'harbour', sky: 0x8fe0ff,
    groundFn: terrainFn, colorFn: colorFn, size: 70, segs: 80,
    bounds: { minX: -25, maxX: 25, minZ: -25, maxZ: 25 },
    spawn: { x: 0, z: -3, angle: 0 },
    killY: -12
  });
  world.water.push({ minX: -28, maxX: 28, minZ: -28, maxZ: 28, y: WATER_Y });

  /* ---------- boardwalks / docks ---------- */
  function dock(x0, x1, z0, z1) {
    var m = A.mesh(A.GEO.box, A.mat(0xc98d5a));
    m.scale.set(x1 - x0, 0.3, z1 - z0);
    m.position.set((x0 + x1) / 2, DOCK_Y - 0.15, (z0 + z1) / 2);
    world.group.add(m);
    world.platform(x0, x1, z0, z1, DOCK_Y, { noWall: false });
    // corner posts
    [[x0, z0], [x1, z0], [x0, z1], [x1, z1]].forEach(function (c) {
      var p = A.mesh(A.GEO.cyl, A.mat(0x8a6142), c[0], DOCK_Y - 0.5, c[1]);
      p.scale.set(0.12, 1.2, 0.12);
      world.group.add(p);
    });
  }
  dock(-5, 5, -5, 5);        // plaza
  dock(-2, 2, 5, 13);        // north walk
  dock(-6, 6, 13, 22);       // lighthouse islet
  dock(5, 13, -2, 2);        // east walk
  dock(13, 22, -6, 6);       // crane dock
  dock(-13, -5, -2, 2);      // west walk
  dock(-22, -13, -6, 6);     // boat dock
  dock(-2, 2, -13, -5);      // south walk
  dock(-6, 6, -22, -13);     // gate islet

  /* ---------- return gate ---------- */
  var backGate = A.makeGate(0x8fd483);
  world.add(backGate, 0, DOCK_Y, -20);
  backGate.rotation.y = 0;
  backGate.userData.swirl.material.opacity = 0.5;
  world.interact({
    x: 0, z: -20, radius: 2.4, prompt: 'Back to Inventor Village', icon: '🏡',
    onInteract: function () { PIP.game.gotoWorld('hub'); }
  });
  world.addAt(A.makeSign('Inventor Village'), 3, -18);

  /* ---------- Captain Shell ---------- */
  function makeCaptain() {
    var g = new THREE.Group();
    var shell = A.mesh(A.GEO.sphere, A.mat(0x2fa457), 0, 0.52, 0); shell.scale.set(0.55, 0.42, 0.62);
    var belly = A.mesh(A.GEO.sphere, A.mat(0xffe3a8), 0, 0.36, 0.12); belly.scale.set(0.42, 0.24, 0.42);
    var head = A.mesh(A.GEO.sphere, A.mat(0x6fce8a), 0, 0.64, 0.5); head.scale.set(0.23, 0.23, 0.25);
    var hat = A.mesh(A.GEO.cyl, A.mat(0x2b4a7a), 0, 0.9, 0.5); hat.scale.set(0.22, 0.16, 0.22);
    var brim = A.mesh(A.GEO.cyl, A.mat(0x2b4a7a), 0, 0.82, 0.54); brim.scale.set(0.34, 0.05, 0.34);
    var badge = A.mesh(A.GEO.sphere, A.mat(0xffd257), 0, 0.92, 0.7); badge.scale.setScalar(0.05);
    [-1, 1].forEach(function (s) {
      var e = A.mesh(A.GEO.sphere, A.mat(0xffffff), 0.09 * s, 0.66, 0.68); e.scale.set(0.05, 0.06, 0.03); g.add(e);
      var p = A.mesh(A.GEO.sphere, A.mat(0x2b2b33), 0.09 * s, 0.66, 0.71); p.scale.set(0.025, 0.03, 0.02); g.add(p);
      var fin = A.mesh(A.GEO.sphere, A.mat(0x6fce8a), 0.42 * s, 0.4, 0.12); fin.scale.set(0.15, 0.08, 0.22); g.add(fin);
    });
    g.add(shell, belly, head, hat, brim, badge);
    return g;
  }
  var captain = makeCaptain();
  world.add(captain, 0, DOCK_Y, 1);
  world.block(0, 1, 0.8);
  var capT = 0;
  world.tick(function (dt) {
    capT += dt;
    captain.position.y = DOCK_Y + Math.sin(capT * 1.8) * 0.04;
    var pp = PIP.player.state.pos;
    if (U.dist2(pp.x, pp.z, 0, 1) < 60)
      captain.rotation.y = U.angleLerp(captain.rotation.y, Math.atan2(pp.x - 0, pp.z - 1), Math.min(1, dt * 3));
  });
  world.interact({
    x: 0, z: 1, radius: 2.6, prompt: 'Talk to Captain Shell', icon: '🐢',
    onInteract: function () { captainTalk(); }
  });
  function captainTalk() {
    var done = ['harbour.lighthouse', 'harbour.boat', 'harbour.crane'].filter(function (m) { return PIP.save.mission(m) === 'done'; }).length;
    if (done === 3 && !PIP.save.hasCore('harbour')) {
      PIP.ui.say('Captain Shell', '🐢', ['Ahoy — the whole harbour is ship-shape! The Idea Core has surfaced by the plaza. Fetch it!']);
      return;
    }
    if (done === 3) { PIP.ui.say('Captain Shell', '🐢', ['A finer harbour I never did sail. Cubes stack, cylinders roll, and wood floats — you know your shapes, matey!']); return; }
    PIP.ui.say('Captain Shell', '🐢', [
      'Ahoy, Pip! Welcome to Shape Sail Harbour.',
      'The Mix-Up Machine muddled everything! Three jobs need doing:',
      'Fix the shape lighthouse to the north, build me a boat to the west, and work the crane to the east.',
      'Every splash is just a swim — so go and try things!'
    ]).then(pointNext);
  }
  function pointNext() {
    checkAllMissions();
    if (PIP.save.mission('harbour.lighthouse') !== 'done') { PIP.ui.setGoal('Fix the shape lighthouse to the north. 🗼', false); world.setBeacon(0, 17); }
    else if (PIP.save.mission('harbour.boat') !== 'done') { PIP.ui.setGoal('Build Captain Shell a boat to the west. ⛵', false); world.setBeacon(-17, 0); }
    else if (PIP.save.mission('harbour.crane') !== 'done') { PIP.ui.setGoal('Work the crane to the east. 🏗️', false); world.setBeacon(17, 0); }
    else if (!PIP.save.hasCore('harbour')) { PIP.ui.setGoal('Collect the Harbour Idea Core by the plaza! 💡', false); world.setBeacon(0, 4); }
    else PIP.ui.clearGoal();
  }

  /* =====================================================================
     MISSION 1 — Shape Lighthouse (2D/3D shapes, stable stacking)
     ===================================================================== */
  var LX = 0, LZ = 17;
  var lighthouseDone = PIP.save.mission('harbour.lighthouse') === 'done';
  var beaconLight = null, beamGroup = null;

  function shapePart(kind) {
    if (kind === 'cube') { var m = A.mesh(A.GEO.box, A.mat(0xff9e6b), 0, 0, 0); m.scale.set(1.1, 1.0, 1.1); return m; }
    if (kind === 'cylinder') { return A.mesh(new THREE.CylinderGeometry(0.5, 0.5, 1.2, 16), A.mat(0xffd257), 0, 0, 0); }
    if (kind === 'sphere') { var s = A.mesh(A.GEO.sphere, A.mat(0x8fd8ff, { emissive: 0x59c8f0, emissiveIntensity: 0.7 }), 0, 0, 0); s.scale.setScalar(0.42); return s; }
    return A.mesh(new THREE.ConeGeometry(0.6, 0.9, 16), A.mat(0xff6f9c), 0, 0, 0); // cone
  }
  var lightBaseY = DOCK_Y;
  var LH_SLOTS = [
    { key: 'cube', y: lightBaseY + 0.5 },
    { key: 'cylinder', y: lightBaseY + 1.6 },
    { key: 'sphere', y: lightBaseY + 2.5 },
    { key: 'cone', y: lightBaseY + 3.15 }
  ];
  function buildStaticLighthouse() {
    LH_SLOTS.forEach(function (s) {
      var m = shapePart(s.key); m.position.set(LX, s.y, LZ); world.group.add(m);
    });
    lightUpLighthouse();
  }
  function lightUpLighthouse() {
    beaconLight = A.mesh(A.GEO.sphere, A.mat(0xffef9e, { emissive: 0xffe27a, emissiveIntensity: 1 }), LX, lightBaseY + 2.5, LZ);
    beaconLight.scale.setScalar(0.5);
    world.group.add(beaconLight);
    beamGroup = new THREE.Mesh(
      new THREE.ConeGeometry(1.6, 6, 12, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xfff2a0, transparent: true, opacity: 0.2, side: THREE.DoubleSide, depthWrite: false })
    );
    beamGroup.rotation.z = Math.PI / 2;
    beamGroup.position.set(LX, lightBaseY + 2.5, LZ);
    world.group.add(beamGroup);
    world.tick(function (dt) { if (beamGroup) beamGroup.rotation.y += dt * 1.2; });
  }
  if (lighthouseDone) buildStaticLighthouse();

  // lighthouse plinth (always there)
  var plinth = A.mesh(A.GEO.cyl, A.mat(0xb9c3cc), LX, DOCK_Y + 0.05, LZ); plinth.scale.set(1.4, 0.2, 1.4);
  world.group.add(plinth);
  world.block(LX, LZ, 1.4);
  world.addAt(A.makeSign('Shape Lighthouse'), LX + 3, LZ - 2);

  var lighthouseActive = false;
  world.interact({
    x: LX, z: LZ, radius: 3.2, prompt: 'Fix the lighthouse', icon: '🗼',
    enabled: function () { return !lighthouseDone && !lighthouseActive; },
    onInteract: function () {
      lighthouseActive = true;
      PIP.ui.say('Captain Shell', '🐢', [
        'The lighthouse toppled! Stack it back with the right solid shapes.',
        'A wide CUBE for a steady base, a CYLINDER tower, a round SPHERE lamp, and a CONE for the roof!'
      ]).then(startLighthouseBuild);
    }
  });

  function startLighthouseBuild() {
    PIP.player.state.frozen = true;
    world.clearBeacon();
    PIP.game.tweenCamera(new THREE.Vector3(LX + 5, DOCK_Y + 4, LZ - 5), new THREE.Vector3(LX, DOCK_Y + 2, LZ));
    PIP.challenge.begin({
      id: 'harbour.lighthouse', concept: 'shapes',
      goal: 'Stack the right shapes to rebuild the lighthouse.',
      hints: [
        'Each glowing spot wants one shape. The bottom needs the widest one — the cube.',
        'A wide, flat cube makes a stable base. A cylinder rolls on its side but stacks as a tower.',
        'Match each card to its spot: cube, then cylinder, then the sphere lamp, then the cone roof.'
      ]
    });
    var parts = [
      { id: 'cube', name: 'Cube', icon: '🟧', count: 1, make: function () { return shapePart('cube'); }, tip: 'A cube has flat faces — a steady, wide base.' },
      { id: 'cylinder', name: 'Cylinder', icon: '🥫', count: 1, make: function () { return shapePart('cylinder'); }, tip: 'A cylinder makes a tall tower.' },
      { id: 'sphere', name: 'Sphere', icon: '🔵', count: 1, make: function () { return shapePart('sphere'); }, tip: 'A round sphere for the lamp.' },
      { id: 'cone', name: 'Cone', icon: '🔺', count: 1, make: function () { return shapePart('cone'); }, tip: 'A cone roof, pointy on top.' }
    ];
    var slots = LH_SLOTS.map(function (s) {
      return { id: s.key, accepts: [s.key], pos: new THREE.Vector3(LX, s.y, LZ) };
    });
    PIP.builder.start({
      scene: world.group, parts: parts, slots: slots,
      tip: 'Pick a shape card, then tap its glowing spot. Bottom to top!',
      allowBack: true,
      canTest: function () {
        var placed = 0; slots.forEach(function (s) { if (s.placed) placed++; });
        return placed < 4 ? 'Place all four shapes first — one on each glowing spot.' : null;
      },
      onTest: function () {
        PIP.builder.setTesting(true);
        PIP.audio.play('unlock');
        PIP.builder.finish();
        PIP.player.state.frozen = false;
        lighthouseDone = true;
        PIP.save.setMission('harbour.lighthouse', 'done');
        PIP.save.recordAttempt('shapes', true, 0);
        PIP.save.recordAttempt('dtStructure', true, 0);
        PIP.save.addDesign({ name: 'Shape Lighthouse', icon: '🗼', note: 'Cube base, cylinder tower, sphere lamp, cone roof.' });
        lightUpLighthouse();
        PIP.challenge.complete({
          title: 'The light shines again!',
          maths: 'cube · cylinder · sphere · cone',
          text: 'Four solid shapes, stacked wide-to-narrow. The wide cube base keeps it steady — and the light sweeps the sea!',
          speak: 'A cube base, a cylinder tower, a sphere lamp and a cone roof. Four solid shapes — and a steady base at the bottom!'
        }).then(function () { pointNext(); if (PIP.save.grantBadge('shape')) PIP.ui.toast('🔷', 'Inventor Badge: Shape Spotter!'); });
      },
      onExit: function () { PIP.player.state.frozen = false; }
    });
  }

  /* =====================================================================
     MISSION 2 — Captain Shell's Boat (materials/floating + cargo count)
     ===================================================================== */
  var BX = -17, BZ = -9;   // boat floats in the water just south of the west dock
  var boatDone = PIP.save.mission('harbour.boat') === 'done';

  function hullMesh(kind) {
    var g = new THREE.Group();
    var col = kind === 'wood' ? 0xd8a869 : kind === 'sponge' ? 0xffd27f : 0x9aa3ac;
    var hull = A.mesh(A.GEO.box, A.mat(col), 0, 0, 0); hull.scale.set(2.2, 0.5, 1.1);
    var bowL = A.mesh(A.GEO.cone, A.mat(col), 1.25, 0, 0); bowL.rotation.z = -Math.PI / 2; bowL.scale.set(0.55, 0.6, 1.1);
    g.add(hull, bowL);
    if (kind === 'sponge') for (var i = 0; i < 5; i++) { var h = A.mesh(A.GEO.sphere, A.mat(0xffe0a0), U.rand(-0.9, 0.9), 0.1, U.rand(-0.4, 0.4)); h.scale.setScalar(0.12); g.add(h); }
    return g;
  }
  function crateMesh() { var m = A.mesh(A.GEO.box, A.mat(0xb98a55), 0, 0, 0); m.scale.set(0.5, 0.5, 0.5); return m; }

  function buildStaticBoat() {
    var g = hullMesh('wood'); g.position.set(BX, WATER_Y + 0.15, BZ); world.group.add(g);
    for (var i = 0; i < 4; i++) { var c = crateMesh(); c.position.set(BX - 0.75 + (i % 2) * 1.5, WATER_Y + 0.55, BZ - 0.3 + Math.floor(i / 2) * 0.6); world.group.add(c); }
  }
  if (boatDone) buildStaticBoat();

  world.addAt(A.makeSign('Boat Yard'), -12, -4);
  // a little marker buoy beside the build spot
  var buoy = A.mesh(A.GEO.sphere, A.mat(0xff6f6f), BX + 2.6, WATER_Y + 0.2, BZ); buoy.scale.set(0.3, 0.4, 0.3);
  world.group.add(buoy);

  var boatActive = false;
  world.interact({
    x: BX, z: BZ + 3.4, radius: 3.6, prompt: 'Build a boat', icon: '⛵',
    enabled: function () { return !boatDone && !boatActive; },
    onInteract: function () {
      boatActive = true;
      PIP.ui.say('Captain Shell', '🐢', [
        'I need a boat that FLOATS. Some materials float, some sink like a stone!',
        'Choose a hull and test it in the water. If it floats, we’ll load the shells.'
      ]).then(startBoatBuild);
    }
  });

  function startBoatBuild() {
    PIP.player.state.frozen = true;
    world.clearBeacon();
    PIP.game.tweenCamera(new THREE.Vector3(BX - 1, WATER_Y + 3.6, BZ + 5.5), new THREE.Vector3(BX, WATER_Y + 0.5, BZ));
    PIP.challenge.begin({
      id: 'harbour.boat', concept: 'dtMaterials',
      goal: 'Pick a hull that floats — then test it!',
      hints: [
        'Think about what floats. Wood floats on water. Stone sinks. Sponge soaks up water and sinks.',
        'Put a hull on the glowing water spot, then press Test it.',
        'If it sank, tap the hull to take it back and try the wooden one — wood floats!'
      ]
    });
    var parts = [
      { id: 'wood', name: 'Wood hull', icon: '🟫', count: 1, make: function () { return hullMesh('wood'); }, tip: 'Wood is light and floats!' },
      { id: 'sponge', name: 'Sponge hull', icon: '🧽', count: 1, make: function () { return hullMesh('sponge'); }, tip: 'Sponge soaks up water…' },
      { id: 'stone', name: 'Stone hull', icon: '🪨', count: 1, make: function () { return hullMesh('stone'); }, tip: 'Stone is heavy…' }
    ];
    var slots = [{
      id: 'hull', accepts: ['wood', 'sponge', 'stone'],
      pos: new THREE.Vector3(BX, WATER_Y + 0.15, BZ),
      ghost: function () {
        return new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.7, 1.3),
          new THREE.MeshBasicMaterial({ color: 0xffe27a, transparent: true, opacity: 0.35, depthWrite: false }));
      }
    }];
    PIP.builder.start({
      scene: world.group, parts: parts, slots: slots,
      tip: 'Pick a hull, tap the glowing water spot, then press Test it!',
      allowBack: true,
      canTest: function () { return slots[0].placed ? null : 'Choose a hull and place it on the water first.'; },
      onTest: function (api) {
        var hull = api.slots[0].placed.partId;
        var hullMeshRef = api.slots[0].placed.mesh;
        PIP.builder.setTesting(true);
        if (hull === 'wood') {
          bobBoat([hullMeshRef], function () {
            PIP.builder.setTesting(false);
            PIP.builder.finish();               // hull stays in the scene, player stays frozen
            loadCargoThenCount(hullMeshRef);
          });
        } else {
          sinkBoat([hullMeshRef], [hullMeshRef.position.y], function () {
            PIP.builder.setTesting(false);
            PIP.save.recordAttempt('dtMaterials', false, 0);
            PIP.ui.say('Captain Shell', '🐢', [
              hull === 'stone' ? 'Blub blub! Stone is too heavy — straight to the seabed!' : 'Blub! The sponge soaked up the sea and sank!',
              'Tap that hull to take it back, then try a material that FLOATS. What about wood?'
            ]);
          });
        }
      },
      onExit: function () { PIP.player.state.frozen = false; }
    });
  }
  // wood floated: load 4 crates with a counting flourish, then confirm the count
  function loadCargoThenCount(hullMeshRef) {
    var loaded = 0;
    function loadOne() {
      var c = crateMesh();
      c.position.set(BX - 0.75 + (loaded % 2) * 1.5, WATER_Y + 0.55, BZ - 0.3 + Math.floor(loaded / 2) * 0.6);
      world.group.add(c);
      loaded++;
      PIP.audio.play('count', loaded);
      PIP.narrate.callout(U.numWord(loaded) + '!');
      if (loaded < 4) setTimeout(loadOne, 500);
      else setTimeout(askCount, 650);
    }
    function askCount() {
      PIP.challenge.numberPick({
        question: 'The crates are loaded! Count them — how many crates?',
        answer: 4, options: [3, 4, 5],
        visual: { emoji: '📦', count: 4 },
        nudge: 'Point at each crate and count: one, two, three, four.',
        concept: 'counting'
      }).then(function () {
        PIP.player.state.frozen = false;
        boatDone = true;
        PIP.save.setMission('harbour.boat', 'done');
        PIP.save.recordAttempt('dtMaterials', true, 0);
        PIP.save.recordAttempt('counting', true, 0);
        PIP.save.addDesign({ name: 'Captain’s Boat', icon: '⛵', note: 'Wooden hull (floats), 4 crates of cargo.' });
        if (PIP.save.grantBadge('improver')) PIP.ui.toast('🔧', 'Inventor Badge: Clever Improver!');
        PIP.challenge.complete({
          title: 'She floats!',
          maths: '4 crates loaded',
          text: 'Wood is light, so the hull floats — and it carries all 4 crates. A heavy stone or a soggy sponge would have sunk!',
          speak: 'Wood floats! Your boat carries four crates. Stone and sponge would have sunk.'
        }).then(pointNext);
      });
    }
    setTimeout(loadOne, 300);
  }
  function bobBoat(meshes, done) {
    var t = 0;
    var ticker = function (dt) {
      t += dt;
      meshes.forEach(function (m, i) { m.position.y += Math.sin(t * 3 + i) * 0.004; });
      if (t > 1.4) { world.updaters.splice(world.updaters.indexOf(ticker), 1); PIP.audio.play('chime'); done(); }
    };
    PIP.audio.play('splash'); world.tick(ticker);
  }
  function sinkBoat(meshes, homeY, done) {
    PIP.audio.play('splash');
    var t = 0;
    var ticker = function (dt) {
      t += dt;
      meshes.forEach(function (m) { m.position.y -= dt * 1.3; });
      if (t > 1.3) {
        world.updaters.splice(world.updaters.indexOf(ticker), 1);
        meshes.forEach(function (m, i) { m.position.y = homeY[i]; }); // restore for another try
        PIP.audio.play('wobble'); done();
      }
    };
    world.tick(ticker);
  }

  /* =====================================================================
     MISSION 3 — Crane Directions (position & counting-on)
     ===================================================================== */
  var CX = 17;             // crane tower sits at the north edge of the east dock (z=6)
  var craneDone = PIP.save.mission('harbour.crane') === 'done';
  var crane = new THREE.Group();
  crane.position.set(CX, DOCK_Y, 6);
  var tower = A.mesh(A.GEO.box, A.mat(0x6b7a86), 0, 2, 0); tower.scale.set(0.5, 4, 0.5);
  var beam = A.mesh(A.GEO.box, A.mat(0x8a97a3), 0, 3.4, 4); beam.scale.set(0.35, 0.35, 8); // extends north over the water
  crane.add(tower, beam);
  world.group.add(crane);
  world.block(CX, 6, 0.8);
  // trolley + hanging parcel
  var trolley = A.mesh(A.GEO.box, A.mat(0xffd257), 0, 0, 0); trolley.scale.set(0.5, 0.35, 0.5);
  var parcel = A.mesh(A.GEO.box, A.mat(0xff8a5c), 0, 0, 0); parcel.scale.set(0.5, 0.5, 0.5);
  var line = A.mesh(A.GEO.cyl, A.mat(0x333333), 0, 0, 0); line.scale.set(0.03, 1.4, 0.03);
  // three target boats north of the crane, under the beam, at trolley steps 1,2,3
  var BOAT_Z = [8, 10, 12];
  BOAT_Z.forEach(function (bz, i) {
    var b = hullMesh('wood'); b.scale.setScalar(0.55); b.position.set(CX, WATER_Y + 0.1, bz);
    b.rotation.y = Math.PI / 2;
    world.group.add(b);
    var num = A.textSprite(String(i + 1), { px: 70, scale: 0.7, color: '#fff' });
    num.position.set(CX, WATER_Y + 1.2, bz);
    world.group.add(num);
  });
  var craneState = { pos: 0 };
  function placeTrolley() {
    var lz = 2 + craneState.pos * 2;      // local z: pos 0 → z2 (world 8), pos 2 → z6 (world 12)
    trolley.position.set(0, 3.0, lz);
    parcel.position.set(0, 2.1, lz);
    line.position.set(0, 2.6, lz);
  }
  crane.add(trolley, parcel, line);
  placeTrolley();
  if (craneDone) { parcel.visible = false; }

  world.addAt(A.makeSign('Cargo Crane'), CX - 3, 3);
  var craneActive = false;
  world.interact({
    x: CX, z: 3, radius: 3.4, prompt: 'Work the crane', icon: '🏗️',
    enabled: function () { return !craneDone && !craneActive; },
    onInteract: function () {
      craneActive = true;
      PIP.ui.say('Captain Shell', '🐢', [
        'The crane must drop its parcel on boat number 3.',
        'The parcel is above boat 1. Count the steps FORWARD to reach boat 3!'
      ]).then(startCrane);
    }
  });
  function startCrane() {
    PIP.player.state.frozen = true;
    world.clearBeacon();
    PIP.game.tweenCamera(new THREE.Vector3(CX - 6, DOCK_Y + 5, 4), new THREE.Vector3(CX, DOCK_Y + 1, 10));
    PIP.challenge.begin({
      id: 'harbour.crane', concept: 'counting',
      goal: 'How many steps forward from boat 1 to boat 3?',
      hints: [
        'The parcel is over boat 1. Count on: boat 2, boat 3…',
        'From 1 to 3 is two hops forward.',
        'Point along the boats: one hop to boat 2, two hops to boat 3. The answer is 2.'
      ]
    });
    PIP.challenge.numberPick({
      question: 'The parcel is over boat 1. How many steps forward to boat 3?',
      answer: 2,
      options: [1, 2, 3],
      visual: { emoji: '⛵', count: 3 },
      nudge: 'Count on from boat one: two, three. How many hops was that?',
      concept: 'counting'
    }).then(function () {
      runCrane();
    });
  }
  function runCrane() {
    var t = 0, dropping = false, dropped = false;
    var targetPos = 2;
    PIP.audio.play('gear');
    var ticker = function (dt) {
      t += dt;
      if (!dropping) {
        // slide forward: reach step 2 over ~1.2s
        craneState.pos = Math.min(targetPos, t / 0.6);
        placeTrolley();
        if (t >= targetPos * 0.6) { craneState.pos = targetPos; placeTrolley(); dropping = true; }
      } else if (dropping && !dropped) {
        parcel.position.y -= dt * 3;            // lower the parcel (local y) toward the boat
        if (parcel.position.y <= (WATER_Y + 0.55) - DOCK_Y) { dropped = true; PIP.audio.play('chime'); }
      } else if (dropped) {
        world.updaters.splice(world.updaters.indexOf(ticker), 1);
        line.visible = false;
        PIP.player.state.frozen = false;
        craneDone = true;
        PIP.save.setMission('harbour.crane', 'done');
        PIP.save.recordAttempt('counting', true, 0);
        if (PIP.save.grantBadge('mechanism')) PIP.ui.toast('⚙️', 'Inventor Badge: Mechanism Maker!');
        PIP.challenge.complete({
          title: 'Parcel delivered!',
          maths: '1 → 2 → 3  (2 steps)',
          text: 'Two steps forward carried the parcel from boat 1 all the way to boat 3. That is counting on!',
          speak: 'Two steps forward — boat two, boat three. The parcel landed right on target!'
        }).then(pointNext);
      }
    };
    world.tick(ticker);
  }

  /* =====================================================================
     HIDDEN — Shape Spotter (which shape has 3 sides?)
     ===================================================================== */
  var hiddenDone = PIP.save.mission('harbour.hidden') === 'done';
  var HX = 3.5, HZ = -15;
  var padHit = hiddenDone;
  var shapePads = [
    { sides: 4, label: '⬛', x: HX - 2.4, correct: false },
    { sides: 3, label: '🔺', x: HX, correct: true },
    { sides: 0, label: '⚫', x: HX + 2.4, correct: false }
  ];
  var hiddenIntroDone = hiddenDone;
  shapePads.forEach(function (sp) {
    var pad = A.mesh(A.GEO.cyl, A.mat(hiddenDone && sp.correct ? 0x8ce68a : 0xbfae8a), sp.x, DOCK_Y + 0.05, HZ);
    pad.scale.set(1.1, 0.2, 1.1);
    world.group.add(pad);
    var lab = A.textSprite(sp.label, { px: 80, scale: 0.9 });
    lab.position.set(sp.x, DOCK_Y + 1.4, HZ);
    world.group.add(lab);
    sp.pad = pad;
    world.tick(function (dt) {
      if (padHit) return;
      var ps = PIP.player.state;
      if (ps.grounded && ps.anim.land > 0.2 && U.dist2(ps.pos.x, ps.pos.z, sp.x, HZ) < 1.3) onPad(sp);
    });
  });
  world.addAt(A.makeSign('Secret: jump the 3-sided shape!'), HX - 4, HZ + 2);
  world.tick(function (dt) {
    if (hiddenIntroDone) return;
    var ps = PIP.player.state.pos;
    if (U.dist2(ps.x, ps.z, HX, HZ) < 30) {
      hiddenIntroDone = true;
      PIP.challenge.begin({
        id: 'harbour.hidden', concept: 'shapes',
        goal: 'JUMP onto the shape with exactly 3 sides!',
        hints: ['Count the sides of each shape.', 'A triangle has 3 straight sides. A square has 4. A circle has none.', 'The red triangle 🔺 is the one with 3 sides — jump on it!']
      });
    }
  });
  function onPad(sp) {
    if (padHit) return;
    if (sp.correct) {
      padHit = true;
      PIP.save.setMission('harbour.hidden', 'done');
      PIP.save.recordAttempt('shapes', true, 0);
      sp.pad.material = A.mat(0x8ce68a);
      PIP.audio.play('success');
      if (PIP.save.grantBadge('shape')) PIP.ui.toast('🔷', 'Inventor Badge: Shape Spotter!');
      world.seed('h_hidden1', HX - 1, HZ, 0.8);
      world.seed('h_hidden2', HX + 1, HZ, 0.8);
      PIP.challenge.complete({
        title: 'Shape spotted!',
        maths: 'triangle = 3 sides',
        text: 'A triangle has exactly 3 straight sides. Squares have 4, and circles have none!',
        speak: 'A triangle has three sides. You spotted it!'
      });
    } else {
      PIP.audio.play('notyet');
      PIP.narrate.say(sp.sides === 4 ? 'That square has 4 sides. Look for 3!' : 'A circle has no straight sides. Find the 3-sided shape!');
      PIP.save.recordAttempt('shapes', false, 0);
    }
  }

  /* =====================================================================
     IDEA CORE
     ===================================================================== */
  var coreTaken = PIP.save.hasCore('harbour');
  var corePedestal = A.mesh(A.GEO.cyl, A.mat(0xd7b356), 0, DOCK_Y + 0.1, 4); corePedestal.scale.set(0.8, 1.0, 0.8);
  world.group.add(corePedestal);
  world.block(0, 4, 1.0);
  var core = A.makeCore(0x8fd8ff);
  world.add(core, 0, DOCK_Y + 0.9, 4);
  core.visible = false;
  var coreT = 0;
  world.tick(function (dt) {
    if (!core.visible) return;
    coreT += dt;
    core.position.y = DOCK_Y + 1.4 + Math.sin(coreT * 2) * 0.15;
    core.rotation.y += dt; core.userData.ring.rotation.z += dt * 2;
  });
  function checkAllMissions() {
    var all = ['harbour.lighthouse', 'harbour.boat', 'harbour.crane'].every(function (m) { return PIP.save.mission(m) === 'done'; });
    if (all && !coreTaken && !core.visible) {
      core.visible = true;
      PIP.audio.play('unlock');
      PIP.ui.say('Captain Shell', '🐢', [
        'Shiver me shapes — the harbour works again!',
        'The Idea Core has bobbed up by the plaza. Go and collect it, inventor!'
      ]).then(function () { PIP.ui.setGoal('Collect the Harbour Idea Core! 💡', false); world.setBeacon(0, 4); });
    }
  }
  world.interact({
    x: 0, z: 4, radius: 2.4, prompt: 'Take the Idea Core', icon: '💡',
    enabled: function () { return core.visible && !coreTaken; },
    onInteract: function () {
      coreTaken = true; core.visible = false;
      PIP.save.grantCore('harbour'); PIP.ui.updateHUD(); world.clearBeacon();
      PIP.audio.play('fanfare');
      PIP.ui.summary({
        title: 'IDEA CORE FOUND! 💡',
        text: 'The Harbour Idea Core is safe! Three of five recovered. Take it home to Inventor Village.',
        speak: 'You found the Harbour Idea Core! Take it back to Inventor Village.',
        stars: '💡⭐💡'
      }).then(function () { PIP.ui.setGoal('Return to Inventor Village through the green gate. 🏡', false); world.setBeacon(0, -20); });
    }
  });

  /* ---------- scenery, seeds, ambience ---------- */
  world.butterflies(4, 0, 0, 16);
  // bobbing gulls (butterflies reused as birds high up) & sparkles handled by seeds
  world.seed('h1', 0, 20, 0.7);
  world.seed('h2', 18, 4, 0.7);
  world.seed('h3', -20, 4, 0.7);
  world.seed('h4', 4, 4, 1.2);           // near the plaza
  world.seed('h5', 0, 9, -0.9);          // in the water on the north walk (swim!)
  world.seed('h6', 20, -20, -0.9);       // far corner, a swim reward

  // a few decorative sailboats bobbing in the distance
  [[-12, 12], [12, -12], [-14, -10]].forEach(function (p, i) {
    var sb = hullMesh('wood'); sb.scale.setScalar(0.7);
    sb.position.set(p[0], WATER_Y + 0.15, p[1]);
    var mast = A.mesh(A.GEO.cyl, A.mat(0x8a6142), 0, 0.8, 0); mast.scale.set(0.05, 1.6, 0.05); sb.add(mast);
    var sail = A.mesh(A.GEO.box, A.mat([0xff9ec4, 0xffe27a, 0x9fd8ff][i]), 0, 0.9, 0.02); sail.scale.set(0.05, 1, 0.9); sb.add(sail);
    world.group.add(sb);
    var t = U.rand(0, 6);
    world.tick(function (dt) { t += dt; sb.position.y = WATER_Y + 0.15 + Math.sin(t * 1.5) * 0.08; sb.rotation.z = Math.sin(t) * 0.06; });
  });

  /* ---------- arrival ---------- */
  world.postEnter = function () {
    // reveal core immediately if everything already done
    checkAllMissions();
    if (!PIP.save.mission('harbour.intro')) {
      PIP.save.setMission('harbour.intro', 'done');
      return PIP.ui.say('Captain Shell', '🐢', [
        'Ahoy, Pip! Captain Shell at your service. Welcome to Shape Sail Harbour!',
        'The Mix-Up Machine jumbled my lighthouse, my boat and my crane.',
        'Three quick jobs — and remember, a splash in the sea is just a swim. Off you go!'
      ]).then(pointNext);
    }
    pointNext();
    return Promise.resolve();
  };

  return world;
};
