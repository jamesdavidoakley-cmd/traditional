/* World 1 — Numberberry Meadow (complete).
   Mission 1: Repair the stepping-stone path   (counting, numerals)
   Mission 2: Build a bridge for the Berrybacks (number bonds to 10, DT structures)
   Mission 3: The Numberberry Picnic            (fair sharing, equal groups)
   Hidden:    The growing flower trail          (growing patterns, counting in 2s)
   Reward:    the Meadow Idea Core */
PIP.worlds = PIP.worlds || {};

PIP.worlds.meadow = function () {
  var U = PIP.util, A = PIP.assets, K = PIP.worldkit;

  /* ---------- terrain ----------
     west bank | stream | central meadow | ravine | eastern orchard */
  function band(x, c, halfW) {
    var d = Math.abs(x - c);
    if (d >= halfW) return 0;
    return Math.cos(d / halfW * Math.PI) * 0.5 + 0.5;
  }
  function terrainFn(x, z) {
    var y = 0.5 + Math.sin(x * 0.09) * Math.cos(z * 0.11) * 0.45;
    y += U.hill(x, z, 8, 10, 11, 2.0);        // core hill
    y += U.hill(x, z, -22, -16, 9, 1.4);
    y -= band(x, -4, 3.6) * 2.6;              // stream (west)
    y -= band(x, 17, 4.2) * 6.0;              // ravine (east)
    var d = Math.sqrt(x * x + z * z);
    if (d > 33) y -= (d - 33) * 1.7;          // island edge
    return y;
  }
  function colorFn(x, z, y) {
    if (y < -3) return '#8a7a5c';
    if (y < -1.1 && Math.abs(x + 4) < 4) return '#cbbd8d';
    var n = Math.sin(x * 0.3 + 1) * Math.cos(z * 0.33);
    return n > 0.35 ? '#93da7f' : n < -0.4 ? '#6ec46a' : '#80cf72';
  }

  var world = K.createWorld({
    id: 'meadow', music: 'meadow', sky: 0x9ae1ff,
    groundFn: terrainFn, colorFn: colorFn, size: 84, segs: 110,
    bounds: { minX: -34, maxX: 34, minZ: -34, maxZ: 34 },
    spawn: { x: -27.5, z: 0, angle: Math.PI / 2 },
    killY: -16
  });

  world.water.push({ minX: -8, maxX: 0, minZ: -34, maxZ: 34, y: -1.35 });

  /* ---------- return gate ---------- */
  var backGate = A.makeGate(0x8fd483);
  world.addAt(backGate, -31, 0);
  backGate.rotation.y = Math.PI / 2;
  backGate.userData.swirl.material.opacity = 0.5;
  world.interact({
    x: -31, z: 0, radius: 2.4, prompt: 'Back to Inventor Village', icon: '🏡',
    onInteract: function () { PIP.game.gotoWorld('hub'); }
  });
  world.addAt(A.makeSign('Inventor Village ⇦'), -28.5, 2.5);

  /* =====================================================================
     MISSION 1 — the stepping-stone path
     ===================================================================== */
  var lvl1 = PIP.save.levelFor('counting');
  // two short gaps keep this opening mission quick (spec: ~4 min)
  var GAP_COUNTS = lvl1 === 0 ? [2, 3] : lvl1 === 2 ? [4, 5] : [3, 4];
  var GAP_TOTAL = GAP_COUNTS.reduce(function (a, b) { return a + b; }, 0);
  var stonesDone = PIP.save.mission('meadow.stones') === 'done';
  var gaps = [
    { z: 2, need: GAP_COUNTS[0] }, { z: -6, need: GAP_COUNTS[1] }
  ];
  var stoneMissionActive = false;
  var totalPlaced = 0;

  gaps.forEach(function (gap, gi) {
    gap.filled = 0;
    gap.slots = [];
    for (var i = 0; i < gap.need; i++) {
      var sx = -6.6 + (i + 0.5) * (5.6 / gap.need);
      gap.slots.push({ x: sx, z: gap.z, filled: false });
    }
    // numeral sign on the west side of each gap
    var numeral = A.textSprite(String(gap.need), { px: 100, scale: 1.15, color: '#ffe27a' });
    numeral.position.set(-8.6, terrainFn(-8.6, gap.z) + 2.2, gap.z);
    world.add(numeral);
    gap.numeral = numeral;
    if (stonesDone) {
      gap.slots.forEach(function (s) { placeStoneMesh(s); });
      gap.filled = gap.need;
      numeral.visible = false;
    }
  });
  function placeStoneMesh(slot) {
    var st = A.makeStone();
    st.position.set(slot.x, -1.15, slot.z);
    world.add(st);
    world.platform(slot.x - 0.45, slot.x + 0.45, slot.z - 0.45, slot.z + 0.45, -0.82, { noWall: true });
    slot.filled = true;
    slot.mesh = st;
  }

  // loose stones on the banks
  var looseStones = [];
  if (!stonesDone) {
    var stoneSpots = [
      [-12, 3], [-14, -3], [-11, 7], [-16, 6], [-12, -8], [-15, -12], [-10, 12], [-18, 1],
      [-13, 14], [-20, -7], [-11, -14], [-17, 11], [-21, 5], [-14, -16]
    ];
    stoneSpots.slice(0, GAP_TOTAL + 2).forEach(function (sp, i) {
      var st = A.makeStone();
      world.addAt(st, sp[0], sp[1], 0.05);
      var stone = { mesh: st, x: sp[0], z: sp[1], carried: false, used: false };
      looseStones.push(stone);
      world.interact({
        x: sp[0], z: sp[1], radius: 1.7, prompt: 'Pick up stone', icon: '🪨',
        enabled: function () { return !stone.used && !stone.carried && !PIP.player.state.carrying; },
        onInteract: function () {
          stone.carried = true;
          PIP.player.carry(st);
          st.userData.stoneRef = stone;
          PIP.audio.play('pop');
          if (!stoneMissionActive) startStoneMission();
        }
      });
    });
  }

  // placing a carried stone into the nearest empty slot
  world.interact({
    dynamic: true, radius: 0,
    prompt: 'Place stone', icon: '🪨',
    near: function () {
      if (!PIP.player.state.carrying || !PIP.player.state.carrying.userData.stoneRef) return null;
      var ps = PIP.player.state.pos;
      for (var g = 0; g < gaps.length; g++) {
        var gap = gaps[g];
        if (gap.filled >= gap.need) continue;
        var slot = gap.slots[gap.filled];
        if (U.dist2(ps.x, ps.z, slot.x, slot.z) < 3.2 * 3.2) return { gap: gap, slot: slot };
      }
      return null;
    },
    onInteract: function (hit) {
      var carried = PIP.player.drop();
      carried.userData.stoneRef.used = true;
      world.group.remove(carried);
      placeStoneMesh(hit.slot);
      hit.gap.filled++;
      totalPlaced++;
      PIP.audio.play('splash');
      PIP.audio.play('count', hit.gap.filled);
      PIP.narrate.callout(U.numWord(hit.gap.filled) + '!');
      if (hit.gap.filled >= hit.gap.need) {
        hit.gap.numeral.visible = false;
        PIP.audio.play('chime');
        PIP.narrate.say('That gap is full! ' + U.numWord(hit.gap.need) + ' stones, all counted.');
      }
      if (gaps.every(function (g) { return g.filled >= g.need; })) finishStoneMission();
    }
  });

  function startStoneMission() {
    if (stoneMissionActive || stonesDone) return;
    stoneMissionActive = true;
    PIP.challenge.begin({
      id: 'meadow.stones', concept: 'counting',
      goal: 'Fill each gap with the right number of stones. The signs show how many!',
      hints: [
        'Look for the big yellow numbers by the stream — they show how many stones each gap needs.',
        'Could you count how many spaces are still empty in the gap?',
        'Carry a stone to the sparkling gap and press the DO button to place it. Let’s count each one together.'
      ]
    });
    world.setBeacon(-4, 0);
  }

  function finishStoneMission() {
    stonesDone = true;
    PIP.save.setMission('meadow.stones', 'done');
    world.clearBeacon();
    var counts = GAP_COUNTS.join(' + ');
    var total = GAP_TOTAL;
    if (PIP.save.grantBadge('counter')) PIP.ui.toast('🔢', 'Inventor Badge: Careful Counter!');
    // Berrybacks celebrate by crossing the stones
    hopBerrybacksAcross();
    PIP.challenge.complete({
      title: 'The stepping-stone path is fixed!',
      maths: counts + ' = ' + total,
      text: 'You counted every stone into place. The Berrybacks can cross again!',
      speak: 'You placed ' + counts + ' stones. That makes ' + total + ' altogether. The Berrybacks can cross again!'
    }).then(function () {
      PIP.ui.setGoal('Find Bella Berryback by the big ravine, past the stream. ➡️', true);
      world.setBeacon(11, -4);
    });
  }

  function hopBerrybacksAcross() {
    gaps.forEach(function (gap, i) {
      var b = A.makeBerryback(U.pick([0xff6f9c, 0xffd257, 0xc9a6ff]));
      world.add(b, -10, terrainFn(-10, gap.z), gap.z);
      var t = -i * 0.8;
      world.tick(function (dt) {
        t += dt;
        if (t < 0) return;
        var prog = Math.min(1, t / 4);
        var x = U.lerp(-10, 2.5, prog);
        var baseY = x > -7.2 && x < -0.6 ? -0.82 : terrainFn(x, gap.z);
        b.position.set(x, baseY + Math.abs(Math.sin(t * 6)) * 0.25, gap.z);
        b.rotation.y = Math.PI / 2;
        if (prog >= 1) b.position.y = terrainFn(x, gap.z);
      });
    });
  }

  /* =====================================================================
     MISSION 2 — build a bridge for the Berrybacks
     ===================================================================== */
  var bridgeDone = PIP.save.mission('meadow.bridge') === 'done';
  var DECK_Y = terrainFn(11, -4) * 0 + 1.0;    // deck height over the ravine
  var DECK_X0 = 13.0, DECK_N = 10, DECK_W = 0.84;

  // Bella the Berryback waits at the ravine edge
  var bella = A.makeBerryback(0xff6f9c);
  world.addAt(bella, 11, -2);
  world.block(11, -2, 0.8);
  var bellaT = 0;
  world.tick(function (dt) {
    bellaT += dt;
    bella.position.y = terrainFn(11, -2) + Math.abs(Math.sin(bellaT * 2.5)) * 0.06;
    var pp = PIP.player.state.pos;
    if (U.dist2(pp.x, pp.z, 11, -2) < 80)
      bella.rotation.y = U.angleLerp(bella.rotation.y, Math.atan2(pp.x - 11, pp.z + 2), Math.min(1, dt * 3));
  });

  // plank crate at the build site
  var crate = A.mesh(A.GEO.box, A.mat(0xb98a55));
  crate.scale.set(1.4, 1, 1.4);
  world.addAt(crate, 12, -7, 0.5);
  world.block(12, -7, 1);
  var crateLabel = A.textSprite('6', { px: 90, scale: 0.9, color: '#fff' });
  crateLabel.position.set(12, terrainFn(12, -7) + 1.9, -7);
  world.add(crateLabel);

  // four planks hidden around the meadow
  var plankSpots = [[4, 14], [-14, 18], [3, -16], [-12, -18]];
  var planksFound = 0, plankMeshes = [];
  function spawnPlanks() {
    plankSpots.forEach(function (sp, i) {
      var pl = A.makePlank(0xe8b978);
      pl.scale.set(1.4, 0.16, 0.5);
      world.addAt(pl, sp[0], sp[1], 0.3);
      pl.rotation.y = U.rand(0, 3);
      var glow = new THREE.Mesh(new THREE.SphereGeometry(0.6, 8, 8),
        new THREE.MeshBasicMaterial({ color: 0xffe27a, transparent: true, opacity: 0.25 }));
      glow.position.copy(pl.position);
      world.add(glow);
      plankMeshes.push(glow);
      world.interact({
        x: sp[0], z: sp[1], radius: 1.9, prompt: 'Take plank', icon: '🪵',
        enabled: function () { return !pl.userData.taken; },
        onInteract: function () {
          pl.userData.taken = true;
          world.group.remove(pl); world.group.remove(glow);
          planksFound++;
          PIP.audio.play('collect');
          PIP.audio.play('count', planksFound);
          PIP.narrate.callout(U.numWord(6 + planksFound) + '!');
          PIP.ui.toast('🪵', 'Planks: ' + (6 + planksFound) + ' of 10');
          if (planksFound >= 4) {
            PIP.narrate.say('Ten planks! Six from the crate and four found makes ten. Back to Bella!');
            PIP.ui.setGoal('You have all 10 planks! Go back to Bella at the ravine. 🌉', false);
            world.setBeacon(11, -4);
          }
        }
      });
    });
  }

  world.interact({
    x: 11, z: -2, radius: 2.6, prompt: 'Talk to Bella', icon: '🐹',
    onInteract: function () { bellaTalk(); }
  });

  function bellaTalk() {
    if (bridgeDone) {
      PIP.ui.say('Bella', '🐹', [U.pick([
        'Our bridge is the strongest in the meadow — those triangles were YOUR idea!',
        'Squeak! Berrybacks bounce across your bridge all day long.'
      ])]);
      return;
    }
    if (!stonesDone) {
      PIP.ui.say('Bella', '🐹', ['Oh! Could you fix the stepping stones first? My cousins are stuck across the stream!']);
      return;
    }
    var stage = PIP.save.mission('meadow.bridge.stage') || 'ask';
    if (stage === 'ask') {
      PIP.ui.say('Bella', '🐹', [
        'The old bridge fell into the ravine! We Berrybacks cannot reach the orchard for the picnic.',
        'A bridge needs TEN deck planks all the way across.',
        'This crate only has SIX planks in it…'
      ]).then(function () {
        PIP.challenge.begin({
          id: 'meadow.planks', concept: 'bonds10',
          goal: 'Work out how many more planks we need to make 10.',
          hints: ['The crate shows 6. The bridge needs 10.',
            'Could you count on from six? Six… seven…',
            'Count the dashed circles with me — they are the missing planks.']
        });
        PIP.challenge.numberPick({
          question: 'We need 10 planks. The crate has 6. How many MORE do we need?',
          answer: 4,
          options: [3, 4, 5],
          visual: { total: 10, filled: 6 },
          nudge: 'Count on from six: seven, eight, nine, ten. How many did you count?',
          concept: 'bonds10'
        }).then(function () {
          PIP.save.recordAttempt('bonds10', true, 0);
          PIP.save.setMission('meadow.bridge.stage', 'collect');
          spawnPlanks();
          PIP.ui.setGoal('Find 4 planks in the meadow — they twinkle gold! 🪵', true);
          PIP.challenge.begin({
            id: 'meadow.plankhunt', concept: 'counting',
            goal: 'Find 4 planks in the meadow — they twinkle gold! 🪵',
            speak: false,
            hints: ['Golden twinkles show where planks are hiding.',
              'One is near the big flowers to the north, one by the orchard edge, two to the west.',
              'Use your map button to see the whole meadow, and look for golden glows.']
          });
        });
      });
    } else if (stage === 'collect' && planksFound < 4) {
      PIP.ui.say('Bella', '🐹', ['You have ' + (6 + planksFound) + ' planks so far. We need 10 — keep hunting the golden twinkles!']);
    } else {
      PIP.ui.say('Bella', '🐹', [
        'Ten planks! Time to build!',
        'Remember: it must reach ALL the way across, and hold three bouncy Berrybacks.'
      ]).then(startBridgeBuild);
    }
  }
  // planks respawn if the child left mid-hunt last visit
  if (!bridgeDone && PIP.save.mission('meadow.bridge.stage') === 'collect') spawnPlanks();

  /* ----- the bridge builder ----- */
  var permBridge = new THREE.Group();
  world.add(permBridge, 0, 0, 0);
  function buildPermanentBridge() {
    for (var i = 0; i < DECK_N; i++) {
      var pl = A.makePlank();
      pl.scale.set(DECK_W * 0.95, 0.18, 1.6);
      pl.position.set(DECK_X0 + (i + 0.5) * DECK_W, DECK_Y, -4);
      permBridge.add(pl);
    }
    [15.5, 19.5].forEach(function (tx) {
      var base = terrainFn(tx, -4);
      var h = (DECK_Y - 0.08 - base) / 4;
      for (var b = 0; b < 4; b++) {
        var bl = A.makeBlock();
        bl.scale.y *= h / 0.5;
        bl.position.set(tx, base + h / 2 + b * h, -4);
        permBridge.add(bl);
      }
      var brace = A.makeBrace();
      brace.position.set(tx - 0.5, DECK_Y - 0.85, -3.6);
      permBridge.add(brace);
    });
    world.platform(DECK_X0 - 0.4, DECK_X0 + DECK_N * DECK_W + 0.4, -4.9, -3.1, DECK_Y + 0.1, { noWall: true });
  }
  if (bridgeDone) buildPermanentBridge();

  function startBridgeBuild() {
    PIP.player.state.frozen = true;
    world.clearBeacon();
    // camera looks side-on at the ravine
    PIP.game.tweenCamera(new THREE.Vector3(17.2, 4.5, 6.5), new THREE.Vector3(17.2, 0.5, -4));
    PIP.challenge.begin({
      id: 'meadow.bridge', concept: 'dtStructure',
      goal: 'Build a bridge: 10 planks across, and strong towers underneath!',
      hints: [
        'The glowing spots show where parts can go. Pick a part card first.',
        'Each tower needs 4 blocks. 4 blocks and 4 more blocks — how many altogether?',
        'If the bridge wobbles, triangles make it stiff. Try the orange triangle braces!'
      ]
    });

    var parts = [
      { id: 'deck', name: 'Deck plank', icon: '🟫', count: 10, make: function () { var p = A.makePlank(); p.scale.set(DECK_W * 0.95, 0.18, 1.6); return p; }, tip: 'Planks make the path.' },
      { id: 'block', name: 'Tower block', icon: '⬜', count: 8, make: function () { return A.makeBlock(); }, tip: 'Blocks hold the bridge up.' },
      { id: 'brace', name: 'Triangle brace', icon: '🔺', count: 2, make: function () { return A.makeBrace(); }, tip: 'Triangles make it stiff!' }
    ];
    var slots = [];
    for (var i = 0; i < DECK_N; i++) {
      slots.push({
        id: 'deck' + i, accepts: ['deck'], group: 'deck',
        pos: new THREE.Vector3(DECK_X0 + (i + 0.5) * DECK_W, DECK_Y, -4)
      });
    }
    [15.5, 19.5].forEach(function (tx, ti) {
      var base = terrainFn(tx, -4);
      var h = (DECK_Y - 0.08 - base) / 4; // 4 blocks exactly span floor → deck
      for (var b = 0; b < 4; b++) {
        slots.push({
          id: 'tower' + ti + '_' + b, accepts: ['block'], group: 'tower' + ti,
          pos: new THREE.Vector3(tx, base + h / 2 + b * h, -4),
          placeTransform: function (m) { m.scale.y *= h / 0.5; }
        });
      }
      slots.push({
        id: 'brace' + ti, accepts: ['brace'], group: 'braces',
        pos: new THREE.Vector3(tx - 0.5, DECK_Y - 0.85, -3.6)
      });
    });

    var testedOnce = false;
    PIP.builder.start({
      scene: world.group,
      parts: parts, slots: slots,
      tip: 'Pick a part card, then tap a glowing spot! Put the card down to take parts back.',
      allowBack: true,
      canTest: function () {
        var c = PIP.builder.counts();
        if ((c['group:deck'] || 0) === 0) return 'Put some deck planks on first — the glowing spots show where.';
        return null;
      },
      onTest: function (api) {
        var c = api.counts;
        var decks = c['group:deck'] || 0;
        var t0 = c['group:tower0'] || 0, t1 = c['group:tower1'] || 0;
        var braces = c['group:braces'] || 0;
        PIP.builder.setTesting(true);
        if (!testedOnce) { testedOnce = true; if (PIP.save.grantBadge('tester')) PIP.ui.toast('🧪', 'Inventor Badge: Brave Tester!'); }
        runBridgeTest(api.slots, decks, t0, t1, braces).then(function (result) {
          PIP.builder.setTesting(false);
          if (result === 'success') {
            PIP.save.setMission('meadow.bridge', 'done');
            PIP.save.setMission('meadow.bridge.stage', 'built');
            bridgeDone = true;
            PIP.save.recordAttempt('dtStructure', true, 0);
            PIP.save.recordAttempt('dtTest', true, 0);
            PIP.save.addDesign({ name: 'Berryback Bridge', icon: '🌉', note: '10 planks, two 4-block towers, triangle braces.' });
            if (PIP.save.grantBadge('improver') && braces > 0) PIP.ui.toast('🔧', 'Inventor Badge: Clever Improver!');
            PIP.builder.finish();
            world.platform(DECK_X0 - 0.4, DECK_X0 + DECK_N * DECK_W + 0.4, -4.9, -3.1, DECK_Y + 0.1, { noWall: true });
            PIP.player.state.frozen = false;
            PIP.challenge.complete({
              title: 'The bridge is strong!',
              maths: '6 + 4 = 10  ·  4 + 4 = 8',
              text: 'Ten planks across, eight blocks in two towers, and triangles to make it stiff. Three Berrybacks crossed safely!',
              speak: 'Six planks plus four planks made ten. Four blocks and four blocks made two strong towers. Your triangles made it stiff. Bridge built!'
            }).then(function () {
              PIP.ui.setGoal('Cross your bridge to the orchard for the Numberberry Picnic! 🍓', true);
              world.setBeacon(28, -2);
            });
          }
        });
      },
      onExit: function () {
        PIP.player.state.frozen = false;
      }
    });
  }

  function runBridgeTest(slots, decks, t0, t1, braces) {
    return new Promise(function (resolve) {
      var deckMeshes = slots.filter(function (s) { return s.group === 'deck' && s.placed; })
        .map(function (s) { return s.placed.mesh; });
      // three brave Berrybacks step on
      var testers = [];
      for (var i = 0; i < 3; i++) {
        var b = A.makeBerryback([0xff6f9c, 0xffd257, 0xc9a6ff][i]);
        b.position.set(12 - i * 1.1, terrainFn(12 - i * 1.1, -4), -4);
        b.rotation.y = Math.PI / 2;
        world.group.add(b);
        testers.push(b);
      }
      var t = 0, outcome = null, done = false;
      if (decks < DECK_N) outcome = 'gap';
      else if (t0 < 4 || t1 < 4) outcome = 'sag';
      else if (braces < 2) outcome = 'wobble';
      else outcome = 'success';

      var ticker = function (dt) {
        if (done) return;
        t += dt;
        var lead = Math.min(1, t / 5);
        testers.forEach(function (b, i) {
          var prog = U.clamp(lead - i * 0.12, 0, 1);
          var x = U.lerp(12, 22.5, prog);
          var onBridge = x > DECK_X0 && x < DECK_X0 + DECK_N * DECK_W;
          var y = onBridge ? DECK_Y + 0.1 : terrainFn(x, -4);
          if (outcome === 'wobble' && onBridge) y += Math.sin(t * 10 + i) * 0.22;
          if (outcome === 'sag' && onBridge) y -= band(x, 17, 4) * 1.4;
          b.position.set(x, y + Math.abs(Math.sin(t * 7 + i)) * 0.15, -4);
        });
        if (outcome === 'wobble') deckMeshes.forEach(function (m, i) { m.rotation.x = Math.sin(t * 10 + i) * 0.12; m.position.y = DECK_Y + Math.sin(t * 10 + i * 2) * 0.12; });
        if (outcome === 'sag') deckMeshes.forEach(function (m) { m.position.y = DECK_Y - band(m.position.x, 17, 4) * 1.4; });

        var failT = outcome === 'gap' ? 1.6 : 2.6;
        if ((outcome === 'wobble' || outcome === 'sag' || outcome === 'gap') && t > failT) {
          done = true;
          PIP.audio.play(outcome === 'gap' ? 'notyet' : 'wobble');
          testers.forEach(function (b) { world.group.remove(b); });
          deckMeshes.forEach(function (m) { m.rotation.x = 0; m.position.y = DECK_Y; });
          var msg = outcome === 'gap' ?
            'The Berrybacks stopped at the edge! The bridge does not reach all the way across yet. Count the empty glowing spots.' :
            outcome === 'sag' ?
              'Ooh — the middle sagged down low! The planks need holding up. Each tower wants 4 blocks under the bridge.' :
              'It wobbled and the Berrybacks bounced right back! It is nearly there. Triangles make things stiff — try the orange braces.';
          PIP.ui.say('Professor Pebble', '🪨', [
            outcome === 'wobble' ? 'That bridge is certainly exciting. I am not yet convinced it is a bridge.' : 'A test! Wonderful. Every test teaches us something.',
            msg
          ]).then(function () { resolve(outcome); });
          PIP.save.recordAttempt('dtTest', true, 0);
        }
        if (outcome === 'success' && t > 5.4) {
          done = true;
          PIP.audio.play('success');
          testers.forEach(function (b) { world.group.remove(b); });
          resolve('success');
        }
      };
      world.tick(ticker);
    });
  }

  // bounce mushroom in the ravine so nobody gets stuck
  var shroom = new THREE.Group();
  var stalk = A.mesh(A.GEO.cyl, A.mat(0xfff3c9), 0, 0.4, 0); stalk.scale.set(0.3, 0.8, 0.3);
  var cap = A.mesh(A.GEO.sphere, A.mat(0xff6f9c), 0, 0.9, 0); cap.scale.set(0.9, 0.5, 0.9);
  shroom.add(stalk, cap);
  world.addAt(shroom, 17, 3);
  world.tick(function (dt) {
    var ps = PIP.player.state;
    if (U.dist2(ps.pos.x, ps.pos.z, 17, 3) < 1.2 && ps.pos.y < terrainFn(17, 3) + 1.4 && ps.vel.y <= 0) {
      ps.vel.y = 16;
      cap.scale.set(1.1, 0.3, 1.1);
      PIP.audio.play('jump');
      setTimeout(function () { cap.scale.set(0.9, 0.5, 0.9); }, 200);
    }
  });
  world.addAt(A.makeSign('Boing!'), 15.5, 4.5);

  /* =====================================================================
     MISSION 3 — the Numberberry Picnic (fair sharing)
     ===================================================================== */
  var picnicDone = PIP.save.mission('meadow.picnic') === 'done';
  var lvlShare = PIP.save.levelFor('sharing');
  var GUESTS = 3;
  var BERRIES = lvlShare === 0 ? 6 : lvlShare === 2 ? 15 : 12;
  var PER = BERRIES / GUESTS;

  var mats = [];
  var guestData = [
    { x: 26, z: 4, color: 0xff6f9c, name: 'Pip-squeak' },
    { x: 29, z: 7, color: 0xffd257, name: 'Bumble' },
    { x: 32, z: 4, color: 0xc9a6ff, name: 'Plum' }
  ];
  var basket = { x: 29, z: 1, count: BERRIES };
  var picnicActive = false;

  guestData.forEach(function (gd, gi) {
    var mat = A.mesh(A.GEO.cyl, A.mat(0xfff3c9));
    mat.scale.set(1.1, 0.08, 1.1);
    world.addAt(mat, gd.x, gd.z, 0.02);
    var guest = A.makeBerryback(gd.color);
    world.addAt(guest, gd.x, gd.z - 1.6);
    world.block(gd.x, gd.z - 1.6, 0.7);
    var numeral = A.textSprite('0', { px: 90, scale: 0.85, color: '#fff' });
    numeral.position.set(gd.x, terrainFn(gd.x, gd.z) + 2.0, gd.z);
    numeral.visible = false;
    world.add(numeral);
    var m = { gd: gd, count: 0, numeral: numeral, guest: guest, berryMeshes: [], t: U.rand(0, 5) };
    mats.push(m);
    world.tick(function (dt) {
      m.t += dt;
      guest.position.y = terrainFn(gd.x, gd.z - 1.6) + Math.abs(Math.sin(m.t * 2.2)) * 0.05;
    });
    // give a berry / take a berry back
    world.interact({
      x: gd.x, z: gd.z, radius: 1.9, prompt: 'Give berry to ' + gd.name, icon: '🍓',
      enabled: function () {
        return picnicActive && !picnicFinished && PIP.player.state.carrying && PIP.player.state.carrying.userData.isBerry;
      },
      onInteract: function () {
        var berry = PIP.player.drop();
        world.group.remove(berry);
        addBerryToMat(m);
        PIP.audio.play('count', m.count);
        PIP.narrate.callout(U.numWord(m.count) + ' for ' + gd.name + '!');
        checkPicnic();
      }
    });
    world.interact({
      x: gd.x, z: gd.z, radius: 1.9, prompt: 'Take a berry back', icon: '↩️',
      enabled: function () {
        return picnicActive && !picnicFinished && !PIP.player.state.carrying && m.count > 0 && basket.count === 0 && !isFair();
      },
      onInteract: function () {
        removeBerryFromMat(m);
        var berry = A.makeBerry();
        berry.userData.isBerry = true;
        world.group.add(berry);
        PIP.player.carry(berry);
        PIP.audio.play('pop');
      }
    });
  });

  function addBerryToMat(m) {
    m.count++;
    var b = A.makeBerry();
    var a = m.count * 2.4;
    b.position.set(m.gd.x + Math.cos(a) * 0.5, terrainFn(m.gd.x, m.gd.z) + 0.15, m.gd.z + Math.sin(a) * 0.5);
    world.group.add(b);
    m.berryMeshes.push(b);
    m.numeral.visible = true;
    updateMatNumeral(m);
  }
  function removeBerryFromMat(m) {
    m.count--;
    var b = m.berryMeshes.pop();
    if (b) world.group.remove(b);
    updateMatNumeral(m);
  }
  function updateMatNumeral(m) {
    var parent = m.numeral.parent;
    var pos = m.numeral.position.clone();
    parent.remove(m.numeral);
    m.numeral = A.textSprite(String(m.count), { px: 90, scale: 0.85, color: isFairFor(m) ? '#8ce68a' : '#fff' });
    m.numeral.position.copy(pos);
    parent.add(m.numeral);
  }
  function isFairFor(m) { return m.count === PER; }
  function isFair() {
    return mats.every(function (m) { return m.count === PER; });
  }

  // basket
  var basketMesh = new THREE.Group();
  var bb = A.mesh(A.GEO.cyl, A.mat(0xc98d5a), 0, 0.3, 0); bb.scale.set(0.9, 0.6, 0.9);
  basketMesh.add(bb);
  var basketBerries = [];
  world.addAt(basketMesh, basket.x, basket.z);
  world.block(basket.x, basket.z, 0.8);
  var basketLabel = A.textSprite(String(BERRIES), { px: 90, scale: 0.9, color: '#ffb1d0' });
  basketLabel.position.set(basket.x, terrainFn(basket.x, basket.z) + 1.8, basket.z);
  world.add(basketLabel);
  function refreshBasket() {
    basketBerries.forEach(function (b) { basketMesh.remove(b); });
    basketBerries = [];
    for (var i = 0; i < Math.min(basket.count, 9); i++) {
      var b = A.makeBerry();
      b.position.set(Math.cos(i * 2.1) * 0.4, 0.65 + (i % 3) * 0.12, Math.sin(i * 2.1) * 0.4);
      basketMesh.add(b);
      basketBerries.push(b);
    }
    var parent = basketLabel.parent, pos = basketLabel.position.clone();
    parent.remove(basketLabel);
    basketLabel = A.textSprite(String(basket.count), { px: 90, scale: 0.9, color: '#ffb1d0' });
    basketLabel.position.copy(pos);
    parent.add(basketLabel);
  }
  if (!picnicDone) refreshBasket(); else { basket.count = 0; refreshBasket(); }

  world.interact({
    x: basket.x, z: basket.z, radius: 2.0, prompt: 'Take a berry', icon: '🍓',
    enabled: function () { return picnicActive && !picnicFinished && basket.count > 0 && !PIP.player.state.carrying; },
    onInteract: function () {
      basket.count--;
      refreshBasket();
      var berry = A.makeBerry();
      berry.userData.isBerry = true;
      world.group.add(berry);
      PIP.player.carry(berry);
      PIP.audio.play('pop');
    }
  });

  var mama = A.makeBerryback(0x8fd483);
  mama.scale.setScalar(1.3);
  world.addAt(mama, 27, 0);
  world.block(27, 0, 0.9);
  world.interact({
    x: 27, z: 0, radius: 2.6, prompt: 'Talk to Mama Berryback', icon: '🐹',
    onInteract: function () {
      if (picnicDone) {
        PIP.ui.say('Mama Berryback', '🐹', ['That was the fairest picnic in meadow history. Everyone had exactly the same!']);
        return;
      }
      if (!bridgeDone) {
        PIP.ui.say('Mama Berryback', '🐹', ['You hopped over the ravine?! Gracious. The little ones need Bella’s bridge before picnic day.']);
        return;
      }
      if (!picnicActive) {
        picnicActive = true;
        PIP.ui.say('Mama Berryback', '🐹', [
          'Picnic time! I picked ' + BERRIES + ' numberberries.',
          'Pip-squeak, Bumble and Plum must each get the SAME amount — or somebody will sulk.',
          'Carry the berries from my basket to their picnic mats, please!'
        ]).then(function () {
          PIP.challenge.begin({
            id: 'meadow.picnic', concept: 'sharing',
            goal: 'Share ' + BERRIES + ' berries fairly between the 3 Berrybacks.',
            hints: [
              'Give one berry to each mat, then start again: one for each, round and round.',
              'Look at the numbers over the mats. Are any different?',
              'Everyone should have ' + PER + '. If a mat has more, take one back and give it to a mat with fewer.'
            ]
          });
          world.setBeacon(29, 1);
        });
      }
    }
  });

  var picnicFinished = false;
  function checkPicnic() {
    if (basket.count > 0) return;
    if (isFair()) {
      picnicFinished = true;
      picnicDone = true;
      PIP.save.setMission('meadow.picnic', 'done');
      world.clearBeacon();
      if (PIP.save.grantBadge('sharer')) PIP.ui.toast('🍓', 'Inventor Badge: Fair Sharer!');
      mats.forEach(function (m) { // happy hop
        var t = 0;
        world.tick(function (dt) {
          t += dt;
          if (t < 2) m.guest.position.y = terrainFn(m.gd.x, m.gd.z - 1.6) + Math.abs(Math.sin(t * 8)) * 0.3;
        });
      });
      var line = [];
      for (var i = 0; i < GUESTS; i++) line.push(PER);
      PIP.challenge.complete({
        title: 'A perfectly fair picnic!',
        maths: line.join(' + ') + ' = ' + BERRIES,
        text: BERRIES + ' berries shared into 3 equal groups of ' + PER + '. Every Berryback is beaming!',
        speak: BERRIES + ' berries, shared fairly, is ' + PER + ' each. ' + PER + ' plus ' + PER + ' plus ' + PER + ' makes ' + BERRIES + '. Equal shares!'
      }).then(checkAllMissions);
    } else {
      // gentle prompt to compare
      var most = mats[0], least = mats[0];
      mats.forEach(function (m) { if (m.count > most.count) most = m; if (m.count < least.count) least = m; });
      PIP.audio.play('notyet');
      PIP.ui.say('Mama Berryback', '🐹', [
        'Hmm! ' + most.gd.name + ' has ' + most.count + ' but ' + least.gd.name + ' only has ' + least.count + '.',
        'That is not equal yet. Take a berry back from a big pile and give it to a small one.'
      ]);
      PIP.save.recordAttempt('comparing', true, 0);
    }
  }

  /* =====================================================================
     HIDDEN CHALLENGE — the growing flower trail (2, 4, 6, 8, …?)
     ===================================================================== */
  var patternDone = PIP.save.mission('meadow.pattern') === 'done';
  var trailBase = { x: -18, z: 24 };
  [2, 4, 6, 8].forEach(function (n, pi) {
    var px = trailBase.x + pi * 4.4, pz = trailBase.z - pi * 1.2;
    for (var i = 0; i < n; i++) {
      var f = A.makeFlower([0xff6f9c, 0xffd257, 0x9fd8ff, 0xc9a6ff][pi], 1);
      world.addAt(f, px + (i % 4) * 0.6 - 0.9, pz + Math.floor(i / 4) * 0.7, 0);
    }
    var num = A.textSprite(String(n), { px: 80, scale: 0.8, color: '#ffe27a' });
    num.position.set(px, terrainFn(px, pz) + 2.0, pz);
    world.add(num);
  });
  var padOptions = U.shuffle([9, 10, 12]);
  var padHit = false;
  padOptions.forEach(function (n, i) {
    var px = trailBase.x + 4 * 4.4 + (i - 1) * 3.2, pz = trailBase.z - 4 * 1.2 - Math.abs(i - 1) * 1;
    var pad = A.mesh(A.GEO.cyl, A.mat(patternDone && n === 10 ? 0x8ce68a : 0xd8c9a0));
    pad.scale.set(1.2, 0.2, 1.2);
    world.addAt(pad, px, pz, 0.1);
    var num = A.textSprite(String(n), { px: 80, scale: 0.8, color: '#fff' });
    num.position.set(px, terrainFn(px, pz) + 1.6, pz);
    world.add(num);
    if (patternDone) return;
    // stomp pads
    world.tick(function (dt) {
      if (padHit) return;
      var ps = PIP.player.state;
      if (ps.stomping) return;
      if (ps.grounded && U.dist2(ps.pos.x, ps.pos.z, px, pz) < 1.4 && ps.anim.land > 0.2) {
        onPadStomp(n, pad, px, pz);
      }
    });
  });
  world.addAt(A.makeSign('Secret: what comes next?'), trailBase.x - 3, trailBase.z + 2.5);
  var patternIntroDone = false;
  world.tick(function (dt) {
    if (patternIntroDone || patternDone) return;
    var ps = PIP.player.state.pos;
    if (U.dist2(ps.x, ps.z, trailBase.x, trailBase.z) < 36) {
      patternIntroDone = true;
      PIP.challenge.begin({
        id: 'meadow.pattern', concept: 'patterns',
        goal: 'The flowers grow in a pattern: 2, 4, 6, 8… JUMP onto the stone that comes next!',
        hints: [
          'Say the numbers out loud: two, four, six, eight…',
          'Each patch has 2 more flowers than the one before. What is 2 more than 8?',
          'Count up two from eight: nine… ten! Land on that stone with a jump.'
        ]
      });
    }
  });
  function onPadStomp(n, pad, px, pz) {
    if (n === 10) {
      padHit = true;
      PIP.save.setMission('meadow.pattern', 'done');
      pad.material = A.mat(0x8ce68a);
      PIP.audio.play('success');
      for (var i = 0; i < 10; i++) {
        var f = A.makeFlower(0x8ce68a, 1.1);
        world.addAt(f, px + (i % 4) * 0.6 - 0.9, pz + 1.5 + Math.floor(i / 4) * 0.7, 0);
      }
      if (PIP.save.grantBadge('pattern')) PIP.ui.toast('🌸', 'Inventor Badge: Pattern Finder!');
      world.seed('pattern1', px - 1, pz + 3, 0.8);
      world.seed('pattern2', px + 1, pz + 3, 0.8);
      PIP.challenge.complete({
        title: 'You found the pattern!',
        maths: '2, 4, 6, 8, 10',
        text: 'The flowers were growing by 2 each time. Ten new flowers burst into bloom!',
        speak: 'The pattern was growing by two each time. Two, four, six, eight, ten!'
      });
    } else {
      PIP.audio.play('notyet');
      PIP.challenge.attempt(false);
      PIP.narrate.say('Not that one yet. The pattern grows by two each time: 2, 4, 6, 8…');
      PIP.save.recordAttempt('patterns', false, 0);
    }
  }

  /* =====================================================================
     THE IDEA CORE
     ===================================================================== */
  var coreTaken = PIP.save.hasCore('meadow');
  var pedestal = A.mesh(A.GEO.cyl, A.mat(0xd7b356));
  pedestal.scale.set(0.9, 1.2, 0.9);
  world.addAt(pedestal, 8, 10, 0.6);
  world.block(8, 10, 1.1);
  var core = A.makeCore(0xff9ec4);
  world.addAt(core, 8, 10, 1.3);
  core.visible = false;
  var coreT = 0;
  world.tick(function (dt) {
    if (!core.visible) return;
    coreT += dt;
    core.position.y = terrainFn(8, 10) + 1.6 + Math.sin(coreT * 2) * 0.15;
    core.rotation.y += dt;
    core.userData.ring.rotation.z += dt * 2;
  });

  function checkAllMissions() {
    if (stonesDone && bridgeDone && picnicDone && !coreTaken && !core.visible) {
      core.visible = true;
      PIP.audio.play('unlock');
      PIP.ui.say('Professor Pebble', '🪨', [
        'Pip! The meadow’s Idea Core has floated back to its pedestal on the hill!',
        'Stones counted, a bridge tested and improved, a picnic shared fairly — that is inventor work.',
        'Go and collect it!'
      ]).then(function () {
        PIP.ui.setGoal('Collect the glowing Idea Core on the hill! 💡', false);
        world.setBeacon(8, 10);
      });
    }
  }
  world.interact({
    x: 8, z: 10, radius: 2.4, prompt: 'Take the Idea Core', icon: '💡',
    enabled: function () { return core.visible && !coreTaken; },
    onInteract: function () {
      coreTaken = true;
      core.visible = false;
      PIP.save.grantCore('meadow');
      PIP.ui.updateHUD();
      world.clearBeacon();
      PIP.audio.play('fanfare');
      PIP.ui.summary({
        title: 'IDEA CORE FOUND! 💡',
        maths: null,
        text: 'The first Idea Core is safe! Take it home to Inventor Village and watch the village wake up.',
        speak: 'You found the first Idea Core! Take it back to Inventor Village.',
        stars: '💡⭐💡'
      }).then(function () {
        PIP.ui.setGoal('Return to Inventor Village through the green gate. 🏡', false);
        world.setBeacon(-31, 0);
      });
    }
  });

  /* ---------- scenery & seeds ---------- */
  [[-24, 10], [-26, -6], [5, 20], [24, 14], [30, -10], [2, -22], [-8, -26], [22, -18]].forEach(function (t, i) {
    var tree = A.makeTree(i % 4 === 0 ? 'pine' : 'round');
    world.addAt(tree, t[0], t[1]);
    world.block(t[0], t[1], 0.7);
  });
  // giant flowers (landmark)
  [[6, 16], [10, 18]].forEach(function (fp) {
    var f = A.makeFlower(0xff6f9c, 3.2);
    world.addAt(f, fp[0], fp[1]);
    world.block(fp[0], fp[1], 0.5);
  });
  K.scatter(world, 24, function () { return A.makeFlower(U.pick([0xff6f9c, 0xffd257, 0x9fd8ff, 0xc9a6ff]), U.rand(0.6, 1.3)); }, 0, 0, 30);
  K.scatter(world, 8, function () { return A.makeBush(0x4fae5e); }, 10, -14, 16);
  world.butterflies(8, 0, 8, 22);

  world.seed('m1', -20, 16, 0.6);
  world.seed('m2', -24, -14, 0.6);
  world.seed('m3', 2, 24, 0.6);
  world.seed('m4', 17, -2, -4.6);       // down in the ravine (bounce out!)
  world.seed('m5', 30, 12, 0.6);
  world.seed('m6', 8, 11.5, 3.4);       // above the core hill
  world.seed('m7', -2, -28, 0.6);
  world.seed('m8', 24, -24, 0.6);

  /* ---------- arrival ---------- */
  world.postEnter = function () {
    if (!PIP.save.mission('meadow.intro')) {
      PIP.save.setMission('meadow.intro', 'done');
      return PIP.ui.say('Bramble', '🐹', [
        'Squeak! A visitor! I am Bramble the Berryback.',
        'The Mix-Up Machine stole our stepping stones! We cannot cross the stream — Berrybacks sink like berries.',
        'The yellow numbers show how many stones each gap needs. The spare stones are lying around the bank.',
        'Please, Pip — carry stones to the gaps and count them in!'
      ]).then(function () {
        startStoneMission();
      });
    }
    if (!stonesDone) { startStoneMission(); }
    else if (!bridgeDone) {
      PIP.ui.setGoal('Find Bella Berryback by the big ravine. 🌉', false);
      world.setBeacon(11, -4);
    } else if (!picnicDone) {
      PIP.ui.setGoal('Cross the bridge and talk to Mama Berryback in the orchard. 🍓', false);
      world.setBeacon(27, 0);
    } else if (!coreTaken) { checkAllMissions(); }
    else PIP.ui.clearGoal();
    return Promise.resolve();
  };

  // Bramble hangs about near the stream
  var bramble = A.makeBerryback(0xffd257);
  world.addAt(bramble, -12, 1);
  world.block(-12, 1, 0.7);
  world.interact({
    x: -12, z: 1, radius: 2.2, prompt: 'Talk to Bramble', icon: '🐹',
    onInteract: function () {
      if (!PIP.save.settings.chatter && stonesDone) return;
      if (!stonesDone) {
        var left = gaps.reduce(function (a, g) { return a + (g.need - g.filled); }, 0);
        PIP.ui.say('Bramble', '🐹', [
          left === GAP_TOTAL ?
            'The numbers by the stream show how many stones fit in each gap!' :
            'Only ' + left + ' more stones to go! You are so close!'
        ]);
      } else {
        PIP.ui.say('Bramble', '🐹', [U.pick([
          'Squeak! I hopped across your stones eleven times today. Or maybe twelve.',
          'You are the best stone-counter in the whole meadow!'
        ])]);
      }
    }
  });

  return world;
};
