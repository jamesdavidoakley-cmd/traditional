/* Pip's character controller + follow camera.
   Tuned to be forgiving: coyote time, jump buffering, double jump with a
   flutter, strong air control, no lives, instant gentle respawns. */
PIP.player = (function () {
  var U = PIP.util;
  var G = 22, RUN = 6.4, ACCEL = 34, JUMP_V = 9.0, AIR_CTRL = 0.85;
  var COYOTE = 0.16, BUFFER = 0.16;

  var p = {
    group: null, pos: null, vel: null, facing: 0,
    grounded: false, jumps: 0, coyote: 0, buffer: 0,
    flutterT: 0, fluttering: false, stomping: false, swimming: false,
    carrying: null, lastSafe: null, safeT: 0, respawning: false,
    anim: { t: 0, squash: 0, land: 0 },
    cam: { yaw: 0, pitch: 0.42, dist: 8.5, idleT: 0 },
    frozen: false,
    twirlT: 0, spinExtra: 0, sparkleCooldown: 0, particles: []
  };

  function create(scene) {
    p.group = PIP.assets.makePip();
    p.pos = new THREE.Vector3(0, 0, 0);
    p.vel = new THREE.Vector3();
    p.lastSafe = new THREE.Vector3();
    scene.add(p.group);
    return p;
  }

  function teleport(x, z, angle, world) {
    p.pos.set(x, world ? supportAt(world, x, z, 999) : 0, z);
    p.vel.set(0, 0, 0);
    p.facing = angle || 0;
    p.cam.yaw = (angle || 0) + Math.PI;
    p.lastSafe.copy(p.pos);
    p.grounded = true; p.jumps = 0;
    p.twirlT = 0; p.spinExtra = 0;
    clearParticles();     // meshes belong to the old world's scene
    syncMesh(0);
  }

  /* ---------- just-for-fun abilities (cosmetic only) ----------
     These delight without helping — they change no positions, unlock no
     routes and touch no challenge, so a six-year-old can spam them freely. */
  function scene() { return PIP.game && PIP.game.scene; }
  function clearParticles() {
    var s = scene();
    for (var i = 0; i < p.particles.length; i++) if (s) s.remove(p.particles[i].m);
    p.particles.length = 0;
  }
  function spawnParticle(mesh, vx, vy, vz, life, spin) {
    var s = scene(); if (!s) return;
    s.add(mesh);
    p.particles.push({ m: mesh, vx: vx, vy: vy, vz: vz, life: life, max: life, spin: spin || 0 });
    if (p.particles.length > 160) { s.remove(p.particles[0].m); p.particles.shift(); }
  }
  function updateParticles(dt) {
    var s = scene();
    for (var i = p.particles.length - 1; i >= 0; i--) {
      var q = p.particles[i];
      q.life -= dt;
      if (q.life <= 0) { if (s) s.remove(q.m); p.particles.splice(i, 1); continue; }
      q.vy -= 9 * dt;
      q.m.position.x += q.vx * dt; q.m.position.y += q.vy * dt; q.m.position.z += q.vz * dt;
      q.m.rotation.y += q.spin * dt; q.m.rotation.x += q.spin * 0.6 * dt;
      var k = q.life / q.max;
      q.m.scale.setScalar(q.baseScale ? q.baseScale * (0.4 + k) : (0.4 + k));
    }
  }

  // Ability 1: Leaf Tornado — a joyful spin that flings glittering leaves
  function doTwirl() {
    if (p.twirlT > 0.2) return;
    p.twirlT = 1.0;
    PIP.audio.play('whoosh');
    PIP.audio.play('chime');
    if (PIP.save.settings.chatter) PIP.narrate.callout('Wheee! Leaf tornado!');
    var A = PIP.assets;
    for (var i = 0; i < 14; i++) {
      var leaf = A.makeLeaf(U.rand(0.14, 0.24));
      var a = i / 14 * Math.PI * 2;
      leaf.position.set(p.pos.x + Math.cos(a) * 0.4, p.pos.y + 0.6, p.pos.z + Math.sin(a) * 0.4);
      leaf.rotation.z = a;
      var part = p.particles;
      spawnParticle(leaf, Math.cos(a) * U.rand(2, 4), U.rand(3, 6), Math.sin(a) * U.rand(2, 4), U.rand(0.9, 1.4), U.rand(6, 12));
      part[part.length - 1].baseScale = 1;
    }
    if (PIP.save.grantBadge && !PIP.save.data.badges.twirl) { /* not a badge, just fun */ }
  }

  // Ability 2: Sparkle Burst — a fountain of rainbow sparkles + a happy chime
  function doSparkle() {
    if (p.sparkleCooldown > 0) return;
    p.sparkleCooldown = 0.5;
    PIP.audio.play('success');
    if (PIP.save.settings.chatter) PIP.narrate.callout('Sparkle blast!');
    var A = PIP.assets;
    var cols = [0xff7fb0, 0xffd257, 0x8fd8ff, 0x9be89b, 0xc9a6ff, 0xff9e6b];
    for (var i = 0; i < 22; i++) {
      var col = cols[i % cols.length];
      var m = new THREE.Mesh(A.GEO.sphere, A.mat(col, { emissive: col, emissiveIntensity: 0.85 }));
      m.scale.setScalar(0.12);
      m.position.set(p.pos.x + U.rand(-0.3, 0.3), p.pos.y + 0.5, p.pos.z + U.rand(-0.3, 0.3));
      spawnParticle(m, U.rand(-3, 3), U.rand(5, 9), U.rand(-3, 3), U.rand(0.8, 1.3), 0);
      p.particles[p.particles.length - 1].baseScale = 0.12;
    }
    p.twirlT = Math.max(p.twirlT, 0.35); // a little happy hop-spin too
  }

  /* ---------- ground & collision ---------- */
  function supportAt(world, x, z, feetY) {
    var g = world.terrain(x, z);
    var plats = world.platforms;
    for (var i = 0; i < plats.length; i++) {
      var pl = plats[i];
      if (pl.disabled) continue;
      if (x >= pl.minX && x <= pl.maxX && z >= pl.minZ && z <= pl.maxZ) {
        if (pl.topY <= feetY + 0.5 && pl.topY > g) g = pl.topY;
      }
    }
    return g;
  }
  function collide(world) {
    var R = 0.42;
    // circle obstacles
    var cols = world.colliders;
    for (var i = 0; i < cols.length; i++) {
      var c = cols[i];
      if (c.disabled) continue;
      var dx = p.pos.x - c.x, dz = p.pos.z - c.z;
      var d2 = dx * dx + dz * dz, min = (c.r + R);
      if (d2 < min * min && d2 > 0.0001) {
        if (c.topY != null && p.pos.y >= c.topY - 0.1) continue; // standing on top of it
        var d = Math.sqrt(d2);
        p.pos.x = c.x + dx / d * min;
        p.pos.z = c.z + dz / d * min;
      }
    }
    // platform sides act as walls when Pip is below the top
    var plats = world.platforms;
    for (var j = 0; j < plats.length; j++) {
      var pl = plats[j];
      if (pl.disabled || pl.noWall) continue;
      if (p.pos.y + 0.5 >= pl.topY) continue;
      if (pl.bottomY != null && p.pos.y > pl.topY) continue;
      var ex = 0; // expand by radius
      if (p.pos.x > pl.minX - R && p.pos.x < pl.maxX + R && p.pos.z > pl.minZ - R && p.pos.z < pl.maxZ + R) {
        var pushL = p.pos.x - (pl.minX - R), pushR = (pl.maxX + R) - p.pos.x;
        var pushB = p.pos.z - (pl.minZ - R), pushF = (pl.maxZ + R) - p.pos.z;
        var m = Math.min(pushL, pushR, pushB, pushF);
        if (m === pushL) p.pos.x = pl.minX - R;
        else if (m === pushR) p.pos.x = pl.maxX + R;
        else if (m === pushB) p.pos.z = pl.minZ - R;
        else p.pos.z = pl.maxZ + R;
      }
    }
    // world bounds
    if (world.bounds) {
      p.pos.x = U.clamp(p.pos.x, world.bounds.minX, world.bounds.maxX);
      p.pos.z = U.clamp(p.pos.z, world.bounds.minZ, world.bounds.maxZ);
    }
  }
  function waterAt(world, x, z) {
    var ws = world.water || [];
    for (var i = 0; i < ws.length; i++) {
      var w = ws[i];
      if (x >= w.minX && x <= w.maxX && z >= w.minZ && z <= w.maxZ) return w;
    }
    return null;
  }

  /* ---------- per-frame ---------- */
  function update(dt, world, inp) {
    updateParticles(dt);
    if (p.twirlT > 0) p.twirlT = Math.max(0, p.twirlT - dt);
    if (p.sparkleCooldown > 0) p.sparkleCooldown = Math.max(0, p.sparkleCooldown - dt);
    if (p.frozen) { syncMesh(dt); return; } // build mode / cutscenes steer the camera themselves
    var s = inp.state;

    // camera-relative input
    var mx = s.moveX, mz = s.moveZ;
    var mag = Math.hypot(mx, mz);
    var yaw = p.cam.yaw;
    var wishX = 0, wishZ = 0;
    if (mag > 0.05) {
      // -mx so screen-left/right match the key pressed (was inverted)
      var ang = Math.atan2(-mx, -mz) + yaw + Math.PI;
      wishX = Math.sin(ang) * Math.min(1, mag);
      wishZ = Math.cos(ang) * Math.min(1, mag);
      p.facing = U.angleLerp(p.facing, ang, Math.min(1, dt * 12));
    }

    var speed = p.carrying ? RUN * 0.72 : (p.swimming ? RUN * 0.5 : RUN);
    var ctrl = p.grounded || p.swimming ? 1 : AIR_CTRL;
    p.vel.x = U.lerp(p.vel.x, wishX * speed, Math.min(1, ACCEL * ctrl * dt / speed * 2));
    p.vel.z = U.lerp(p.vel.z, wishZ * speed, Math.min(1, ACCEL * ctrl * dt / speed * 2));

    // jumping
    if (s.jumpPressed) p.buffer = BUFFER;
    else p.buffer = Math.max(0, p.buffer - dt);
    p.coyote = p.grounded ? COYOTE : Math.max(0, p.coyote - dt);

    if (p.buffer > 0) {
      if (p.swimming) {
        p.vel.y = JUMP_V * 0.85; p.swimming = false; p.buffer = 0; p.jumps = 1;
        PIP.audio.play('splash');
      } else if (p.coyote > 0) {
        p.vel.y = JUMP_V; p.grounded = false; p.coyote = 0; p.buffer = 0; p.jumps = 1;
        p.anim.squash = -0.25;
        PIP.audio.play('jump');
      } else if (p.jumps === 1) {
        p.vel.y = JUMP_V * 0.92; p.jumps = 2; p.buffer = 0;
        p.flutterT = 0;
        PIP.audio.play('jump');
      }
    }
    // flutter: hold jump while falling after using both jumps
    p.fluttering = false;
    if (!p.grounded && !p.swimming && p.jumps >= 2 && s.jumpHeld && p.vel.y < 0 && p.flutterT < 1.1) {
      p.vel.y = Math.max(p.vel.y, -1.6);
      p.flutterT += dt;
      p.fluttering = true;
    }
    // stomp: X, or the DO button while airborne
    if (!p.grounded && !p.swimming && (s.stompPressed || (s.actPressed && p.vel.y < 2 && !nearInteractable))) {
      if (!p.stomping) { p.stomping = true; p.vel.y = -20; PIP.audio.play('whoosh'); }
    }

    // gravity & integrate
    if (!p.swimming) p.vel.y -= G * dt;
    p.pos.x += p.vel.x * dt;
    p.pos.z += p.vel.z * dt;
    p.pos.y += p.vel.y * dt;

    collide(world);

    // ground contact
    var ground = supportAt(world, p.pos.x, p.pos.z, p.pos.y);
    var wasGrounded = p.grounded;
    if (p.pos.y <= ground + 0.001) {
      p.pos.y = ground;
      if (!wasGrounded && p.vel.y < -3) {
        p.anim.land = 0.28;
        PIP.audio.play(p.stomping ? 'stomp' : 'land');
        if (p.stomping && world.onStomp) world.onStomp(p.pos.x, p.pos.z);
      }
      p.vel.y = 0;
      p.grounded = true; p.jumps = 0; p.stomping = false; p.flutterT = 0;
    } else if (p.pos.y > ground + 0.05) {
      p.grounded = false;
    }

    // water
    var w = waterAt(world, p.pos.x, p.pos.z);
    if (w && ground < w.y - 0.35 && p.pos.y <= w.y - 0.2) {
      if (!p.swimming) { PIP.audio.play('splash'); p.swimming = true; }
      p.pos.y = w.y - 0.25 + Math.sin(p.anim.t * 3) * 0.05;
      p.vel.y = 0; p.jumps = 0; p.stomping = false;
    } else p.swimming = false;

    // safe spot + fall rescue
    if (p.grounded && !p.swimming) {
      p.safeT += dt;
      if (p.safeT > 0.6) { p.lastSafe.copy(p.pos); p.safeT = 0; }
    } else p.safeT = 0;
    if (p.pos.y < (world.killY != null ? world.killY : -18) && !p.respawning) {
      p.respawning = true;
      PIP.ui.fade(true).then(function () {
        p.pos.copy(p.lastSafe); p.vel.set(0, 0, 0); p.grounded = true; p.jumps = 0;
        PIP.ui.fade(false);
        PIP.narrate.callout('Whoops! Up you pop, Pip.');
        p.respawning = false;
      });
    }

    p.anim.t += dt * (1 + Math.hypot(p.vel.x, p.vel.z) * 0.35);
    p.anim.squash = U.lerp(p.anim.squash, 0, Math.min(1, dt * 8));
    p.anim.land = Math.max(0, p.anim.land - dt);

    syncMesh(dt);
    updateCamera(dt, inp, world);
  }

  var nearInteractable = false; // set from main each frame so DO in mid-air can stomp
  function setNearInteractable(v) { nearInteractable = v; }

  function syncMesh(dt) {
    var g = p.group;
    g.position.copy(p.pos);
    // Leaf-Tornado twirl: spin fast on top of the normal facing (cosmetic)
    var twirlSpin = p.twirlT > 0 ? p.twirlT * p.twirlT * 26 : 0;
    p.spinExtra = (p.spinExtra + twirlSpin * dt) % (Math.PI * 2);
    g.rotation.y = p.facing + (p.twirlT > 0 ? p.spinExtra : 0);
    var ud = g.userData;
    var moving = Math.hypot(p.vel.x, p.vel.z) > 0.6;
    var bob = moving && p.grounded ? Math.abs(Math.sin(p.anim.t * 9)) * 0.08 : 0;
    if (p.twirlT > 0) bob += Math.sin((1 - p.twirlT) * Math.PI) * 0.35; // little hop during the twirl
    g.position.y += bob;
    var squash = 1 + p.anim.squash - (p.anim.land > 0 ? 0.22 * (p.anim.land / 0.28) : 0);
    g.scale.set(1 / Math.sqrt(squash), squash, 1 / Math.sqrt(squash));
    if (ud.tail) {
      if (p.fluttering) ud.tail.rotation.y += dt * 40;
      else { ud.tail.rotation.y = 0; ud.tail.rotation.x = Math.sin(p.anim.t * 3) * 0.2; }
    }
    if (ud.footL && p.grounded && moving) {
      ud.footL.position.z = 0.03 + Math.sin(p.anim.t * 9) * 0.16;
      ud.footR.position.z = 0.03 - Math.sin(p.anim.t * 9) * 0.16;
    } else if (ud.footL) { ud.footL.position.z = 0.03; ud.footR.position.z = 0.03; }
    // carried object rides above Pip's head
    if (p.carrying) {
      p.carrying.position.set(p.pos.x, p.pos.y + 1.75 + bob, p.pos.z);
      p.carrying.rotation.y = p.facing;
    }
  }

  /* ---------- camera ---------- */
  var camTarget = new THREE.Vector3();
  function updateCamera(dt, inp, world) {
    var cam = PIP.game.camera;
    var s = inp.state;
    var c = p.cam;
    if (Math.abs(s.camDX) > 0.0001 || Math.abs(s.camDY) > 0.0001) {
      c.yaw -= s.camDX; c.pitch = U.clamp(c.pitch + s.camDY, 0.12, 1.1);
      c.idleT = 0;
    } else c.idleT += dt;
    // helpful camera: drift back behind Pip while running
    if (PIP.save.settings.assistCam && c.idleT > 1.2 && Math.hypot(p.vel.x, p.vel.z) > 2) {
      c.yaw = U.angleLerp(c.yaw, p.facing + Math.PI, Math.min(1, dt * 1.4));
    }
    var target = camTarget.set(p.pos.x, p.pos.y + 1.6, p.pos.z);
    var cx = target.x + Math.sin(c.yaw) * Math.cos(c.pitch) * c.dist;
    var cz = target.z + Math.cos(c.yaw) * Math.cos(c.pitch) * c.dist;
    var cy = target.y + Math.sin(c.pitch) * c.dist;
    // keep camera above the ground
    if (world) {
      var gy = world.terrain(cx, cz) + 0.6;
      if (cy < gy) cy = gy;
    }
    var k = Math.min(1, dt * 6);
    cam.position.x = U.lerp(cam.position.x, cx, k);
    cam.position.y = U.lerp(cam.position.y, cy, k);
    cam.position.z = U.lerp(cam.position.z, cz, k);
    cam.lookAt(target);
  }

  function carry(obj) { p.carrying = obj; }
  function drop() { var o = p.carrying; p.carrying = null; return o; }

  return {
    create: create, update: update, teleport: teleport, supportAt: supportAt,
    carry: carry, drop: drop, setNearInteractable: setNearInteractable,
    doTwirl: doTwirl, doSparkle: doSparkle,
    get state() { return p; }
  };
})();
