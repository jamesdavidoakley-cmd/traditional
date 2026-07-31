/* Inventor Village — the central hub island.
   Contains Pip's workshop, the five travel gates, a movement practice area,
   Professor Pebble, the progress map, display pedestals and a bonds
   challenge door. The village visibly repairs itself as Idea Cores return. */
PIP.worlds = PIP.worlds || {};

PIP.worlds.hub = function () {
  var U = PIP.util, A = PIP.assets, K = PIP.worldkit;

  function terrainFn(x, z) {
    var y = U.hill(x, z, 0, 0, 44, 1.4);
    y -= U.hill(x, z, -17, 3, 7.5, 2.6);           // pond dip (west)
    y += U.hill(x, z, 24, -18, 10, 1.2);           // practice knoll
    var d = Math.sqrt(x * x + z * z);
    if (d > 29) y -= (d - 29) * 1.6;               // island edge falls away
    return y;
  }
  function colorFn(x, z, y) {
    if (y < -0.7) return '#c9b98a';                // sandy pond bed
    var n = Math.sin(x * 0.35) * Math.cos(z * 0.3);
    return n > 0.3 ? '#8fd483' : n < -0.4 ? '#6dbb62' : '#7cc96f';
  }

  var world = K.createWorld({
    id: 'hub', music: 'hub', sky: 0x9adcff,
    groundFn: terrainFn, colorFn: colorFn, size: 76, segs: 96,
    bounds: { minX: -30, maxX: 30, minZ: -30, maxZ: 30 },
    spawn: { x: 0, z: -7, angle: 0 },
    killY: -14
  });
  var hasCore1 = PIP.save.hasCore('meadow');

  /* ---------- pond + bridge (west) ---------- */
  world.water.push({ minX: -24, maxX: -10, minZ: -4, maxZ: 10, y: -0.55 });
  var bridge = new THREE.Group();
  for (var i = 0; i < 5; i++) {
    var pl = A.makePlank();
    pl.scale.set(1.7, 0.14, 0.8);
    pl.position.set(-13.2 - i * 1.75, 0.15, 3);
    if (!hasCore1) { // broken: middle planks fallen and tilted
      if (i === 2) { pl.position.y = -0.45; pl.rotation.z = 0.7; }
      if (i === 3) { pl.position.y = -0.5; pl.rotation.x = 0.6; }
    }
    bridge.add(pl);
  }
  world.add(bridge, 0, 0, 0);
  var bridgePlat = world.platform(-21.9, -12.3, 2.6, 3.4, 0.22, { noWall: true });
  bridgePlat.disabled = !hasCore1;
  world.seed('pond1', -22.5, 3, 0.8);
  world.seed('pond2', -17, 7.5, 0.5);

  /* ---------- plaza: fountain & lamps ---------- */
  var fountain = A.makeFountain();
  world.addAt(fountain, 3, 4);
  world.block(3, 4, 1.9);
  fountain.userData.water.visible = hasCore1;
  fountain.userData.top.visible = hasCore1;
  var fountT = 0;
  world.tick(function (dt) {
    if (!fountain.userData.top.visible) return;
    fountT += dt;
    fountain.userData.top.position.y = 1.6 + Math.abs(Math.sin(fountT * 2.4)) * 0.35;
  });

  var lamps = [];
  [[-4, 0], [9, 2], [-2, 10], [7, 10]].forEach(function (p) {
    var l = A.makeLamp();
    world.addAt(l, p[0], p[1]);
    world.block(p[0], p[1], 0.4);
    lamps.push(l);
  });
  function lightLamps(on) {
    lamps.forEach(function (l) {
      l.userData.bulb.material = A.mat(on ? 0xffe27a : 0x777777, on ? { emissive: 0xffc94d, emissiveIntensity: 0.9 } : {});
    });
  }
  lightLamps(hasCore1);

  /* ---------- workshop & display pedestals ---------- */
  var workshop = A.makeHouse(0xf2e0bd, 0x6fae62);
  workshop.scale.setScalar(1.35);
  world.addAt(workshop, 0, -18);
  workshop.rotation.y = 0;
  world.block(0, -18, 3.4);
  world.addAt(A.makeSign('Pip’s Workshop'), 3.6, -14.5);
  var tools = A.makeGear(0.5, 8, 0xd8a869);
  world.addAt(tools, -2.6, -15.2, 2.8);
  world.tick(function (dt) { tools.rotation.z += dt * 0.5; });

  // display pedestals show finished inventions
  var pedX = 7;
  (PIP.save.data.designs || []).forEach(function (des, i) {
    var ped = A.mesh(A.GEO.cyl, A.mat(0xb9c3cc));
    ped.scale.set(0.7, 1, 0.7);
    world.addAt(ped, pedX + i * 2.4, -16, 0.5);
    world.block(pedX + i * 2.4, -16, 0.9);
    var label = A.textSprite(des.icon, { px: 80, scale: 1.1 });
    label.position.set(pedX + i * 2.4, world.terrain(pedX + i * 2.4, -16) + 2.1, -16);
    world.add(label);
  });
  world.interact({
    x: -1.5, z: -14.2, radius: 2.4, prompt: 'Build table', icon: '🛠️',
    onInteract: function () {
      var d = PIP.save.data.designs;
      if (!d.length) {
        PIP.ui.say('Pip', '🍃', ['My build table! When I finish an invention, it will be remembered here.']);
      } else {
        PIP.ui.say('Pip', '🍃', d.map(function (x) { return x.icon + ' ' + x.name + ' — ' + x.note; }));
      }
    }
  });

  /* ---------- Professor Pebble ---------- */
  var pebble = A.makePebble();
  world.addAt(pebble, 0, 1);
  world.block(0, 1, 0.9);
  var pebT = 0;
  world.tick(function (dt) {
    pebT += dt;
    pebble.position.y = world.terrain(0, 1) + Math.sin(pebT * 1.8) * 0.04;
    // Pebble politely faces Pip
    var pp = PIP.player.state.pos;
    if (U.dist2(pp.x, pp.z, 0, 1) < 60)
      pebble.rotation.y = U.angleLerp(pebble.rotation.y, Math.atan2(pp.x - 0, pp.z - 1), Math.min(1, dt * 3));
  });
  world.interact({
    x: 0, z: 1, radius: 2.6, prompt: 'Talk to Professor Pebble', icon: '🪨',
    onInteract: function () { pebbleTalk(); }
  });
  function pebbleTalk() {
    var cores = PIP.save.coreCount();
    if (cores === 0 && !PIP.save.mission('meadow.stones')) {
      PIP.ui.say('Professor Pebble', '🪨', [
        'The Mix-Up Machine has scattered the five Idea Cores, and half the islands have stopped working!',
        'A first design is an idea. A tested design is information. We shall need plenty of both.',
        'Start in Numberberry Meadow — through the strawberry gate. The stepping stones there have gone missing!'
      ]).then(function () { world.setBeacon(gatePos[0][0], gatePos[0][1]); });
    } else if (cores === 0) {
      PIP.ui.say('Professor Pebble', '🪨', [
        'The Berrybacks in Numberberry Meadow still need you, Pip.',
        'Finish helping them and the meadow’s Idea Core will glow again.'
      ]);
    } else if (cores === 1) {
      PIP.ui.say('Professor Pebble', '🪨', [
        'One Idea Core home — look how the village fountain dances again!',
        'Gearleaf Grove is open now. The tree lift is stuck, and machines do love a good tester.',
        'The machine always follows its rule, even when the rule is rather silly.'
      ]);
    } else {
      PIP.ui.say('Professor Pebble', '🪨', [
        'Two cores! You did not fix them by knowing every answer, Pip.',
        'You fixed them by looking carefully, trying ideas, and improving them.',
        'The other three islands are still being invented. Rest, explore, or beat your old challenges!'
      ]);
    }
  }

  /* ---------- five travel gates (southern arc) ---------- */
  var gatePos = [[-16, 19], [-8, 23.5], [0, 25.5], [8, 23.5], [16, 19]];
  var gateInfo = [
    { id: 'meadow', color: 0xff6f9c, name: 'Numberberry Meadow', icon: '🍓', open: function () { return true; } },
    { id: 'grove', color: 0x8fa3ff, name: 'Gearleaf Grove', icon: '⚙️', open: function () { return true; } },
    { id: 'harbour', color: 0x62c4e8, name: 'Shape Sail Harbour', icon: '⛵', open: function () { return true; } },
    { id: 'mountain', color: 0xd8e8f2, name: 'Measure Mountain', icon: '🏔️', open: function () { return true; } },
    { id: 'factory', color: 0xffb066, name: 'Patternworks Factory', icon: '🏭', open: function () { return true; } }
  ];
  var gates = [];
  gateInfo.forEach(function (gi, i) {
    var g = A.makeGate(gi.color);
    var x = gatePos[i][0], z = gatePos[i][1];
    world.addAt(g, x, z);
    g.rotation.y = Math.atan2(-x, -z) + Math.PI;
    world.block(x - 1.2, z, 0.5); world.block(x + 1.2, z, 0.5);
    var sign = A.makeSign(gi.name);
    world.addAt(sign, x + 2.4, z - 1.4);
    sign.rotation.y = Math.atan2(-x, -z) + Math.PI;
    gates.push(g);
    updateGateLook(g, gi);
    world.interact({
      x: x, z: z, radius: 2.2, prompt: gi.name, icon: gi.icon,
      onInteract: function () {
        if (gi.soon) {
          PIP.audio.play('notyet');
          PIP.ui.say('Professor Pebble', '🪨', [gi.name + ' is still being invented. Even islands need a plan, a build and a test!']);
        } else if (!gi.open()) {
          PIP.audio.play('notyet');
          PIP.ui.say('Professor Pebble', '🪨', ['That gate wakes up when the Numberberry Meadow Idea Core comes home.']);
        } else {
          world.clearBeacon();
          PIP.game.gotoWorld(gi.id);
        }
      }
    });
  });
  function updateGateLook(g, gi) {
    var openNow = !gi.soon && gi.open();
    g.userData.swirl.material.opacity = openNow ? 0.55 : 0.12;
  }
  var gateT = 0;
  world.tick(function (dt) {
    gateT += dt;
    gates.forEach(function (g, i) {
      var gi = gateInfo[i];
      if (!gi.soon && gi.open()) g.userData.swirl.rotation.z += dt * 0.8;
    });
  });

  /* ---------- practice area (east knoll) ---------- */
  world.addAt(A.makeSign('Practice Peaks!'), 18.5, -13);
  var steps = [[22, -14, 1.1], [24, -16, 2.0], [26, -18, 2.9]];
  steps.forEach(function (s, i) {
    var box = A.mesh(A.GEO.box, A.mat(i === 2 ? 0xffd257 : 0xd8a869));
    var baseY = world.terrain(s[0], s[1]);
    box.scale.set(2.2, 0.6, 2.2);
    box.position.set(s[0], baseY + s[2] - 0.3, s[1]);
    world.add(box);
    world.platform(s[0] - 1.1, s[0] + 1.1, s[1] - 1.1, s[1] + 1.1, baseY + s[2]);
  });
  world.seed('practice1', 26, -18, 3.6);
  world.seed('practice2', 22, -14, 1.8);
  world.addAt(A.makeSign('Jump — then jump again!'), 20, -10.5);
  world.addAt(A.makeSign('Hold JUMP to flutter'), 24.5, -20.5);
  world.addAt(A.makeSign('Q = leaf-vine grab!'), 15, -6);
  world.addAt(A.makeSign('F = 🍃 spin!  G = ✨ sparkle!'), 19, -16.5);

  /* ---------- bonds challenge door ---------- */
  var doorGroup = new THREE.Group();
  var doorFrame = A.mesh(A.GEO.box, A.mat(0x8a6142), 0, 1.4, 0); doorFrame.scale.set(2.2, 2.8, 0.5);
  var doorTen = A.textSprite('10', { px: 90, scale: 1.1, color: '#ffe27a' });
  doorTen.position.set(0, 3.2, 0);
  doorGroup.add(doorFrame, doorTen);
  world.addAt(doorGroup, 24, 8);
  doorGroup.rotation.y = -0.9;
  world.block(24, 8, 1.4);
  world.addAt(A.makeSign('Challenge Door'), 21.5, 9.5);
  world.interact({
    x: 24, z: 8, radius: 2.6, prompt: 'Challenge Door', icon: '🔟',
    onInteract: function () {
      if (!PIP.save.hasCore('meadow')) {
        PIP.ui.say('Professor Pebble', '🪨', ['The Challenge Door hums quietly. It will wake when the first Idea Core returns.']);
        return;
      }
      bondsDoor();
    }
  });
  function bondsDoor() {
    PIP.ui.say('Professor Pebble', '🪨', [
      'This door adores the number ten. Feed it pairs that make ten and it will shower you with Spark Seeds!'
    ]).then(function () {
      var qs = U.shuffle([3, 6, 8, 2, 5, 7, 4]).slice(0, 3);
      var chain = Promise.resolve();
      qs.forEach(function (a) {
        chain = chain.then(function () {
          var ans = 10 - a;
          var others = [ans + 1, Math.max(0, ans - 2), ans + 2].filter(function (v, i, arr) {
            return v !== ans && arr.indexOf(v) === i;
          }).slice(0, 2);
          return PIP.challenge.numberPick({
            question: 'The door shows ' + a + '. How many more make 10?',
            answer: ans,
            options: U.shuffle([ans].concat(others)),
            visual: { total: 10, filled: a },
            nudge: 'Count the dashed circles — they are the missing part of ten.',
            concept: 'bonds10'
          }).then(function () { PIP.save.recordAttempt('bonds10', true, 0); });
        });
      });
      chain.then(function () {
        PIP.audio.play('unlock');
        var found = 0;
        ['door1', 'door2', 'door3'].forEach(function (id, i) {
          if (!PIP.save.hasSeed('hub', id)) { world.seed(id, 24 + U.rand(-2, 2), 11 + i, 0.8); found++; }
        });
        PIP.ui.summary({
          title: 'The door is delighted!',
          maths: qs.map(function (a) { return a + ' + ' + (10 - a) + ' = 10'; }).join('   '),
          text: found ? 'Spark Seeds spilled out behind the door!' : 'The door plays a little tune for you. Lovely bonds!',
          speak: 'Pairs that make ten are called number bonds. You found three of them!'
        });
      });
    });
  }

  /* ---------- map board ---------- */
  var board = A.makeSign('Progress Map');
  board.scale.setScalar(1.3);
  world.addAt(board, -6, 6);
  world.block(-6, 6, 0.7);
  world.interact({
    x: -6, z: 6, radius: 2.4, prompt: 'Progress Map', icon: '🗺️',
    onInteract: function () { PIP.ui.renderMap(); PIP.ui.pushModal(); U.show('map-panel'); }
  });

  /* ---------- villagers return as cores come home ---------- */
  if (hasCore1) {
    var villager = A.makeBerryback(0xffd257);
    world.addAt(villager, -9, -6);
    world.block(-9, -6, 0.8);
    var vt = 0;
    world.tick(function (dt) { vt += dt; villager.position.y = world.terrain(-9, -6) + Math.abs(Math.sin(vt * 3)) * 0.08; });
    world.interact({
      x: -9, z: -6, radius: 2.2, prompt: 'Sunny the Berryback', icon: '🐹',
      onInteract: function () {
        if (!PIP.save.settings.chatter) return;
        PIP.ui.say('Sunny', '🐹', [U.pick([
          'I moved to the village because your bridge made the meadow famous!',
          'Squeak! The fountain water is deliciously fizzy.',
          'I counted the lamps. One, two, three, four! All glowing!'
        ])]);
      }
    });
  }

  /* ---------- scenery ---------- */
  [[-24, -12], [-20, -20], [14, -22], [-26, 12], [26, 0], [-12, 16], [20, 14]].forEach(function (t, i) {
    var tree = A.makeTree(i % 3 === 0 ? 'pine' : 'round');
    world.addAt(tree, t[0], t[1]);
    world.block(t[0], t[1], 0.7);
  });
  K.scatter(world, 14, function () { return A.makeFlower(U.pick([0xff6f9c, 0xffd257, 0x9fd8ff, 0xc9a6ff]), U.rand(0.7, 1.2)); }, 0, 0, 26);
  K.scatter(world, 6, function () { return A.makeBush(0x4fae5e); }, 0, 12, 20);
  world.butterflies(5, 0, 0, 18);
  world.seed('hub1', 12, 18, 0.6);
  world.seed('hub2', -24, -16, 0.6);
  world.seed('hub3', 28, -8, 0.6);

  /* ---------- arrival logic ---------- */
  world.postEnter = function () {
    var d = PIP.save.data;
    if (!d.started) {
      d.started = true; PIP.save.persist();
      return PIP.ui.say('Professor Pebble', '🪨', [
        'Pip! There you are. I am Professor Pebble, and today has been… inventive.',
        'Our Mix-Up Machine went BOING and scattered the five Idea Cores across the islands.',
        'Bridges are broken, lifts are stuck, and the Berrybacks’ stepping stones have floated clean away!',
        'Practise your jumps on the Practice Peaks if you like — then hop through the strawberry gate!'
      ]).then(function () {
        PIP.ui.setGoal('Go through the strawberry gate to Numberberry Meadow. 🍓', false);
        world.setBeacon(gatePos[0][0], gatePos[0][1]);
      });
    }
    // ---- THE FINALE: all five Idea Cores recovered ----
    if (PIP.save.coreCount() === 5 && !PIP.save.mission('hub.finale')) {
      PIP.save.setMission('hub.finale', 'done');
      PIP.audio.play('fanfare');
      gates.forEach(function (g) { g.userData.swirl.material.opacity = 0.75; });
      ['fin1', 'fin2', 'fin3', 'fin4'].forEach(function (id) { if (!PIP.save.hasSeed('hub', id)) world.seed(id, U.rand(-7, 7), U.rand(2, 9), 0.9); });
      return PIP.ui.say('Professor Pebble', '🪨', [
        'Pip… look. All five Idea Cores, home at last.',
        'Watch — the islands are reconnecting! Bridges, lifts, water, cranes and machines, all working together again.',
        'You did not fix the islands by already knowing every answer.',
        'You fixed them by looking carefully, trying ideas, and improving them.',
        'That is what an inventor does. Thank you, Pip — the Inventor Islands are whole again!'
      ]).then(function () {
        PIP.audio.play('success');
        PIP.ui.toast('🏆', 'All five Idea Cores recovered!');
        PIP.ui.setGoal('You did it! Explore, replay challenges, or hunt every Spark Seed. 🌟', false);
      });
    }
    if (PIP.save.hasCore('meadow') && !PIP.save.mission('hub.core1')) {
      PIP.save.setMission('hub.core1', 'done');
      PIP.audio.play('fanfare');
      return PIP.ui.say('Professor Pebble', '🪨', [
        'The Idea Core is home! Watch the village wake up!',
        'The fountain dances, the lamps glow, and the little bridge has mended itself.',
        'And listen — the Gearleaf Grove gate is humming. Off you pop, inventor!'
      ]).then(function () {
        PIP.ui.setGoal('Visit Gearleaf Grove — through the gear gate. ⚙️', false);
        world.setBeacon(gatePos[1][0], gatePos[1][1]);
      });
    }
    if (!PIP.save.mission('meadow.stones')) {
      PIP.ui.setGoal('Go through the strawberry gate to Numberberry Meadow. 🍓', false);
      world.setBeacon(gatePos[0][0], gatePos[0][1]);
    } else {
      // point at the first world still missing its Idea Core
      var order = ['meadow', 'grove', 'harbour', 'mountain', 'factory'];
      var names = ['Numberberry Meadow 🍓', 'Gearleaf Grove ⚙️', 'Shape Sail Harbour ⛵', 'Measure Mountain 🏔️', 'Patternworks Factory 🏭'];
      var next = -1;
      for (var i = 0; i < order.length; i++) if (!PIP.save.hasCore(order[i])) { next = i; break; }
      if (next === -1) { PIP.ui.setGoal('Every island is whole! Explore and collect Spark Seeds. 🌟', false); world.clearBeacon(); }
      else { PIP.ui.setGoal('Explore ' + names[next] + ' to find its Idea Core.', false); world.setBeacon(gatePos[next][0], gatePos[next][1]); }
    }
    return Promise.resolve();
  };

  return world;
};
