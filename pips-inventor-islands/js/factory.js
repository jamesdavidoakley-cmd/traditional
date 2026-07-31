/* World 5 — Patternworks Factory (short missions) + the finale trigger.
   Mission 1: Pattern conveyor — repeating & growing patterns, sequences
   Mission 2: Packing machine  — equal groups ("2 wings per glider")
   Mission 3: Rebuild the Mix-Up Machine — integrated build / test / improve
   Hidden:    The n machine     — a friendly variable (n → n + 2)
   Reward:    the fifth Idea Core (collecting it sets up the hub finale) */
PIP.worlds = PIP.worlds || {};

PIP.worlds.factory = function () {
  var U = PIP.util, A = PIP.assets, K = PIP.worldkit;

  function terrainFn(x, z) {
    var y = 0.2 + Math.sin(x * 0.5) * 0.03;
    y += U.hill(x, z, 0, 10, 8, 0.8);
    var d = Math.sqrt(x * x + z * z);
    if (d > 23) y -= (d - 23) * 1.8;
    return y;
  }
  function colorFn(x, z, y) {
    var checker = (Math.floor(x / 2) + Math.floor(z / 2)) % 2 === 0;
    return checker ? '#c9b79a' : '#bda98a';
  }
  var world = K.createWorld({
    id: 'factory', music: 'factory', sky: 0xffe0b0,
    groundFn: terrainFn, colorFn: colorFn, size: 64, segs: 80,
    bounds: { minX: -23, maxX: 23, minZ: -23, maxZ: 23 },
    spawn: { x: 0, z: -8, angle: 0 },
    killY: -14
  });

  var backGate = A.makeGate(0x8fd483);
  world.addAt(backGate, 0, -16); backGate.rotation.y = 0; backGate.userData.swirl.material.opacity = 0.5;
  world.interact({ x: 0, z: -16, radius: 2.4, prompt: 'Back to Inventor Village', icon: '🏡', onInteract: function () { PIP.game.gotoWorld('hub'); } });
  world.addAt(A.makeSign('Inventor Village'), 3, -14);

  /* ---------- Bolt the robot ---------- */
  function makeBolt() {
    var g = new THREE.Group();
    var body = A.mesh(A.GEO.box, A.mat(0x8fa3ff), 0, 0.62, 0); body.scale.set(0.5, 0.6, 0.4);
    var head = A.mesh(A.GEO.box, A.mat(0xbfeaff), 0, 1.1, 0); head.scale.set(0.42, 0.36, 0.36);
    var ant = A.mesh(A.GEO.cyl, A.mat(0x5b6770), 0, 1.42, 0); ant.scale.set(0.04, 0.3, 0.04);
    var bulb = A.mesh(A.GEO.sphere, A.mat(0xff5b5b, { emissive: 0xff3b3b, emissiveIntensity: 0.7 }), 0, 1.58, 0); bulb.scale.setScalar(0.08);
    var mouth = A.mesh(A.GEO.box, A.mat(0x2b2b33), 0, 1.02, 0.19); mouth.scale.set(0.2, 0.03, 0.03);
    [-1, 1].forEach(function (s) {
      var e = A.mesh(A.GEO.sphere, A.mat(0x2b2b33), 0.1 * s, 1.13, 0.19); e.scale.set(0.06, 0.06, 0.04); g.add(e);
      var arm = A.mesh(A.GEO.cyl, A.mat(0x6f87c7), 0.32 * s, 0.62, 0); arm.scale.set(0.06, 0.4, 0.06); g.add(arm);
      var foot = A.mesh(A.GEO.box, A.mat(0x5b6770), 0.16 * s, 0.12, 0.04); foot.scale.set(0.18, 0.18, 0.28); g.add(foot);
    });
    g.add(body, head, ant, bulb, mouth); g.userData.bulb = bulb;
    return g;
  }
  var bolt = makeBolt();
  world.addAt(bolt, 0, -3); world.block(0, -3, 0.7);
  var boltT = 0;
  world.tick(function (dt) {
    boltT += dt; bolt.position.y = terrainFn(0, -3) + Math.abs(Math.sin(boltT * 3)) * 0.05;
    bolt.userData.bulb.material.emissiveIntensity = 0.5 + Math.abs(Math.sin(boltT * 4)) * 0.5;
    var pp = PIP.player.state.pos;
    if (U.dist2(pp.x, pp.z, 0, -3) < 60) bolt.rotation.y = U.angleLerp(bolt.rotation.y, Math.atan2(pp.x, pp.z + 3), Math.min(1, dt * 3));
  });
  world.interact({
    x: 0, z: -3, radius: 2.6, prompt: 'Talk to Bolt', icon: '🤖',
    onInteract: function () {
      var done = ['factory.conveyor', 'factory.packing', 'factory.machine'].filter(function (m) { return PIP.save.mission(m) === 'done'; }).length;
      if (done === 3 && !PIP.save.hasCore('factory')) { PIP.ui.say('Bolt', '🤖', ['BEEP! The Mix-Up Machine is fixed! Its Idea Core is glowing — take it, Pip!']); return; }
      if (done === 3) { PIP.ui.say('Bolt', '🤖', ['Patterns flowing, boxes packed, machine purring. You are a true inventor. Beep-boop!']); return; }
      PIP.ui.say('Bolt', '🤖', [
        'BEEP-BOOP! Welcome to Patternworks Factory, Pip!',
        'This is where the Mix-Up Machine lives — the one that started all the trouble.',
        'Fix the pattern conveyor, the packing machine, then REBUILD the Mix-Up Machine itself!'
      ]).then(pointNext);
    }
  });
  function pointNext() {
    checkAllMissions();
    if (PIP.save.mission('factory.conveyor') !== 'done') { PIP.ui.setGoal('Fix the pattern conveyor to the west. 🎞️', false); world.setBeacon(-12, 2); }
    else if (PIP.save.mission('factory.packing') !== 'done') { PIP.ui.setGoal('Run the packing machine to the east. 📦', false); world.setBeacon(12, 2); }
    else if (PIP.save.mission('factory.machine') !== 'done') { PIP.ui.setGoal('Rebuild the Mix-Up Machine to the north! 🛠️', false); world.setBeacon(0, 9); }
    else if (!PIP.save.hasCore('factory')) { PIP.ui.setGoal('Collect the last Idea Core! 💡', false); world.setBeacon(0, 6); }
    else PIP.ui.clearGoal();
  }

  /* =====================================================================
     MISSION 1 — Pattern conveyor (repeating + growing patterns)
     ===================================================================== */
  var CVX = -12, CVZ = 2;
  var conveyorDone = PIP.save.mission('factory.conveyor') === 'done';
  var belt = A.mesh(A.GEO.box, A.mat(0x4a4a55), CVX, terrainFn(CVX, CVZ) + 0.5, CVZ); belt.scale.set(5, 0.4, 1.4);
  world.group.add(belt); world.block(CVX, CVZ, 1.2);
  // pattern tokens sitting on the belt
  var patCols = [0xff5b5b, 0x5cc8ff, 0xff5b5b, 0x5cc8ff];
  patCols.forEach(function (c, i) { var t = A.mesh(A.GEO.box, A.mat(c), CVX - 1.8 + i * 0.9, terrainFn(CVX, CVZ) + 0.85, CVZ); t.scale.set(0.5, 0.5, 0.5); world.group.add(t); });
  var gapToken = A.mesh(A.GEO.box, A.mat(0x2b2b33, { transparent: true, opacity: 0.4 }), CVX + 1.8, terrainFn(CVX, CVZ) + 0.85, CVZ); gapToken.scale.set(0.5, 0.5, 0.5);
  world.group.add(gapToken);
  world.addAt(A.makeSign('Pattern Conveyor'), CVX, CVZ - 2.5);
  var beltRun = false;
  world.tick(function (dt) { if (beltRun) belt.position.x = CVX; });

  var conveyorActive = false;
  world.interact({
    x: CVX, z: CVZ - 2.5, radius: 3.0, prompt: 'Fix the conveyor', icon: '🎞️',
    enabled: function () { return !conveyorDone && !conveyorActive; },
    onInteract: function () {
      conveyorActive = true;
      PIP.ui.say('Bolt', '🤖', ['The conveyor pattern is broken! Look at the colours: red, blue, red, blue, red… what comes NEXT?']).then(function () {
        PIP.challenge.begin({
          id: 'factory.conveyor', concept: 'patterns',
          goal: 'Finish the patterns on the conveyor.',
          hints: ['Say the colours out loud: red, blue, red, blue…', 'After red always comes blue in this pattern.', 'The next one is BLUE 🔵!']
        });
        PIP.challenge.choicePick({
          question: 'Red, blue, red, blue, red… what comes next?',
          sequence: ['🔴', '🔵', '🔴', '🔵', '🔴', '❓'],
          options: [{ label: '🔵', correct: true }, { label: '🔴' }, { label: '🟡' }],
          nudge: 'After every red comes a blue.',
          speak: 'Blue! The pattern is red, blue, red, blue.',
          concept: 'patterns'
        }).then(function () {
          gapToken.material = A.mat(0x5cc8ff); beltRun = true; PIP.audio.play('gear');
          // growing number pattern
          PIP.challenge.numberPick({
            question: 'Growing pattern: 1, 3, 5, 7, … what comes next?',
            answer: 9, options: [8, 9, 10],
            visual: { emoji: '🔧', count: 7 },
            nudge: 'It goes up by 2 each time. What is 2 more than 7?',
            concept: 'patterns'
          }).then(function () {
            conveyorDone = true; PIP.save.setMission('factory.conveyor', 'done');
            PIP.save.recordAttempt('patterns', true, 0);
            if (PIP.save.grantBadge('pattern')) PIP.ui.toast('🌸', 'Inventor Badge: Pattern Finder!');
            world.seed('fcv1', CVX, CVZ + 3, 0.7);
            PIP.challenge.complete({
              title: 'The conveyor flows!', maths: '1, 3, 5, 7, 9',
              text: 'A repeating colour pattern and a growing number pattern — you spotted both rules and the belt whirred to life!',
              speak: 'Red blue red blue, and one three five seven nine. Patterns fixed!'
            }).then(pointNext);
          });
        });
      });
    }
  });

  /* =====================================================================
     MISSION 2 — Packing machine (equal groups)
     ===================================================================== */
  var PKX = 12, PKZ = 2;
  var packingDone = PIP.save.mission('factory.packing') === 'done';
  var packer = A.mesh(A.GEO.box, A.mat(0x6f87c7), PKX, terrainFn(PKX, PKZ) + 1, PKZ); packer.scale.set(2.4, 2, 2);
  world.group.add(packer); world.block(PKX, PKZ, 1.4);
  var chute = A.mesh(A.GEO.box, A.mat(0x4a4a55), PKX, terrainFn(PKX, PKZ) + 0.4, PKZ - 1.6); chute.scale.set(1, 0.3, 1.2);
  world.group.add(chute);
  world.addAt(A.makeSign('Packing Machine'), PKX, PKZ - 3);
  var packingActive = false;
  world.interact({
    x: PKX, z: PKZ - 2.5, radius: 3.0, prompt: 'Run the packer', icon: '📦',
    enabled: function () { return !packingDone && !packingActive; },
    onInteract: function () {
      packingActive = true;
      PIP.ui.say('Bolt', '🤖', ['Each box needs the right number of parts. Every glider needs 2 wings — count in equal groups!']).then(function () {
        PIP.challenge.begin({
          id: 'factory.packing', concept: 'sharing',
          goal: 'Work out the parts for each box (equal groups).',
          hints: ['2 wings for 1 glider, 2 more for the next… count in twos.', 'Three gliders is three groups of 2. 2, 4, 6.', 'Two, four, six — three gliders need 6 wings!']
        });
        PIP.challenge.numberPick({
          question: 'Each glider needs 2 wings. How many wings for 3 gliders?',
          answer: 6, options: [5, 6, 7],
          visual: { emoji: '🛩️', count: 3 },
          nudge: 'Count in twos: 2, 4, 6.',
          concept: 'sharing'
        }).then(function () {
          PIP.challenge.numberPick({
            question: 'Each buggy needs 4 wheels. How many wheels for 2 buggies?',
            answer: 8, options: [6, 8, 10],
            visual: { emoji: '🚙', count: 2 },
            nudge: 'Four wheels and four more: 4, 8.',
            concept: 'sharing'
          }).then(function () {
            packingDone = true; PIP.save.setMission('factory.packing', 'done');
            PIP.save.recordAttempt('sharing', true, 0);
            PIP.audio.play('gear');
            world.seed('fpk1', PKX, PKZ + 3, 0.7);
            PIP.challenge.complete({
              title: 'Boxes packed!', maths: '2 × 3 = 6   ·   4 × 2 = 8',
              text: 'Equal groups! Three gliders need 3 groups of 2 wings, and 2 buggies need 2 groups of 4 wheels.',
              speak: 'Three twos are six. Two fours are eight. Equal groups packed!'
            }).then(pointNext);
          });
        });
      });
    }
  });

  /* =====================================================================
     MISSION 3 — Rebuild the Mix-Up Machine (integrated build/test/improve)
     ===================================================================== */
  var MMX = 0, MMZ = 10;
  var machineDone = PIP.save.mission('factory.machine') === 'done';
  var mmBase = terrainFn(MMX, MMZ);
  // frame (always visible)
  var frame = new THREE.Group();
  [[-1.6, 0], [1.6, 0]].forEach(function (p) { var post = A.mesh(A.GEO.box, A.mat(0x8a97a3), p[0], 1.4, 0); post.scale.set(0.3, 2.8, 0.3); frame.add(post); });
  var top = A.mesh(A.GEO.box, A.mat(0x8a97a3), 0, 2.8, 0); top.scale.set(3.6, 0.3, 0.3); frame.add(top);
  var funnel = A.mesh(A.GEO.cone, A.mat(0xffb066), 0, 3.3, 0); funnel.scale.set(0.9, 0.8, 0.9);
  frame.add(funnel);
  frame.position.set(MMX, mmBase, MMZ);
  world.group.add(frame); world.block(MMX, MMZ, 2);
  world.addAt(A.makeSign('The Mix-Up Machine'), MMX + 3.5, MMZ - 1);
  var mmParts = { gear: null, lever: null, wheel: null, brace: null };
  function partGear() { var g = A.makeGear(0.6, 8, 0xd8a869); g.rotation.x = Math.PI / 2; return g; }
  function partLever() { var g = new THREE.Group(); var pivot = A.mesh(A.GEO.sphere, A.mat(0x5b6770), 0, 0, 0); pivot.scale.setScalar(0.18); var arm = A.mesh(A.GEO.box, A.mat(0xff6f6f), 0, 0.3, 0); arm.scale.set(0.12, 1, 0.12); arm.geometry.translate(0, 0.5, 0); arm.rotation.z = 0.5; g.add(pivot, arm); return g; }
  function partWheel() { var w = A.mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.25, 16), A.mat(0x4b4b4b), 0, 0, 0); w.rotation.x = Math.PI / 2; return w; }
  function partBrace() { return A.makeBrace(); }
  var mmSlots = [];
  function buildStaticMachine() {
    var g = partGear(); g.position.set(MMX - 0.9, mmBase + 1.8, MMZ + 0.2); world.group.add(g); mmParts.gear = g;
    var l = partLever(); l.position.set(MMX + 1.2, mmBase + 1.4, MMZ + 0.2); world.group.add(l); mmParts.lever = l;
    var w = partWheel(); w.position.set(MMX + 0.9, mmBase + 0.5, MMZ + 0.2); world.group.add(w); mmParts.wheel = w;
    var b = partBrace(); b.position.set(MMX - 1.4, mmBase + 0.2, MMZ - 0.1); world.group.add(b); mmParts.brace = b;
  }
  if (machineDone) { buildStaticMachine(); startMachineIdle(); }

  var machineActive = false;
  world.interact({
    x: MMX, z: MMZ - 2.5, radius: 3.2, prompt: 'Rebuild the machine', icon: '🛠️',
    enabled: function () { return !machineDone && !machineActive; },
    onInteract: function () {
      machineActive = true;
      PIP.ui.say('Bolt', '🤖', [
        'The big one! To work, the Mix-Up Machine needs a GEAR, a LEVER and a WHEEL.',
        'First — a counting check. It uses 4 wheels and 2 gears inside. How many parts is that in all?'
      ]).then(function () {
        PIP.challenge.begin({
          id: 'factory.machine', concept: 'addition',
          goal: 'Build the machine: add a gear, a lever and a wheel — then test and improve!',
          hints: ['Place a gear, a lever and a wheel on the glowing spots.', 'Press Test. If it wobbles, something is missing…', 'A triangle BRACE stops the wobble — add it and test again!']
        });
        PIP.challenge.numberPick({
          question: 'The machine has 4 wheels and 2 gears. How many parts altogether? 4 + 2 = □',
          answer: 6, options: [5, 6, 7],
          visual: { total: 6, filled: 6 },
          nudge: 'Count on from 4: five, six.',
          concept: 'addition'
        }).then(startMachineBuild);
      });
    }
  });
  function startMachineBuild() {
    PIP.player.state.frozen = true; world.clearBeacon();
    PIP.game.tweenCamera(new THREE.Vector3(MMX - 5, mmBase + 4, MMZ - 6), new THREE.Vector3(MMX, mmBase + 1.6, MMZ));
    var parts = [
      { id: 'gear', name: 'Gear', icon: '⚙️', count: 1, make: partGear, tip: 'A spinning gear.' },
      { id: 'lever', name: 'Lever', icon: '🎚️', count: 1, make: partLever, tip: 'A push-me lever.' },
      { id: 'wheel', name: 'Wheel', icon: '🛞', count: 1, make: partWheel, tip: 'A rolling wheel.' },
      { id: 'brace', name: 'Brace', icon: '🔺', count: 1, make: partBrace, tip: 'A triangle brace for strength.' }
    ];
    var slots = [
      { id: 'gear', accepts: ['gear'], pos: new THREE.Vector3(MMX - 0.9, mmBase + 1.8, MMZ + 0.2) },
      { id: 'lever', accepts: ['lever'], pos: new THREE.Vector3(MMX + 1.2, mmBase + 1.4, MMZ + 0.2) },
      { id: 'wheel', accepts: ['wheel'], pos: new THREE.Vector3(MMX + 0.9, mmBase + 0.5, MMZ + 0.2) },
      { id: 'brace', accepts: ['brace'], pos: new THREE.Vector3(MMX - 1.4, mmBase + 0.2, MMZ - 0.1) }
    ];
    var testedOnce = false;
    PIP.builder.start({
      scene: world.group, parts: parts, slots: slots,
      tip: 'Add a gear, a lever and a wheel to the glowing spots, then Test it!',
      allowBack: true,
      canTest: function () {
        var need = ['gear', 'lever', 'wheel'];
        for (var i = 0; i < need.length; i++) { var s = slots.filter(function (x) { return x.id === need[i]; })[0]; if (!s.placed) return 'The machine needs a gear, a lever AND a wheel first.'; }
        return null;
      },
      onTest: function (api) {
        var braced = slots.filter(function (x) { return x.id === 'brace'; })[0].placed;
        PIP.builder.setTesting(true);
        if (!testedOnce) { testedOnce = true; if (PIP.save.grantBadge('tester')) PIP.ui.toast('🧪', 'Inventor Badge: Brave Tester!'); }
        var meshes = slots.filter(function (s) { return s.placed; }).map(function (s) { return s.placed.mesh; });
        var t = 0;
        var ticker = function (dt) {
          t += dt;
          meshes.forEach(function (m, i) { m.rotation.z = braced ? 0 : Math.sin(t * 12 + i) * 0.2; });
          frame.rotation.z = braced ? 0 : Math.sin(t * 12) * 0.05;
          if (t > (braced ? 1.6 : 1.3)) {
            world.updaters.splice(world.updaters.indexOf(ticker), 1);
            frame.rotation.z = 0; meshes.forEach(function (m) { m.rotation.z = 0; });
            PIP.builder.setTesting(false);
            if (braced) {
              // capture built parts, keep them
              slots.forEach(function (s) { if (s.placed) mmParts[s.id] = s.placed.mesh; });
              PIP.builder.finish(); PIP.player.state.frozen = false;
              machineDone = true; PIP.save.setMission('factory.machine', 'done');
              PIP.save.recordAttempt('addition', true, 0); PIP.save.recordAttempt('dtMechanism', true, 0); PIP.save.recordAttempt('dtTest', true, 0);
              PIP.save.addDesign({ name: 'Mix-Up Machine', icon: '🛠️', note: 'Gear + lever + wheel, braced with a triangle. Fixed!' });
              if (PIP.save.grantBadge('mechanism')) PIP.ui.toast('⚙️', 'Inventor Badge: Mechanism Maker!');
              startMachineIdle();
              PIP.audio.play('success');
              PIP.challenge.complete({
                title: 'The Mix-Up Machine works!', maths: '4 + 2 = 6 parts',
                text: 'A gear, a lever, a wheel — and a triangle brace to stop the wobble. You tested it, found the fault, and improved it!',
                speak: 'Gear, lever and wheel — and a brace to stop the wobble. You tested it and improved it. The machine works!'
              }).then(pointNext);
            } else {
              PIP.audio.play('wobble');
              PIP.save.recordAttempt('dtTest', true, 0);
              PIP.ui.say('Professor Pebble', '🪨', ['That is certainly exciting. I am not yet convinced it is a machine.', 'It wobbled! A triangle BRACE makes a frame stiff. Add the brace and test again.']);
            }
          }
        };
        world.tick(ticker);
      },
      onExit: function () { PIP.player.state.frozen = false; }
    });
  }
  function startMachineIdle() {
    var it = 0;
    world.tick(function (dt) {
      it += dt;
      if (mmParts.gear) mmParts.gear.rotation.z += dt * 1.5;
      if (mmParts.wheel) mmParts.wheel.rotation.z -= dt * 1.5;
      if (mmParts.lever) mmParts.lever.rotation.z = 0.5 + Math.sin(it * 3) * 0.2;
    });
  }

  /* =====================================================================
     HIDDEN — the n machine (a friendly variable)
     ===================================================================== */
  var nDone = PIP.save.mission('factory.n') === 'done';
  var NX = 10, NZ = -8;
  var nBooth = A.mesh(A.GEO.box, A.mat(0x9b59b6), NX, terrainFn(NX, NZ) + 1, NZ); nBooth.scale.set(1.6, 2, 1.4);
  world.group.add(nBooth); world.block(NX, NZ, 1);
  var nLabel = A.textSprite('+2', { px: 80, scale: 0.9, color: '#ffe27a' }); nLabel.position.set(NX, terrainFn(NX, NZ) + 2.6, NZ + 0.8); world.group.add(nLabel);
  world.addAt(A.makeSign('The +2 Machine'), NX + 2, NZ - 1.5);
  var nActive = false;
  world.interact({
    x: NX, z: NZ - 2, radius: 2.8, prompt: 'The +2 machine', icon: '🎁',
    enabled: function () { return !nDone && !nActive; },
    onInteract: function () {
      nActive = true;
      PIP.ui.say('Bolt', '🤖', ['Secret machine! It ADDS 2 Spark Seeds to any number you post in.', 'If 5 goes in, 5 and 2 more come out. Try it!']).then(function () {
        PIP.challenge.begin({
          id: 'factory.n', concept: 'missing',
          goal: 'The machine adds 2. Work out what comes out!',
          hints: ['Whatever goes in, add 2 more.', '5 and 2 more: count on… six, seven.', '5 + 2 = 7.']
        });
        PIP.challenge.numberPick({
          question: 'The machine adds 2. If 5 goes in, what comes out?',
          answer: 7, options: [6, 7, 8],
          visual: { total: 7, filled: 5 },
          nudge: 'Start at 5 and count on 2 more.',
          concept: 'missing'
        }).then(function () {
          nLabel.parent.remove(nLabel);
          var nBox = A.textSprite('n', { px: 90, scale: 1, color: '#ffe27a' }); nBox.position.set(NX, terrainFn(NX, NZ) + 2.6, NZ + 0.8); world.group.add(nBox);
          PIP.narrate.say('Now the mystery number is called n. In goes n… out comes n plus 2!');
          PIP.challenge.numberPick({
            question: 'The mystery number n is 3. What is n + 2?',
            answer: 5, options: [4, 5, 6],
            visual: { total: 5, filled: 3 },
            nudge: 'n is 3, so 3 and 2 more.',
            concept: 'missing'
          }).then(function () {
            nDone = true; PIP.save.setMission('factory.n', 'done');
            PIP.save.recordAttempt('missing', true, 0);
            if (PIP.save.grantBadge('pattern')) PIP.ui.toast('🌸', 'Inventor Badge: Pattern Finder!');
            world.seed('fn1', NX - 1, NZ, 0.8); world.seed('fn2', NX + 1, NZ, 0.8);
            PIP.challenge.complete({
              title: 'You met n!', maths: 'n → n + 2',
              text: 'The mystery number n can be anything. Whatever n is, the machine gives you n and 2 more. That is a real bit of algebra!',
              speak: 'The mystery number n can be anything, and out comes n plus two. You did algebra, Pip!'
            });
          });
        });
      });
    }
  });

  /* =====================================================================
     THE FIFTH IDEA CORE
     ===================================================================== */
  var coreTaken = PIP.save.hasCore('factory');
  var pedestal = A.mesh(A.GEO.cyl, A.mat(0xd7b356), 0, mmBase + 0.6, 6); pedestal.scale.set(0.8, 1.1, 0.8);
  world.group.add(pedestal); world.block(0, 6, 1.0);
  var core = A.makeCore(0xffb066);
  world.add(core, 0, mmBase + 1.5, 6); core.visible = false;
  var coreT = 0;
  world.tick(function (dt) { if (!core.visible) return; coreT += dt; core.position.y = mmBase + 1.5 + Math.sin(coreT * 2) * 0.15; core.rotation.y += dt; core.userData.ring.rotation.z += dt * 2; });
  function checkAllMissions() {
    var all = ['factory.conveyor', 'factory.packing', 'factory.machine'].every(function (m) { return PIP.save.mission(m) === 'done'; });
    if (all && !coreTaken && !core.visible) {
      core.visible = true; PIP.audio.play('unlock');
      PIP.ui.say('Bolt', '🤖', ['BEEP-BOOP-HOORAY! The Mix-Up Machine is fixed and its Idea Core is glowing!', 'It is the FIFTH and last core. Take it, Pip!'])
        .then(function () { PIP.ui.setGoal('Collect the last Idea Core! 💡', false); world.setBeacon(0, 6); });
    }
  }
  world.interact({
    x: 0, z: 6, radius: 2.4, prompt: 'Take the last Idea Core', icon: '💡',
    enabled: function () { return core.visible && !coreTaken; },
    onInteract: function () {
      coreTaken = true; core.visible = false; PIP.save.grantCore('factory'); PIP.ui.updateHUD(); world.clearBeacon(); PIP.audio.play('fanfare');
      PIP.ui.summary({ title: 'THE FINAL IDEA CORE! 💡', text: 'All five Idea Cores are recovered! Hurry back to Inventor Village — something wonderful is about to happen.', speak: 'That is all five Idea Cores! Take it home to Inventor Village!', stars: '💡🌟💡' })
        .then(function () { PIP.ui.setGoal('Return to Inventor Village — the islands await! 🏡', false); world.setBeacon(0, -16); });
    }
  });

  /* ---------- scenery & seeds ---------- */
  [[-18, 10], [18, 10], [-18, -10], [18, -12], [-8, 16], [8, 16]].forEach(function (p) { var box = A.mesh(A.GEO.box, A.mat(U.pick([0xff9e6b, 0x8fa3ff, 0x7ee48e]))); box.scale.set(1, 1, 1); world.addAt(box, p[0], p[1], 0.5); world.block(p[0], p[1], 0.6); });
  // spinning cog decorations
  [[-16, 4], [16, -4]].forEach(function (p) { var g = A.makeGear(1, 10, 0xb98a55); g.position.set(p[0], terrainFn(p[0], p[1]) + 1.5, p[1]); world.group.add(g); world.tick(function (dt) { g.rotation.z += dt; }); });
  world.butterflies(3, 0, 0, 14);
  world.seed('f1', 0, 18, 0.7); world.seed('f2', 18, 4, 0.7); world.seed('f3', -18, 4, 0.7); world.seed('f4', 8, -14, 0.7);

  /* ---------- arrival ---------- */
  world.postEnter = function () {
    checkAllMissions();
    if (!PIP.save.mission('factory.intro')) {
      PIP.save.setMission('factory.intro', 'done');
      return PIP.ui.say('Bolt', '🤖', [
        'BEEP! You made it to Patternworks Factory — where the Mix-Up Machine lives!',
        'Fix the conveyor and the packer, then rebuild the machine that started all the mischief.',
        'This is the big one, Pip. Everything you have learned comes together here!'
      ]).then(pointNext);
    }
    pointNext();
    return Promise.resolve();
  };

  return world;
};
