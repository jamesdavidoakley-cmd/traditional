/* World 6 — Fraction Falls (bonus island).
   Mission 1: Fair-share falls  — halving & quartering (equal parts)
   Mission 2: Water channel     — build an aqueduct (DT: joining, make/test)
   Mission 3: Symmetry garden   — mirror symmetry (both sides match)
   Hidden:    Waterwheel machine — a halving function machine
   Reward:    the Fraction Falls Idea Core */
PIP.worlds = PIP.worlds || {};

PIP.worlds.fractionfalls = function () {
  var U = PIP.util, A = PIP.assets, K = PIP.worldkit;

  function terrainFn(x, z) {
    var y = 0.4 + Math.sin(x * 0.1) * Math.cos(z * 0.1) * 0.4;
    y += U.hill(x, z, 0, 16, 10, 3.0);          // the falls rise to the north
    var d = Math.sqrt(x * x + z * z);
    if (d > 22) y -= (d - 22) * 1.7;
    return y;
  }
  function colorFn(x, z, y) {
    var n = Math.sin(x * 0.35) * Math.cos(z * 0.3);
    return y > 2 ? '#bfe6c9' : n < -0.3 ? '#6ec98a' : '#7fd89a';
  }
  var world = K.createWorld({
    id: 'fractionfalls', music: 'falls', sky: 0x9fe6ff,
    groundFn: terrainFn, colorFn: colorFn, size: 62, segs: 80,
    bounds: { minX: -22, maxX: 22, minZ: -22, maxZ: 22 },
    spawn: { x: 0, z: -7, angle: 0 }, killY: -13
  });
  world.water.push({ minX: -20, maxX: 20, minZ: 9, maxZ: 20, y: 0.2 }); // the big pool below the falls

  var backGate = A.makeGate(0x8fd483);
  world.addAt(backGate, 0, -14); backGate.rotation.y = 0; backGate.userData.swirl.material.opacity = 0.5;
  world.interact({ x: 0, z: -14, radius: 2.4, prompt: 'Back to Inventor Village', icon: '🏡', onInteract: function () { PIP.game.gotoWorld('hub'); } });
  world.addAt(A.makeSign('Inventor Village'), 3, -12);

  // the waterfall (visual)
  var fall = new THREE.Mesh(new THREE.BoxGeometry(6, 5, 0.5), new THREE.MeshBasicMaterial({ color: 0x8fd8ff, transparent: true, opacity: 0.6 }));
  fall.position.set(0, terrainFn(0, 16) + 1, 15); world.group.add(fall);
  var fallT = 0; world.tick(function (dt) { fallT += dt; fall.material.opacity = 0.5 + Math.sin(fallT * 6) * 0.1; });

  /* ---------- Dewdrop the otter ---------- */
  function makeDewdrop() {
    var g = new THREE.Group();
    var body = A.mesh(A.GEO.sphere, A.mat(0xa87f5a), 0, 0.5, 0); body.scale.set(0.4, 0.45, 0.55);
    var belly = A.mesh(A.GEO.sphere, A.mat(0xe8d0b0), 0, 0.42, 0.18); belly.scale.set(0.28, 0.3, 0.3);
    var head = A.mesh(A.GEO.sphere, A.mat(0xa87f5a), 0, 0.9, 0.28); head.scale.setScalar(0.28);
    var snout = A.mesh(A.GEO.sphere, A.mat(0xe8d0b0), 0, 0.85, 0.52); snout.scale.set(0.13, 0.1, 0.12);
    var nose = A.mesh(A.GEO.sphere, A.mat(0x2b2b33), 0, 0.88, 0.6); nose.scale.setScalar(0.05);
    var tail = A.mesh(A.GEO.sphere, A.mat(0xa87f5a), 0, 0.4, -0.55); tail.scale.set(0.14, 0.14, 0.4); tail.rotation.x = 0.6;
    [-1, 1].forEach(function (s) {
      var ear = A.mesh(A.GEO.sphere, A.mat(0xa87f5a), 0.16 * s, 1.08, 0.28); ear.scale.setScalar(0.08); g.add(ear);
      var e = A.mesh(A.GEO.sphere, A.mat(0x2b2b33), 0.1 * s, 0.92, 0.5); e.scale.set(0.045, 0.05, 0.03); g.add(e);
    });
    g.add(body, belly, head, snout, nose, tail); return g;
  }
  var dew = makeDewdrop(); world.addAt(dew, 0, -1); world.block(0, -1, 0.7);
  var dewT = 0;
  world.tick(function (dt) { dewT += dt; dew.position.y = terrainFn(0, -1) + Math.abs(Math.sin(dewT * 2)) * 0.05; var pp = PIP.player.state.pos; if (U.dist2(pp.x, pp.z, 0, -1) < 60) dew.rotation.y = U.angleLerp(dew.rotation.y, Math.atan2(pp.x, pp.z + 1), Math.min(1, dt * 3)); });
  world.interact({
    x: 0, z: -1, radius: 2.6, prompt: 'Talk to Dewdrop', icon: '🦦',
    onInteract: function () {
      var done = ['falls.share', 'falls.channel', 'falls.symmetry'].filter(function (m) { return PIP.save.mission(m) === 'done'; }).length;
      if (done === 3 && !PIP.save.hasCore('fractionfalls')) { PIP.ui.say('Dewdrop', '🦦', ['The falls flow fairly again — the Idea Core is by the pool. Go get it!']); return; }
      if (done === 3) { PIP.ui.say('Dewdrop', '🦦', ['Halves, quarters and matching gardens — you split it all perfectly, Pip!']); return; }
      PIP.ui.say('Dewdrop', '🦦', [
        'Splash! Welcome to Fraction Falls, where everything must be shared FAIRLY.',
        'Share the falls into equal parts, build a water channel, and match up the mirror garden.',
        'Fair means equal — same-size pieces every time!'
      ]).then(pointNext);
    }
  });
  function pointNext() {
    checkAllMissions();
    if (PIP.save.mission('falls.share') !== 'done') { PIP.ui.setGoal('Share the falls fairly (west). 💧', false); world.setBeacon(-11, 4); }
    else if (PIP.save.mission('falls.channel') !== 'done') { PIP.ui.setGoal('Build the water channel (east). 🚰', false); world.setBeacon(8, 6); }
    else if (PIP.save.mission('falls.symmetry') !== 'done') { PIP.ui.setGoal('Match the mirror garden (north). 🌸', false); world.setBeacon(0, 13); }
    else if (!PIP.save.hasCore('fractionfalls')) { PIP.ui.setGoal('Collect the Fraction Falls Idea Core! 💡', false); world.setBeacon(0, 8); }
    else PIP.ui.clearGoal();
  }

  /* =====================================================================
     MISSION 1 — Fair-share falls (halving & quartering)
     ===================================================================== */
  var FSX = -11, FSZ = 4;
  var shareDone = PIP.save.mission('falls.share') === 'done';
  // ponds (visual): 2 big, then 4 small
  function pond(x, z, r, col) { var p = A.mesh(A.GEO.cyl, A.mat(col || 0x62c4e8), x, terrainFn(x, z) + 0.1, z); p.scale.set(r, 0.2, r); world.group.add(p); return p; }
  pond(FSX, FSZ, 1.4);
  world.addAt(A.makeSign('Fair Share Falls'), FSX, FSZ - 3);
  var shareActive = false;
  world.interact({
    x: FSX, z: FSZ - 2.5, radius: 3.0, prompt: 'Share the falls', icon: '💧',
    enabled: function () { return !shareDone && !shareActive; },
    onInteract: function () {
      shareActive = true;
      PIP.ui.say('Dewdrop', '🦦', ['8 sparkle-berries fell in the pool! Share them into 2 EQUAL ponds so it is fair.']).then(function () {
        PIP.challenge.begin({
          id: 'falls.share', concept: 'sharing',
          goal: 'Share fairly: half of 8, then a quarter of 8.',
          hints: ['Two equal ponds means splitting into 2 equal halves.', 'Half of 8: 4 and 4. So each pond gets…', 'Half of 8 is 4. A quarter means 4 equal ponds.']
        });
        PIP.challenge.numberPick({
          question: 'Share 8 berries into 2 equal ponds. How many in EACH?  (half of 8)',
          answer: 4, options: [3, 4, 5], visual: { emoji: '🫐', count: 8 },
          nudge: 'Split 8 into two equal piles: 4 and 4.', concept: 'sharing'
        }).then(function () {
          pond(FSX - 2, FSZ + 2.4, 0.7, 0x8fd8ff); pond(FSX + 2, FSZ + 2.4, 0.7, 0x8fd8ff);
          PIP.challenge.numberPick({
            question: 'Now share 8 berries into 4 equal ponds. How many in each?  (a quarter of 8)',
            answer: 2, options: [2, 3, 4], visual: { emoji: '🫐', count: 8 },
            nudge: 'Four equal piles from 8: 2, 2, 2, 2.', concept: 'sharing'
          }).then(function () {
            shareDone = true; PIP.save.setMission('falls.share', 'done');
            PIP.save.recordAttempt('sharing', true, 0);
            if (PIP.save.grantBadge('sharer')) PIP.ui.toast('🍓', 'Inventor Badge: Fair Sharer!');
            world.seed('fs1', FSX, FSZ + 4, 0.7);
            PIP.challenge.complete({
              title: 'Perfectly fair!', maths: 'half of 8 = 4   ·   quarter of 8 = 2',
              text: 'Equal parts are what fair sharing means. Half of 8 is 4; a quarter of 8 is 2. Every creature got the same!',
              speak: 'Half of eight is four. A quarter of eight is two. Fair and equal!'
            }).then(pointNext);
          });
        });
      });
    }
  });

  /* =====================================================================
     MISSION 2 — Water channel (DT: joining, make & test)
     ===================================================================== */
  var CHZ = 6, CH_X = [7, 10, 13];
  var channelDone = PIP.save.mission('falls.channel') === 'done';
  var chBase = terrainFn(10, CHZ);
  // source spout (west end) and thirsty garden (east end)
  var spout = A.mesh(A.GEO.box, A.mat(0x8a97a3), 5, chBase + 0.6, CHZ); spout.scale.set(0.8, 1.2, 1); world.group.add(spout);
  var gardenBed = A.mesh(A.GEO.box, A.mat(0x8a6142), 16, chBase + 0.2, CHZ); gardenBed.scale.set(2, 0.4, 2.4); world.group.add(gardenBed);
  var gardenFlowers = [];
  world.addAt(A.makeSign('Water Channel'), 10, CHZ - 3);
  function channelPiece() { var g = new THREE.Group(); var b = A.mesh(A.GEO.box, A.mat(0xb0b8c0), 0, 0, 0); b.scale.set(1.5, 0.3, 0.9); var lft = A.mesh(A.GEO.box, A.mat(0x8a97a3), 0, 0.2, 0.45); lft.scale.set(1.5, 0.4, 0.1); var rgt = A.mesh(A.GEO.box, A.mat(0x8a97a3), 0, 0.2, -0.45); rgt.scale.set(1.5, 0.4, 0.1); g.add(b, lft, rgt); return g; }
  function buildStaticChannel() { CH_X.forEach(function (x) { var c = channelPiece(); c.position.set(x, chBase + 0.6, CHZ); world.group.add(c); }); bloomGarden(); }
  function bloomGarden() { for (var i = 0; i < 5; i++) { var f = A.makeFlower(U.pick([0xff6f9c, 0xffd257, 0xc9a6ff]), 1); f.position.set(16 + U.rand(-0.8, 0.8), chBase + 0.4, CHZ + U.rand(-0.9, 0.9)); world.group.add(f); gardenFlowers.push(f); } }
  if (channelDone) buildStaticChannel();

  var channelActive = false;
  world.interact({
    x: 10, z: CHZ - 2.5, radius: 3.2, prompt: 'Build the channel', icon: '🚰',
    enabled: function () { return !channelDone && !channelActive; },
    onInteract: function () {
      channelActive = true;
      PIP.ui.say('Dewdrop', '🦦', ['The garden is thirsty! Join up CHANNEL pieces from the spout to the flower bed so water can flow.']).then(startChannelBuild);
    }
  });
  function startChannelBuild() {
    PIP.player.state.frozen = true; world.clearBeacon();
    PIP.game.tweenCamera(new THREE.Vector3(10, chBase + 4.5, CHZ - 7), new THREE.Vector3(10, chBase + 0.6, CHZ));
    PIP.challenge.begin({
      id: 'falls.channel', concept: 'dtMechanism',
      goal: 'Join the channel pieces from spout to garden, then test the flow!',
      hints: ['Each glowing spot needs a channel piece to carry the water.', 'The water can only cross where the pieces JOIN with no gaps.', 'Fill all three spots, then press Test it!']
    });
    var parts = [
      { id: 'channel', name: 'Channel', icon: '🟦', count: 3, make: channelPiece, tip: 'Carries water along.' },
      { id: 'rock', name: 'Rock', icon: '🪨', count: 1, make: function () { return A.makeRock(0.6); }, tip: 'A rock blocks water!' }
    ];
    var slots = CH_X.map(function (x, i) { return { id: 'ch' + i, accepts: ['channel'], pos: new THREE.Vector3(x, chBase + 0.6, CHZ), ghost: function () { return new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.6, 1), new THREE.MeshBasicMaterial({ color: 0xffe27a, transparent: true, opacity: 0.35, depthWrite: false })); } }; });
    PIP.builder.start({
      scene: world.group, parts: parts, slots: slots,
      tip: 'Place a channel on each glowing spot, then Test it!',
      allowBack: true,
      canTest: function () { var n = 0; slots.forEach(function (s) { if (s.placed) n++; }); return n < 3 ? 'Join all three channel pieces first — no gaps!' : null; },
      onTest: function () {
        PIP.builder.setTesting(true);
        // water blob flows along the channel
        var water = A.mesh(A.GEO.sphere, A.mat(0x62c4e8), 5, chBase + 0.9, CHZ); water.scale.set(0.4, 0.3, 0.4); world.group.add(water);
        var t = 0;
        var ticker = function (dt) {
          t += dt; water.position.x = U.lerp(5, 16, Math.min(1, t / 2));
          if (t > 2.1) {
            world.updaters.splice(world.updaters.indexOf(ticker), 1); world.group.remove(water);
            PIP.builder.setTesting(false); PIP.builder.finish(); PIP.player.state.frozen = false;
            bloomGarden(); PIP.audio.play('splash'); PIP.audio.play('chime');
            channelDone = true; PIP.save.setMission('falls.channel', 'done');
            PIP.save.recordAttempt('dtMechanism', true, 0);
            PIP.save.addDesign({ name: 'Water Channel', icon: '🚰', note: 'Three channels joined — water flows to the garden.' });
            if (PIP.save.grantBadge('mechanism')) PIP.ui.toast('⚙️', 'Inventor Badge: Mechanism Maker!');
            PIP.challenge.complete({
              title: 'The garden blooms!', maths: 'spout → 3 channels → garden',
              text: 'Joined with no gaps, the channel carried water all the way to the thirsty garden. It burst into flower!',
              speak: 'The channels joined up and the water flowed right to the garden. It bloomed!'
            }).then(pointNext);
          }
        };
        PIP.audio.play('creak'); world.tick(ticker);
      },
      onExit: function () { PIP.player.state.frozen = false; }
    });
  }

  /* =====================================================================
     MISSION 3 — Symmetry garden (mirror symmetry)
     ===================================================================== */
  var SYZ = 13, symDone = PIP.save.mission('falls.symmetry') === 'done';
  var symBase = terrainFn(0, SYZ);
  // a mirror line down the middle; left side has flowers, right side empty spots
  var mirror = A.mesh(A.GEO.box, A.mat(0xbfeaff, { transparent: true, opacity: 0.4 }), 0, symBase + 0.8, SYZ); mirror.scale.set(0.1, 1.6, 3.5); world.group.add(mirror);
  var leftFlowers = [[-3, -1, 0xff6f9c], [-2, 1, 0xffd257]];
  leftFlowers.forEach(function (f) { var fl = A.makeFlower(f[2], 1.1); fl.position.set(f[0], symBase, SYZ + f[1]); world.group.add(fl); });
  world.addAt(A.makeSign('Mirror Garden'), -4, SYZ - 2.5);
  var symActive = false;
  world.interact({
    x: 0, z: SYZ - 2.5, radius: 3.0, prompt: 'Match the garden', icon: '🌸',
    enabled: function () { return !symDone && !symActive; },
    onInteract: function () {
      symActive = true;
      PIP.ui.say('Dewdrop', '🦦', ['A mirror garden! The right side must MATCH the left, like a reflection. What belongs opposite each flower?']).then(function () {
        PIP.challenge.begin({
          id: 'falls.symmetry', concept: 'patterns',
          goal: 'Make the right side mirror the left.',
          hints: ['Look straight across the mirror line.', 'The same flower must be the same distance on the other side.', 'Opposite the pink flower goes another PINK flower.']
        });
        PIP.challenge.choicePick({
          question: 'Opposite the 🌸 pink flower, what makes the mirror match?',
          sequence: ['🌸', '|', '❓'], options: [{ label: '🌸', correct: true }, { label: '🌻' }, { label: '🌷' }],
          nudge: 'A mirror shows the SAME thing on both sides.', speak: 'Pink matches pink!', concept: 'patterns'
        }).then(function () {
          var r1 = A.makeFlower(0xff6f9c, 1.1); r1.position.set(3, symBase, SYZ - 1); world.group.add(r1);
          PIP.challenge.choicePick({
            question: 'Opposite the 🌼 yellow flower, what makes it match?',
            sequence: ['🌼', '|', '❓'], options: [{ label: '🌷' }, { label: '🌼', correct: true }, { label: '🌸' }],
            nudge: 'Same colour, same spot — mirrored.', speak: 'Yellow matches yellow!', concept: 'patterns'
          }).then(function () {
            var r2 = A.makeFlower(0xffd257, 1.1); r2.position.set(2, symBase, SYZ + 1); world.group.add(r2);
            symDone = true; PIP.save.setMission('falls.symmetry', 'done');
            PIP.save.recordAttempt('patterns', true, 0);
            if (PIP.save.grantBadge('pattern')) PIP.ui.toast('🌸', 'Inventor Badge: Pattern Finder!');
            world.seed('fsy1', 0, SYZ + 3, 0.7);
            PIP.challenge.complete({
              title: 'A perfect reflection!', maths: 'left ↔ right (symmetry)',
              text: 'Both sides of the mirror line match exactly. That is symmetry — a shape that is the same on both sides!',
              speak: 'Both sides match across the line. That is symmetry!'
            }).then(pointNext);
          });
        });
      });
    }
  });

  /* =====================================================================
     HIDDEN — Waterwheel halving machine
     ===================================================================== */
  var wheelDone = PIP.save.mission('falls.wheel') === 'done';
  var WWX = 12, WWZ = -8;
  var wheel = A.makeGear(1.2, 12, 0x8a6142); wheel.position.set(WWX, terrainFn(WWX, WWZ) + 1.4, WWZ); world.group.add(wheel);
  world.tick(function (dt) { wheel.rotation.z -= dt * 0.8; });
  world.block(WWX, WWZ, 1); world.addAt(A.makeSign('Halving Wheel'), WWX + 2, WWZ - 1.5);
  var wheelActive = false;
  world.interact({
    x: WWX, z: WWZ - 1.8, radius: 2.8, prompt: 'The waterwheel', icon: '💠',
    enabled: function () { return !wheelDone && !wheelActive; },
    onInteract: function () {
      wheelActive = true;
      PIP.ui.say('Dewdrop', '🦦', ['Secret wheel! It HALVES every number — cuts it in two equal parts. Try it!']).then(function () {
        PIP.challenge.begin({ id: 'falls.wheel', concept: 'doubles', goal: 'The wheel halves. Work out what comes out!', hints: ['Halving means splitting into two equal parts.', 'Half of 10 is 5 and 5.', 'Ten shared in two is five.'] });
        PIP.challenge.numberPick({ question: 'The wheel halves! 10 goes in. What comes out?', answer: 5, options: [4, 5, 6], visual: { emoji: '💧', count: 10 }, nudge: 'Split 10 into two equal halves.', concept: 'doubles' }).then(function () {
          PIP.challenge.numberPick({ question: 'Halving again: 6 goes in. What comes out?', answer: 3, options: [2, 3, 4], visual: { emoji: '💧', count: 6 }, nudge: 'Half of 6: 3 and 3.', concept: 'doubles' }).then(function () {
            wheelDone = true; PIP.save.setMission('falls.wheel', 'done'); PIP.save.recordAttempt('doubles', true, 0);
            world.seed('fw1', WWX - 1, WWZ, 0.8); world.seed('fw2', WWX + 1, WWZ, 0.8);
            PIP.challenge.complete({ title: 'Halving machine cracked!', maths: 'half of 10 = 5 · half of 6 = 3', text: 'Halving is the opposite of doubling — split a number into two equal parts. Half of 10 is 5, half of 6 is 3!', speak: 'Halving splits into two equal parts. Half of ten is five!' });
          });
        });
      });
    }
  });

  /* =====================================================================
     IDEA CORE
     ===================================================================== */
  var coreTaken = PIP.save.hasCore('fractionfalls');
  var pedestal = A.mesh(A.GEO.cyl, A.mat(0xd7b356), 0, terrainFn(0, 8) + 0.6, 8); pedestal.scale.set(0.8, 1.1, 0.8); world.group.add(pedestal); world.block(0, 8, 1);
  var core = A.makeCore(0x6fd8e0); world.add(core, 0, terrainFn(0, 8) + 1.5, 8); core.visible = false;
  var coreT = 0; world.tick(function (dt) { if (!core.visible) return; coreT += dt; core.position.y = terrainFn(0, 8) + 1.5 + Math.sin(coreT * 2) * 0.15; core.rotation.y += dt; core.userData.ring.rotation.z += dt * 2; });
  function checkAllMissions() {
    var all = ['falls.share', 'falls.channel', 'falls.symmetry'].every(function (m) { return PIP.save.mission(m) === 'done'; });
    if (all && !coreTaken && !core.visible) { core.visible = true; PIP.audio.play('unlock'); PIP.ui.say('Dewdrop', '🦦', ['Everything shared fairly and matching perfectly — the Idea Core has surfaced by the pool!', 'Take it, Pip!']).then(function () { PIP.ui.setGoal('Collect the Fraction Falls Idea Core! 💡', false); world.setBeacon(0, 8); }); }
  }
  world.interact({
    x: 0, z: 8, radius: 2.4, prompt: 'Take the Idea Core', icon: '💡',
    enabled: function () { return core.visible && !coreTaken; },
    onInteract: function () {
      coreTaken = true; core.visible = false; PIP.save.grantCore('fractionfalls'); PIP.ui.updateHUD(); world.clearBeacon(); PIP.audio.play('fanfare');
      PIP.ui.summary({ title: 'IDEA CORE FOUND! 💡', text: 'The Fraction Falls Idea Core is safe! Take it home to Inventor Village.', speak: 'You found the Fraction Falls Idea Core!', stars: '💡⭐💡' }).then(function () { PIP.ui.setGoal('Return to Inventor Village. 🏡', false); world.setBeacon(0, -14); });
    }
  });

  /* ---------- scenery & seeds ---------- */
  [[-16, 8], [16, 6], [-14, -12], [14, -10], [-6, 16], [8, 14]].forEach(function (t, i) { var tr = A.makeTree(i % 2 ? 'round' : 'pine'); world.addAt(tr, t[0], t[1]); world.block(t[0], t[1], 0.7); });
  K.scatter(world, 16, function () { return A.makeFlower(U.pick([0xff6f9c, 0xffd257, 0x9fd8ff, 0xc9a6ff]), U.rand(0.6, 1.1)); }, 0, 0, 18);
  world.butterflies(6, 0, 0, 16);
  world.seed('ff1', 0, 18, -0.6); world.seed('ff2', 18, 8, 0.7); world.seed('ff3', -18, 8, 0.7); world.seed('ff4', 6, -16, 0.7);

  world.postEnter = function () {
    checkAllMissions();
    if (!PIP.save.mission('falls.intro')) {
      PIP.save.setMission('falls.intro', 'done');
      return PIP.ui.say('Dewdrop', '🦦', ['Splash! A new island drifted in — Fraction Falls! I am Dewdrop.', 'Here everything must be shared FAIRLY, into equal parts.', 'Come and see — three watery puzzles await!']).then(pointNext);
    }
    pointNext(); return Promise.resolve();
  };
  return world;
};
