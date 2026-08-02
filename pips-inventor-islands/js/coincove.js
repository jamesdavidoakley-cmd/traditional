/* World 7 — Coin Cove (bonus island).
   Mission 1: The Shell Stall  — recognise coins & make an amount
   Mission 2: Coin Sorter      — add money (totals)
   Mission 3: Give Change      — subtraction with money
   Hidden:    Make 10p         — coin bonds to 10
   Reward:    the Coin Cove Idea Core
   All money is play money in pretend pence — an optional, gentle intro to UK coins. */
PIP.worlds = PIP.worlds || {};

PIP.worlds.coincove = function () {
  var U = PIP.util, A = PIP.assets, K = PIP.worldkit;

  function terrainFn(x, z) {
    var y = 0.3 + Math.sin(x * 0.12) * Math.cos(z * 0.1) * 0.4;
    var d = Math.sqrt(x * x + z * z);
    if (d > 22) y -= (d - 22) * 1.6;
    return y;
  }
  function colorFn(x, z, y) { var n = Math.sin(x * 0.3) * Math.cos(z * 0.32); return n < -0.3 ? '#e8d29a' : '#f0dfa8'; }
  var world = K.createWorld({
    id: 'coincove', music: 'cove', sky: 0xffe6b0,
    groundFn: terrainFn, colorFn: colorFn, size: 62, segs: 76,
    bounds: { minX: -22, maxX: 22, minZ: -22, maxZ: 22 },
    spawn: { x: 0, z: -7, angle: 0 }, killY: -13
  });
  world.water.push({ minX: -22, maxX: 22, minZ: 16, maxZ: 24, y: 0.1 }); // the cove sea to the north

  var backGate = A.makeGate(0x8fd483);
  world.addAt(backGate, 0, -14); backGate.rotation.y = 0; backGate.userData.swirl.material.opacity = 0.5;
  world.interact({ x: 0, z: -14, radius: 2.4, prompt: 'Back to Inventor Village', icon: '🏡', onInteract: function () { PIP.game.gotoWorld('hub'); } });
  world.addAt(A.makeSign('Inventor Village'), 3, -12);

  /* ---------- coins & Penny the crab ---------- */
  function coinMesh(val, silver) {
    var g = new THREE.Group();
    var c = A.mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.1, 18), A.mat(silver ? 0xcfd4da : 0xd98c3a), 0, 0, 0); c.rotation.x = Math.PI / 2;
    g.add(c);
    var lab = A.textSprite(val, { px: 50, scale: 0.42, color: silver ? '#3a4048' : '#5a3610' }); lab.position.set(0, 0, 0.08); g.add(lab);
    return g;
  }
  function makePenny() {
    var g = new THREE.Group();
    var body = A.mesh(A.GEO.sphere, A.mat(0xff6f4a), 0, 0.42, 0); body.scale.set(0.6, 0.36, 0.5);
    var belly = A.mesh(A.GEO.sphere, A.mat(0xffd0b0), 0, 0.34, 0.18); belly.scale.set(0.4, 0.2, 0.3);
    [-1, 1].forEach(function (s) {
      var stalk = A.mesh(A.GEO.cyl, A.mat(0xff6f4a), 0.18 * s, 0.75, 0.1); stalk.scale.set(0.05, 0.4, 0.05); g.add(stalk);
      var eye = A.mesh(A.GEO.sphere, A.mat(0xffffff), 0.18 * s, 0.95, 0.1); eye.scale.setScalar(0.1); g.add(eye);
      var pup = A.mesh(A.GEO.sphere, A.mat(0x2b2b33), 0.18 * s, 0.97, 0.16); pup.scale.setScalar(0.045); g.add(pup);
      var claw = A.mesh(A.GEO.sphere, A.mat(0xff6f4a), 0.6 * s, 0.35, 0.2); claw.scale.set(0.18, 0.22, 0.14); g.add(claw);
      [0.3, -0.2].forEach(function (z) { var leg = A.mesh(A.GEO.cyl, A.mat(0xff6f4a), 0.5 * s, 0.15, z); leg.scale.set(0.04, 0.18, 0.04); leg.rotation.z = 0.5 * s; g.add(leg); });
    });
    g.add(body, belly);
    return g;
  }
  var penny = makePenny(); world.addAt(penny, 0, -1); world.block(0, -1, 0.7);
  var pT = 0; world.tick(function (dt) { pT += dt; penny.position.y = terrainFn(0, -1) + Math.abs(Math.sin(pT * 2)) * 0.04; var pp = PIP.player.state.pos; if (U.dist2(pp.x, pp.z, 0, -1) < 60) penny.rotation.y = U.angleLerp(penny.rotation.y, Math.atan2(pp.x, pp.z + 1), Math.min(1, dt * 3)); });
  world.interact({
    x: 0, z: -1, radius: 2.6, prompt: 'Talk to Penny', icon: '🦀',
    onInteract: function () {
      var done = ['cove.stall', 'cove.sorter', 'cove.change'].filter(function (m) { return PIP.save.mission(m) === 'done'; }).length;
      if (done === 3 && !PIP.save.hasCore('coincove')) { PIP.ui.say('Penny', '🦀', ['The market is buzzing again — the Idea Core is by the pier. Snip snip, off you go!']); return; }
      if (done === 3) { PIP.ui.say('Penny', '🦀', ['You know your coins, your totals AND your change. A proper little shopkeeper!']); return; }
      PIP.ui.say('Penny', '🦀', [
        'Snip snip! Welcome to Coin Cove market, Pip!',
        'Help at my shell stall, sort the coins, and work out the change.',
        'It is all pretend pennies — a lovely way to learn coins!'
      ]).then(pointNext);
    }
  });
  function pointNext() {
    checkAllMissions();
    if (PIP.save.mission('cove.stall') !== 'done') { PIP.ui.setGoal('Help at the Shell Stall (west). 🐚', false); world.setBeacon(-11, 4); }
    else if (PIP.save.mission('cove.sorter') !== 'done') { PIP.ui.setGoal('Run the coin sorter (east). 🪙', false); world.setBeacon(11, 4); }
    else if (PIP.save.mission('cove.change') !== 'done') { PIP.ui.setGoal('Give change at the counter (north). 💰', false); world.setBeacon(0, 13); }
    else if (!PIP.save.hasCore('coincove')) { PIP.ui.setGoal('Collect the Coin Cove Idea Core! 💡', false); world.setBeacon(0, 8); }
    else PIP.ui.clearGoal();
  }

  function stall(x, z, col) {
    var g = new THREE.Group();
    [[-1.2, 0], [1.2, 0]].forEach(function (p) { var post = A.mesh(A.GEO.cyl, A.mat(0x8a6142), p[0], 1, 0); post.scale.set(0.12, 2, 0.12); g.add(post); });
    var counter = A.mesh(A.GEO.box, A.mat(0xc98d5a), 0, 0.9, 0); counter.scale.set(2.8, 0.2, 1); g.add(counter);
    var roof = A.mesh(A.GEO.box, A.mat(col), 0, 2, 0); roof.scale.set(3, 0.2, 1.6); roof.rotation.x = 0.15; g.add(roof);
    g.position.set(x, terrainFn(x, z), z); world.group.add(g); world.block(x, z, 1.2);
    return g;
  }

  /* =====================================================================
     MISSION 1 — The Shell Stall (recognise coins + make an amount)
     ===================================================================== */
  var stallDone = PIP.save.mission('cove.stall') === 'done';
  stall(-11, 4, 0xff7fb0);
  var shell = A.mesh(A.GEO.sphere, A.mat(0xffd8e8), -11, terrainFn(-11, 4) + 1.1, 4); shell.scale.set(0.3, 0.25, 0.3); world.group.add(shell);
  world.addAt(A.makeSign('Shell Stall'), -11, 4 - 3);
  var stallActive = false;
  world.interact({
    x: -11, z: 4 - 2.5, radius: 3.0, prompt: 'Help at the stall', icon: '🐚',
    enabled: function () { return !stallDone && !stallActive; },
    onInteract: function () {
      stallActive = true;
      PIP.ui.say('Penny', '🦀', ['A customer wants this pretty shell — it costs 5p. Which coin is worth 5 pence?']).then(function () {
        PIP.challenge.begin({ id: 'cove.stall', concept: 'measure', goal: 'Find the right coins to pay.', hints: ['Coins have their value written on them: 1p, 2p, 5p, 10p.', 'Five pence is written 5p.', 'Pick the 5p coin!'] });
        PIP.challenge.choicePick({
          question: 'The shell costs 5p. Which coin is 5p?',
          options: [{ label: '2p' }, { label: '5p', correct: true }, { label: '10p' }],
          nudge: 'Look for the coin that says 5p.', speak: 'The 5p coin!', concept: 'measure'
        }).then(function () {
          PIP.challenge.numberPick({
            question: 'Now a starfish costs 7p. You pay with a 5p and a 2p. How much is that?',
            answer: 7, options: [6, 7, 8], visual: { emoji: '🪙', count: 7 },
            nudge: '5p and 2p more: 5, 6, 7.', concept: 'addition'
          }).then(function () {
            stallDone = true; PIP.save.setMission('cove.stall', 'done'); PIP.save.recordAttempt('addition', true, 0);
            world.seed('cs1', -11, 8, 0.7);
            PIP.challenge.complete({ title: 'Sold!', maths: '5p + 2p = 7p', text: 'You found the 5p coin, and a 5p with a 2p makes 7p. Adding coins is just adding numbers!', speak: 'Five p and two p makes seven p. Sold!' }).then(pointNext);
          });
        });
      });
    }
  });

  /* =====================================================================
     MISSION 2 — Coin Sorter (adding money / totals)
     ===================================================================== */
  var sorterDone = PIP.save.mission('cove.sorter') === 'done';
  var SRX = 11, SRZ = 4, srBase = terrainFn(SRX, SRZ);
  var sorter = A.mesh(A.GEO.box, A.mat(0x6f87c7), SRX, srBase + 1, SRZ); sorter.scale.set(2, 2, 1.4); world.group.add(sorter); world.block(SRX, SRZ, 1.2);
  var tray = A.mesh(A.GEO.box, A.mat(0x4a4a55), SRX, srBase + 0.4, SRZ - 1.3); tray.scale.set(1.6, 0.3, 1); world.group.add(tray);
  world.addAt(A.makeSign('Coin Sorter'), SRX, SRZ - 3);
  var sorterActive = false;
  world.interact({
    x: SRX, z: SRZ - 2.5, radius: 3.0, prompt: 'Run the sorter', icon: '🪙',
    enabled: function () { return !sorterDone && !sorterActive; },
    onInteract: function () {
      sorterActive = true;
      PIP.ui.say('Penny', '🦀', ['The sorter tips out a handful of coins. Add them up to find the total!']).then(function () {
        PIP.player.state.frozen = true; world.clearBeacon();
        PIP.game.tweenCamera(new THREE.Vector3(SRX - 3, srBase + 3.5, SRZ - 5), new THREE.Vector3(SRX, srBase + 1, SRZ - 1));
        // drop 3 coins: 5p, 2p, 1p = 8p
        var vals = [['5p', true], ['2p', false], ['1p', false]];
        var coins = [];
        vals.forEach(function (v, i) { var c = coinMesh(v[0], v[1]); c.position.set(SRX - 0.6 + i * 0.6, srBase + 0.6, SRZ - 1.3); world.group.add(c); coins.push(c); PIP.audio.play('count', i + 1); });
        PIP.challenge.begin({ id: 'cove.sorter', concept: 'addition', goal: 'Add the coins to find the total.', hints: ['Read each coin: 5p, 2p, 1p.', 'Start with the biggest: 5, then 2 more, then 1 more.', '5, 7, 8. The total is 8p.'] });
        setTimeout(function () {
          PIP.challenge.numberPick({
            question: 'The sorter tipped out 5p, 2p and 1p. How much altogether?',
            answer: 8, options: [7, 8, 9], visual: { emoji: '🪙', count: 3 },
            nudge: 'Count on: 5… 7… 8.', concept: 'addition'
          }).then(function () {
            PIP.player.state.frozen = false;
            sorterDone = true; PIP.save.setMission('cove.sorter', 'done'); PIP.save.recordAttempt('addition', true, 0);
            if (PIP.save.grantBadge('counter')) PIP.ui.toast('🔢', 'Inventor Badge: Careful Counter!');
            world.seed('cs2', SRX, SRZ + 4, 0.7);
            PIP.challenge.complete({ title: 'All counted!', maths: '5p + 2p + 1p = 8p', text: 'Add coins by counting on from the biggest: 5, then 7, then 8. Eight pence in the tray!', speak: 'Five, seven, eight. Eight pence altogether!' }).then(pointNext);
          });
        }, 1200);
      });
    }
  });

  /* =====================================================================
     MISSION 3 — Give Change (subtraction with money)
     ===================================================================== */
  var changeDone = PIP.save.mission('cove.change') === 'done';
  stall(0, 13, 0x8fd8ff);
  world.addAt(A.makeSign('Change Counter'), 3, 13 - 2.5);
  var changeActive = false;
  world.interact({
    x: 0, z: 13 - 2.5, radius: 3.0, prompt: 'Give change', icon: '💰',
    enabled: function () { return !changeDone && !changeActive; },
    onInteract: function () {
      changeActive = true;
      PIP.ui.say('Penny', '🦀', ['A customer buys a 6p crab-cake and pays with a 10p coin. How much change do we give back?']).then(function () {
        PIP.challenge.begin({ id: 'cove.change', concept: 'subtraction', goal: 'Work out the change (10p take away the cost).', hints: ['Change is what is left after paying.', 'Count up from 6 to 10: 7, 8, 9, 10 — that is 4.', '10 take away 6 is 4. Give 4p change.'] });
        PIP.challenge.numberPick({
          question: 'Paid 10p for a 6p cake. How much change?  10 − 6 = □',
          answer: 4, options: [3, 4, 5], visual: { total: 10, filled: 6 },
          nudge: 'Count up from 6 to 10.', concept: 'subtraction'
        }).then(function () {
          PIP.challenge.numberPick({
            question: 'Another! Paid 10p for a 3p pebble. How much change?',
            answer: 7, options: [6, 7, 8], visual: { total: 10, filled: 3 },
            nudge: 'Count up from 3 to 10.', concept: 'subtraction'
          }).then(function () {
            changeDone = true; PIP.save.setMission('cove.change', 'done'); PIP.save.recordAttempt('subtraction', true, 0);
            world.seed('cs3', 0, 16, -0.6);
            PIP.challenge.complete({ title: 'Correct change!', maths: '10p − 6p = 4p   ·   10p − 3p = 7p', text: 'Change is the difference between what they paid and the price. From 10p: a 6p cake leaves 4p, a 3p pebble leaves 7p.', speak: 'Ten take away six is four. Ten take away three is seven. Correct change!' }).then(pointNext);
          });
        });
      });
    }
  });

  /* =====================================================================
     HIDDEN — Make 10p (coin bonds to 10)
     ===================================================================== */
  var tenDone = PIP.save.mission('cove.ten') === 'done';
  var TNX = 12, TNZ = -8;
  var piggy = A.mesh(A.GEO.sphere, A.mat(0xff9ec4), TNX, terrainFn(TNX, TNZ) + 0.6, TNZ); piggy.scale.set(0.6, 0.5, 0.7); world.group.add(piggy); world.block(TNX, TNZ, 0.8);
  world.addAt(A.makeSign('Make 10p!'), TNX + 2, TNZ - 1.5);
  var tenActive = false;
  world.interact({
    x: TNX, z: TNZ - 1.8, radius: 2.8, prompt: 'The piggy bank', icon: '🐷',
    enabled: function () { return !tenDone && !tenActive; },
    onInteract: function () {
      tenActive = true;
      PIP.ui.say('Penny', '🦀', ['My piggy bank only likes exactly 10p! Can you make ten pence?']).then(function () {
        PIP.challenge.begin({ id: 'cove.ten', concept: 'bonds10', goal: 'Make 10p with coins.', hints: ['Number bonds to 10 again — with coins!', 'A 5p needs another 5p to make 10p.', '5p and 5p is 10p.'] });
        PIP.challenge.numberPick({ question: 'You have a 5p. How many more pence make 10p?', answer: 5, options: [4, 5, 6], visual: { total: 10, filled: 5 }, nudge: 'Count on from 5 to 10.', concept: 'bonds10' }).then(function () {
          PIP.challenge.numberPick({ question: 'Now you have 8p. How many more pence make 10p?', answer: 2, options: [1, 2, 3], visual: { total: 10, filled: 8 }, nudge: 'Count on from 8 to 10.', concept: 'bonds10' }).then(function () {
            tenDone = true; PIP.save.setMission('cove.ten', 'done'); PIP.save.recordAttempt('bonds10', true, 0);
            world.seed('ct1', TNX - 1, TNZ, 0.8); world.seed('ct2', TNX + 1, TNZ, 0.8);
            PIP.challenge.complete({ title: 'The piggy is happy!', maths: '5p + 5p = 10p · 8p + 2p = 10p', text: 'Coin bonds to 10! 5 and 5 make 10, and 8 and 2 make 10. The same number bonds work with money!', speak: 'Five and five is ten. Eight and two is ten. The piggy is full!' });
          });
        });
      });
    }
  });

  /* =====================================================================
     IDEA CORE
     ===================================================================== */
  var coreTaken = PIP.save.hasCore('coincove');
  var pedestal = A.mesh(A.GEO.cyl, A.mat(0xd7b356), 0, terrainFn(0, 8) + 0.6, 8); pedestal.scale.set(0.8, 1.1, 0.8); world.group.add(pedestal); world.block(0, 8, 1);
  var core = A.makeCore(0xffd257); world.add(core, 0, terrainFn(0, 8) + 1.5, 8); core.visible = false;
  var coreT = 0; world.tick(function (dt) { if (!core.visible) return; coreT += dt; core.position.y = terrainFn(0, 8) + 1.5 + Math.sin(coreT * 2) * 0.15; core.rotation.y += dt; core.userData.ring.rotation.z += dt * 2; });
  function checkAllMissions() {
    var all = ['cove.stall', 'cove.sorter', 'cove.change'].every(function (m) { return PIP.save.mission(m) === 'done'; });
    if (all && !coreTaken && !core.visible) { core.visible = true; PIP.audio.play('unlock'); PIP.ui.say('Penny', '🦀', ['Sold, sorted and changed — the market thrives! The Idea Core popped up by the pier.', 'Go and get it, Pip!']).then(function () { PIP.ui.setGoal('Collect the Coin Cove Idea Core! 💡', false); world.setBeacon(0, 8); }); }
  }
  world.interact({
    x: 0, z: 8, radius: 2.4, prompt: 'Take the Idea Core', icon: '💡',
    enabled: function () { return core.visible && !coreTaken; },
    onInteract: function () {
      coreTaken = true; core.visible = false; PIP.save.grantCore('coincove'); PIP.ui.updateHUD(); world.clearBeacon(); PIP.audio.play('fanfare');
      PIP.ui.summary({ title: 'IDEA CORE FOUND! 💡', text: 'The Coin Cove Idea Core is safe! Take it home to Inventor Village.', speak: 'You found the Coin Cove Idea Core!', stars: '💡⭐💡' }).then(function () { PIP.ui.setGoal('Return to Inventor Village. 🏡', false); world.setBeacon(0, -14); });
    }
  });

  /* ---------- scenery & seeds ---------- */
  [[-16, 8], [16, 6], [-14, -12], [14, -10], [-6, 14], [8, 15]].forEach(function (t, i) { var tr = A.makeTree(i % 2 ? 'round' : 'pine'); world.addAt(tr, t[0], t[1]); world.block(t[0], t[1], 0.7); });
  // scattered giant coins as decoration
  [[-18, 2], [18, -4], [4, -14]].forEach(function (p) { var c = coinMesh('1p', false); c.scale.setScalar(1.6); c.position.set(p[0], terrainFn(p[0], p[1]) + 0.6, p[1]); world.group.add(c); var t = U.rand(0, 6); world.tick(function (dt) { t += dt; c.rotation.y += dt; }); });
  world.butterflies(4, 0, 0, 15);
  world.seed('cc1', 0, 18, -0.5); world.seed('cc2', 18, 8, 0.7); world.seed('cc3', -18, 8, 0.7); world.seed('cc4', 6, -16, 0.7);

  world.postEnter = function () {
    checkAllMissions();
    if (!PIP.save.mission('cove.intro')) {
      PIP.save.setMission('cove.intro', 'done');
      return PIP.ui.say('Penny', '🦀', ['Snip snip! A market island drifted in — Coin Cove! I am Penny the crab.', 'It is all pretend pennies here — recognise coins, add them up, and give change.', 'Come and mind the stalls with me!']).then(pointNext);
    }
    pointNext(); return Promise.resolve();
  };
  return world;
};
