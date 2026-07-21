/* Procedural low-poly asset factory. Every model is original and built from
   primitives at load time — there are no imported art files at all. */
PIP.assets = (function () {
  var U = PIP.util;
  var matCache = {};

  function mat(color, opts) {
    opts = opts || {};
    var key = color + '|' + (opts.emissive || 0) + '|' + (opts.transparent ? 't' + opts.opacity : '');
    if (matCache[key]) return matCache[key];
    var m = new THREE.MeshLambertMaterial({ color: color });
    if (opts.emissive) { m.emissive = new THREE.Color(opts.emissive); m.emissiveIntensity = opts.emissiveIntensity || 0.6; }
    if (opts.transparent) { m.transparent = true; m.opacity = opts.opacity == null ? 0.5 : opts.opacity; }
    matCache[key] = m;
    return m;
  }
  function mesh(geo, m, x, y, z) {
    var me = new THREE.Mesh(geo, m);
    if (x !== undefined) me.position.set(x, y, z);
    me.castShadow = true; me.receiveShadow = true;
    return me;
  }
  var GEO = {
    sphere: new THREE.SphereGeometry(1, 12, 10),
    box: new THREE.BoxGeometry(1, 1, 1),
    cyl: new THREE.CylinderGeometry(1, 1, 1, 12),
    cone: new THREE.ConeGeometry(1, 1, 10),
    torus: new THREE.TorusGeometry(1, 0.18, 8, 20)
  };

  /* ---------- text sprites (numerals, labels) ---------- */
  function textSprite(text, opts) {
    opts = opts || {};
    var size = opts.px || 128;
    var cv = document.createElement('canvas');
    var pad = 20;
    var ctx = cv.getContext('2d');
    ctx.font = 'bold ' + size + 'px "Arial Rounded MT Bold", "Trebuchet MS", sans-serif';
    var w = Math.ceil(ctx.measureText(text).width) + pad * 2;
    cv.width = Math.max(64, w); cv.height = size + pad * 2;
    ctx = cv.getContext('2d');
    ctx.font = 'bold ' + size + 'px "Arial Rounded MT Bold", "Trebuchet MS", sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    if (opts.bg) {
      ctx.fillStyle = opts.bg;
      var r = 30;
      ctx.beginPath();
      ctx.moveTo(r, 0); ctx.arcTo(cv.width, 0, cv.width, cv.height, r);
      ctx.arcTo(cv.width, cv.height, 0, cv.height, r); ctx.arcTo(0, cv.height, 0, 0, r); ctx.arcTo(0, 0, cv.width, 0, r);
      ctx.fill();
    }
    ctx.lineWidth = 10; ctx.strokeStyle = opts.outline || 'rgba(20,50,40,.85)';
    ctx.strokeText(text, cv.width / 2, cv.height / 2 + 4);
    ctx.fillStyle = opts.color || '#ffffff';
    ctx.fillText(text, cv.width / 2, cv.height / 2 + 4);
    var tex = new THREE.CanvasTexture(cv);
    tex.minFilter = THREE.LinearFilter;
    var sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
    var scale = opts.scale || 1;
    sp.scale.set(scale * cv.width / cv.height, scale, 1);
    return sp;
  }

  /* ---------- Pip ---------- */
  function makePip() {
    var g = new THREE.Group();
    var bodyMat = mat(0x8ce68a), bellyMat = mat(0xfff3c9);
    var body = mesh(GEO.sphere, bodyMat, 0, 0.52, 0); body.scale.set(0.42, 0.5, 0.42);
    var belly = mesh(GEO.sphere, bellyMat, 0, 0.45, 0.16); belly.scale.set(0.28, 0.34, 0.22);
    var head = mesh(GEO.sphere, bodyMat, 0, 1.12, 0.03); head.scale.set(0.38, 0.36, 0.38);
    var snout = mesh(GEO.sphere, bellyMat, 0, 1.02, 0.3); snout.scale.set(0.19, 0.14, 0.16);
    var eyeW = mat(0xffffff), eyeB = mat(0x2b2b33);
    var eL = mesh(GEO.sphere, eyeW, -0.15, 1.2, 0.28); eL.scale.set(0.11, 0.13, 0.07);
    var eR = mesh(GEO.sphere, eyeW, 0.15, 1.2, 0.28); eR.scale.set(0.11, 0.13, 0.07);
    var pL = mesh(GEO.sphere, eyeB, -0.15, 1.2, 0.34); pL.scale.set(0.05, 0.06, 0.03);
    var pR = mesh(GEO.sphere, eyeB, 0.15, 1.2, 0.34); pR.scale.set(0.05, 0.06, 0.03);
    var cheekM = mat(0xffb1a0);
    var cL = mesh(GEO.sphere, cheekM, -0.24, 1.05, 0.24); cL.scale.set(0.06, 0.045, 0.03);
    var cR = mesh(GEO.sphere, cheekM, 0.24, 1.05, 0.24); cR.scale.set(0.06, 0.045, 0.03);
    // leaf sprout on head
    var sproutStem = mesh(GEO.cyl, mat(0x2fa457), 0, 1.5, 0); sproutStem.scale.set(0.03, 0.14, 0.03);
    var sprout = makeLeaf(0.22); sprout.position.set(0.02, 1.62, 0); sprout.rotation.z = 0.4;
    // leaf tail
    var tail = new THREE.Group();
    var leaf = makeLeaf(0.42); leaf.rotation.x = -0.5;
    tail.add(leaf); tail.position.set(0, 0.5, -0.34);
    var footM = mat(0x54b86a);
    var fL = mesh(GEO.sphere, footM, -0.16, 0.1, 0.03); fL.scale.set(0.13, 0.1, 0.18);
    var fR = mesh(GEO.sphere, footM, 0.16, 0.1, 0.03); fR.scale.set(0.13, 0.1, 0.18);
    var aL = mesh(GEO.sphere, footM, -0.4, 0.62, 0.05); aL.scale.set(0.09, 0.16, 0.09);
    var aR = mesh(GEO.sphere, footM, 0.4, 0.62, 0.05); aR.scale.set(0.09, 0.16, 0.09);
    g.add(body, belly, head, snout, eL, eR, pL, pR, cL, cR, sproutStem, sprout, tail, fL, fR, aL, aR);
    g.userData = { body: body, head: head, tail: tail, footL: fL, footR: fR, armL: aL, armR: aR };
    return g;
  }
  function makeLeaf(size) {
    var s = new THREE.Shape();
    s.moveTo(0, 0);
    s.quadraticCurveTo(size * 0.9, size * 0.5, 0, size * 1.6);
    s.quadraticCurveTo(-size * 0.9, size * 0.5, 0, 0);
    var geo = new THREE.ShapeGeometry(s, 6);
    var m = new THREE.MeshLambertMaterial({ color: 0x3dbb63, side: THREE.DoubleSide });
    var me = new THREE.Mesh(geo, m);
    me.castShadow = true;
    return me;
  }

  /* ---------- characters ---------- */
  function makePebble() {
    var g = new THREE.Group();
    var rockM = mat(0x9aa3ac);
    var body = mesh(GEO.sphere, rockM, 0, 0.6, 0); body.scale.set(0.55, 0.62, 0.5);
    var head = mesh(GEO.sphere, rockM, 0, 1.35, 0); head.scale.set(0.38, 0.34, 0.36);
    var moss = mesh(GEO.sphere, mat(0x5fae53), 0, 1.56, -0.04); moss.scale.set(0.32, 0.14, 0.3);
    var eyeW = mat(0xffffff), eyeB = mat(0x2b2b33);
    [-1, 1].forEach(function (s) {
      var e = mesh(GEO.sphere, eyeW, 0.14 * s, 1.38, 0.3); e.scale.set(0.1, 0.11, 0.05); g.add(e);
      var p = mesh(GEO.sphere, eyeB, 0.14 * s, 1.38, 0.34); p.scale.set(0.045, 0.05, 0.03); g.add(p);
      var ring = new THREE.Mesh(GEO.torus, mat(0x8a6f3b));
      ring.position.set(0.14 * s, 1.38, 0.33); ring.scale.set(0.11, 0.12, 0.06); g.add(ring);
      var arm = mesh(GEO.sphere, rockM, 0.55 * s, 0.72, 0); arm.scale.set(0.14, 0.22, 0.14); g.add(arm);
      var foot = mesh(GEO.sphere, rockM, 0.22 * s, 0.1, 0.04); foot.scale.set(0.16, 0.1, 0.2); g.add(foot);
    });
    var brow = mesh(GEO.box, mat(0xd8dee4), 0, 1.52, 0.26); brow.scale.set(0.4, 0.05, 0.05);
    var mouth = mesh(GEO.sphere, mat(0x5b6770), 0, 1.22, 0.32); mouth.scale.set(0.09, 0.04, 0.03);
    g.add(body, head, moss, brow, mouth);
    g.userData.head = head;
    return g;
  }

  function makeBerryback(color) {
    var g = new THREE.Group();
    var bodyM = mat(0x8a6b4f), berryM = mat(color || 0xff6f9c);
    var body = mesh(GEO.sphere, bodyM, 0, 0.42, 0); body.scale.set(0.42, 0.36, 0.5);
    var head = mesh(GEO.sphere, bodyM, 0, 0.62, 0.44); head.scale.set(0.24, 0.22, 0.24);
    var berry = mesh(GEO.sphere, berryM, 0, 0.72, -0.08); berry.scale.set(0.3, 0.28, 0.3);
    var stem = mesh(GEO.cyl, mat(0x3f7b3f), 0, 1.02, -0.08); stem.scale.set(0.03, 0.1, 0.03);
    var eyeW = mat(0xffffff), eyeB = mat(0x2b2b33);
    [-1, 1].forEach(function (s) {
      var e = mesh(GEO.sphere, eyeW, 0.1 * s, 0.68, 0.62); e.scale.set(0.06, 0.07, 0.04); g.add(e);
      var p = mesh(GEO.sphere, eyeB, 0.1 * s, 0.68, 0.65); p.scale.set(0.03, 0.035, 0.02); g.add(p);
      [0.22, -0.18].forEach(function (z) {
        var leg = mesh(GEO.cyl, bodyM, 0.26 * s, 0.12, z); leg.scale.set(0.06, 0.12, 0.06); g.add(leg);
      });
    });
    var nose = mesh(GEO.sphere, mat(0x53402e), 0, 0.6, 0.68); nose.scale.set(0.05, 0.04, 0.04);
    var tail = mesh(GEO.sphere, bodyM, 0, 0.42, -0.52); tail.scale.set(0.08, 0.08, 0.1);
    g.add(body, head, berry, stem, nose, tail);
    g.userData = { berry: berry, head: head };
    return g;
  }

  function makeSquirrelish() { // Gearleaf Grove helper creature: "Nutkin the Tinkerer"
    var g = new THREE.Group();
    var furM = mat(0xc98d5a);
    var body = mesh(GEO.sphere, furM, 0, 0.5, 0); body.scale.set(0.3, 0.36, 0.3);
    var head = mesh(GEO.sphere, furM, 0, 0.95, 0.06); head.scale.set(0.24, 0.22, 0.22);
    var tail = mesh(GEO.sphere, mat(0xa96f3f), 0, 0.72, -0.4); tail.scale.set(0.16, 0.4, 0.16); tail.rotation.x = 0.5;
    var eyeW = mat(0xffffff), eyeB = mat(0x2b2b33);
    [-1, 1].forEach(function (s) {
      var ear = mesh(GEO.cone, furM, 0.13 * s, 1.2, 0.02); ear.scale.set(0.06, 0.12, 0.06); g.add(ear);
      var e = mesh(GEO.sphere, eyeW, 0.09 * s, 0.99, 0.24); e.scale.set(0.06, 0.07, 0.04); g.add(e);
      var p = mesh(GEO.sphere, eyeB, 0.09 * s, 0.99, 0.27); p.scale.set(0.03, 0.035, 0.02); g.add(p);
    });
    var goggle = new THREE.Mesh(GEO.torus, mat(0xffd257));
    goggle.position.set(0, 1.12, 0.1); goggle.scale.set(0.16, 0.16, 0.1); goggle.rotation.x = -0.9;
    g.add(body, head, tail, goggle);
    return g;
  }

  /* ---------- flora & scenery ---------- */
  function makeTree(kind) {
    var g = new THREE.Group();
    var trunk = mesh(GEO.cyl, mat(0x8a6142), 0, 1.1, 0); trunk.scale.set(0.28, 2.2, 0.28);
    g.add(trunk);
    if (kind === 'pine') {
      [2.0, 2.9, 3.7].forEach(function (y, i) {
        var c = mesh(GEO.cone, mat(0x2e8f57), 0, y, 0);
        var s = 1.5 - i * 0.35; c.scale.set(s, 1.2, s); g.add(c);
      });
    } else {
      var tuft = mat(kind === 'autumn' ? 0xe8a13f : 0x4fbf6a);
      [[0, 3.0, 0, 1.15], [0.75, 2.5, 0.2, 0.8], [-0.7, 2.6, -0.2, 0.75], [0.1, 2.4, 0.75, 0.7], [-0.2, 2.5, -0.75, 0.65]]
        .forEach(function (p) {
          var b = mesh(GEO.sphere, tuft, p[0], p[1], p[2]); b.scale.setScalar(p[3]); g.add(b);
        });
    }
    return g;
  }
  function makeFlower(color, scale) {
    var g = new THREE.Group();
    scale = scale || 1;
    var stem = mesh(GEO.cyl, mat(0x3f9950), 0, 0.35 * scale, 0); stem.scale.set(0.04 * scale, 0.7 * scale, 0.04 * scale);
    g.add(stem);
    var c = mesh(GEO.sphere, mat(0xffd257), 0, 0.75 * scale, 0); c.scale.setScalar(0.12 * scale); g.add(c);
    for (var i = 0; i < 6; i++) {
      var a = i / 6 * Math.PI * 2;
      var p = mesh(GEO.sphere, mat(color), Math.cos(a) * 0.17 * scale, 0.75 * scale, Math.sin(a) * 0.17 * scale);
      p.scale.set(0.1 * scale, 0.05 * scale, 0.1 * scale); g.add(p);
    }
    return g;
  }
  function makeRock(scale) {
    var r = mesh(GEO.sphere, mat(0x97a0a8), 0, scale * 0.4, 0);
    r.scale.set(scale, scale * 0.62, scale * 0.85);
    r.rotation.y = U.rand(0, 3);
    return r;
  }
  function makeBush(color) {
    var g = new THREE.Group();
    [[0, 0.3, 0, 0.5], [0.35, 0.25, 0.1, 0.35], [-0.3, 0.25, -0.1, 0.38]].forEach(function (p) {
      var b = mesh(GEO.sphere, mat(color || 0x3f9950), p[0], p[1], p[2]); b.scale.setScalar(p[3]); g.add(b);
    });
    return g;
  }

  function makeHouse(bodyColor, roofColor) {
    var g = new THREE.Group();
    var body = mesh(GEO.box, mat(bodyColor || 0xf2e0bd), 0, 1.1, 0); body.scale.set(3, 2.2, 2.6);
    var roof = mesh(GEO.cone, mat(roofColor || 0xd96a45), 0, 3.0, 0); roof.scale.set(2.6, 1.6, 2.6); roof.rotation.y = Math.PI / 4;
    roof.geometry = new THREE.ConeGeometry(1, 1, 4);
    var door = mesh(GEO.box, mat(0x8a6142), 0, 0.65, 1.31); door.scale.set(0.8, 1.3, 0.1);
    var knob = mesh(GEO.sphere, mat(0xffd257), 0.25, 0.65, 1.38); knob.scale.setScalar(0.06);
    [-0.95, 0.95].forEach(function (x) {
      var win = mesh(GEO.box, mat(0xbfe9ff), x, 1.35, 1.31); win.scale.set(0.6, 0.6, 0.08); g.add(win);
    });
    g.add(body, roof, door, knob);
    return g;
  }

  function makeGate(color) {
    var g = new THREE.Group();
    var post = mat(0x8a6142);
    var l = mesh(GEO.cyl, post, -1.3, 1.5, 0); l.scale.set(0.22, 3, 0.22);
    var r = mesh(GEO.cyl, post, 1.3, 1.5, 0); r.scale.set(0.22, 3, 0.22);
    var top = mesh(GEO.cyl, post, 0, 3.1, 0); top.scale.set(0.18, 3.2, 0.18); top.rotation.z = Math.PI / 2;
    var arch = new THREE.Mesh(GEO.torus, mat(color));
    arch.position.set(0, 3.1, 0); arch.scale.set(1.5, 1.1, 1);
    var swirl = new THREE.Mesh(
      new THREE.CircleGeometry(1.18, 24),
      new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: 0.4, side: THREE.DoubleSide })
    );
    swirl.position.set(0, 1.7, 0);
    g.add(l, r, top, arch, swirl);
    g.userData.swirl = swirl;
    return g;
  }

  function makeLamp() {
    var g = new THREE.Group();
    var pole = mesh(GEO.cyl, mat(0x5b6770), 0, 1.2, 0); pole.scale.set(0.08, 2.4, 0.08);
    var bulb = mesh(GEO.sphere, mat(0x777777), 0, 2.55, 0); bulb.scale.setScalar(0.26);
    var cap = mesh(GEO.cone, mat(0x46525b), 0, 2.9, 0); cap.scale.set(0.4, 0.3, 0.4);
    g.add(pole, bulb, cap);
    g.userData.bulb = bulb;
    return g;
  }

  function makeFountain() {
    var g = new THREE.Group();
    var basin = mesh(GEO.cyl, mat(0xb9c3cc), 0, 0.3, 0); basin.scale.set(1.6, 0.6, 1.6);
    var water = mesh(GEO.cyl, mat(0x62c4e8, { emissive: 0x2b7fa8, emissiveIntensity: 0.3 }), 0, 0.62, 0);
    water.scale.set(1.4, 0.08, 1.4);
    var column = mesh(GEO.cyl, mat(0xb9c3cc), 0, 0.9, 0); column.scale.set(0.2, 1.2, 0.2);
    var top = mesh(GEO.sphere, mat(0x62c4e8), 0, 1.6, 0); top.scale.setScalar(0.26); top.visible = false;
    g.add(basin, water, column, top);
    g.userData = { water: water, top: top };
    return g;
  }

  function makeSign(text) {
    var g = new THREE.Group();
    var post = mesh(GEO.cyl, mat(0x8a6142), 0, 0.7, 0); post.scale.set(0.07, 1.4, 0.07);
    var board = mesh(GEO.box, mat(0xc98d5a), 0, 1.35, 0); board.scale.set(1.7, 0.8, 0.12);
    g.add(post, board);
    var label = textSprite(text, { px: 54, scale: 0.62, color: '#fff6e3', bg: 'rgba(90,60,30,0)' });
    label.position.set(0, 1.36, 0.12);
    g.add(label);
    return g;
  }

  /* ---------- collectibles ---------- */
  function makeSeed() {
    var g = new THREE.Group();
    var core = mesh(GEO.sphere, mat(0xffd257, { emissive: 0xffaa00, emissiveIntensity: 0.7 }), 0, 0, 0);
    core.scale.set(0.18, 0.26, 0.18);
    var leaf = makeLeaf(0.12); leaf.position.set(0, 0.22, 0); g.add(core, leaf);
    return g;
  }
  function makeCore(color) {
    var g = new THREE.Group();
    var bulb = mesh(GEO.sphere, mat(color || 0x9be8ff, { emissive: color || 0x59c8f0, emissiveIntensity: 0.9 }), 0, 0.55, 0);
    bulb.scale.set(0.42, 0.5, 0.42);
    var base = mesh(GEO.cyl, mat(0xd7b356), 0, 0.12, 0); base.scale.set(0.26, 0.26, 0.26);
    var ring = new THREE.Mesh(GEO.torus, mat(0xffd257, { emissive: 0xcc8800, emissiveIntensity: 0.4 }));
    ring.position.y = 0.55; ring.scale.set(0.55, 0.55, 0.55); ring.rotation.x = Math.PI / 2;
    g.add(bulb, base, ring);
    g.userData = { bulb: bulb, ring: ring };
    return g;
  }

  /* ---------- build components ---------- */
  function makeStone() {
    var s = mesh(GEO.sphere, mat(0xc4cdd4), 0, 0.22, 0);
    s.scale.set(0.42, 0.24, 0.42);
    return s;
  }
  function makePlank(color) {
    return mesh(GEO.box, mat(color || 0xd8a869), 0, 0.09, 0);
  }
  function makeBlock() {
    var b = mesh(GEO.box, mat(0xb9c3cc), 0, 0.25, 0); b.scale.set(0.56, 0.5, 0.56);
    return b;
  }
  function makeBrace() { // triangle support
    var s = new THREE.Shape();
    s.moveTo(-0.5, 0); s.lineTo(0.5, 0); s.lineTo(0, 0.75); s.lineTo(-0.5, 0);
    var geo = new THREE.ExtrudeGeometry(s, { depth: 0.16, bevelEnabled: false });
    var m = new THREE.Mesh(geo, mat(0xe07b4f));
    m.castShadow = true;
    return m;
  }
  function makeBerry(color) {
    var g = new THREE.Group();
    var b = mesh(GEO.sphere, mat(color || 0xff5f8f), 0, 0.16, 0); b.scale.setScalar(0.17);
    var stem = mesh(GEO.cyl, mat(0x3f7b3f), 0, 0.34, 0); stem.scale.set(0.02, 0.1, 0.02);
    g.add(b, stem);
    return g;
  }
  function makeGear(radius, teeth, color) {
    var g = new THREE.Group();
    var body = mesh(new THREE.CylinderGeometry(radius, radius, 0.18, 20), mat(color || 0xd8a869), 0, 0, 0);
    body.rotation.x = Math.PI / 2;
    g.add(body);
    for (var i = 0; i < teeth; i++) {
      var a = i / teeth * Math.PI * 2;
      var t = mesh(GEO.box, mat(color || 0xd8a869), Math.cos(a) * (radius + 0.09), Math.sin(a) * (radius + 0.09), 0);
      t.scale.set(0.16, 0.16, 0.16); t.rotation.z = a;
      g.add(t);
    }
    var hub = mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.24, 10), mat(0x8a6142), 0, 0, 0);
    hub.rotation.x = Math.PI / 2;
    g.add(hub);
    return g;
  }
  function makeAcorn() {
    var g = new THREE.Group();
    var nut = mesh(GEO.sphere, mat(0xd8a869), 0, 0.14, 0); nut.scale.set(0.13, 0.16, 0.13);
    var cap = mesh(GEO.sphere, mat(0x8a6142), 0, 0.24, 0); cap.scale.set(0.14, 0.09, 0.14);
    var tip = mesh(GEO.cyl, mat(0x8a6142), 0, 0.32, 0); tip.scale.set(0.02, 0.06, 0.02);
    g.add(nut, cap, tip);
    return g;
  }
  function makePod() { // seed pod (counts as one, looks different from acorn)
    var g = new THREE.Group();
    var pod = mesh(GEO.sphere, mat(0x7fbf5f), 0, 0.14, 0); pod.scale.set(0.11, 0.18, 0.11);
    g.add(pod);
    return g;
  }

  function makeButterfly(color) {
    var g = new THREE.Group();
    var body = mesh(GEO.sphere, mat(0x4a4a55), 0, 0, 0); body.scale.set(0.04, 0.12, 0.04);
    var wingGeo = new THREE.CircleGeometry(0.16, 8);
    var wm = new THREE.MeshLambertMaterial({ color: color, side: THREE.DoubleSide });
    var wL = new THREE.Mesh(wingGeo, wm); wL.position.x = -0.14;
    var wR = new THREE.Mesh(wingGeo, wm); wR.position.x = 0.14;
    g.add(body, wL, wR);
    g.userData = { wL: wL, wR: wR };
    return g;
  }

  /* ---------- terrain helper ---------- */
  function groundMesh(size, segs, heightFn, colorFn) {
    var geo = new THREE.PlaneGeometry(size, size, segs, segs);
    geo.rotateX(-Math.PI / 2);
    var pos = geo.attributes.position;
    var colors = new Float32Array(pos.count * 3);
    var c = new THREE.Color();
    for (var i = 0; i < pos.count; i++) {
      var x = pos.getX(i), z = pos.getZ(i);
      var y = heightFn(x, z);
      pos.setY(i, y);
      c.set(colorFn(x, z, y));
      colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    var m = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true }));
    m.receiveShadow = true;
    return m;
  }

  return {
    mat: mat, mesh: mesh, GEO: GEO, textSprite: textSprite,
    makePip: makePip, makeLeaf: makeLeaf, makePebble: makePebble, makeBerryback: makeBerryback,
    makeSquirrelish: makeSquirrelish,
    makeTree: makeTree, makeFlower: makeFlower, makeRock: makeRock, makeBush: makeBush,
    makeHouse: makeHouse, makeGate: makeGate, makeLamp: makeLamp, makeFountain: makeFountain,
    makeSign: makeSign, makeSeed: makeSeed, makeCore: makeCore,
    makeStone: makeStone, makePlank: makePlank, makeBlock: makeBlock, makeBrace: makeBrace,
    makeBerry: makeBerry, makeGear: makeGear, makeAcorn: makeAcorn, makePod: makePod,
    makeButterfly: makeButterfly, groundMesh: groundMesh
  };
})();
