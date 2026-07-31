/* World 4 — Measure Mountain (short missions).
   Mission 1: Mountain shelter — insulation & materials, a heat meter (DT materials)
   Mission 2: Cable carrier    — measuring length, choose the right rope, pulley
   Mission 3: Rescue sled      — mass & counting in fives, keep under the safe load
   Hidden:    Clock climb       — o'clock and half past (simple time)
   Reward:    the Mountain Idea Core */
PIP.worlds = PIP.worlds || {};

PIP.worlds.mountain = function () {
  var U = PIP.util, A = PIP.assets, K = PIP.worldkit;

  function terrainFn(x, z) {
    var y = 0.4 + Math.sin(x * 0.08) * Math.cos(z * 0.09) * 0.6;
    y += U.hill(x, z, 0, 6, 10, 1.6);        // central rise where the core sits
    var d = Math.sqrt(x * x + z * z);
    if (d > 24) y -= (d - 24) * 1.7;
    return y;
  }
  function colorFn(x, z, y) {
    var n = Math.sin(x * 0.3) * Math.cos(z * 0.33);
    return y > 1.6 ? '#ffffff' : n < -0.4 ? '#d6e4f5' : '#eef6ff';
  }

  var world = K.createWorld({
    id: 'mountain', music: 'mountain', sky: 0xbfe6ff,
    groundFn: terrainFn, colorFn: colorFn, size: 66, segs: 84,
    bounds: { minX: -24, maxX: 24, minZ: -24, maxZ: 24 },
    spawn: { x: 0, z: -6, angle: 0 },
    killY: -14
  });

  /* ---------- return gate ---------- */
  var backGate = A.makeGate(0x8fd483);
  world.addAt(backGate, 0, -15);
  backGate.rotation.y = 0;
  backGate.userData.swirl.material.opacity = 0.5;
  world.interact({ x: 0, z: -15, radius: 2.4, prompt: 'Back to Inventor Village', icon: '🏡', onInteract: function () { PIP.game.gotoWorld('hub'); } });
  world.addAt(A.makeSign('Inventor Village'), 3, -13);

  /* ---------- characters ---------- */
  function makeFizz() {
    var g = new THREE.Group();
    var body = A.mesh(A.GEO.sphere, A.mat(0xffffff), 0, 0.5, 0); body.scale.set(0.45, 0.4, 0.55);
    var head = A.mesh(A.GEO.sphere, A.mat(0xffffff), 0, 0.85, 0.35); head.scale.setScalar(0.3);
    var snout = A.mesh(A.GEO.sphere, A.mat(0xf0f0f8), 0, 0.8, 0.6); snout.scale.set(0.13, 0.1, 0.12);
    var nose = A.mesh(A.GEO.sphere, A.mat(0xff8aa0), 0, 0.82, 0.68); nose.scale.setScalar(0.04);
    var tail = A.mesh(A.GEO.sphere, A.mat(0xffffff), 0, 0.55, -0.5); tail.scale.set(0.14, 0.14, 0.22);
    [-1, 1].forEach(function (s) {
      var ear = A.mesh(A.GEO.cone, A.mat(0xdfe6ff), 0.16 * s, 1.06, 0.32); ear.scale.set(0.1, 0.2, 0.1); g.add(ear);
      var e = A.mesh(A.GEO.sphere, A.mat(0x2b2b33), 0.1 * s, 0.88, 0.61); e.scale.set(0.045, 0.055, 0.03); g.add(e);
      var leg = A.mesh(A.GEO.sphere, A.mat(0xffffff), 0.2 * s, 0.12, 0.1); leg.scale.setScalar(0.13); g.add(leg);
    });
    g.add(body, head, snout, nose, tail);
    return g;
  }
  function makeFrostling(color) {
    var g = new THREE.Group();
    var b = A.mesh(A.GEO.sphere, A.mat(color || 0x9fd8ff), 0, 0.3, 0); b.scale.set(0.26, 0.32, 0.26);
    [-1, 1].forEach(function (s) {
      var e = A.mesh(A.GEO.sphere, A.mat(0xffffff), 0.08 * s, 0.36, 0.2); e.scale.set(0.05, 0.06, 0.03); g.add(e);
      var p = A.mesh(A.GEO.sphere, A.mat(0x2b2b33), 0.08 * s, 0.36, 0.23); p.scale.set(0.025, 0.03, 0.02); g.add(p);
    });
    g.add(b);
    return g;
  }
  var fizz = makeFizz();
  world.addAt(fizz, 0, -1);
  world.block(0, -1, 0.7);
  var fzT = 0;
  world.tick(function (dt) {
    fzT += dt; fizz.position.y = terrainFn(0, -1) + Math.abs(Math.sin(fzT * 2)) * 0.05;
    var pp = PIP.player.state.pos;
    if (U.dist2(pp.x, pp.z, 0, -1) < 60) fizz.rotation.y = U.angleLerp(fizz.rotation.y, Math.atan2(pp.x, pp.z + 1), Math.min(1, dt * 3));
  });
  world.interact({
    x: 0, z: -1, radius: 2.6, prompt: 'Talk to Fizz', icon: '🐺',
    onInteract: function () {
      var done = ['mountain.shelter', 'mountain.cable', 'mountain.sled'].filter(function (m) { return PIP.save.mission(m) === 'done'; }).length;
      if (done === 3 && !PIP.save.hasCore('mountain')) { PIP.ui.say('Fizz', '🐺', ['Woof! The mountain works again — the Idea Core is up on the rise. Go fetch!']); return; }
      if (done === 3) { PIP.ui.say('Fizz', '🐺', ['Warm shelter, a cable that carries, a safe sled — you measured it all perfectly!']); return; }
      PIP.ui.say('Fizz', '🐺', [
        'Brrr! Welcome to Measure Mountain, Pip. I am Fizz.',
        'Three jobs need a good measurer: warm up the Frostling’s cave, mend the cable carrier, and pack the rescue sled.',
        'Take your time — nothing here is timed!'
      ]).then(pointNext);
    }
  });
  function pointNext() {
    checkAllMissions();
    if (PIP.save.mission('mountain.shelter') !== 'done') { PIP.ui.setGoal('Warm the Frostling’s cave to the north. 🏠', false); world.setBeacon(0, 12); }
    else if (PIP.save.mission('mountain.cable') !== 'done') { PIP.ui.setGoal('Mend the cable carrier to the east. 🚡', false); world.setBeacon(12, 0); }
    else if (PIP.save.mission('mountain.sled') !== 'done') { PIP.ui.setGoal('Pack the rescue sled to the west. 🛷', false); world.setBeacon(-13, 0); }
    else if (!PIP.save.hasCore('mountain')) { PIP.ui.setGoal('Collect the Mountain Idea Core on the rise! 💡', false); world.setBeacon(0, 6); }
    else PIP.ui.clearGoal();
  }

  /* =====================================================================
     MISSION 1 — Mountain shelter (insulation & materials + heat meter)
     ===================================================================== */
  var SHX = 0, SHZ = 12;
  var shelterDone = PIP.save.mission('mountain.shelter') === 'done';
  // cave mound
  var mound = A.mesh(A.GEO.sphere, A.mat(0xdfe8f5), SHX, terrainFn(SHX, SHZ) + 1.2, SHZ); mound.scale.set(2.6, 2.0, 2.4);
  world.group.add(mound);
  var caveHole = A.mesh(A.GEO.sphere, A.mat(0x3a4658), SHX, terrainFn(SHX, SHZ) + 0.9, SHZ - 2.0); caveHole.scale.set(1.0, 1.1, 0.7);
  world.group.add(caveHole);
  world.block(SHX, SHZ, 2.2);
  var frostling = makeFrostling(0x9fd8ff);
  world.add(frostling, SHX, terrainFn(SHX, SHZ), SHZ - 2.2);
  var frShiver = 0;
  world.tick(function (dt) { frShiver += dt; if (!shelterDone) frostling.position.x = SHX + Math.sin(frShiver * 22) * 0.03; });
  world.addAt(A.makeSign('Cosy Cave'), SHX + 3, SHZ - 2);

  // thermometer (heat meter)
  var thermo = new THREE.Group();
  var tube = A.mesh(new THREE.CylinderGeometry(0.16, 0.16, 2, 10), A.mat(0xffffff), 0, 1, 0);
  var bulb = A.mesh(A.GEO.sphere, A.mat(0xff5b5b), 0, 0, 0); bulb.scale.setScalar(0.3);
  var fill = A.mesh(new THREE.CylinderGeometry(0.1, 0.1, 2, 10), A.mat(0xff5b5b), 0, 0, 0);
  thermo.add(tube, bulb, fill);
  thermo.position.set(SHX - 3, terrainFn(SHX - 3, SHZ - 2) + 0.3, SHZ - 2);
  world.group.add(thermo);
  function setHeat(f) { fill.scale.y = Math.max(0.02, f); fill.position.y = fill.scale.y; }
  setHeat(shelterDone ? 1 : 0.15);

  var shelterActive = false;
  world.interact({
    x: SHX, z: SHZ - 3.4, radius: 3.0, prompt: 'Warm the cave', icon: '🏠',
    enabled: function () { return !shelterDone && !shelterActive; },
    onInteract: function () {
      shelterActive = true;
      PIP.ui.say('Fizz', '🐺', [
        'The little Frostling is shivering! Choose a WALL and a BLANKET to keep the wind and cold out.',
        'Some materials trap warmth, some let it whoosh away. Watch the heat meter when you test!'
      ]).then(startShelterBuild);
    }
  });
  function startShelterBuild() {
    PIP.player.state.frozen = true; world.clearBeacon();
    PIP.game.tweenCamera(new THREE.Vector3(SHX - 4, terrainFn(SHX, SHZ) + 3.5, SHZ - 6), new THREE.Vector3(SHX, terrainFn(SHX, SHZ) + 1, SHZ - 2));
    PIP.challenge.begin({
      id: 'mountain.shelter', concept: 'dtMaterials',
      goal: 'Pick warm materials, then test the heat meter!',
      hints: ['Thick, soft, cosy things trap heat. Thin, shiny, icy things let cold in.',
        'Wood walls keep wind out better than ice. Wool is warmer than foil.',
        'Try WOOD walls and a WOOL blanket — then press Test it!']
    });
    // warmth score: choose one wall + one blanket; cosy if total >= 3
    var WALL = { ice: 0, stone: 1, wood: 2 }, BLANK = { foil: 0, straw: 1, wool: 2 };
    var parts = [
      { id: 'ice', name: 'Ice wall', icon: '🧊', count: 1, make: function () { return wallMesh(0xbfeaff); }, tip: 'Ice… stays cold.' },
      { id: 'stone', name: 'Stone wall', icon: '🪨', count: 1, make: function () { return wallMesh(0x9aa3ac); }, tip: 'Stone blocks wind.' },
      { id: 'wood', name: 'Wood wall', icon: '🟫', count: 1, make: function () { return wallMesh(0xc98d5a); }, tip: 'Wood keeps warmth in!' },
      { id: 'foil', name: 'Foil blanket', icon: '🔩', count: 1, make: function () { return blanketMesh(0xd8d8e0); }, tip: 'Thin and cold.' },
      { id: 'straw', name: 'Straw', icon: '🌾', count: 1, make: function () { return blanketMesh(0xe8c96a); }, tip: 'Straw is warmish.' },
      { id: 'wool', name: 'Wool blanket', icon: '🧶', count: 1, make: function () { return blanketMesh(0xff9ec4); }, tip: 'Wool is snuggly-warm!' }
    ];
    var slots = [
      { id: 'wall', accepts: ['ice', 'stone', 'wood'], pos: new THREE.Vector3(SHX - 1.4, terrainFn(SHX, SHZ) + 1.1, SHZ - 1.6),
        ghost: bigGhost },
      { id: 'blanket', accepts: ['foil', 'straw', 'wool'], pos: new THREE.Vector3(SHX + 1.4, terrainFn(SHX, SHZ) + 0.7, SHZ - 1.6), ghost: bigGhost }
    ];
    PIP.builder.start({
      scene: world.group, parts: parts, slots: slots,
      tip: 'Pick a wall and a blanket, tap the two glowing spots, then Test it!',
      allowBack: true,
      canTest: function () { return (slots[0].placed && slots[1].placed) ? null : 'Choose a wall AND a blanket first.'; },
      onTest: function (api) {
        var w = api.slots[0].placed.partId, b = api.slots[1].placed.partId;
        var score = WALL[w] + BLANK[b]; // 0..4
        PIP.builder.setTesting(true);
        var t = 0, target = score / 4;
        var ticker = function (dt) {
          t += dt; setHeat(0.15 + (target - 0.15) * Math.min(1, t / 1.2));
          if (t > 1.4) {
            world.updaters.splice(world.updaters.indexOf(ticker), 1);
            PIP.builder.setTesting(false);
            if (score >= 3) {
              PIP.builder.finish(); PIP.player.state.frozen = false;
              shelterDone = true; PIP.save.setMission('mountain.shelter', 'done');
              PIP.save.recordAttempt('dtMaterials', true, 0);
              PIP.save.addDesign({ name: 'Warm Shelter', icon: '🏠', note: 'Wood walls + wool blanket = cosy!' });
              if (PIP.save.grantBadge('improver')) PIP.ui.toast('🔧', 'Inventor Badge: Clever Improver!');
              PIP.audio.play('chime');
              PIP.challenge.complete({
                title: 'Toasty warm!', maths: 'warm walls + warm blanket = cosy',
                text: 'Thick, soft materials trap heat. The Frostling has stopped shivering and is snuggled up warm!',
                speak: 'Warm walls and a warm blanket keep the heat in. The Frostling is cosy now!'
              }).then(pointNext);
            } else {
              PIP.audio.play('notyet');
              PIP.save.recordAttempt('dtMaterials', false, 0);
              PIP.ui.say('Fizz', '🐺', ['Brrr, still chilly — the heat meter barely moved!', 'Tap a material to swap it. Thicker, softer, warmer things trap more heat. Try wood and wool!']);
            }
          }
        };
        world.tick(ticker);
      },
      onExit: function () { PIP.player.state.frozen = false; }
    });
  }
  function wallMesh(c) { var m = A.mesh(A.GEO.box, A.mat(c), 0, 0, 0); m.scale.set(2, 1.4, 0.4); return m; }
  function blanketMesh(c) { var m = A.mesh(A.GEO.box, A.mat(c), 0, 0, 0); m.scale.set(1.2, 0.2, 1.0); return m; }
  function bigGhost() { return new THREE.Mesh(new THREE.SphereGeometry(0.8, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffe27a, transparent: true, opacity: 0.35, depthWrite: false })); }

  /* =====================================================================
     MISSION 2 — Cable carrier (measure length + pulley)
     ===================================================================== */
  var CBX = 12, CBZ = 0;
  var cableDone = PIP.save.mission('mountain.cable') === 'done';
  var GAP = 5;
  // near & far posts across a gap, with measuring marks
  var nearPost = A.mesh(A.GEO.cyl, A.mat(0x8a6142), CBX, terrainFn(CBX, CBZ) + 1.4, CBZ); nearPost.scale.set(0.2, 2.8, 0.2);
  var farPost = A.mesh(A.GEO.cyl, A.mat(0x8a6142), CBX + GAP + 1, terrainFn(CBX + GAP + 1, CBZ) + 1.4, CBZ); farPost.scale.set(0.2, 2.8, 0.2);
  world.group.add(nearPost, farPost);
  world.block(CBX, CBZ, 0.5);
  // measuring flags 1..5 between posts
  for (var m = 1; m <= GAP; m++) {
    var flag = A.textSprite(String(m), { px: 60, scale: 0.6, color: '#3e6fd0' });
    flag.position.set(CBX + m, terrainFn(CBX, CBZ) + 0.6, CBZ + 0.6);
    world.group.add(flag);
  }
  // far ledge (where the carrier delivers)
  var ledge = A.mesh(A.GEO.box, A.mat(0xeef6ff), CBX + GAP + 2.5, terrainFn(CBX, CBZ) + 0.3, CBZ); ledge.scale.set(2.5, 0.6, 3);
  world.group.add(ledge);
  var basket = A.mesh(A.GEO.box, A.mat(0xd8a869), CBX, terrainFn(CBX, CBZ) + 2.6, CBZ); basket.scale.set(0.6, 0.5, 0.6);
  world.group.add(basket);
  var supply = makeFrostling(0xc9a6ff); world.add(supply, CBX + GAP + 2.5, terrainFn(CBX, CBZ) + 0.6, CBZ);
  world.addAt(A.makeSign('Cable Carrier'), CBX - 1, CBZ - 3);
  var ropeLine = null;
  if (cableDone) { drawRope(GAP); basket.position.x = CBX + GAP + 1; }

  var cableActive = false;
  world.interact({
    x: CBX, z: CBZ + 2.5, radius: 3.0, prompt: 'Mend the cable', icon: '🚡',
    enabled: function () { return !cableDone && !cableActive; },
    onInteract: function () {
      cableActive = true;
      PIP.ui.say('Fizz', '🐺', [
        'The cable carrier needs a NEW rope to reach across the gap.',
        'Count the little flags — how many units wide is the gap? Then pick the rope that is JUST long enough.'
      ]).then(function () {
        PIP.challenge.begin({
          id: 'mountain.cable', concept: 'measure',
          goal: 'Measure the gap, then choose the rope that fits.',
          hints: ['Count the numbered flags from post to post.', 'The gap is 5 units. A 3-rope is too short; a 7-rope droops.',
            'Pick the rope that measures exactly 5 — just right!']
        });
        PIP.challenge.numberPick({
          question: 'Count the flags — how many units wide is the gap?',
          answer: 5, options: [3, 5, 7],
          visual: { total: 5, filled: 5 },
          nudge: 'Point at each flag: 1, 2, 3, 4, 5.',
          concept: 'measure'
        }).then(function () {
          drawRope(GAP); PIP.audio.play('creak');
          // pulley carries the basket across
          var t = 0;
          PIP.player.state.frozen = true;
          PIP.game.tweenCamera(new THREE.Vector3(CBX - 2, terrainFn(CBX, CBZ) + 4, CBZ + 7), new THREE.Vector3(CBX + GAP / 2, terrainFn(CBX, CBZ) + 1.5, CBZ));
          var ticker = function (dt) {
            t += dt; basket.position.x = U.lerp(CBX, CBX + GAP + 1, Math.min(1, t / 2.2));
            basket.position.y = terrainFn(CBX, CBZ) + 2.6 - Math.sin(Math.min(1, t / 2.2) * Math.PI) * 0.3;
            if (t > 2.4) {
              world.updaters.splice(world.updaters.indexOf(ticker), 1);
              PIP.player.state.frozen = false;
              cableDone = true; PIP.save.setMission('mountain.cable', 'done');
              PIP.save.recordAttempt('measure', true, 0);
              if (PIP.save.grantBadge('mechanism')) PIP.ui.toast('⚙️', 'Inventor Badge: Mechanism Maker!');
              PIP.audio.play('chime');
              PIP.challenge.complete({
                title: 'The cable carries again!', maths: 'gap = 5 units → rope = 5',
                text: 'A rope exactly 5 units long stretched across and the pulley whisked the basket over. Measuring means choosing the size that fits!',
                speak: 'The gap was five units, so the five-rope was just right. Over goes the basket!'
              }).then(pointNext);
            }
          };
          world.tick(ticker);
        });
      });
    }
  });
  function drawRope(len) {
    if (ropeLine) return;
    ropeLine = A.mesh(A.GEO.cyl, A.mat(0x5b5b5b), CBX + (len + 1) / 2, terrainFn(CBX, CBZ) + 2.8, CBZ);
    ropeLine.scale.set(0.04, len + 1, 0.04); ropeLine.rotation.z = Math.PI / 2;
    world.group.add(ropeLine);
  }

  /* =====================================================================
     MISSION 3 — Rescue sled (mass, counting in fives)
     ===================================================================== */
  var SLX = -13, SLZ = 0;
  var sledDone = PIP.save.mission('mountain.sled') === 'done';
  // a downhill ramp
  var ramp = A.mesh(A.GEO.box, A.mat(0xeef6ff), SLX, terrainFn(SLX, SLZ) + 0.4, SLZ); ramp.scale.set(2.4, 0.4, 8); ramp.rotation.x = -0.16;
  world.group.add(ramp);
  var sled = new THREE.Group();
  var sledBase = A.mesh(A.GEO.box, A.mat(0xd8a869), 0, 0.15, 0); sledBase.scale.set(1.4, 0.2, 2.0);
  var sledRunner = A.mesh(A.GEO.box, A.mat(0x8a6142), 0, 0, 0); sledRunner.scale.set(1.5, 0.1, 2.2);
  sled.add(sledBase, sledRunner);
  sled.position.set(SLX, terrainFn(SLX, SLZ) + 0.8, SLZ - 3);
  world.group.add(sled);
  world.block(SLX, SLZ, 0.8);
  world.addAt(A.makeSign('Rescue Sled'), SLX + 2, SLZ - 4);
  var sledSacks = [];
  function loadSack(i) {
    var s = A.mesh(A.GEO.sphere, A.mat(0xb98a55), -0.4 + (i % 3) * 0.4, 0.45, -0.3); s.scale.set(0.25, 0.3, 0.25);
    sled.add(s); sledSacks.push(s);
  }
  if (sledDone) { for (var q = 0; q < 3; q++) loadSack(q); sled.position.z = SLZ + 3; }

  var sledActive = false;
  world.interact({
    x: SLX, z: SLZ - 3, radius: 3.0, prompt: 'Pack the sled', icon: '🛷',
    enabled: function () { return !sledDone && !sledActive; },
    onInteract: function () {
      sledActive = true;
      PIP.ui.say('Fizz', '🐺', [
        'Load the rescue sled — but not too heavy, or it will race away!',
        'Each supply sack weighs 5 kg. The sled is safe up to 15 kg. Count in fives to find how many sacks fit.'
      ]).then(function () {
        PIP.challenge.begin({
          id: 'mountain.sled', concept: 'counting2s',
          goal: 'How many 5 kg sacks keep the sled at (or under) 15 kg?',
          hints: ['Count in fives: 5, 10, 15…', 'Each sack is 5. Stop at 15 kg — that is the safe limit.',
            'Five, ten, fifteen — that is three sacks. Three fives make fifteen!']
        });
        PIP.challenge.numberPick({
          question: 'Sacks weigh 5 kg. Safe up to 15 kg. How many sacks? (5, 10, 15…)',
          answer: 3, options: [2, 3, 4],
          visual: { emoji: '⬜', count: 3 },
          nudge: 'Count in fives to 15: five, ten, fifteen. How many fives?',
          concept: 'counting2s'
        }).then(function () {
          PIP.player.state.frozen = true;
          PIP.game.tweenCamera(new THREE.Vector3(SLX - 4, terrainFn(SLX, SLZ) + 3.5, SLZ + 4), new THREE.Vector3(SLX, terrainFn(SLX, SLZ) + 1, SLZ));
          var loaded = 0;
          function loadOne() {
            loadSack(loaded); loaded++; PIP.audio.play('count', loaded * 5 % 8); PIP.narrate.callout((loaded * 5) + ' kilos!');
            if (loaded < 3) setTimeout(loadOne, 480); else setTimeout(slide, 700);
          }
          function slide() {
            var t = 0;
            var ticker = function (dt) {
              t += dt; sled.position.z = U.lerp(SLZ - 3, SLZ + 4, Math.min(1, t / 2)); sled.position.y = terrainFn(SLX, SLZ) + 0.8 - Math.min(1, t / 2) * 0.6;
              if (t > 2.1) {
                world.updaters.splice(world.updaters.indexOf(ticker), 1);
                PIP.player.state.frozen = false;
                sledDone = true; PIP.save.setMission('mountain.sled', 'done');
                PIP.save.recordAttempt('counting2s', true, 0);
                if (PIP.save.grantBadge('counter')) PIP.ui.toast('🔢', 'Inventor Badge: Careful Counter!');
                PIP.audio.play('chime');
                PIP.challenge.complete({
                  title: 'Safely down the mountain!', maths: '5 + 5 + 5 = 15 kg',
                  text: 'Three sacks of 5 kg make exactly 15 kg — right on the safe limit. Counting in fives keeps the sled from racing away!',
                  speak: 'Five, ten, fifteen. Three sacks make fifteen kilos — safe and steady down the slope!'
                }).then(pointNext);
              }
            };
            PIP.audio.play('whoosh'); world.tick(ticker);
          }
          setTimeout(loadOne, 300);
        });
      });
    }
  });

  /* =====================================================================
     HIDDEN — Clock climb (o'clock & half past)
     ===================================================================== */
  var clockDone = PIP.save.mission('mountain.clock') === 'done';
  var CLX = 11, CLZ = -9;
  function makeClock(hour, half) {
    var g = new THREE.Group();
    var face = A.mesh(new THREE.CylinderGeometry(1, 1, 0.2, 24), A.mat(0xffffff), 0, 0, 0); face.rotation.x = Math.PI / 2;
    g.add(face);
    for (var h = 0; h < 12; h++) { var a = h / 12 * Math.PI * 2; var tick = A.mesh(A.GEO.box, A.mat(0x2b2b33), Math.sin(a) * 0.82, Math.cos(a) * 0.82, 0.12); tick.scale.set(0.06, 0.14, 0.05); g.add(tick); }
    // hour hand
    var ha = ((hour % 12) + (half ? 0.5 : 0)) / 12 * Math.PI * 2;
    var hour_h = A.mesh(A.GEO.box, A.mat(0x2b2b33), 0, 0, 0.14); hour_h.scale.set(0.09, 0.5, 0.05);
    hour_h.geometry.translate(0, 0.25, 0); hour_h.rotation.z = -ha; g.add(hour_h);
    // minute hand
    var ma = half ? Math.PI : 0;
    var min_h = A.mesh(A.GEO.box, A.mat(0x3e6fd0), 0, 0, 0.15); min_h.scale.set(0.07, 0.8, 0.05);
    min_h.geometry.translate(0, 0.4, 0); min_h.rotation.z = -ma; g.add(min_h);
    return g;
  }
  var clockTower = A.mesh(A.GEO.cyl, A.mat(0x9aa3ac), CLX, terrainFn(CLX, CLZ) + 1.5, CLZ); clockTower.scale.set(0.6, 3, 0.6);
  world.group.add(clockTower);
  var clockFace = makeClock(3, false); clockFace.position.set(CLX, terrainFn(CLX, CLZ) + 3.2, CLZ + 0.5); clockFace.scale.setScalar(0.9);
  world.group.add(clockFace);
  world.block(CLX, CLZ, 0.7);
  world.addAt(A.makeSign('What time is it?'), CLX + 2, CLZ + 1.5);
  var clockActive = false;
  world.interact({
    x: CLX, z: CLZ + 1, radius: 2.8, prompt: 'Read the clock', icon: '🕒',
    enabled: function () { return !clockDone && !clockActive; },
    onInteract: function () {
      clockActive = true;
      PIP.ui.say('Fizz', '🐺', ['A secret clock! When the big blue hand points straight up, it is something o’clock. When it points straight down, it is half past.']).then(function () {
        PIP.challenge.begin({
          id: 'mountain.clock', concept: 'measure',
          goal: 'Read the clock — what o’clock is it?',
          hints: ['The big blue hand points up, so it is o’clock (not half past).', 'The little black hand points to a number — that is the hour.', 'The little hand is on 3, so it is 3 o’clock.']
        });
        // first: 3 o'clock
        PIP.challenge.numberPick({
          question: 'The blue hand points UP. The little hand is on 3. What o’clock is it?',
          answer: 3, options: [2, 3, 4],
          visual: { emoji: '🕒', count: 3 },
          nudge: 'Follow the little black hand to its number.',
          concept: 'measure'
        }).then(function () {
          // change clock to half past 4
          world.group.remove(clockFace);
          clockFace = makeClock(4, true); clockFace.position.set(CLX, terrainFn(CLX, CLZ) + 3.2, CLZ + 0.5); clockFace.scale.setScalar(0.9); world.group.add(clockFace);
          PIP.narrate.say('Now the blue hand points DOWN — that means half past!');
          PIP.challenge.numberPick({
            question: 'The blue hand points DOWN (half past). The little hand is just past 4. Half past which number?',
            answer: 4, options: [3, 4, 5],
            visual: { emoji: '🕟', count: 4 },
            nudge: 'The little hand has just passed the hour number.',
            concept: 'measure'
          }).then(function () {
            clockDone = true; PIP.save.setMission('mountain.clock', 'done');
            PIP.save.recordAttempt('measure', true, 0);
            world.seed('mclk1', CLX - 1, CLZ, 0.8); world.seed('mclk2', CLX + 1, CLZ, 0.8);
            PIP.challenge.complete({
              title: 'Right on time!', maths: 'hand up = o’clock · hand down = half past',
              text: 'Hand up means o’clock, hand down means half past. You read three o’clock and half past four!',
              speak: 'Hand up is o’clock, hand down is half past. Perfectly told!'
            });
          });
        });
      });
    }
  });

  /* =====================================================================
     THE MOUNTAIN IDEA CORE
     ===================================================================== */
  var coreTaken = PIP.save.hasCore('mountain');
  var pedestal = A.mesh(A.GEO.cyl, A.mat(0xd7b356), 0, terrainFn(0, 6) + 0.6, 6); pedestal.scale.set(0.8, 1.1, 0.8);
  world.group.add(pedestal); world.block(0, 6, 1.0);
  var core = A.makeCore(0xd8e8f2);
  world.add(core, 0, terrainFn(0, 6) + 1.5, 6); core.visible = false;
  var coreT = 0;
  world.tick(function (dt) { if (!core.visible) return; coreT += dt; core.position.y = terrainFn(0, 6) + 1.5 + Math.sin(coreT * 2) * 0.15; core.rotation.y += dt; core.userData.ring.rotation.z += dt * 2; });
  function checkAllMissions() {
    var all = ['mountain.shelter', 'mountain.cable', 'mountain.sled'].every(function (m) { return PIP.save.mission(m) === 'done'; });
    if (all && !coreTaken && !core.visible) {
      core.visible = true; PIP.audio.play('unlock');
      PIP.ui.say('Fizz', '🐺', ['Warm, mended and safely packed — you measured it all! The Idea Core is glowing on the rise.', 'Go and collect it, Pip!'])
        .then(function () { PIP.ui.setGoal('Collect the Mountain Idea Core! 💡', false); world.setBeacon(0, 6); });
    }
  }
  world.interact({
    x: 0, z: 6, radius: 2.4, prompt: 'Take the Idea Core', icon: '💡',
    enabled: function () { return core.visible && !coreTaken; },
    onInteract: function () {
      coreTaken = true; core.visible = false; PIP.save.grantCore('mountain'); PIP.ui.updateHUD(); world.clearBeacon(); PIP.audio.play('fanfare');
      PIP.ui.summary({ title: 'IDEA CORE FOUND! 💡', text: 'The Measure Mountain Idea Core is safe! Four of five recovered.', speak: 'You found the Mountain Idea Core! Take it home.', stars: '💡⭐💡' })
        .then(function () { PIP.ui.setGoal('Return to Inventor Village through the green gate. 🏡', false); world.setBeacon(0, -15); });
    }
  });

  /* ---------- scenery & seeds ---------- */
  [[-8, 10], [8, 8], [-18, -6], [18, -8], [-6, -18], [16, 14], [-16, 16]].forEach(function (t, i) {
    var tree = A.makeTree('pine'); tree.scale.setScalar(1.1); world.addAt(tree, t[0], t[1]); world.block(t[0], t[1], 0.7);
  });
  // snowdrifts
  K.scatter(world, 12, function () { var r = A.mesh(A.GEO.sphere, A.mat(0xffffff)); r.scale.set(U.rand(0.8, 1.6), 0.5, U.rand(0.8, 1.6)); return r; }, 0, 0, 22);
  world.butterflies(3, 0, 0, 14); // snow-sprites
  world.seed('mt1', 0, 18, 0.7); world.seed('mt2', 20, 6, 0.7); world.seed('mt3', -20, 6, 0.7);
  world.seed('mt4', 6, -18, 0.7); world.seed('mt5', -18, -14, 0.7);

  /* ---------- arrival ---------- */
  world.postEnter = function () {
    checkAllMissions();
    if (!PIP.save.mission('mountain.intro')) {
      PIP.save.setMission('mountain.intro', 'done');
      return PIP.ui.say('Fizz', '🐺', [
        'Brrr — a visitor! I am Fizz, guardian of Measure Mountain.',
        'The Mix-Up Machine froze our cave, snapped the cable and muddled the sled.',
        'Three measuring jobs — take your time, nothing here is timed. Come and see!'
      ]).then(pointNext);
    }
    pointNext();
    return Promise.resolve();
  };

  return world;
};
