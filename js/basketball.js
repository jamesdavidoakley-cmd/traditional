/* ============================================================
   PIG SPORTS — BASKETBALL (2 v 2)
   Jump-shot model based on real shooting biomechanics: release
   just before the apex of the jump, ~45–52° launch arc with
   backspin, higher release = harder to block. Layups, dunks,
   blocks, steals, passes and live rebounds off a physical rim.
   ============================================================ */
(function () {
  'use strict';
  const V3 = (x, y, z) => new THREE.Vector3(x, y, z);

  // court (metres) — compact street court for 2v2 pace
  const HW = 7.0;          // half width  (x)
  const HL = 11.0;         // half length (z)
  const RIM_H = 3.05, RIM_R = 0.23, BALL_R = 0.123;
  const RIM_Z = HL - 1.575;      // rim centre distance from centre
  const BOARD_Z = HL - 1.2;
  const THREE_R = 5.8;           // 3-point distance from rim
  const G = 9.81;

  const DIFF = {
    easy:   { speed: 2.9, shot: 0.7,  steal: 0.1,  block: 0.08, iq: 0.5, name: 'Hamlet',    icon: '🐖' },
    normal: { speed: 4.1, shot: 0.95, steal: 0.22, block: 0.2,  iq: 0.75, name: 'Trotsky',   icon: '🐗' },
    hard:   { speed: 5.4, shot: 1.15, steal: 0.4,  block: 0.45, iq: 1.0,  name: 'Kong Bros.', icon: '🦍' },
  };

  let S = null;

  /* ---------------- court & hoops ---------------- */
  function buildCourt(scene) {
    const padW = 2.2, padL = 2.4;
    const w = (HW + padW) * 2, l = (HL + padL) * 2;
    const tex = PS.canvasTexture(1024, 1536, (ctx, cw, ch) => {
      const sx = cw / w, sy = ch / l;
      const X = (x) => (x + HW + padW) * sx, Y = (z) => (z + HL + padL) * sy;
      // wooden planks
      ctx.fillStyle = '#c98d4f'; ctx.fillRect(0, 0, cw, ch);
      for (let i = 0; i < 40; i++) {
        ctx.fillStyle = `rgba(${120 + Math.random() * 60 | 0},${70 + Math.random() * 40 | 0},30,.18)`;
        ctx.fillRect(0, (ch / 40) * i, cw, ch / 40 - 2);
      }
      ctx.strokeStyle = '#fdf6ea'; ctx.lineWidth = 6; ctx.lineCap = 'round';
      const rect = (x, z, ww, ll) => ctx.strokeRect(X(x), Y(z), ww * sx, ll * sy);
      rect(-HW, -HL, HW * 2, HL * 2);                       // boundary
      ctx.beginPath(); ctx.moveTo(X(-HW), Y(0)); ctx.lineTo(X(HW), Y(0)); ctx.stroke();  // half-court
      // centre circle + pig logo
      ctx.beginPath(); ctx.arc(X(0), Y(0), 1.8 * sx, 0, 7); ctx.stroke();
      ctx.fillStyle = 'rgba(255,127,168,.85)';
      ctx.beginPath(); ctx.arc(X(0), Y(0), 1.1 * sx, 0, 7); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.ellipse(X(0), Y(0), 0.55 * sx, 0.42 * sy, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#e75480';
      ctx.beginPath(); ctx.arc(X(-0.18), Y(0), 0.1 * sx, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.arc(X(0.18), Y(0), 0.1 * sx, 0, 7); ctx.fill();
      for (const zs of [-1, 1]) {
        const rz = RIM_Z * zs;
        // painted key
        ctx.fillStyle = 'rgba(231,84,128,.55)';
        ctx.fillRect(X(-1.8), Y(Math.min(rz + 0, HL * zs === -HL ? 0 : 0)), 0, 0); // noop guard
        const keyLen = 4.2;
        const zTop = zs > 0 ? HL - keyLen : -HL;
        ctx.fillRect(X(-1.8), Y(zTop), 3.6 * sx, keyLen * sy);
        ctx.strokeRect(X(-1.8), Y(zTop), 3.6 * sx, keyLen * sy);
        // free-throw circle
        ctx.beginPath(); ctx.arc(X(0), Y(zs * (HL - keyLen)), 1.5 * sx, 0, 7); ctx.stroke();
        // 3-point arc
        ctx.beginPath();
        ctx.arc(X(0), Y(rz), THREE_R * sx, zs > 0 ? Math.PI : 0, zs > 0 ? 2 * Math.PI : Math.PI);
        ctx.stroke();
      }
    });
    const court = new THREE.Mesh(new THREE.PlaneGeometry(w, l),
      new THREE.MeshStandardMaterial({ map: tex, roughness: 0.55 }));
    court.rotation.x = -Math.PI / 2;
    court.receiveShadow = true;
    scene.add(court);

    // hoops
    S.hoops = [];
    for (const zs of [-1, 1]) {
      const g = new THREE.Group();
      // stanchion — the near hoop's is ghosted so it never blocks the camera
      const stanM = PS.std(0x37415e, 0.5, 0.5);
      if (zs > 0) { stanM.transparent = true; stanM.opacity = 0.25; stanM.depthWrite = false; }
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 3.6, 10), stanM);
      pole.position.set(0, 1.8, zs * (HL + 0.9)); g.add(pole);
      const armLen = (HL + 0.9) - BOARD_Z;
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, armLen + 0.2), stanM);
      arm.position.set(0, 3.45, zs * (BOARD_Z + armLen / 2)); g.add(arm);
      // backboard
      const boardTex = PS.canvasTexture(256, 160, (ctx, cw, ch) => {
        ctx.fillStyle = 'rgba(235,242,255,.94)'; ctx.fillRect(0, 0, cw, ch);
        ctx.strokeStyle = '#e2542f'; ctx.lineWidth = 8; ctx.strokeRect(6, 6, cw - 12, ch - 12);
        ctx.strokeRect(cw * 0.36, ch * 0.52, cw * 0.28, ch * 0.3);
      });
      const boardM = new THREE.MeshStandardMaterial({ map: boardTex, roughness: 0.35 });
      if (zs > 0) { boardM.transparent = true; boardM.opacity = 0.55; }   // see through the near board
      const board = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 1.05), boardM);
      board.position.set(0, 3.42, zs * BOARD_Z);
      board.rotation.y = zs > 0 ? Math.PI : 0;
      g.add(board);
      // rim
      const rim = new THREE.Mesh(new THREE.TorusGeometry(RIM_R, 0.02, 10, 24), PS.std(0xe2542f, 0.35, 0.6));
      rim.rotation.x = Math.PI / 2;
      rim.position.set(0, RIM_H, zs * RIM_Z);
      g.add(rim);
      // net
      const netTex = PS.canvasTexture(128, 128, (ctx, cw, ch) => {
        ctx.clearRect(0, 0, cw, ch);
        ctx.strokeStyle = 'rgba(250,252,255,.95)'; ctx.lineWidth = 4;
        for (let i = 0; i < 8; i++) {
          ctx.beginPath(); ctx.moveTo((i / 8) * cw, 0); ctx.lineTo(((i + 0.5) / 8) * cw, ch); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(((i + 1) / 8) * cw, 0); ctx.lineTo(((i + 0.5) / 8) * cw, ch); ctx.stroke();
        }
      });
      const net = new THREE.Mesh(new THREE.CylinderGeometry(RIM_R, 0.14, 0.42, 12, 1, true),
        new THREE.MeshBasicMaterial({ map: netTex, transparent: true, side: THREE.DoubleSide, depthWrite: false }));
      net.position.set(0, RIM_H - 0.23, zs * RIM_Z);
      g.add(net);
      g.traverse((o) => { if (o.isMesh && o !== net) o.castShadow = true; });
      scene.add(g);
      S.hoops.push({ zs, rim: V3(0, RIM_H, zs * RIM_Z), net, netPulse: 0, boardZ: zs * BOARD_Z });
    }
  }

  function makeBBall(scene) {
    const tex = PS.canvasTexture(256, 256, (ctx, w, h) => {
      ctx.fillStyle = '#e07a33'; ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#3d2314'; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.moveTo(w / 2, 0); ctx.lineTo(w / 2, h); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, h / 2); ctx.lineTo(w, h / 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(-w * 0.15, h / 2, w * 0.55, -1, 1); ctx.stroke();
      ctx.beginPath(); ctx.arc(w * 1.15, h / 2, w * 0.55, Math.PI - 1, Math.PI + 1); ctx.stroke();
    });
    const m = new THREE.Mesh(new THREE.SphereGeometry(BALL_R, 20, 16),
      new THREE.MeshStandardMaterial({ map: tex, roughness: 0.65 }));
    m.castShadow = true;
    scene.add(m);
    return m;
  }

  /* ---------------- poses ---------------- */
  function resetPose(j) {
    j.body.rotation.set(0, 0, 0); j.head.rotation.set(0, 0, 0);
    j.armL.rotation.set(0, 0, 0.18); j.armR.rotation.set(0, 0, -0.18);
    j.elbowL.rotation.set(-0.35, 0, 0); j.elbowR.rotation.set(-0.35, 0, 0);
    j.handL.rotation.set(0, 0, 0); j.handR.rotation.set(0, 0, 0);
  }
  // p<0: gather/crouch · 0..1: extend, release, follow-through
  function poseShoot(j, p) {
    if (p < 0) {
      j.armR.rotation.set(2.0, 0, -0.25); j.elbowR.rotation.x = -2.0;
      j.armL.rotation.set(1.7, 0, 0.35); j.elbowL.rotation.x = -1.6;
      j.body.rotation.x = 0.12;
    } else {
      const k = p < 0.7 ? 1 : 1 - (p - 0.7) / 0.3;
      const up = Math.min(1, p * 2.5);
      j.armR.rotation.set((2.0 + 0.9 * up) * k, 0, -0.12 * k - 0.18 * (1 - k));
      j.elbowR.rotation.x = (-2.0 + 1.8 * up) * k - 0.35 * (1 - k);
      j.handR.rotation.x = -1.1 * Math.max(0, up - 0.6) * k;   // wrist snap → backspin
      j.armL.rotation.set((1.7 - 1.2 * up) * k, 0, 0.35 * k + 0.18 * (1 - k));
      j.elbowL.rotation.x = (-1.6 + 1.2 * up) * k - 0.35 * (1 - k);
      j.body.rotation.x = 0.12 * (1 - up) * k;
    }
  }
  function poseDunk(j, p) {
    const k = p < 0.75 ? 1 : 1 - (p - 0.75) / 0.25;
    const wind = Math.min(1, p * 2.0), slam = Math.max(0, p * 2.0 - 1);
    j.armR.rotation.set((2.4 + 0.8 * wind - 2.2 * slam) * k, 0, -0.2);
    j.armL.rotation.set((2.4 + 0.8 * wind - 2.2 * slam) * k, 0, 0.2);
    j.elbowR.rotation.x = -0.3 * k; j.elbowL.rotation.x = -0.3 * k;
    j.body.rotation.x = 0.25 * slam * k;
  }
  function poseGuard(j, t) {
    j.armL.rotation.set(0.4, 0, 1.15 + Math.sin(t * 5) * 0.08);
    j.armR.rotation.set(0.4, 0, -1.15 - Math.sin(t * 5 + 1) * 0.08);
    j.elbowL.rotation.x = -0.5; j.elbowR.rotation.x = -0.5;
  }
  function poseDribble(j, t) {
    j.armR.rotation.set(0.75 + Math.sin(t * 9) * 0.3, 0, -0.3);
    j.elbowR.rotation.x = -0.5;
  }
  function poseBlock(j) {
    j.armR.rotation.set(3.05, 0, -0.12); j.elbowR.rotation.x = -0.08;
    j.armL.rotation.set(2.9, 0, 0.2); j.elbowL.rotation.x = -0.2;
  }

  /* ---------------- match setup ---------------- */
  PS.modes.basketball = {
    start(cfg) {
      const scene = new THREE.Scene();
      const cam = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 400);
      S = { cfg, scene, cam, t: 0 };
      S.d = DIFF[cfg.difficulty];
      S.stadium = PS.makeStadium(scene, { innerW: HW + 3, innerL: HL + 3.4,
        theme: { board: '#7a3fb0', ground: 0x3a3d52, skyTop: '#2c2a66', skyMid: '#7c5db8', skyBot: '#f9c46a', fog: 0xc7a6e0 } });
      buildCourt(scene);

      const mate = PS.choice(PS.PIGS.filter((p) => p !== cfg.pig));
      const mkP = (def, team, isUser, x, z) => {
        const ch = PS.makePig(def);
        scene.add(ch);
        return { ch, def, team, isUser, x, z, y: 0, vy: 0, jumping: false, releaseFrac: 0,
          scale: ch.userData.dims.scale, reach: ch.userData.dims.reach,
          speed: 3.7 + 2.4 * def.stats.speed, stats: def.stats,
          anim: null, move: 0, face: 0, cd: 0, stumble: 0, aiT: Math.random() };
      };
      const mkOpp = (x, z, idx) => {
        let ch, stats;
        if (cfg.difficulty === 'hard') { ch = PS.makeMonkey({ scale: 1.85 }); stats = { speed: 0.9, power: 1, touch: 0.9 }; }
        else {
          const def = PS.choice(PS.PIGS);
          ch = PS.makePig(def, { scale: cfg.difficulty === 'easy' ? 0.92 : 1.02 });
          stats = def.stats;
        }
        scene.add(ch);
        return { ch, team: 'B', isUser: false, x, z, y: 0, vy: 0, jumping: false, releaseFrac: 0,
          scale: ch.userData.dims.scale, reach: ch.userData.dims.reach,
          speed: S.d.speed, stats, anim: null, move: 0, face: 0, cd: 0, stumble: 0, aiT: Math.random() * 2 };
      };
      S.players = [
        mkP(cfg.pig, 'A', true, -1.2, 8.2),
        mkP(mate, 'A', false, 2.2, 6.5),
        mkOpp(-1.5, -3), mkOpp(2, -5),
      ];
      S.A = [S.players[0], S.players[1]];
      S.B = [S.players[2], S.players[3]];

      S.ballMesh = makeBBall(scene);
      S.trail = new PS.Trail(scene, 0xffb066, 0.05, 10);
      S.particles = new PS.Particles(scene);

      // controlled-player indicator
      S.ring = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.55, 28),
        new THREE.MeshBasicMaterial({ color: PS.C(0xffcf5c), transparent: true, opacity: 0.85 }));
      S.ring.rotation.x = -Math.PI / 2; S.ring.position.y = 0.02;
      scene.add(S.ring);

      S.ball = { pos: V3(0, 1, 8), vel: V3(0, 0, 0), state: 'held', holder: S.players[0],
                 shot: null, lastTeam: 'A', spinAxis: new THREE.Vector3(1, 0, 0), spinRate: 0 };
      S.score = { A: 0, B: 0 };
      S.clock = 120; S.timeUp = false; S.golden = false;
      S.state = 'intro'; S.stateT = 0;
      S.stats = { dunks: 0, threes: 0, blocks: 0, steals: 0 };
      S.userP = S.players[0];
      S.switchCd = 0;
      S.camPos = V3(0, 6, 18); S.camLook = V3(0, 1, 0); S.shakeV = V3(0, 0, 0);
      S.dribbleT = 0;

      const d = S.d;
      PS.hud.setNames(cfg.pig.name + ' & ' + mate.name, cfg.pig.emoji, d.name, d.icon);
      PS.hud.setScore(0, 0);
      PS.hud.setTimer(120, 'TIME');
      PS.setTouchLabels('SHOOT', 'PASS', '');
      PS.popup(cfg.difficulty === 'hard' ? 'THE KONG BROTHERS HAVE ARRIVED 🦍🦍' : 'FIRST TO THE BUZZER!', 'gold', 2200);
      if (cfg.difficulty === 'hard') PS.audio.play('ook');
      updateHint();
    },

    onResize() { if (S) { S.cam.aspect = innerWidth / innerHeight; S.cam.updateProjectionMatrix(); } },

    update(dt, t) {
      if (!S) return;
      S.t = t;
      S.stateT += dt;
      if (S.state === 'intro' && S.stateT > 1.3) { S.state = 'live'; }
      if (S.state === 'live') {
        if (!S.timeUp) {
          S.clock -= dt;
          if (S.clock <= 0) {
            S.clock = 0; S.timeUp = true;
            PS.audio.play('whistle');
            if (S.score.A === S.score.B) { S.golden = true; PS.popup('GOLDEN BUCKET!', 'gold', 2200); PS.hud.setTimer(0, 'GOLDEN'); }
            else PS.popup('TIME! Last play…', 'blue', 1500);
          }
          PS.hud.setTimer(S.clock, S.golden ? 'GOLDEN' : undefined);
        }
        updateControl(dt);
        updateAI(dt);
        stepBall(dt);
        // buzzer: a shot in the air still counts, then the game ends
        if (S.timeUp && !S.golden && S.ball.state !== 'flight' && S.ball.state !== 'made') finishMatch();
      } else if (S.state === 'score') {
        stepBall(dt);
        if (S.stateT > 1.5) { if (S.timeUp) finishMatch(); else doInbound(); }
      }
      updatePlayers(dt, t);
      S.stadium.update(t, dt);
      S.particles.update(dt);
      S.trail.update();
      for (const h of S.hoops) {
        h.netPulse = Math.max(0, h.netPulse - dt * 3);
        h.net.scale.set(1 + h.netPulse * 0.25, 1 - h.netPulse * 0.3, 1 + h.netPulse * 0.25);
      }
      updateCamera(dt);
      PS.renderer.render(S.scene, S.cam);
    },

    dispose() { if (S) { PS.disposeScene(S.scene); S = null; } },
  };

  function updateHint() {
    const onO = S.ball.holder && S.ball.holder.team === 'A';
    PS.hud.setHint(onO
      ? '<b>WASD</b> move · hold <b>SPACE</b> to jump, release at the <b>TOP</b> to shoot! · <b>X</b> pass · drive close for layups &amp; dunks'
      : '<b>WASD</b> move · <b>SPACE</b> jump to block · <b>X</b> steal');
  }

  const rimFor = (team) => S.hoops[team === 'A' ? 0 : 1].rim; // A attacks -z hoop (index 0)
  const distXZ = (a, b) => Math.hypot(a.x - b.x, (a.z !== undefined ? a.z : a.pos.z) - b.z);

  /* ---------------- user control ---------------- */
  function updateControl(dt) {
    const ball = S.ball;
    S.switchCd -= dt;
    // pick the controlled pig: holder on offence, nearest on defence
    if (ball.holder && ball.holder.team === 'A') S.userP = ball.holder;
    else if (S.switchCd <= 0) {
      const near = S.A.reduce((m, p) => (dxzBall(p) < dxzBall(m) ? p : m), S.A[0]);
      if (near !== S.userP) { S.userP = near; S.switchCd = 0.4; }
    }
    const u = S.userP;
    if (u.stumble > 0) return;

    const ax = PS.input.axisX(), ay = PS.input.axisY();
    const mv = Math.hypot(ax, ay);
    if (mv > 0.01 && !(u.anim && u.anim.type === 'shoot')) {
      const spd = u.speed * (ball.holder === u ? 0.92 : 1);
      u.x = PS.clamp(u.x + ax * spd * dt, -HW + 0.3, HW - 0.3);
      u.z = PS.clamp(u.z + ay * spd * dt, -HL + 0.3, HL - 0.3);
      u.move = PS.clamp(mv, 0, 1);
      u.face = Math.atan2(ax, ay);
    }

    const hasBall = ball.holder === u;
    if (hasBall) {
      const rim = rimFor('A');
      const dRim = distXZ(u, rim);
      // hold to jump, release at the top — the real jump-shot rhythm
      if (PS.input.wasPressed('A') && !u.jumping) {
        u.jumping = true; u.vy = 4.9; u.jumpShot = true;
        u.anim = { type: 'shoot', phase: -1, t: 0 };
        u.ch.userData.armsBusy = true;
        if (dRim < 1.35) { // close enough to throw one down
          u.dunking = true;
          u.anim = { type: 'dunk', phase: 0, t: 0, dur: 0.55 };
        } else {
          PS.hud.meterShow(0.76, 0.97);
        }
      }
      if (u.jumping && u.jumpShot && !u.dunking) {
        const frac = 1 - u.vy / 4.9;             // 1.0 exactly at the apex
        PS.hud.meterSet(PS.clamp(frac, 0, 1));
        if (PS.input.wasReleased('A')) {
          PS.hud.meterHide();
          releaseShot(u, PS.clamp(frac, 0, 1.6));
        }
      }
      if (PS.input.wasPressed('B') && !u.jumping) {
        passBall(u, S.A.find((p) => p !== u));
      }
    } else if (!ball.holder || ball.holder.team === 'B') {
      // defence
      if (PS.input.wasPressed('A') && !u.jumping && u.cd <= 0) {
        u.jumping = true; u.vy = 5.1; u.blockJump = true;
        u.anim = { type: 'block', t: 0 };
        u.ch.userData.armsBusy = true;
        tryBlock(u);
      }
      if (PS.input.wasPressed('B') && u.cd <= 0) {
        trySteal(u);
      }
    } else if (!ball.holder && ball.state === 'loose') {
      // scramble handled by pickup radius below
    }
  }

  function dxzBall(p) { return Math.hypot(p.x - S.ball.pos.x, p.z - S.ball.pos.z); }

  /* ---------------- actions ---------------- */
  function releaseShot(sh, frac) {
    const ball = S.ball;
    if (ball.holder !== sh) return;
    const rim = rimFor(sh.team);
    const dRim = distXZ(sh, rim);
    const isLayup = dRim < 2.2;
    // timing: ideal is just before the apex (frac ≈ 0.93)
    const q = PS.clamp(1 - Math.abs(frac - 0.93) / 0.4, 0, 1);
    const pts = dRim > THREE_R ? 3 : 2;

    let base = isLayup ? 0.88 : dRim < 3.5 ? 0.62 : dRim < THREE_R ? 0.53 : dRim < 8 ? 0.45 : 0.2;
    let p = base * (0.45 + 0.8 * (isLayup ? Math.max(q, 0.75) : q));
    p *= 0.8 + 0.38 * (sh.stats ? sh.stats.touch : 0.8);
    if (sh.team === 'B') p *= S.d.shot;
    // contest
    const defTeam = sh.team === 'A' ? S.B : S.A;
    let contested = false;
    for (const df of defTeam) {
      const dd = Math.hypot(df.x - sh.x, df.z - sh.z);
      if (dd < 1.3) { p *= df.y > 0.25 ? 0.45 : 0.68; contested = true; }
      else if (dd < 2.2) p *= 0.88;
    }
    launchShot(sh, rim, PS.clamp(p, 0.03, 0.97), pts, frac, q, contested, false);
  }

  function launchShot(sh, rim, prob, pts, frac, q, contested, isDunk) {
    const ball = S.ball;
    ball.holder = null;
    const from = V3(sh.x, releaseHeight(sh), sh.z);
    ball.pos.copy(from);
    const made = Math.random() < prob;
    const dRim = distXZ(sh, rim);
    // target: centre if made; rim edge biased short (early) / long (late) if missed
    const target = rim.clone();
    if (!made) {
      const longShort = (frac < 0.9 ? -1 : 1) * PS.rand(0.12, 0.4);
      const side = PS.rand(-0.25, 0.25);
      const dir = V3(rim.x - sh.x, 0, rim.z - sh.z).normalize();
      target.addScaledVector(dir, longShort);
      target.x += side * Math.abs(dir.z); target.z += side * Math.abs(dir.x);
    }
    // flight time tuned for a ~45–52° entry arc
    const T = PS.clamp(0.55 + dRim * 0.11, 0.6, 1.35);
    ball.vel.set((target.x - from.x) / T, (target.y - from.y + 0.5 * G * T * T) / T, (target.z - from.z) / T);
    ball.state = 'flight';
    ball.shot = { team: sh.team, pts, made, T, t: 0, q, rim, shooter: sh };
    ball.spinRate = -9; // backspin
    S.trail.clear();
    PS.audio.play('whoosh');
    if (sh.isUser) {
      if (q > 0.85) PS.popup('PERFECT RELEASE!', 'small gold', 800);
      else if (frac > 1.25) PS.popup('LATE!', 'small red', 700);
    }
    // block window at release
    const defTeam = sh.team === 'A' ? S.B : S.A;
    for (const df of defTeam) {
      if (df.y > 0.3 && Math.hypot(df.x - sh.x, df.z - sh.z) < 1.15 + df.reach * 0.4) {
        const bp = df.isUser ? 0.55 : S.d.block;
        if (Math.random() < bp) doBlock(df);
        break;
      }
    }
  }

  function releaseHeight(sh) { return 1.35 * sh.scale + sh.y + 0.55; }

  function doBlock(df) {
    const ball = S.ball;
    ball.state = 'loose'; ball.shot = null;
    ball.vel.set(PS.rand(-3, 3), PS.rand(1, 3), (df.team === 'A' ? 1 : -1) * PS.rand(2, 5));
    PS.popup('BLOCKED! 🚫', df.team === 'A' ? 'green' : 'red', 1200);
    PS.audio.play('board'); PS.shake(0.2);
    S.stadium.cheer(0.8);
    if (df.isUser || df.team === 'A') S.stats.blocks++;
    if (df.team === 'B' && S.cfg.difficulty === 'hard') PS.audio.play('ook');
  }

  function tryBlock(u) {
    // handled at shot release; jumping near the shooter is what counts
    u.cd = 0.5;
  }

  function trySteal(u) {
    const ball = S.ball, h = ball.holder;
    u.cd = 0.8;
    u.anim = { type: 'steal', t: 0 };
    if (h && h.team === 'B' && Math.hypot(h.x - u.x, h.z - u.z) < 1.15) {
      if (Math.random() < 0.4) {
        gainPossession(u);
        PS.popup('STEAL! 🐽', 'green', 1000);
        PS.audio.play('oink'); S.stats.steals++;
        return;
      }
      u.stumble = 0.55;
    }
  }

  function passBall(from, to) {
    const ball = S.ball;
    if (ball.holder !== from || !to) return;
    ball.holder = null;
    ball.state = 'pass';
    ball.passTo = to;
    ball.pos.set(from.x, 1.1 * from.scale, from.z);
    const T = Math.max(0.25, Math.hypot(to.x - from.x, to.z - from.z) / 13);
    ball.vel.set((to.x - from.x) / T, (1.0 * to.scale - ball.pos.y + 0.5 * G * T * T * 0.3) / T, (to.z - from.z) / T);
    ball.passG = G * 0.3;
    PS.audio.play('whoosh');
    // interception chance
    const defs = from.team === 'A' ? S.B : S.A;
    for (const df of defs) {
      const midX = (from.x + to.x) / 2, midZ = (from.z + to.z) / 2;
      if (Math.hypot(df.x - midX, df.z - midZ) < 1.0 && Math.random() < (from.team === 'A' ? S.d.steal : 0.15)) {
        ball.intercept = df;
        break;
      }
    }
  }

  function gainPossession(p) {
    const ball = S.ball;
    ball.holder = p; ball.state = 'held'; ball.shot = null; ball.passTo = null; ball.intercept = null;
    ball.lastTeam = p.team;
    if (p.team === 'A') S.userP = p;
    updateHint();
  }

  /* ---------------- ball physics ---------------- */
  function stepBall(dt) {
    const ball = S.ball;
    const b = ball.pos;

    if (ball.state === 'held' && ball.holder) {
      const h = ball.holder;
      S.dribbleT += dt * (h.move > 0.05 ? 9 : 6.5);
      const bob = Math.abs(Math.sin(S.dribbleT));
      const prev = ball.dribblePrev || 1;
      if (bob < 0.08 && prev >= 0.08) PS.audio.play('dribble');
      ball.dribblePrev = bob;
      const side = h.team === 'A' ? -0.32 : 0.32;
      const fx = Math.sin(h.face), fz = Math.cos(h.face);
      b.set(h.x + fz * 0 + side * fz + fx * 0.25, h.jumping ? releaseHeight(h) - 0.35 : 0.15 + bob * 0.5 * h.scale, h.z - fx * side + fz * 0.25);
      ball.vel.set(0, 0, 0);
      return;
    }

    if (ball.state === 'pass') {
      ball.vel.y -= (ball.passG || G * 0.3) * dt;
      b.addScaledVector(ball.vel, dt);
      S.trail.push(b);
      if (ball.intercept && Math.hypot(ball.intercept.x - b.x, ball.intercept.z - b.z) < 0.7) {
        const df = ball.intercept;
        gainPossession(df);
        PS.popup(df.team === 'B' ? 'INTERCEPTED!' : 'STEAL! 🐽', df.team === 'B' ? 'red' : 'green', 1100);
        if (df.team === 'A') S.stats.steals++;
        return;
      }
      const to = ball.passTo;
      if (to && Math.hypot(to.x - b.x, to.z - b.z) < 0.7 && Math.abs(b.y - 1.0 * to.scale) < 1.2) {
        gainPossession(to);
        return;
      }
      if (b.y < BALL_R) { ball.state = 'loose'; }
      return;
    }

    if (ball.state === 'flight' && ball.shot) {
      const sh = ball.shot;
      sh.t += dt;
      ball.vel.y -= G * dt;
      b.addScaledVector(ball.vel, dt);
      S.trail.push(b);
      if (sh.t >= sh.T) {
        if (sh.made) {
          registerBasket(sh);
          ball.state = 'made';
          ball.vel.set(PS.rand(-0.3, 0.3), -2.2, PS.rand(-0.3, 0.3));
          const clean = sh.q > 0.8 && Math.random() < 0.75;
          PS.audio.play(clean ? 'swish' : 'rim');
        } else {
          ball.state = 'loose';
          PS.audio.play('rim');
        }
      }
      return;
    }

    if (ball.state === 'made') {
      // drop through the net
      ball.vel.y -= G * 0.35 * dt;
      b.addScaledVector(ball.vel, dt);
      if (b.y < BALL_R) { ball.state = 'loose'; ball.vel.set(PS.rand(-1, 1), 2, PS.rand(-1, 1)); }
      return;
    }

    if (ball.state === 'loose') {
      ball.vel.y -= G * dt;
      ball.vel.multiplyScalar(Math.max(0, 1 - 0.12 * dt));
      b.addScaledVector(ball.vel, dt);

      // rim & backboard collisions on both hoops
      for (const h of S.hoops) {
        const rel = V3(b.x - h.rim.x, 0, b.z - h.rim.z);
        const rl = rel.length();
        if (Math.abs(b.y - RIM_H) < 0.25 && rl > 0.02 && rl < RIM_R + BALL_R + 0.05 && rl > RIM_R - BALL_R - 0.05) {
          const cp = V3(h.rim.x + (rel.x / rl) * RIM_R, RIM_H, h.rim.z + (rel.z / rl) * RIM_R);
          const n = V3(b.x - cp.x, b.y - cp.y, b.z - cp.z);
          const d2 = n.length();
          if (d2 < BALL_R + 0.03) {
            n.normalize();
            b.copy(cp).addScaledVector(n, BALL_R + 0.035);
            const vn = ball.vel.dot(n);
            if (vn < 0) ball.vel.addScaledVector(n, -1.55 * vn);
            ball.vel.multiplyScalar(0.75);
            PS.audio.play('rim');
          }
        }
        // backboard
        const bz = h.boardZ;
        if (Math.abs(b.x - h.rim.x) < 0.95 && b.y > 2.85 && b.y < 4.0) {
          const going = (bz > 0 && ball.vel.z > 0 && b.z > bz - BALL_R && b.z < bz + 0.3) ||
                        (bz < 0 && ball.vel.z < 0 && b.z < bz + BALL_R && b.z > bz - 0.3);
          if (going) { b.z = bz - Math.sign(bz) * BALL_R; ball.vel.z *= -0.62; PS.audio.play('board'); }
        }
      }

      // lucky bounce through the hoop still counts
      for (const h of S.hoops) {
        if (ball.vel.y < 0 && Math.abs(b.y - (RIM_H - 0.05)) < 0.09 &&
            Math.hypot(b.x - h.rim.x, b.z - h.rim.z) < RIM_R - 0.06) {
          const team = h.zs < 0 ? 'A' : 'B';
          registerBasket({ team, pts: 2, q: 0.5 });
          ball.state = 'made';
          PS.audio.play('rim');
        }
      }

      // floor & walls
      if (b.y < BALL_R) {
        b.y = BALL_R;
        if (Math.abs(ball.vel.y) > 1) { ball.vel.y = -ball.vel.y * 0.62; PS.audio.play('bounce'); }
        else ball.vel.y = 0;
        ball.vel.x *= 0.85; ball.vel.z *= 0.85;
      }
      if (Math.abs(b.x) > HW + 1.6) { b.x = Math.sign(b.x) * (HW + 1.6); ball.vel.x *= -0.5; }
      if (Math.abs(b.z) > HL + 1.9) { b.z = Math.sign(b.z) * (HL + 1.9); ball.vel.z *= -0.5; }

      // pickups
      if (S.state === 'live') {
        for (const p of S.players) {
          if (p.cd > 0 || p.stumble > 0) continue;
          if (Math.hypot(p.x - b.x, p.z - b.z) < 0.62 && b.y < 1.5 * p.scale + p.y) {
            gainPossession(p);
            break;
          }
        }
      }
    }
  }

  function registerBasket(shot) {
    if (S.state !== 'live') return;
    const team = shot.team;
    S.score[team] += shot.pts;
    PS.hud.setScore(S.score.A, S.score.B);
    const h = S.hoops[team === 'A' ? 0 : 1];
    h.netPulse = 1;
    const you = team === 'A';
    if (shot.pts === 3) { if (you) S.stats.threes++; PS.popup(you ? 'THREEEEE! 🎯' : '+3 them…', you ? 'gold' : 'red', 1400); }
    else if (shot.isDunk) { PS.popup(you ? 'BOOM! 💥' : 'MONKEY SLAM 🦍', you ? 'gold' : 'red', 1400); }
    else PS.popup(you ? (shot.q > 0.8 ? 'SWISH! +2' : '+2!') : '+2 them', you ? 'green' : 'red', 1100);
    S.stadium.cheer(you ? 1 : 0.6);
    PS.audio.play('cheer', you);
    if (you) PS.audio.play('oink');
    else if (S.cfg.difficulty === 'hard') PS.audio.play('ook');
    S.state = 'score'; S.stateT = 0;
    S.concede = team === 'A' ? 'B' : 'A';
  }

  function doInbound() {
    const team = S.concede || 'B';
    const zBase = team === 'A' ? HL - 1 : -HL + 1;
    const arr = team === 'A' ? S.A : S.B;
    const oth = team === 'A' ? S.B : S.A;
    arr[0].x = 0.8; arr[0].z = zBase;
    arr[1].x = -2.4; arr[1].z = zBase * 0.75;
    oth[0].x = 0.5; oth[0].z = -zBase * 0.45;
    oth[1].x = -1.8; oth[1].z = -zBase * 0.3;
    for (const p of S.players) { p.y = 0; p.vy = 0; p.jumping = false; p.anim = null; p.ch.userData.armsBusy = false; resetPose(p.ch.userData.j); }
    gainPossession(arr[0]);
    S.trail.clear();
    S.state = 'live'; S.stateT = 0;
  }

  function finishMatch() {
    if (S.state === 'done') return;
    S.state = 'done';
    PS.audio.play('buzzer');
    const { A, B } = S.score;
    const win = A > B ? 'you' : A < B ? 'them' : 'draw';
    if (win === 'you') S.particles.confettiRain(0, 0, 6, 8, 70);
    S.stadium.cheer(1);
    PS.matchOver({
      you: A, them: B, win,
      stats: [
        { num: S.stats.threes, lbl: '3-pointers' },
        { num: S.stats.dunks, lbl: 'Dunks' },
        { num: S.stats.blocks, lbl: 'Blocks' },
        { num: S.stats.steals, lbl: 'Steals' },
      ],
    });
  }

  /* ---------------- AI ---------------- */
  function updateAI(dt) {
    const ball = S.ball;
    for (const p of S.players) {
      p.cd = Math.max(0, p.cd - dt);
      p.stumble = Math.max(0, p.stumble - dt);
      if (p === S.userP || p.stumble > 0) continue;
      p.aiT -= dt;

      const onBall = ball.holder === p;
      const myRim = rimFor(p.team);
      const enemies = p.team === 'A' ? S.B : S.A;

      if (onBall) {
        aiHandler(p, dt, myRim, enemies);
      } else if (ball.holder && ball.holder.team === p.team) {
        // spacing: drift to the wing on the other side
        const h = ball.holder;
        const tx = h.x > 0 ? -3.6 : 3.6;
        const tz = myRim.z + (p.team === 'A' ? 1 : -1) * PS.rand(2.5, 3);
        seek(p, tx, tz, dt, 0.8);
      } else if (ball.state === 'loose') {
        seek(p, ball.pos.x, ball.pos.z, dt, 1);
      } else if (ball.holder) {
        // defend: stay between your man / the handler and your basket
        const guardRim = rimFor(p.team === 'A' ? 'B' : 'A'); // hoop this team defends
        const others = enemies;
        const mark = nearestTo(others, p);
        const isOnBallDef = ball.holder && enemies.includes(ball.holder) &&
          nearestTo(p.team === 'A' ? S.A : S.B, ball.holder) === p;
        const target = isOnBallDef ? ball.holder : mark;
        const gr = rimFor(target.team);       // the hoop the target attacks
        const dir = V3(gr.x - target.x, 0, gr.z - target.z).normalize();
        seek(p, target.x + dir.x * 1.1, target.z + dir.z * 1.1, dt, 1);
        // steal / contest attempts
        if (isOnBallDef && p.aiT <= 0) {
          p.aiT = PS.rand(0.6, 1.4);
          const d2 = Math.hypot(ball.holder.x - p.x, ball.holder.z - p.z);
          if (d2 < 1.1 && Math.random() < (p.team === 'B' ? S.d.steal : 0.12)) {
            gainPossession(p);
            PS.popup(p.team === 'B' ? 'STOLEN!' : 'STEAL! 🐽', p.team === 'B' ? 'red' : 'green', 1000);
            if (p.team === 'B' && S.cfg.difficulty === 'hard') PS.audio.play('ook');
          }
        }
      } else {
        seek(p, p.x * 0.9, p.z * 0.9, dt, 0.4);
      }

      // AI jump shots resolve on their own timer
      if (p.jumpShot && p.jumping && !p.dunking && p.vy < 1.1 && ball.holder === p) {
        const frac = 1 - p.vy / 4.9;
        releaseShot(p, frac + PS.rand(-0.12, 0.12) * (p.team === 'B' ? (1.2 - S.d.iq) : 0.4));
      }
    }
  }

  function aiHandler(p, dt, rim, enemies) {
    const dRim = distXZ(p, rim);
    const pressure = enemies.reduce((m, e) => Math.min(m, Math.hypot(e.x - p.x, e.z - p.z)), 99);
    const mate = (p.team === 'A' ? S.A : S.B).find((q) => q !== p);
    const iq = p.team === 'B' ? S.d.iq : 0.75;

    if (p.jumping) return;

    // giant monkeys live for the dunk
    const wantDunk = p.team === 'B' && S.cfg.difficulty === 'hard';
    if (dRim < 1.35 && !p.jumping) {
      p.jumping = true; p.vy = 5.2; p.jumpShot = true; p.dunking = true;
      p.anim = { type: 'dunk', phase: 0, t: 0, dur: 0.55 };
      p.ch.userData.armsBusy = true;
      return;
    }
    const openEnough = pressure > (wantDunk ? 2.6 : 1.7);
    const inRange = dRim < (wantDunk ? 4.2 : 6.6);
    if (inRange && openEnough && p.aiT <= 0 && !wantDunk) {
      p.aiT = 1;
      p.jumping = true; p.vy = 4.9; p.jumpShot = true;
      p.anim = { type: 'shoot', phase: -1, t: 0 };
      p.ch.userData.armsBusy = true;
      return;
    }
    if (inRange && openEnough && wantDunk && dRim < 4.5 && p.aiT <= 0 && Math.random() < 0.3) {
      p.aiT = 0.8;
      p.jumping = true; p.vy = 4.9; p.jumpShot = true;
      p.anim = { type: 'shoot', phase: -1, t: 0 };
      p.ch.userData.armsBusy = true;
      return;
    }
    // pass if smothered and the mate is open
    if (pressure < 1.3 && mate && p.aiT <= 0) {
      const mateP = enemies.reduce((m, e) => Math.min(m, Math.hypot(e.x - mate.x, e.z - mate.z)), 99);
      if (mateP > 2 && Math.random() < 0.5 + iq * 0.3) { passBall(p, mate); p.aiT = 0.7; return; }
      p.aiT = 0.5;
    }
    // drive: attack the rim, weave around pressure
    const dir = V3(rim.x - p.x, 0, rim.z - p.z).normalize();
    let sideStep = 0;
    for (const e of enemies) {
      const d2 = Math.hypot(e.x - p.x, e.z - p.z);
      if (d2 < 2.0) sideStep += (p.x - e.x) > 0 ? 1.6 : -1.6;
    }
    seek(p, p.x + dir.x * 2 + sideStep, p.z + dir.z * 2, dt, 1);
  }

  function nearestTo(arr, target) {
    return arr.reduce((m, p) => (Math.hypot(p.x - target.x, p.z - target.z) <
      Math.hypot(m.x - target.x, m.z - target.z) ? p : m), arr[0]);
  }

  function seek(p, tx, tz, dt, urgency) {
    tx = PS.clamp(tx, -HW + 0.3, HW - 0.3); tz = PS.clamp(tz, -HL + 0.3, HL - 0.3);
    const dx = tx - p.x, dz = tz - p.z, dist = Math.hypot(dx, dz);
    if (dist < 0.12) { p.move = Math.max(0, p.move - dt * 3); return; }
    const step = Math.min(dist, p.speed * urgency * dt);
    p.x += (dx / dist) * step; p.z += (dz / dist) * step;
    p.move = PS.clamp(urgency, 0, 1);
    p.face = Math.atan2(dx, dz);
  }

  /* ---------------- per-frame player physics/anim ---------------- */
  function updatePlayers(dt, t) {
    const ball = S.ball;
    for (const p of S.players) {
      // jump physics
      if (p.jumping) {
        p.vy -= G * 1.9 * dt;      // snappy arcade gravity
        p.y += p.vy * dt;
        if (p.dunking && ball.holder === p) {
          // carry to the rim and slam
          const rim = rimFor(p.team);
          p.x += (rim.x - p.x) * 6 * dt;
          p.z += (rim.z - p.z + (p.team === 'A' ? 0.55 : -0.55)) * 6 * dt;
          if (p.y + 1.35 * p.scale > RIM_H - 0.65) {
            // slam it
            ball.holder = null;
            ball.state = 'made';
            ball.pos.set(rim.x, RIM_H + 0.1, rim.z);
            ball.vel.set(0, -3.5, 0);
            registerBasket({ team: p.team, pts: 2, q: 1, isDunk: true });
            if (p.team === 'A') S.stats.dunks++;
            PS.audio.play('board'); PS.shake(0.35);
            p.dunking = false;
          }
        }
        if (p.y <= 0) {
          p.y = 0; p.vy = 0; p.jumping = false; p.jumpShot = false; p.blockJump = false;
          if (p.dunking) p.dunking = false;
          if (ball.holder === p) { /* held through a jump — travel, but it's street rules */ }
          PS.hud.meterHide();
          if (p.anim && (p.anim.type === 'shoot' || p.anim.type === 'block') && p.anim.phase < 0) {
            p.anim = null; p.ch.userData.armsBusy = false; resetPose(p.ch.userData.j);
          }
        }
      }

      // facing: ball handlers face their rim, defenders face the ball
      let face = p.face;
      if (ball.holder === p) {
        const rim = rimFor(p.team);
        face = Math.atan2(rim.x - p.x, rim.z - p.z);
      } else if (ball.holder && ball.holder.team !== p.team) {
        face = Math.atan2(ball.pos.x - p.x, ball.pos.z - p.z);
      }
      p.ch.position.set(p.x, p.y, p.z);
      p.ch.rotation.y = face;
      PS.animLocomotion(p.ch, t, p.move);
      p.move = Math.max(0, p.move - dt * 2);

      // pose layers
      const j = p.ch.userData.j;
      if (p.anim) {
        p.anim.t += dt;
        const a = p.anim;
        if (a.type === 'shoot') {
          if (p.jumping && ball.holder === p) poseShoot(j, -1);
          else { poseShoot(j, Math.min(1, a.t / 0.45)); if (a.t > 0.45) { p.anim = null; p.ch.userData.armsBusy = false; resetPose(j); } }
        } else if (a.type === 'dunk') {
          poseDunk(j, Math.min(1, a.t / a.dur));
          if (a.t > a.dur) { p.anim = null; p.ch.userData.armsBusy = false; resetPose(j); }
        } else if (a.type === 'block') {
          poseBlock(j);
          if (!p.jumping && a.t > 0.15) { p.anim = null; p.ch.userData.armsBusy = false; resetPose(j); }
        } else if (a.type === 'steal') {
          j.armR.rotation.set(1.3, -0.6, -0.4);
          if (a.t > 0.28) { p.anim = null; p.ch.userData.armsBusy = false; resetPose(j); }
        }
      } else if (ball.holder === p) {
        p.ch.userData.armsBusy = true; poseDribble(j, t);
      } else if (ball.holder && ball.holder.team !== p.team && Math.hypot(ball.holder.x - p.x, ball.holder.z - p.z) < 3) {
        p.ch.userData.armsBusy = true; poseGuard(j, t);
      } else if (!p.anim) {
        p.ch.userData.armsBusy = false;
      }
      if (p.stumble > 0) p.ch.rotation.z = Math.sin(t * 30) * 0.08;
      else p.ch.rotation.z = 0;
    }

    // indicator ring under the controlled pig
    S.ring.position.set(S.userP.x, 0.02, S.userP.z);
    S.ring.material.opacity = 0.55 + Math.sin(t * 6) * 0.25;

    // ball visual
    S.ballMesh.position.copy(ball.pos);
    if (ball.state === 'flight' || ball.state === 'loose' || ball.state === 'pass') {
      S.ballMesh.rotation.x += (ball.spinRate || -6) * dt;
    } else {
      S.ballMesh.rotation.x += (ball.holder && ball.holder.move > 0.1 ? 6 : 3) * dt;
    }
  }

  function updateCamera(dt) {
    const b = S.ball.pos;
    const want = V3(PS.clamp(b.x * 0.55, -4.5, 4.5), 6.1, PS.clamp(b.z + 9.2, -1, 21));
    S.camPos.lerp(want, 1 - Math.pow(0.002, dt));
    const lookWant = V3(b.x * 0.45, 1.3, b.z * 0.4 - 1.5);
    S.camLook.lerp(lookWant, 1 - Math.pow(0.002, dt));
    PS.shakeOffset(dt, S.shakeV);
    S.cam.position.copy(S.camPos).add(S.shakeV);
    S.cam.lookAt(S.camLook);
  }
})();
