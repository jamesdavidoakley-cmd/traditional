/* World 2 — Gearleaf Grove (partially complete, unlocked by the Meadow core).
   Mission 1: Fix the tree lift        (gears, doubles, DT mechanisms)
   Mission 2: Balance the acorn gates  (equality, missing numbers)
   Mission 3 + hidden challenge:       signposted as still growing. */
PIP.worlds = PIP.worlds || {};

PIP.worlds.grove = function () {
  var U = PIP.util, A = PIP.assets, K = PIP.worldkit;

  function terrainFn(x, z) {
    var y = 0.4 + Math.sin(x * 0.12) * Math.cos(z * 0.1) * 0.5;
    y += U.hill(x, z, 18, -6, 12, 1.6);
    y += U.hill(x, z, -8, 18, 10, 1.2);
    var d = Math.sqrt(x * x + z * z);
    if (d > 28) y -= (d - 28) * 1.7;
    return y;
  }
  function colorFn(x, z, y) {
    var n = Math.sin(x * 0.4) * Math.cos(z * 0.37);
    return n > 0.3 ? '#5fae53' : n < -0.4 ? '#457f3f' : '#4f9a49';
  }

  var world = K.createWorld({
    id: 'grove', music: 'grove', sky: 0x8fc8b0,
    groundFn: terrainFn, colorFn: colorFn, size: 72, segs: 96,
    bounds: { minX: -29, maxX: 29, minZ: -29, maxZ: 29 },
    spawn: { x: -23, z: 0, angle: Math.PI / 2 },
    killY: -14
  });

  /* ---------- return gate ---------- */
  var backGate = A.makeGate(0x8fd483);
  world.addAt(backGate, -26.5, 0);
  backGate.rotation.y = Math.PI / 2;
  backGate.userData.swirl.material.opacity = 0.5;
  world.interact({
    x: -26.5, z: 0, radius: 2.4, prompt: 'Back to Inventor Village', icon: '🏡',
    onInteract: function () { PIP.game.gotoWorld('hub'); }
  });

  /* =====================================================================
     MISSION 1 — fix the tree lift
     ===================================================================== */
  var liftDone = PIP.save.mission('grove.lift') === 'done';

  // the great gear-tree with a lift platform and Nutkin's treehouse
  var bigTree = A.makeTree('round');
  bigTree.scale.setScalar(2.6);
  world.addAt(bigTree, 18, -6);
  world.block(18, -6, 1.9);
  var house = A.makeHouse(0xc98d5a, 0x5fae53);
  house.scale.setScalar(0.55);
  world.add(house, 18, terrainFn(18, -6) + 8.6, -6);
  var liftBase = terrainFn(16, -2.5);

  var liftPlat = A.mesh(A.GEO.box, A.mat(0xd8a869));
  liftPlat.scale.set(2, 0.25, 2);
  world.add(liftPlat, 15.4, liftBase + 0.15, -2.2);
  var liftWalk = world.platform(14.4, 16.4, -3.2, -1.2, liftBase + 0.28, { noWall: true });
  var rope = A.mesh(A.GEO.cyl, A.mat(0x6b5137));
  rope.scale.set(0.05, 9, 0.05);
  world.add(rope, 15.4, liftBase + 4.8, -2.2);

  // fixed drive gear (8 teeth) + waterwheel that powers it
  var driveGear = A.makeGear(0.8, 8, 0xb98a55);
  world.add(driveGear, 13.2, liftBase + 1.6, -3.4);
  var driveLabel = A.textSprite('8', { px: 80, scale: 0.7, color: '#ffe27a' });
  world.add(driveLabel, 13.2, liftBase + 3.0, -3.4);
  var chosenGear = null, chosenTeeth = 0;
  var gearSlotPos = new THREE.Vector3(14.9, liftBase + 1.6, -3.4);

  var wheel = A.makeGear(1.3, 12, 0x8a6142);
  world.add(wheel, 11.6, liftBase + 1.6, -3.4);
  world.tick(function (dt) {
    wheel.rotation.z -= dt * 1.2;
    driveGear.rotation.z += dt * 1.2;
    if (chosenGear) chosenGear.rotation.z -= dt * 1.2 * (8 / chosenTeeth);
  });

  var nutkin = A.makeSquirrelish();
  world.addAt(nutkin, 13.5, -0.5);
  world.block(13.5, -0.5, 0.7);
  var nutT = 0;
  world.tick(function (dt) {
    nutT += dt;
    nutkin.position.y = terrainFn(13.5, -0.5) + Math.abs(Math.sin(nutT * 3)) * 0.06;
    var pp = PIP.player.state.pos;
    if (U.dist2(pp.x, pp.z, 13.5, -0.5) < 60)
      nutkin.rotation.y = U.angleLerp(nutkin.rotation.y, Math.atan2(pp.x - 13.5, pp.z + 0.5), Math.min(1, dt * 3));
  });

  world.interact({
    x: 13.5, z: -0.5, radius: 2.6, prompt: 'Talk to Nutkin', icon: '🐿️',
    onInteract: function () {
      if (liftDone) {
        PIP.ui.say('Nutkin', '🐿️', ['Same teeth, same speed — my lift purrs like a happy machine. Ride it any time!']);
        return;
      }
      PIP.ui.say('Nutkin', '🐿️', [
        'My tree lift is STUCK and my acorns are all upstairs!',
        'The waterwheel spins the drive gear — it has 8 teeth, count them if you like.',
        'The lift needs a partner gear. Little gears spin fast, big gears spin slowly.',
        'For a gentle ride, the partner must spin at the SAME speed. Which gear will you try?'
      ]).then(startLiftBuild);
    }
  });

  function startLiftBuild() {
    PIP.player.state.frozen = true;
    PIP.game.tweenCamera(new THREE.Vector3(14.2, liftBase + 3.4, 2.8), new THREE.Vector3(14.2, liftBase + 1.4, -3.4));
    PIP.challenge.begin({
      id: 'grove.lift', concept: 'doubles',
      goal: 'Pick a partner gear so the lift moves gently — then test it!',
      hints: [
        'Count the drive gear’s teeth — eight! Now look at the tooth numbers on the gear cards.',
        'A gear with FEWER teeth spins faster. A gear with MORE teeth spins slower.',
        'Four is half of eight, so the small gear spins twice as fast. Which gear has the SAME eight teeth?'
      ]
    });
    var parts = [
      { id: 'g4', name: 'Small gear (4 teeth)', icon: '⚙️', count: 1, make: function () { var g = A.makeGear(0.45, 4, 0xe0b060); g.userData.teeth = 4; return g; }, tip: '4 teeth — half of 8, so it spins double-fast!' },
      { id: 'g8', name: 'Middle gear (8 teeth)', icon: '⚙️', count: 1, make: function () { var g = A.makeGear(0.8, 8, 0xd8a869); g.userData.teeth = 8; return g; }, tip: '8 teeth — the same as the drive gear.' },
      { id: 'g16', name: 'Big gear (16 teeth)', icon: '⚙️', count: 1, make: function () { var g = A.makeGear(1.4, 16, 0xb98a55); g.userData.teeth = 16; return g; }, tip: '16 teeth — double 8, so it spins half as fast.' }
    ];
    var slots = [{
      id: 'gearslot', accepts: ['g4', 'g8', 'g16'], pos: gearSlotPos.clone(),
      ghost: function () {
        return new THREE.Mesh(new THREE.SphereGeometry(0.7, 10, 8),
          new THREE.MeshBasicMaterial({ color: 0xffe27a, transparent: true, opacity: 0.4, depthWrite: false }));
      }
    }];
    PIP.builder.start({
      scene: world.group,
      parts: parts, slots: slots,
      tip: 'Pick a gear card, then tap the glowing spot beside the drive gear.',
      canTest: function () {
        if (!slots[0].placed) return 'Choose a gear first — tap a card, then the glowing spot.';
        return null;
      },
      onTest: function (api) {
        var teeth = api.slots[0].placed.mesh.userData.teeth;
        PIP.builder.setTesting(true);
        runLiftTest(teeth).then(function (ok) {
          PIP.builder.setTesting(false);
          if (ok) {
            liftDone = true;
            PIP.save.setMission('grove.lift', 'done');
            PIP.save.recordAttempt('doubles', true, 0);
            PIP.save.recordAttempt('dtMechanism', true, 0);
            PIP.save.addDesign({ name: 'Tree Lift Gears', icon: '⚙️', note: '8-tooth partner gear: same teeth, same speed.' });
            if (PIP.save.grantBadge('mechanism')) PIP.ui.toast('⚙️', 'Inventor Badge: Mechanism Maker!');
            chosenGear = api.slots[0].placed.mesh;
            chosenTeeth = 8;
            PIP.builder.finish();
            PIP.player.state.frozen = false;
            makeLiftRideable();
            PIP.challenge.complete({
              title: 'The lift is fixed!',
              maths: '8 = 8  ·  double 4 = 8',
              text: 'Same number of teeth means the same speed. The little 4-tooth gear span DOUBLE-fast, the big one only HALF. You found the match!',
              speak: 'Eight teeth equals eight teeth. Same teeth, same speed — a perfectly gentle lift. And remember: double four is eight!'
            }).then(function () {
              PIP.ui.setGoal('Ride the lift, then find the acorn balance gate to the north! ⚖️', true);
              world.setBeacon(-2, 20);
            });
          }
        });
      },
      onExit: function () { PIP.player.state.frozen = false; }
    });
  }

  function runLiftTest(teeth) {
    return new Promise(function (resolve) {
      PIP.audio.play('gear');
      var t = 0, done = false;
      var speed = teeth === 8 ? 1 : teeth === 4 ? 3 : 0.28;
      var startY = liftBase + 0.15;
      world.tick(function (dt) {
        if (done) return;
        t += dt;
        var y = startY + Math.min(7.6, t * speed * 1.6);
        liftPlat.position.y = y;
        if (teeth === 4) liftPlat.position.x = 15.4 + Math.sin(t * 18) * 0.12; // rattling!
        if (t > (teeth === 8 ? 5.2 : teeth === 4 ? 2.2 : 4.5)) {
          done = true;
          if (teeth === 8) {
            PIP.audio.play('chime');
            liftPlat.position.set(15.4, startY, -2.2);
            resolve(true);
          } else {
            PIP.audio.play(teeth === 4 ? 'wobble' : 'creak');
            liftPlat.position.set(15.4, startY, -2.2);
            PIP.save.recordAttempt('doubles', false, 0);
            PIP.ui.say('Nutkin', '🐿️', [
              teeth === 4 ?
                'WHOA! The little gear has 4 teeth — half of 8 — so it spins TWICE as fast. My whiskers!' :
                'Sooo sloooow… 16 teeth is DOUBLE 8, so it turns at half speed. I’d be here till winter.',
              'Let’s test another idea. Which gear matches the drive gear’s 8 teeth?'
            ]).then(function () { resolve(false); });
          }
        }
      });
    });
  }

  // after fixing: the lift gently carries Pip up to the treehouse
  function makeLiftRideable() {
    var t = 0;
    world.tick(function (dt) {
      t += dt;
      var y = liftBase + 0.15 + (Math.sin(t * 0.45) * 0.5 + 0.5) * 7.6;
      liftPlat.position.y = y;
      liftWalk.topY = y + 0.13;
      var ps = PIP.player.state;
      // carry Pip with the platform when standing on it
      if (ps.grounded && ps.pos.x > 14.4 && ps.pos.x < 16.4 && ps.pos.z > -3.2 && ps.pos.z < -1.2 &&
        Math.abs(ps.pos.y - liftWalk.topY) < 0.6) {
        ps.pos.y = liftWalk.topY;
      }
    });
    // treehouse porch: a real floor to hop onto from the lift
    var porch = A.mesh(A.GEO.box, A.mat(0xc98d5a));
    porch.scale.set(3, 0.25, 2.8);
    porch.position.set(18.1, terrainFn(18, -6) + 8.22, -6);
    world.group.add(porch);
    world.platform(16.6, 19.6, -7.4, -4.6, terrainFn(18, -6) + 8.35, { noWall: true });
  }
  if (liftDone) {
    chosenGear = A.makeGear(0.8, 8, 0xd8a869);
    chosenTeeth = 8;
    chosenGear.position.copy(gearSlotPos);
    world.add(chosenGear, gearSlotPos.x, gearSlotPos.y, gearSlotPos.z);
    makeLiftRideable();
  }
  world.seed('lift1', 18, -6, 9.6); // on the treehouse porch — ride the lift!

  /* =====================================================================
     MISSION 2 — balance the acorn gates
     ===================================================================== */
  var balanceDone = PIP.save.mission('grove.balance') === 'done';
  var lvlB = PIP.save.levelFor('equality');
  // left pan: acorns + pods (pods count as one each!) ; right pan: acorns + mystery bag
  var LEFT_A = lvlB === 0 ? 4 : lvlB === 2 ? 6 : 5;
  var LEFT_P = lvlB === 0 ? 1 : lvlB === 2 ? 3 : 2;
  var RIGHT_A = lvlB === 0 ? 3 : 4;
  var ANSWER = (LEFT_A + LEFT_P) - RIGHT_A;

  var scaleG = new THREE.Group();
  var post = A.mesh(A.GEO.cyl, A.mat(0x8a6142), 0, 1.5, 0); post.scale.set(0.16, 3, 0.16);
  var beam = new THREE.Group();
  var beamBar = A.mesh(A.GEO.box, A.mat(0xa97b4b), 0, 0, 0); beamBar.scale.set(6.4, 0.18, 0.3);
  beam.add(beamBar);
  beam.position.y = 3;
  var pans = [];
  [-1, 1].forEach(function (side) {
    var panG = new THREE.Group();
    var pan = A.mesh(A.GEO.cyl, A.mat(0xd8a869), 0, 0, 0); pan.scale.set(1.1, 0.12, 1.1);
    var string = A.mesh(A.GEO.cyl, A.mat(0x6b5137), 0, 0.6, 0); string.scale.set(0.03, 1.2, 0.03);
    panG.add(pan, string);
    panG.position.set(side * 3, -1.2, 0);
    beam.add(panG);
    pans.push(panG);
  });
  scaleG.add(post, beam);
  var scalePos = { x: -2, z: 20 };
  world.addAt(scaleG, scalePos.x, scalePos.z);
  world.block(scalePos.x, scalePos.z, 1.2);

  // items on the pans
  function fillPan(panG, acorns, pods, bagged) {
    // clear old items
    for (var i = panG.children.length - 1; i >= 0; i--)
      if (panG.children[i].userData.isItem) panG.remove(panG.children[i]);
    var n = 0;
    function put(m) {
      m.userData.isItem = true;
      m.position.set((n % 4) * 0.4 - 0.6, 0.1, Math.floor(n / 4) * 0.4 - 0.2);
      panG.add(m); n++;
    }
    for (var a = 0; a < acorns; a++) put(A.makeAcorn());
    for (var p = 0; p < pods; p++) put(A.makePod());
    if (bagged != null) {
      var bag = A.mesh(A.GEO.sphere, A.mat(0xc9a6ff), 0, 0.3, 0);
      bag.scale.set(0.34, 0.4, 0.34);
      bag.userData.isItem = true;
      bag.position.set(0.7, 0.28, 0.3);
      panG.add(bag);
      var q = A.textSprite(bagged === 0 ? '?' : String(bagged), { px: 70, scale: 0.5, color: '#fff' });
      q.userData.isItem = true;
      q.position.set(0.7, 0.85, 0.3);
      panG.add(q);
    }
  }
  var bagCount = balanceDone ? ANSWER : 0;
  fillPan(pans[0], LEFT_A, LEFT_P);
  fillPan(pans[1], RIGHT_A, 0, bagCount);

  var tilt = 0;
  world.tick(function (dt) {
    var leftW = LEFT_A + LEFT_P, rightW = RIGHT_A + bagCount;
    var target = U.clamp((rightW - leftW) * 0.09, -0.32, 0.32);
    tilt = U.lerp(tilt, target, Math.min(1, dt * 3));
    beam.rotation.z = tilt;
    pans.forEach(function (p) { p.rotation.z = -beam.rotation.z; });
  });

  // acorn pile beside the scale
  var pile = new THREE.Group();
  for (var pa = 0; pa < 6; pa++) {
    var ac = A.makeAcorn();
    ac.position.set(Math.cos(pa * 2.4) * 0.5, 0, Math.sin(pa * 2.4) * 0.5);
    pile.add(ac);
  }
  world.addAt(pile, 1.5, 22);
  var balanceActive = false;

  world.addAt(A.makeSign('The Acorn Balance'), -5.5, 18);
  var gateWall = A.mesh(A.GEO.box, A.mat(0x6b5137));
  gateWall.scale.set(5, 3.4, 0.5);
  world.add(gateWall, -2, terrainFn(-2, 24) + 1.7, 24);
  var gatePlatform = world.platform(-4.5, 0.5, 23.6, 24.4, terrainFn(-2, 24) + 3.4);
  if (balanceDone) { gateWall.visible = false; gatePlatform.disabled = true; }

  world.interact({
    x: scalePos.x, z: scalePos.z, radius: 3.0, prompt: 'Look at the balance', icon: '⚖️',
    enabled: function () { return !balanceDone && !balanceActive; },
    onInteract: function () {
      balanceActive = true;
      PIP.ui.say('Professor Pebble', '🪨', [
        'Ah, the acorn gate! It only opens when both sides weigh the same.',
        'Left pan: ' + LEFT_A + ' acorns and ' + LEFT_P + ' seed pods. Pods weigh the same as acorns.',
        'Right pan: ' + RIGHT_A + ' acorns and one mystery bag.',
        'Both sides need the same amount. That is what the equals sign is promising.',
        'Pop acorns into the mystery bag from the pile until the beam is level!'
      ]).then(function () {
        PIP.challenge.begin({
          id: 'grove.balance', concept: 'equality',
          goal: 'Make both sides of the balance equal. Fill the mystery bag!',
          hints: [
            'Count the left side out loud: ' + LEFT_A + ' acorns and ' + LEFT_P + ' pods altogether.',
            'The left side has ' + (LEFT_A + LEFT_P) + '. The right side has ' + RIGHT_A + ' so far. Watch the beam as you add each acorn!',
            'Count on from ' + RIGHT_A + ' up to ' + (LEFT_A + LEFT_P) + ' — that is how many the bag needs.'
          ]
        });
      });
    }
  });
  world.interact({
    x: 1.5, z: 22, radius: 2.0, prompt: 'Put an acorn in the bag', icon: '🌰',
    enabled: function () { return balanceActive && !balanceDone; },
    onInteract: function () {
      bagCount++;
      fillPan(pans[1], RIGHT_A, 0, bagCount);
      PIP.audio.play('count', bagCount);
      PIP.narrate.callout(U.numWord(bagCount) + ' in the bag!');
      checkBalance();
    }
  });
  world.interact({
    x: scalePos.x - 1, z: scalePos.z + 2, radius: 2.0, prompt: 'Take an acorn out', icon: '↩️',
    enabled: function () { return balanceActive && !balanceDone && bagCount > 0; },
    onInteract: function () {
      bagCount--;
      fillPan(pans[1], RIGHT_A, 0, bagCount);
      PIP.audio.play('pop');
      checkBalance();
    }
  });
  function checkBalance() {
    if (bagCount === ANSWER) {
      balanceDone = true;
      PIP.save.setMission('grove.balance', 'done');
      PIP.save.recordAttempt('missing', true, 0);
      PIP.audio.play('success');
      setTimeout(function () {
        gateWall.visible = false;
        gatePlatform.disabled = true;
        PIP.audio.play('unlock');
      }, 1200);
      world.seed('bal1', -2, 26, 0.7);
      world.seed('bal2', -4, 27, 0.7);
      PIP.challenge.complete({
        title: 'Balanced! The gate swings open!',
        maths: LEFT_A + ' + ' + LEFT_P + ' = ' + RIGHT_A + ' + ' + ANSWER,
        text: 'Both sides make ' + (LEFT_A + LEFT_P) + '. The mystery bag was hiding ' + ANSWER + ' acorns — and the equals sign kept its promise.',
        speak: LEFT_A + ' plus ' + LEFT_P + ' equals ' + RIGHT_A + ' plus ' + ANSWER + '. Both sides the same. Balanced!'
      }).then(function () {
        world.clearBeacon();
        PIP.ui.say('Nutkin', '🐿️', ['Beautifully balanced! Now — my cousin Cog needs a delivery cart built. Head over to the cart track!'])
          .then(function () { checkGroveCore(); pointGrove(); });
      });
    } else if (bagCount > ANSWER) {
      PIP.narrate.say('Ooh — now the bag side is heavier. That side went down! Take one out.');
      PIP.save.recordAttempt('equality', false, 0);
    } else if (bagCount === ANSWER - 1) {
      PIP.narrate.say('So close! The left side is still a tiny bit heavier.');
    }
  }

  /* =====================================================================
     MISSION 3 — Woodland delivery cart (missing number, stability, wheels)
     ===================================================================== */
  var cartDone = PIP.save.mission('grove.cart') === 'done';
  var CART_X0 = 9, CART_X1 = 19, CART_Z = 15;
  var trackY = terrainFn(CART_X0, CART_Z);
  // a plank track for the cart to roll along
  var track = A.mesh(A.GEO.box, A.mat(0xb98a55)); track.scale.set(12, 0.3, 2.2);
  track.position.set((CART_X0 + CART_X1) / 2, trackY + 0.1, CART_Z);
  world.group.add(track);
  world.platform(CART_X0 - 1, CART_X1 + 1, CART_Z - 1.1, CART_Z + 1.1, trackY + 0.25, { noWall: true });

  function wheelMesh() { var w = A.mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.2, 14), A.mat(0x4b4b4b), 0, 0, 0); w.rotation.x = Math.PI / 2; return w; }
  function cartBody(wide) {
    var g = new THREE.Group();
    var hw = wide ? 1.0 : 0.5;
    var body = A.mesh(A.GEO.box, A.mat(0xd8a869), 0, 0.45, 0); body.scale.set(1.6, 0.5, hw * 2);
    g.add(body);
    // three parcels on top
    for (var i = 0; i < 3; i++) { var p = A.mesh(A.GEO.box, A.mat(0x8a6142), -0.4 + i * 0.4, 0.85, 0); p.scale.set(0.3, 0.3, 0.3); g.add(p); }
    [[-0.6, -1], [0.6, -1], [-0.6, 1], [0.6, 1]].forEach(function (c) {
      var w = wheelMesh(); w.position.set(c[0], 0.15, c[1] * (hw + 0.06)); g.add(w);
    });
    g.userData.wide = wide;
    return g;
  }
  function buildStaticCart() { var c = cartBody(true); c.position.set(CART_X1 - 1, trackY + 0.35, CART_Z); world.group.add(c); }
  if (cartDone) buildStaticCart();

  var cog = A.makeSquirrelish();
  world.addAt(cog, CART_X0 - 1, CART_Z - 2.5);
  world.block(CART_X0 - 1, CART_Z - 2.5, 0.7);
  world.addAt(A.makeSign('Delivery Cart'), CART_X0 - 1, CART_Z + 2.5);
  var cartActive = false;
  world.interact({
    x: CART_X0 - 1, z: CART_Z - 2.5, radius: 2.6, prompt: 'Talk to Cog', icon: '🐿️',
    enabled: function () { return !cartDone; },
    onInteract: function () {
      if (cartActive) return;
      cartActive = true;
      PIP.ui.say('Cog', '🐿️', [
        'My delivery cart needs building! Every cart needs 4 wheels.',
        'This one has 2 wheels on the front. How many more wheels to make 4?'
      ]).then(function () {
        PIP.challenge.begin({
          id: 'grove.cart', concept: 'missing',
          goal: 'Build a cart that rolls without tipping — then test it!',
          hints: ['Two wheels on the front, and it needs four in all.', 'Count on from two: three, four. That is two more.',
            'A narrow cart tips on the bumps. A WIDE base is much steadier — try the wide body!']
        });
        PIP.challenge.numberPick({
          question: 'The cart has 2 wheels. It needs 4. How many more?  2 + □ = 4',
          answer: 2, options: [1, 2, 3],
          visual: { total: 4, filled: 2 },
          nudge: 'Count on from two up to four.',
          concept: 'missing'
        }).then(startCartBuild);
      });
    }
  });

  function startCartBuild() {
    PIP.player.state.frozen = true;
    world.clearBeacon();
    PIP.game.tweenCamera(new THREE.Vector3(CART_X1 - 1, trackY + 4, CART_Z + 7), new THREE.Vector3((CART_X0 + CART_X1) / 2, trackY + 0.6, CART_Z));
    var parts = [
      { id: 'narrow', name: 'Narrow body', icon: '▭', count: 1, make: function () { return cartBody(false); }, tip: 'A narrow cart… will it wobble?' },
      { id: 'wide', name: 'Wide body', icon: '▬', count: 1, make: function () { return cartBody(true); }, tip: 'A wide base is nice and steady!' }
    ];
    var slots = [{
      id: 'body', accepts: ['narrow', 'wide'],
      pos: new THREE.Vector3(CART_X0 + 1, trackY + 0.35, CART_Z),
      ghost: function () { return new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.8, 2.4), new THREE.MeshBasicMaterial({ color: 0xffe27a, transparent: true, opacity: 0.35, depthWrite: false })); }
    }];
    PIP.builder.start({
      scene: world.group, parts: parts, slots: slots,
      tip: 'Pick a cart body, tap the glowing spot, then press Test it!',
      allowBack: true,
      canTest: function () { return slots[0].placed ? null : 'Choose a cart body first.'; },
      onTest: function (api) {
        var wide = api.slots[0].placed.mesh.userData.wide;
        var mesh = api.slots[0].placed.mesh;
        PIP.builder.setTesting(true);
        rollCart(mesh, wide, function (ok) {
          PIP.builder.setTesting(false);
          if (ok) {
            PIP.builder.finish();
            PIP.player.state.frozen = false;
            cartDone = true;
            PIP.save.setMission('grove.cart', 'done');
            PIP.save.recordAttempt('missing', true, 0);
            PIP.save.recordAttempt('dtStructure', true, 0);
            PIP.save.addDesign({ name: 'Delivery Cart', icon: '🛒', note: '4 wheels, wide steady base — rolls straight.' });
            if (PIP.save.grantBadge('improver')) PIP.ui.toast('🔧', 'Inventor Badge: Clever Improver!');
            PIP.challenge.complete({
              title: 'The cart rolls true!',
              maths: '2 + 2 = 4 wheels',
              text: 'Two wheels and two more make four. A wide base kept it steady over the bumps — no tipping!',
              speak: 'Two wheels plus two more makes four. And a wide base rolls without tipping!'
            }).then(function () { checkGroveCore(); pointGrove(); });
          } else {
            PIP.save.recordAttempt('dtStructure', true, 0);
            PIP.ui.say('Cog', '🐿️', ['Wheee— WHOA! The narrow cart tipped on the bumps!', 'Tap it to take it back and try the WIDE body. A wider base is steadier.']);
          }
        });
      },
      onExit: function () { PIP.player.state.frozen = false; }
    });
  }
  function rollCart(mesh, wide, done) {
    var t = 0, x0 = CART_X0 + 1, homeZ = CART_Z;
    PIP.audio.play('gear');
    var ticker = function (dt) {
      t += dt;
      var prog = Math.min(1, t / 2.2);
      mesh.position.x = U.lerp(x0, CART_X1 - 1, prog);
      mesh.position.y = trackY + 0.35 + Math.sin(t * 12) * (wide ? 0.03 : 0.10);
      mesh.children.forEach(function (c) { if (c.rotation) c.rotation.z -= dt * 6; });
      if (!wide) mesh.rotation.z = Math.min(1.2, t * 0.9);   // narrow cart tips over
      if (wide) mesh.rotation.z = Math.sin(t * 8) * 0.04;
      if (!wide && t > 1.1) { world.updaters.splice(world.updaters.indexOf(ticker), 1); PIP.audio.play('wobble'); mesh.rotation.z = 0; mesh.position.set(x0, trackY + 0.35, homeZ); done(false); }
      else if (wide && prog >= 1) { world.updaters.splice(world.updaters.indexOf(ticker), 1); mesh.rotation.z = 0; PIP.audio.play('chime'); done(true); }
    };
    world.tick(ticker);
  }

  /* =====================================================================
     HIDDEN — the function-machine hollow tree (find the rule)
     ===================================================================== */
  var funcDone = PIP.save.mission('grove.func') === 'done';
  var hollow = A.makeTree('autumn'); hollow.scale.setScalar(1.8);
  world.addAt(hollow, -18, -17);
  world.block(-18, -17, 1.2);
  // a mouth-hole + in/out chutes
  var mouth = A.mesh(A.GEO.sphere, A.mat(0x2b2b2b), -18, terrainFn(-18, -17) + 2.2, -15.4); mouth.scale.set(0.5, 0.6, 0.4);
  world.group.add(mouth);
  world.addAt(A.makeSign('The Rule Tree'), -15, -14.5);
  world.interact({
    x: -18, z: -15.6, radius: 2.6, prompt: 'The hollow tree', icon: '🌳',
    onInteract: function () {
      if (funcDone) { PIP.ui.say('Rule Tree', '🌳', ['Numbers in, doubled numbers out! The rule never changes — that is what makes it a rule.']); return; }
      PIP.ui.say('Rule Tree', '🌳', [
        'I am the Rule Tree! Drop a number in my hole and a NEW number pops out.',
        'I always follow the same secret rule. Can you find it?'
      ]).then(function () {
        PIP.challenge.begin({
          id: 'grove.func', concept: 'patterns',
          goal: 'Find the tree’s secret rule!',
          hints: ['Watch what happens: what comes out compared to what went in?', 'In 2, out 4. In 3, out 6. The out number is bigger…', 'The rule is DOUBLE! Out is two lots of in.']
        });
        // demonstrate, then ask
        PIP.narrate.say('In goes 2… out comes 4! In goes 3… out comes 6!');
        setTimeout(function () {
          PIP.challenge.numberPick({
            question: 'The tree doubles! If 4 goes in, what comes out?',
            answer: 8, options: [6, 7, 8],
            visual: { emoji: '🌰', count: 4 },
            nudge: 'Double 4 is 4 and 4 more.',
            concept: 'doubles'
          }).then(function () {
            PIP.challenge.numberPick({
              question: 'Rule = double. If 5 goes in, what comes out?',
              answer: 10, options: [10, 9, 7],
              visual: { emoji: '🌰', count: 5 },
              nudge: 'Double 5 is 5 and 5 more — count in twos!',
              concept: 'doubles'
            }).then(function () {
              funcDone = true;
              PIP.save.setMission('grove.func', 'done');
              PIP.save.recordAttempt('patterns', true, 0);
              if (PIP.save.grantBadge('pattern')) PIP.ui.toast('🌸', 'Inventor Badge: Pattern Finder!');
              world.seed('gfunc1', -20, -19, 0.8);
              world.seed('gfunc2', -16, -19, 0.8);
              PIP.challenge.complete({
                title: 'You found the rule!',
                maths: 'in → double → out',
                text: 'The secret rule was DOUBLE. Whatever goes in, twice as much comes out — every single time!',
                speak: 'The rule was double! In two, out four. In five, out ten. A rule always stays the same.'
              });
            });
          });
        }, 1600);
      });
    }
  });

  /* =====================================================================
     THE GROVE IDEA CORE
     ===================================================================== */
  var coreTaken = PIP.save.hasCore('grove');
  var pedestal = A.mesh(A.GEO.cyl, A.mat(0xd7b356));
  pedestal.scale.set(0.9, 1.2, 0.9);
  world.addAt(pedestal, 0, -20, 0.6);
  world.block(0, -20, 1.1);
  world.addAt(A.makeSign('Idea Core'), 2.6, -19);
  var groveCore = A.makeCore(0x8fa3ff);
  world.add(groveCore, 0, terrainFn(0, -20) + 1.5, -20);
  groveCore.visible = false;
  var gcoreT = 0;
  world.tick(function (dt) {
    if (!groveCore.visible) return;
    gcoreT += dt;
    groveCore.position.y = terrainFn(0, -20) + 1.5 + Math.sin(gcoreT * 2) * 0.15;
    groveCore.rotation.y += dt; groveCore.userData.ring.rotation.z += dt * 2;
  });
  function checkGroveCore() {
    if (liftDone && balanceDone && cartDone && !coreTaken && !groveCore.visible) {
      groveCore.visible = true;
      PIP.audio.play('unlock');
      PIP.ui.say('Professor Pebble', '🪨', [
        'The Grove hums with life again — the lift rides, the gate balances, the cart rolls!',
        'The Grove Idea Core has returned to its pedestal. Go and collect it, Pip!'
      ]).then(function () { PIP.ui.setGoal('Collect the Grove Idea Core! 💡', false); world.setBeacon(0, -20); });
    }
  }
  world.interact({
    x: 0, z: -20, radius: 2.4, prompt: 'Take the Idea Core', icon: '💡',
    enabled: function () { return groveCore.visible && !coreTaken; },
    onInteract: function () {
      coreTaken = true; groveCore.visible = false;
      PIP.save.grantCore('grove'); PIP.ui.updateHUD(); world.clearBeacon();
      PIP.audio.play('fanfare');
      PIP.ui.summary({
        title: 'IDEA CORE FOUND! 💡',
        text: 'The Gearleaf Grove Idea Core is safe! Take it home to Inventor Village.',
        speak: 'You found the Grove Idea Core! Take it back to Inventor Village.',
        stars: '💡⭐💡'
      }).then(function () { PIP.ui.setGoal('Return to Inventor Village through the green gate. 🏡', false); world.setBeacon(-26.5, 0); });
    }
  });

  /* ---------- scenery & seeds ---------- */
  [[-14, 8], [-10, -8], [6, 10], [8, -12], [22, 8], [-20, 14], [24, -16], [-6, -22], [14, 22]].forEach(function (t, i) {
    var tree = A.makeTree(i % 3 === 1 ? 'pine' : 'round');
    world.addAt(tree, t[0], t[1]);
    world.block(t[0], t[1], 0.8);
  });
  K.scatter(world, 10, function () { return A.makeBush(0x3f8a3f); }, 0, 0, 24);
  K.scatter(world, 8, function () { return A.makeFlower(U.pick([0xffd257, 0xc9a6ff]), U.rand(0.6, 1)); }, 0, 8, 20);
  world.butterflies(5, 0, 0, 20);
  world.seed('g1', -12, 22, 0.6);
  world.seed('g2', 22, 16, 0.6);
  world.seed('g3', -22, -8, 0.6);
  world.seed('g4', 8, -24, 0.6);
  world.seed('g5', -2, 26, 0.7);

  /* ---------- arrival ---------- */
  world.postEnter = function () {
    if (!PIP.save.mission('grove.intro')) {
      PIP.save.setMission('grove.intro', 'done');
      return PIP.ui.say('Nutkin', '🐿️', [
        'A visitor! Welcome to Gearleaf Grove, where everything spins, lifts and clanks.',
        'Or it DID, until the Mix-Up Machine jumbled our gears.',
        'I am Nutkin the Tinkerer — come to the big tree and see my poor stuck lift!'
      ]).then(function () {
        PIP.ui.setGoal('Find Nutkin by the great gear-tree. ⚙️', false);
        world.setBeacon(13.5, -0.5);
      });
    }
    pointGrove();
    checkGroveCore();
    return Promise.resolve();
  };

  function pointGrove() {
    if (!liftDone) { PIP.ui.setGoal('Talk to Nutkin about the stuck tree lift. ⚙️', false); world.setBeacon(13.5, -0.5); }
    else if (!balanceDone) { PIP.ui.setGoal('Find the acorn balance gate to the north. ⚖️', false); world.setBeacon(scalePos.x, scalePos.z); }
    else if (!cartDone) { PIP.ui.setGoal('Help Cog build a delivery cart. 🛒', false); world.setBeacon(CART_X0 - 1, CART_Z - 2.5); }
    else if (!PIP.save.hasCore('grove')) { PIP.ui.setGoal('Collect the Grove Idea Core! 💡', false); world.setBeacon(0, -20); }
    else PIP.ui.clearGoal();
  }

  return world;
};
