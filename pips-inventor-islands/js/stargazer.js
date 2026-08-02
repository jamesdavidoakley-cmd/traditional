/* World 8 — Stargazer Summit (bonus island).
   Mission 1: Count the stars — tens & ones (place value)
   Mission 2: The telescope   — build (DT structure) & aim (direction)
   Mission 3: Rocket launch    — counting in tens to 100, ordering
   Hidden:    Star circuit      — a simple input → output light circuit (DT)
   Reward:    the Stargazer Idea Core */
PIP.worlds = PIP.worlds || {};

PIP.worlds.stargazer = function () {
  var U = PIP.util, A = PIP.assets, K = PIP.worldkit;

  function terrainFn(x, z) {
    var y = 0.5 + Math.sin(x * 0.1) * Math.cos(z * 0.1) * 0.4;
    y += U.hill(x, z, 0, 0, 16, 2.0);            // a gentle summit
    var d = Math.sqrt(x * x + z * z);
    if (d > 22) y -= (d - 22) * 1.8;
    return y;
  }
  function colorFn(x, z, y) { var n = Math.sin(x * 0.3) * Math.cos(z * 0.3); return y > 2 ? '#4a5578' : n < -0.3 ? '#2f3a5c' : '#3a4668'; }
  var world = K.createWorld({
    id: 'stargazer', music: 'summit', sky: 0x1b2350,
    groundFn: terrainFn, colorFn: colorFn, size: 62, segs: 76,
    bounds: { minX: -22, maxX: 22, minZ: -22, maxZ: 22 },
    spawn: { x: 0, z: -7, angle: 0 }, killY: -13
  });

  // stars overhead + a moon
  for (var s = 0; s < 60; s++) { var st = A.mesh(A.GEO.sphere, A.mat(0xffffff, { emissive: 0xffffff, emissiveIntensity: 0.9 }), U.rand(-30, 30), U.rand(10, 22), U.rand(-30, 30)); st.scale.setScalar(U.rand(0.06, 0.16)); world.group.add(st); }
  var moon = A.mesh(A.GEO.sphere, A.mat(0xf0f0e0, { emissive: 0xd8d8c0, emissiveIntensity: 0.5 }), -16, 18, 14); moon.scale.setScalar(1.6); world.group.add(moon);

  var backGate = A.makeGate(0x8fd483);
  world.addAt(backGate, 0, -14); backGate.rotation.y = 0; backGate.userData.swirl.material.opacity = 0.5;
  world.interact({ x: 0, z: -14, radius: 2.4, prompt: 'Back to Inventor Village', icon: '🏡', onInteract: function () { PIP.game.gotoWorld('hub'); } });
  world.addAt(A.makeSign('Inventor Village'), 3, -12);

  /* ---------- Comet the owl ---------- */
  function makeComet() {
    var g = new THREE.Group();
    var body = A.mesh(A.GEO.sphere, A.mat(0x6f87c7), 0, 0.55, 0); body.scale.set(0.42, 0.5, 0.42);
    var belly = A.mesh(A.GEO.sphere, A.mat(0xe8ecf5), 0, 0.5, 0.2); belly.scale.set(0.28, 0.32, 0.22);
    var head = A.mesh(A.GEO.sphere, A.mat(0x6f87c7), 0, 1.05, 0); head.scale.set(0.38, 0.34, 0.36);
    var beak = A.mesh(A.GEO.cone, A.mat(0xffb066), 0, 1.0, 0.34); beak.scale.set(0.06, 0.1, 0.06); beak.rotation.x = Math.PI / 2;
    [-1, 1].forEach(function (si) {
      var e = A.mesh(A.GEO.sphere, A.mat(0xffffff), 0.15 * si, 1.08, 0.28); e.scale.setScalar(0.13); g.add(e);
      var p = A.mesh(A.GEO.sphere, A.mat(0x2b2b33), 0.15 * si, 1.08, 0.37); p.scale.setScalar(0.06); g.add(p);
      var ear = A.mesh(A.GEO.cone, A.mat(0x6f87c7), 0.2 * si, 1.36, 0); ear.scale.set(0.1, 0.22, 0.1); g.add(ear);
      var wing = A.mesh(A.GEO.sphere, A.mat(0x5b6ba8), 0.4 * si, 0.55, 0); wing.scale.set(0.1, 0.3, 0.22); g.add(wing);
    });
    g.add(body, belly, head, beak); return g;
  }
  var comet = makeComet(); world.addAt(comet, 0, -1); world.block(0, -1, 0.7);
  var cT = 0; world.tick(function (dt) { cT += dt; comet.position.y = terrainFn(0, -1) + Math.abs(Math.sin(cT * 2)) * 0.06; var pp = PIP.player.state.pos; if (U.dist2(pp.x, pp.z, 0, -1) < 60) comet.rotation.y = U.angleLerp(comet.rotation.y, Math.atan2(pp.x, pp.z + 1), Math.min(1, dt * 3)); });
  world.interact({
    x: 0, z: -1, radius: 2.6, prompt: 'Talk to Comet', icon: '🦉',
    onInteract: function () {
      var done = ['star.count', 'star.telescope', 'star.rocket'].filter(function (m) { return PIP.save.mission(m) === 'done'; }).length;
      if (done === 3 && !PIP.save.hasCore('stargazer')) { PIP.ui.say('Comet', '🦉', ['Hoo! The summit sparkles again — the Idea Core is up by the star-pad. Off you flit!']); return; }
      if (done === 3) { PIP.ui.say('Comet', '🦉', ['Tens and ones, a fine telescope, and a rocket that flew — a true stargazer, hoo hoo!']); return; }
      PIP.ui.say('Comet', '🦉', [
        'Hoo hoo! Welcome to Stargazer Summit, Pip — the highest, starriest island of all!',
        'Count the stars in tens and ones, build my telescope, and launch the rocket.',
        'Big numbers up here — but tens and ones make them easy!'
      ]).then(pointNext);
    }
  });
  function pointNext() {
    checkAllMissions();
    if (PIP.save.mission('star.count') !== 'done') { PIP.ui.setGoal('Count the star clusters (west). ⭐', false); world.setBeacon(-11, 4); }
    else if (PIP.save.mission('star.telescope') !== 'done') { PIP.ui.setGoal('Build the telescope (east). 🔭', false); world.setBeacon(11, 5); }
    else if (PIP.save.mission('star.rocket') !== 'done') { PIP.ui.setGoal('Launch the rocket (north). 🚀', false); world.setBeacon(0, 13); }
    else if (!PIP.save.hasCore('stargazer')) { PIP.ui.setGoal('Collect the Stargazer Idea Core! 💡', false); world.setBeacon(0, 8); }
    else PIP.ui.clearGoal();
  }

  function starCluster(x, z, n) { var g = new THREE.Group(); for (var i = 0; i < n; i++) { var st = A.mesh(A.GEO.sphere, A.mat(0xffe27a, { emissive: 0xffd257, emissiveIntensity: 0.9 }), U.rand(-1, 1), U.rand(0.5, 1.6), U.rand(-1, 1)); st.scale.setScalar(0.14); g.add(st); } g.position.set(x, terrainFn(x, z), z); world.group.add(g); return g; }

  /* =====================================================================
     MISSION 1 — Count the stars (tens & ones / place value)
     ===================================================================== */
  var countDone = PIP.save.mission('star.count') === 'done';
  starCluster(-13, 5, 8); starCluster(-9, 5, 8);
  world.addAt(A.makeSign('Star Count'), -11, 4 - 3);
  var countActive = false;
  world.interact({
    x: -11, z: 4 - 2.5, radius: 3.0, prompt: 'Count the stars', icon: '⭐',
    enabled: function () { return !countDone && !countActive; },
    onInteract: function () {
      countActive = true;
      PIP.ui.say('Comet', '🦉', ['Astronomers count in TENS and ONES. Here are 3 bags of ten stars, and 4 stars on their own.']).then(function () {
        PIP.challenge.begin({ id: 'star.count', concept: 'placevalue', goal: 'Count in tens and ones.', hints: ['Count the full tens first: 10, 20, 30.', 'Then add the ones: 30 and 4 more.', '3 tens and 4 ones is 34.'] });
        PIP.challenge.numberPick({
          question: '3 bags of ten, and 4 more. How many stars?  (3 tens + 4 ones)',
          answer: 34, options: [34, 43, 30], nudge: 'Thirty, then 4 more ones: 34 — not 43!', concept: 'placevalue'
        }).then(function () {
          PIP.challenge.numberPick({
            question: 'Now 5 bags of ten and 2 more. How many stars?',
            answer: 52, options: [52, 25, 50], nudge: 'Fifty, then 2 ones: 52.', concept: 'placevalue'
          }).then(function () {
            countDone = true; PIP.save.setMission('star.count', 'done'); PIP.save.recordAttempt('placevalue', true, 0);
            if (PIP.save.grantBadge('counter')) PIP.ui.toast('🔢', 'Inventor Badge: Careful Counter!');
            world.seed('sc1', -11, 8, 1.2);
            PIP.challenge.complete({ title: 'Star-counted!', maths: '3 tens + 4 = 34   ·   5 tens + 2 = 52', text: 'Tens and ones! Count the full tens, then the leftover ones. 3 tens and 4 is 34 — the tens come first.', speak: 'Three tens and four ones is thirty four. Tens and ones make big numbers easy!' }).then(pointNext);
          });
        });
      });
    }
  });

  /* =====================================================================
     MISSION 2 — Build & aim the telescope (DT structure + direction)
     ===================================================================== */
  var TLX = 11, TLZ = 5, tlBase = terrainFn(TLX, TLZ), scopeDone = PIP.save.mission('star.telescope') === 'done';
  var plinth = A.mesh(A.GEO.cyl, A.mat(0x5b6770), TLX, tlBase + 0.15, TLZ); plinth.scale.set(1.2, 0.3, 1.2); world.group.add(plinth); world.block(TLX, TLZ, 1.2);
  world.addAt(A.makeSign('Telescope'), TLX + 2.5, TLZ - 2);
  function scopeBase() { var m = A.mesh(new THREE.CylinderGeometry(0.5, 0.6, 0.9, 14), A.mat(0x8a97a3), 0, 0, 0); return m; }
  function scopeTube() { var m = A.mesh(new THREE.CylinderGeometry(0.4, 0.4, 1.4, 14), A.mat(0x6f87c7), 0, 0, 0); return m; }
  function scopeLens() { var m = A.mesh(new THREE.CylinderGeometry(0.5, 0.4, 0.4, 14), A.mat(0xbfeaff, { emissive: 0x8fd8ff, emissiveIntensity: 0.5 }), 0, 0, 0); return m; }
  var TL_SLOTS = [{ key: 'base', y: tlBase + 0.75, make: scopeBase }, { key: 'tube', y: tlBase + 1.9, make: scopeTube }, { key: 'lens', y: tlBase + 2.9, make: scopeLens }];
  function buildStaticScope() { TL_SLOTS.forEach(function (s) { var m = s.make(); m.position.set(TLX, s.y, TLZ); world.group.add(m); }); }
  if (scopeDone) buildStaticScope();
  var scopeActive = false;
  world.interact({
    x: TLX, z: TLZ - 2.5, radius: 3.0, prompt: 'Build the telescope', icon: '🔭',
    enabled: function () { return !scopeDone && !scopeActive; },
    onInteract: function () {
      scopeActive = true;
      PIP.ui.say('Comet', '🦉', ['Build my telescope — a wide base, a long tube, then the lens on top. Bottom to top!']).then(function () {
        PIP.player.state.frozen = true; world.clearBeacon();
        PIP.game.tweenCamera(new THREE.Vector3(TLX + 5, tlBase + 3.5, TLZ - 5), new THREE.Vector3(TLX, tlBase + 1.8, TLZ));
        PIP.challenge.begin({ id: 'star.telescope', concept: 'shapes', goal: 'Stack the telescope, then aim it!', hints: ['The widest part — the base — goes at the bottom to stand steady.', 'Then the long tube, then the lens on top.', 'Place base, tube, then lens, and press Test it.'] });
        var parts = [
          { id: 'base', name: 'Base', icon: '🛢️', count: 1, make: scopeBase, tip: 'Wide, steady base.' },
          { id: 'tube', name: 'Tube', icon: '🔭', count: 1, make: scopeTube, tip: 'The long tube.' },
          { id: 'lens', name: 'Lens', icon: '🔵', count: 1, make: scopeLens, tip: 'The glass lens.' }
        ];
        var slots = TL_SLOTS.map(function (s) { return { id: s.key, accepts: [s.key], pos: new THREE.Vector3(TLX, s.y, TLZ) }; });
        PIP.builder.start({
          scene: world.group, parts: parts, slots: slots,
          tip: 'Stack base, tube, lens on the glowing spots, then Test it!',
          allowBack: true,
          canTest: function () { var n = 0; slots.forEach(function (x) { if (x.placed) n++; }); return n < 3 ? 'Stack all three parts — base, tube, lens.' : null; },
          onTest: function () {
            PIP.builder.setTesting(true); PIP.builder.finish(); PIP.player.state.frozen = false;
            PIP.audio.play('chime');
            // aim it: quarter turn to the bright star on the left
            PIP.challenge.choicePick({
              question: 'The bright star is on your LEFT. Which way should the telescope turn?',
              options: [{ label: '⬅️', correct: true }, { label: '➡️' }, { label: '⬆️' }],
              nudge: 'Left is the way the bright star is.', speak: 'Turn left!', concept: 'shapes'
            }).then(function () {
              scopeDone = true; PIP.save.setMission('star.telescope', 'done');
              PIP.save.recordAttempt('shapes', true, 0); PIP.save.recordAttempt('dtStructure', true, 0);
              PIP.save.addDesign({ name: 'Star Telescope', icon: '🔭', note: 'Wide base, tube, lens — aimed with a quarter turn left.' });
              if (PIP.save.grantBadge('shape')) PIP.ui.toast('🔷', 'Inventor Badge: Shape Spotter!');
              PIP.challenge.complete({ title: 'Star in view!', maths: 'wide base → steady tower', text: 'A wide base keeps the telescope steady, and a quarter turn to the left pointed it right at the star!', speak: 'Wide base, tall tube, lens on top — and a quarter turn left. Star in view!' }).then(pointNext);
            });
          },
          onExit: function () { PIP.player.state.frozen = false; }
        });
      });
    }
  });

  /* =====================================================================
     MISSION 3 — Rocket launch (counting in tens to 100)
     ===================================================================== */
  var RKZ = 13, rocketDone = PIP.save.mission('star.rocket') === 'done';
  var rkBase = terrainFn(0, RKZ);
  var pad = A.mesh(A.GEO.cyl, A.mat(0x5b6770), 0, rkBase + 0.15, RKZ); pad.scale.set(1.6, 0.3, 1.6); world.group.add(pad); world.block(0, RKZ, 1.4);
  var rocket = new THREE.Group();
  var rkBody = A.mesh(new THREE.CylinderGeometry(0.4, 0.5, 2, 14), A.mat(0xff6f6f), 0, 1, 0);
  var rkNose = A.mesh(A.GEO.cone, A.mat(0xffd257), 0, 2.3, 0); rkNose.scale.set(0.5, 0.7, 0.5);
  var rkWin = A.mesh(A.GEO.sphere, A.mat(0xbfeaff), 0, 1.4, 0.4); rkWin.scale.setScalar(0.2);
  [-1, 1].forEach(function (s) { var fin = A.mesh(A.GEO.box, A.mat(0x6f87c7), 0.45 * s, 0.3, 0); fin.scale.set(0.1, 0.6, 0.5); rocket.add(fin); });
  rocket.add(rkBody, rkNose, rkWin);
  rocket.position.set(0, rkBase + 0.3, RKZ); world.group.add(rocket);
  if (rocketDone) rocket.position.y = rkBase + 12;
  world.addAt(A.makeSign('Launch Pad'), 3, RKZ - 2.5);
  var rocketActive = false;
  world.interact({
    x: 0, z: RKZ - 2.5, radius: 3.0, prompt: 'Fuel the rocket', icon: '🚀',
    enabled: function () { return !rocketDone && !rocketActive; },
    onInteract: function () {
      rocketActive = true;
      PIP.ui.say('Comet', '🦉', ['Fuel the rocket by counting in TENS all the way to 100! Ready?']).then(function () {
        PIP.challenge.begin({ id: 'star.rocket', concept: 'counting2s', goal: 'Count in tens to fuel the rocket.', hints: ['Tens go 10, 20, 30, 40…', 'After 40 comes 50.', 'Ten, twenty, thirty, forty, fifty!'] });
        PIP.challenge.numberPick({ question: 'Count in tens: 10, 20, 30, 40, … what comes next?', answer: 50, options: [45, 50, 60], nudge: 'Add ten more to forty.', concept: 'counting2s' }).then(function () {
          PIP.challenge.numberPick({ question: 'How many tens make 100? (10, 20, 30 … 100)', answer: 10, options: [9, 10, 11], visual: { emoji: '🔟', count: 10 }, nudge: 'Count the tens up to a hundred.', concept: 'counting2s' }).then(function () {
            PIP.player.state.frozen = true; PIP.game.tweenCamera(new THREE.Vector3(-5, rkBase + 4, RKZ - 6), new THREE.Vector3(0, rkBase + 3, RKZ));
            var t = 0; PIP.audio.play('whoosh');
            var ticker = function (dt) {
              t += dt; rocket.position.y = rkBase + 0.3 + t * t * 3;
              if (t > 2) {
                world.updaters.splice(world.updaters.indexOf(ticker), 1); PIP.player.state.frozen = false;
                rocketDone = true; PIP.save.setMission('star.rocket', 'done'); PIP.save.recordAttempt('counting2s', true, 0);
                world.seed('sr1', 0, RKZ + 3, 1.2);
                PIP.challenge.complete({ title: 'Blast off!', maths: '10, 20, 30 … 100  (ten tens)', text: 'Counting in tens: ten tens make one hundred! Full tank — and the rocket soared into the stars.', speak: 'Ten tens make one hundred. Full tank — blast off!' }).then(pointNext);
              }
            };
            world.tick(ticker);
          });
        });
      });
    }
  });

  /* =====================================================================
     HIDDEN — Star circuit (input → output light)
     ===================================================================== */
  var circuitDone = PIP.save.mission('star.circuit') === 'done';
  var CIX = 12, CIZ = -8, ciBase = terrainFn(CIX, CIZ);
  var switchBox = A.mesh(A.GEO.box, A.mat(0x8a6142), CIX - 1.4, ciBase + 0.6, CIZ); switchBox.scale.set(0.8, 1, 0.6); world.group.add(switchBox);
  var starLamp = A.mesh(A.GEO.sphere, A.mat(0x555555), CIX + 1.4, ciBase + 1.4, CIZ); starLamp.scale.setScalar(0.4); world.group.add(starLamp);
  world.block(CIX, CIZ, 1.4); world.addAt(A.makeSign('Star Lamp'), CIX + 2.5, CIZ - 1);
  if (circuitDone) starLamp.material = A.mat(0xffe27a, { emissive: 0xffd257, emissiveIntensity: 1 });
  var circuitActive = false;
  world.interact({
    x: CIX, z: CIZ - 1.8, radius: 2.8, prompt: 'The star lamp', icon: '💡',
    enabled: function () { return !circuitDone && !circuitActive; },
    onInteract: function () {
      circuitActive = true;
      PIP.ui.say('Comet', '🦉', ['This lamp needs a wire from the SWITCH (the input) to the LAMP (the output). Which wire joins them up?']).then(function () {
        PIP.challenge.begin({ id: 'star.circuit', concept: 'dtMechanism', goal: 'Connect the switch to the lamp.', hints: ['An input (switch) sends power to an output (lamp).', 'The wire must reach ALL the way from the switch to the lamp.', 'The full, unbroken wire is the one that works.'] });
        PIP.challenge.choicePick({
          question: 'Which wire connects the switch to the lamp so it lights up?',
          options: [{ label: '➰(broken)' }, { label: '➖(full wire)', correct: true }, { label: '·(no wire)' }],
          nudge: 'It must be a full, unbroken wire.', speak: 'The full wire lights it up!', concept: 'dtMechanism'
        }).then(function () {
          starLamp.material = A.mat(0xffe27a, { emissive: 0xffd257, emissiveIntensity: 1 }); PIP.audio.play('ding');
          circuitDone = true; PIP.save.setMission('star.circuit', 'done'); PIP.save.recordAttempt('dtMechanism', true, 0);
          if (PIP.save.grantBadge('mechanism')) PIP.ui.toast('⚙️', 'Inventor Badge: Mechanism Maker!');
          world.seed('sci1', CIX - 1, CIZ, 1); world.seed('sci2', CIX + 1, CIZ, 1);
          PIP.challenge.complete({ title: 'Lights on!', maths: 'switch (input) → lamp (output)', text: 'A full wire carried the power from the switch to the lamp. Flip the input and the output lights up — that is a circuit!', speak: 'The switch is the input, the lamp is the output. A full wire lights it up!' });
        });
      });
    }
  });

  /* =====================================================================
     IDEA CORE
     ===================================================================== */
  var coreTaken = PIP.save.hasCore('stargazer');
  var pedestal = A.mesh(A.GEO.cyl, A.mat(0xd7b356), 0, terrainFn(0, 8) + 0.6, 8); pedestal.scale.set(0.8, 1.1, 0.8); world.group.add(pedestal); world.block(0, 8, 1);
  var core = A.makeCore(0x9b8cff); world.add(core, 0, terrainFn(0, 8) + 1.5, 8); core.visible = false;
  var coreT = 0; world.tick(function (dt) { if (!core.visible) return; coreT += dt; core.position.y = terrainFn(0, 8) + 1.5 + Math.sin(coreT * 2) * 0.15; core.rotation.y += dt; core.userData.ring.rotation.z += dt * 2; });
  function checkAllMissions() {
    var all = ['star.count', 'star.telescope', 'star.rocket'].every(function (m) { return PIP.save.mission(m) === 'done'; });
    if (all && !coreTaken && !core.visible) { core.visible = true; PIP.audio.play('unlock'); PIP.ui.say('Comet', '🦉', ['Counted, built and launched — the summit shines! The Idea Core rose up by the star-pad.', 'Go and take it, Pip!']).then(function () { PIP.ui.setGoal('Collect the Stargazer Idea Core! 💡', false); world.setBeacon(0, 8); }); }
  }
  world.interact({
    x: 0, z: 8, radius: 2.4, prompt: 'Take the Idea Core', icon: '💡',
    enabled: function () { return core.visible && !coreTaken; },
    onInteract: function () {
      coreTaken = true; core.visible = false; PIP.save.grantCore('stargazer'); PIP.ui.updateHUD(); world.clearBeacon(); PIP.audio.play('fanfare');
      PIP.ui.summary({ title: 'IDEA CORE FOUND! 💡', text: 'The Stargazer Summit Idea Core is safe! Take it home to Inventor Village.', speak: 'You found the Stargazer Idea Core!', stars: '💡⭐💡' }).then(function () { PIP.ui.setGoal('Return to Inventor Village. 🏡', false); world.setBeacon(0, -14); });
    }
  });

  /* ---------- scenery & seeds ---------- */
  [[-16, 8], [16, 6], [-14, -12], [14, -10], [-6, 15]].forEach(function (t, i) { var tr = A.makeTree('pine'); tr.scale.setScalar(0.9); world.addAt(tr, t[0], t[1]); world.block(t[0], t[1], 0.7); });
  world.butterflies(3, 0, 6, 14); // fireflies
  world.seed('ss1', 0, 18, 1.4); world.seed('ss2', 18, 8, 0.9); world.seed('ss3', -18, 8, 0.9); world.seed('ss4', 6, -16, 0.8);

  world.postEnter = function () {
    checkAllMissions();
    if (!PIP.save.mission('star.intro')) {
      PIP.save.setMission('star.intro', 'done');
      return PIP.ui.say('Comet', '🦉', ['Hoo hoo! A summit island rose up in the night — Stargazer Summit! I am Comet.', 'Up here the numbers get big, but tens and ones tame them.', 'Come — count the stars, build the telescope, launch the rocket!']).then(pointNext);
    }
    pointNext(); return Promise.resolve();
  };
  return world;
};
