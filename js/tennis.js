/* ============================================================
   PIG SPORTS — TENNIS
   Swing model based on real stroke biomechanics:
   unit turn → loop backswing → hip-led forward swing (kinetic
   chain) → contact out in front → windscreen-wiper follow-through.
   Serve: toss, trophy position, strike at the top of the toss.
   ============================================================ */
(function () {
  'use strict';
  const V3 = (x, y, z) => new THREE.Vector3(x, y, z);

  // court dimensions (metres, official)
  const HW = 4.115;        // singles half width
  const DHW = 5.485;       // doubles half width
  const BL = 11.885;       // baseline distance from net
  const SL = 6.4;          // service line
  const NET_H = 0.914, NET_POST = 1.07;
  const BALL_R = 0.08;
  const G = 9.81;

  const DIFF = {
    easy:   { speed: 3.1, err: 2.0, power: 0.72, react: 0.4,  faultRate: 0.25, name: 'Porkchop',  icon: '🐖' },
    normal: { speed: 4.6, err: 1.05, power: 0.95, react: 0.22, faultRate: 0.12, name: 'Boarris',   icon: '🐗' },
    hard:   { speed: 6.3, err: 0.38, power: 1.2,  react: 0.1,  faultRate: 0.05, name: 'King Bongo', icon: '🦍' },
  };

  const netHeightAt = (x) => NET_H + (Math.abs(x) / HW) * (NET_POST - NET_H) * 0.8;

  let S = null; // per-match state

  /* ---------------- court construction ---------------- */
  function buildCourt(scene) {
    const padW = 4.2, padL = 5.2;
    const w = (HW + padW) * 2, l = (BL + padL) * 2;
    const tex = PS.canvasTexture(1024, 2048, (ctx, cw, ch) => {
      const sx = cw / w, sy = ch / l;
      const X = (x) => (x + HW + padW) * sx, Y = (z) => (z + BL + padL) * sy;
      ctx.fillStyle = '#1e6b52'; ctx.fillRect(0, 0, cw, ch);                    // runback green
      ctx.fillStyle = '#2f6db8';                                               // court blue
      ctx.fillRect(X(-DHW), Y(-BL), (DHW * 2) * sx, (BL * 2) * sy);
      ctx.strokeStyle = '#f4f8ff'; ctx.lineWidth = 5; ctx.lineCap = 'square';
      const line = (x1, z1, x2, z2) => { ctx.beginPath(); ctx.moveTo(X(x1), Y(z1)); ctx.lineTo(X(x2), Y(z2)); ctx.stroke(); };
      line(-DHW, -BL, DHW, -BL); line(-DHW, BL, DHW, BL);                       // baselines
      line(-DHW, -BL, -DHW, BL); line(DHW, -BL, DHW, BL);                       // doubles side
      line(-HW, -BL, -HW, BL); line(HW, -BL, HW, BL);                           // singles side
      line(-HW, -SL, HW, -SL); line(-HW, SL, HW, SL);                           // service lines
      line(0, -SL, 0, SL);                                                     // centre service
      line(0, -BL, 0, -BL + 0.35); line(0, BL, 0, BL - 0.35);                   // centre marks
    });
    const court = new THREE.Mesh(new THREE.PlaneGeometry(w, l),
      new THREE.MeshStandardMaterial({ map: tex, roughness: 0.92 }));
    court.rotation.x = -Math.PI / 2;
    court.receiveShadow = true;
    scene.add(court);

    // net
    const netTex = PS.canvasTexture(512, 64, (ctx, cw, ch) => {
      ctx.clearRect(0, 0, cw, ch);
      ctx.strokeStyle = 'rgba(240,244,255,.9)'; ctx.lineWidth = 1;
      for (let x = 0; x <= cw; x += 6) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, ch); ctx.stroke(); }
      for (let y = 0; y <= ch; y += 6) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(cw, y); ctx.stroke(); }
      ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, cw, 9);                     // top band
    });
    netTex.wrapS = THREE.RepeatWrapping; netTex.repeat.x = 4;
    const net = new THREE.Mesh(new THREE.PlaneGeometry(DHW * 2 + 0.6, NET_H),
      new THREE.MeshBasicMaterial({ map: netTex, transparent: true, side: THREE.DoubleSide }));
    net.position.set(0, NET_H / 2 + 0.02, 0);
    scene.add(net);
    for (const sx of [-1, 1]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, NET_POST, 10), PS.std(0x223148, 0.5, 0.4));
      post.position.set((DHW + 0.35) * sx, NET_POST / 2, 0);
      post.castShadow = true; scene.add(post);
    }

    // umpire chair
    const chair = new THREE.Group();
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.7, 0.7), PS.std(0x2e7d5b, 0.8));
    seat.position.y = 2.1; chair.add(seat);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 2.0, 8), PS.std(0x9aa6bb, 0.5));
      leg.position.set(0.3 * sx, 1.0, 0.25 * sz); chair.add(leg);
    }
    chair.position.set(DHW + 1.5, 0, 0);
    chair.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    scene.add(chair);
  }

  function makeTennisBall(scene) {
    const tex = PS.canvasTexture(128, 128, (ctx, w, h) => {
      ctx.fillStyle = '#d9ee4b'; ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#f6faf0'; ctx.lineWidth = 7;
      ctx.beginPath(); ctx.arc(-w * 0.1, h / 2, w * 0.62, -0.9, 0.9); ctx.stroke();
      ctx.beginPath(); ctx.arc(w * 1.1, h / 2, w * 0.62, Math.PI - 0.9, Math.PI + 0.9); ctx.stroke();
    });
    const m = new THREE.Mesh(new THREE.SphereGeometry(BALL_R, 18, 14),
      new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6 }));
    m.castShadow = true;
    scene.add(m);
    return m;
  }

  /* ---------------- stroke poses (local space, model faces +z) ---------------- */
  function resetPose(j) {
    j.body.rotation.set(0, 0, 0);
    j.head.rotation.set(0, 0, 0);
    j.armL.rotation.set(0, 0, 0.18); j.armR.rotation.set(0, 0, -0.18);
    j.elbowL.rotation.set(-0.35, 0, 0); j.elbowR.rotation.set(-0.35, 0, 0);
    j.handL.rotation.set(0, 0, 0); j.handR.rotation.set(0, 0, 0);
  }

  // fh / bh ground strokes. phase<0 → backswing hold (charge 0..1);
  // phase 0..1 → forward swing; k = overall amplitude (fades at the end)
  function poseStroke(j, stroke, phase, charge) {
    const bh = stroke === 'bh';
    const m = bh ? -1 : 1;
    if (phase < 0) {
      const c = 0.35 + 0.65 * charge;
      j.body.rotation.y = -0.55 * c * m;           // unit turn: shoulders coil
      j.head.rotation.y = 0.3 * c * m;             // eyes stay on the ball
      if (!bh) {
        j.armR.rotation.set(0.55 * c, -1.05 * c, -0.55 - 0.25 * c);
        j.elbowR.rotation.x = -0.85 - 0.65 * c;    // racket loops up & back
        j.handR.rotation.set(-0.7 * c, 0, 0);
        j.armL.rotation.set(-0.6 * c, 0.5 * c, 0.45); // off-arm stretches across
      } else {
        j.armR.rotation.set(0.4 * c, 1.15 * c, -0.15); // racket taken across body
        j.elbowR.rotation.x = -1.0 - 0.4 * c;
        j.handR.rotation.set(-0.5 * c, 0, 0);
        j.armL.rotation.set(0.2 * c, -0.3 * c, 0.5);
      }
    } else {
      const p = Math.min(1, phase);
      const k = p < 0.7 ? 1 : 1 - (p - 0.7) / 0.3;  // blend back to neutral
      const drive = Math.min(1, p * 2.0);           // hips fire first, arm lags
      const wipe = Math.max(0, p * 2.0 - 0.9);      // windscreen-wiper finish
      j.body.rotation.y = (-0.55 + 1.15 * drive) * m * k;
      j.head.rotation.y = 0.25 * (1 - drive) * m * k;
      if (!bh) {
        j.armR.rotation.set((0.55 - 1.7 * drive) * k, (-1.05 + 2.3 * drive) * k, (-0.55 + 0.1 * drive) * k - 0.18 * (1 - k));
        j.elbowR.rotation.x = (-1.5 + 1.25 * drive) * k - 0.35 * (1 - k);
        j.handR.rotation.set((-0.7 + 1.5 * drive) * k, 0.9 * wipe * k, 0);
        j.armL.rotation.set(-0.6 * (1 - drive) * k, 0.5 * (1 - drive) * k, 0.45 * k + 0.18 * (1 - k));
      } else {
        j.armR.rotation.set((0.4 - 1.5 * drive) * k, (1.15 - 2.4 * drive) * k, -0.15 * k - 0.18 * (1 - k));
        j.elbowR.rotation.x = (-1.4 + 1.2 * drive) * k - 0.35 * (1 - k);
        j.handR.rotation.set((-0.5 + 1.2 * drive) * k, -0.8 * wipe * k, 0);
        j.armL.rotation.set((0.2 - 0.9 * drive) * k, -0.3 * k, 0.5 * k + 0.18 * (1 - k));
      }
    }
  }

  // serve: phase<0 → trophy/toss (charge = toss progress), 0..1 → strike
  function poseServe(j, phase) {
    if (phase < 0) {
      j.body.rotation.set(-0.16, -0.35, 0);         // lean back, shoulders turned
      j.armL.rotation.set(2.75, 0, 0.1);            // toss arm points at the ball
      j.armR.rotation.set(0.7, -0.5, -0.5);
      j.elbowR.rotation.x = -2.1;                   // racket cocked behind head
      j.handR.rotation.set(-1.1, 0, 0);
      j.legL && (j.legL.rotation.x = 0.35); j.legR && (j.legR.rotation.x = -0.15);
    } else {
      const p = Math.min(1, phase);
      const k = p < 0.7 ? 1 : 1 - (p - 0.7) / 0.3;
      const up = Math.min(1, p * 2.4);              // leg drive + arm whip
      j.body.rotation.set((-0.16 + 0.5 * up) * k, (-0.35 + 0.55 * up) * k, 0);
      j.armR.rotation.set((0.7 + 2.35 * up - 1.1 * Math.max(0, p * 2.4 - 1.2)) * k, -0.5 * (1 - up) * k, -0.2 * k - 0.18 * (1 - k));
      j.elbowR.rotation.x = (-2.1 + 2.0 * up) * k - 0.35 * (1 - k);
      j.handR.rotation.set(0, 1.2 * up * k, 0);     // pronation
      j.armL.rotation.set(2.75 * (1 - up) * k, 0, 0.1 * k + 0.18 * (1 - k));
      j.legL && (j.legL.rotation.x = 0.35 * (1 - up));
      j.legR && (j.legR.rotation.x = -0.15 * (1 - up));
    }
  }

  /* ---------------- ballistic aiming ----------------
     Choose a launch velocity that lands at `target`, raising the
     arc until the net is cleared by `margin`. Accounts for the
     Magnus dip of topspin (or float of slice). */
  const MAGNUS = 0.3;
  function aimShot(from, target, speed, margin, spin) {
    let T = Math.max(0.35, from.distanceTo(target) / speed);
    let vx = 0, vy = 0, vz = 0;
    for (let i = 0; i < 8; i++) {
      vx = (target.x - from.x) / T;
      vz = (target.z - from.z) / T;
      const gE = G + MAGNUS * (spin || 0) * Math.hypot(vx, vz);
      vy = (target.y - from.y + 0.5 * gE * T * T) / T;
      if (Math.abs(vz) > 1e-4) {
        const tc = (0 - from.z) / vz;
        if (tc > 0 && tc < T) {
          const yc = from.y + vy * tc - 0.5 * gE * tc * tc;
          if (yc < netHeightAt(from.x + vx * tc) + margin) { T *= 1.09; continue; }
        }
      }
      break;
    }
    return V3(vx, vy, vz);
  }

  /* ---------------- match state ---------------- */
  const mode = (PS.modes.tennis = {
    start(cfg) {
      const scene = new THREE.Scene();
      const cam = new THREE.PerspectiveCamera(56, innerWidth / innerHeight, 0.1, 400);
      const stadium = PS.makeStadium(scene, { innerW: HW + 4.5, innerL: BL + 5.5, theme: { board: '#2d5d9e' } });
      buildCourt(scene);

      const d = DIFF[cfg.difficulty];
      const pigMesh = PS.makePig(cfg.pig);
      pigMesh.rotation.y = Math.PI;
      scene.add(pigMesh);
      const racket = PS.makeRacket();
      pigMesh.userData.j.handR.add(racket);

      let oppMesh, oppName, oppIcon;
      if (cfg.difficulty === 'hard') {
        oppMesh = PS.makeMonkey({ scale: 2.25 });
      } else {
        const pool = PS.PIGS.filter((p) => p !== cfg.pig);
        oppMesh = PS.makePig(PS.choice(pool), { scale: cfg.difficulty === 'easy' ? 0.95 : 1.05 });
      }
      oppName = d.name; oppIcon = d.icon;
      scene.add(oppMesh);
      const oppRacket = PS.makeRacket();
      oppRacket.scale.setScalar(oppMesh.userData.dims.kind === 'monkey' ? 1.7 : 1);
      oppMesh.userData.j.handR.add(oppRacket);

      const ballMesh = makeTennisBall(scene);
      const trail = new PS.Trail(scene, 0xd9ee4b, 0.05);
      const particles = new PS.Particles(scene);

      // landing marker
      const marker = new THREE.Mesh(new THREE.RingGeometry(0.1, 0.2, 24),
        new THREE.MeshBasicMaterial({ color: 0x57d98a, transparent: true, opacity: 0 }));
      marker.rotation.x = -Math.PI / 2; marker.position.y = 0.012;
      scene.add(marker);

      S = {
        cfg, d, scene, cam, stadium, particles, trail, marker, ballMesh,
        p: { ch: pigMesh, x: 0, z: BL + 0.6, f: -1, reach: pigMesh.userData.dims.reach,
             stats: cfg.pig.stats, anim: null, move: 0 },
        o: { ch: oppMesh, x: 0, z: -BL - 0.6, f: 1, reach: oppMesh.userData.dims.reach,
             anim: null, move: 0, thinkT: 0, tx: 0, tz: -BL - 0.6 },
        ball: { pos: V3(0, 1, 5), vel: V3(0, 0, 0), spin: 0, live: false,
                lastHit: null, bounces: 0, netTouched: false, isServe: false },
        state: 'intro', stateT: 0,
        score: { p: 0, o: 0 }, ptTotal: 0, starter: 'p',
        clock: 120, timeUp: false, golden: false,
        stats: { aces: 0, winners: 0, bestRally: 0, rallyHits: 0 },
        serve: { num: 1, tossed: false, tossVel: 0 },
        camPos: V3(0, 5, BL + 7), camLook: V3(0, 1, 0),
        shakeV: V3(0, 0, 0), t: 0,
      };

      PS.hud.setNames(cfg.pig.name, cfg.pig.emoji, oppName, oppIcon);
      PS.hud.setScore(0, 0);
      PS.hud.setTimer(120, 'TIME');
      PS.setTouchLabels('SWING', 'SLICE', 'LOB');
      PS.popup(cfg.difficulty === 'hard' ? 'BEWARE THE GIANT MONKEY! 🦍' : 'FIRST TO THE BUZZER WINS!', 'gold', 2000);
      if (cfg.difficulty === 'hard') PS.audio.play('ook');
      setupPoint();
      S.state = 'intro'; S.stateT = 0;
    },

    onResize() { if (S) { S.cam.aspect = innerWidth / innerHeight; S.cam.updateProjectionMatrix(); } },

    update(dt, t) {
      if (!S) return;
      S.t = t;
      updateMatch(dt);
      updateCharacters(dt, t);
      updateBallVisual(dt);
      S.stadium.update(t, dt);
      S.particles.update(dt);
      S.trail.update();
      S.marker.material.opacity = Math.max(0, S.marker.material.opacity - dt * 0.7);
      updateCamera(dt);
      PS.renderer.render(S.scene, S.cam);
    },

    dispose() {
      if (!S) return;
      PS.disposeScene(S.scene);
      S = null;
    },
  });

  /* ---------------- point / serve orchestration ---------------- */
  function server() {
    const n = S.ptTotal;
    if (n === 0) return S.starter;
    const other = S.starter === 'p' ? 'o' : 'p';
    return Math.floor((n + 1) / 2) % 2 === 0 ? S.starter : other;
  }

  function setupPoint() {
    const sv = server();
    const deuce = S.ptTotal % 2 === 0;
    S.serve.num = 1;
    placeForServe(sv, deuce);
    S.state = sv === 'p' ? 'serve' : 'aiserve';
    S.stateT = 0;
    S.ball.live = false;
    S.trail.clear();
    updateHint();
  }

  function placeForServe(sv, deuce) {
    // server stands to the right of the centre mark on their side
    const svSide = sv === 'p' ? 1 : -1;                 // world z sign of server
    const rightX = sv === 'p' ? 1 : -1;                 // server's right in world x
    const sx = (deuce ? 1.1 : -1.1) * rightX;
    if (sv === 'p') {
      S.p.x = sx; S.p.z = BL + 0.5;
      S.o.x = -sx * 1.6; S.o.z = -BL - 0.4;             // receiver on the diagonal
      S.o.tx = S.o.x; S.o.tz = S.o.z;
    } else {
      S.o.x = sx; S.o.z = -BL - 0.5;
      S.o.tx = sx; S.o.tz = -BL - 0.5;
      S.p.x = -sx * 1.6; S.p.z = BL + 0.4;
    }
    S.serveBox = { xSign: -Math.sign(sx || 1), zSign: -svSide };
    S.ball.isServe = true;
  }

  function updateHint() {
    if (S.state === 'serve') {
      PS.hud.setHint('<b>◀ ▶</b> aim &nbsp;·&nbsp; <b>SPACE</b> toss, then <b>SPACE</b> again at the top of the toss — like a real serve!');
    } else {
      PS.hud.setHint('<b>WASD/◀▲▼▶</b> move &nbsp;·&nbsp; hold &amp; release <b>SPACE</b> topspin drive &nbsp;·&nbsp; <b>X</b> slice &nbsp;·&nbsp; <b>C</b> lob<br>Charge your backswing early, hit the ball out in front!');
    }
  }

  function beginRallyState() {
    S.state = 'rally';
    S.stateT = 0;
    updateHint();
  }

  function endPoint(winner, reason, popupCls) {
    if (S.state === 'over' || S.state === 'done') return;
    S.state = 'over'; S.stateT = 0;
    S.score[winner]++;
    PS.hud.setScore(S.score.p, S.score.o);
    S.stats.bestRally = Math.max(S.stats.bestRally, S.stats.rallyHits);
    S.stats.rallyHits = 0;
    if (reason) PS.popup(reason, popupCls || (winner === 'p' ? 'green' : 'red'));
    S.stadium.cheer(winner === 'p' ? 1 : 0.5);
    PS.audio.play('cheer', winner === 'p');
    if (winner === 'p') PS.audio.play('oink');
    else if (S.cfg.difficulty === 'hard') PS.audio.play('ook');
    S.ptTotal++;
  }

  function finishMatch() {
    S.state = 'done';
    PS.audio.play('buzzer');
    const { p, o } = S.score;
    const win = p > o ? 'you' : p < o ? 'them' : 'draw';
    if (win === 'you') S.particles.confettiRain(0, 6, 6, 5, 70);
    S.stadium.cheer(1);
    PS.matchOver({
      you: p, them: o, win,
      stats: [
        { num: S.stats.aces, lbl: 'Aces' },
        { num: S.stats.winners, lbl: 'Winners' },
        { num: S.stats.bestRally, lbl: 'Longest rally' },
      ],
    });
  }

  /* ---------------- main state machine ---------------- */
  function updateMatch(dt) {
    S.stateT += dt;
    const st = S.state;

    // match clock runs while a point is being played
    if (st === 'rally' || st === 'toss' || st === 'aiserve' || st === 'serve') {
      if (!S.timeUp) {
        S.clock -= dt;
        if (S.clock <= 0) {
          S.clock = 0; S.timeUp = true;
          PS.audio.play('whistle');
          if (S.score.p === S.score.o) { S.golden = true; PS.popup('GOLDEN POINT!', 'gold', 2000); PS.hud.setTimer(0, 'GOLDEN'); }
          else PS.popup('TIME! Last rally…', 'blue', 1600);
        }
      }
      PS.hud.setTimer(S.clock, S.golden ? 'GOLDEN' : undefined);
    }

    if (st === 'intro') {
      if (S.stateT > 1.2) setupPoint();
      return;
    }

    if (st === 'over') {
      if (S.stateT > 1.6) {
        if (S.timeUp && S.score.p !== S.score.o) finishMatch();
        else setupPoint();
      }
      return;
    }
    if (st === 'done') return;

    if (st === 'serve') updatePlayerServe(dt);
    else if (st === 'toss') updateToss(dt);
    else if (st === 'aiserve') { updateAIServe(dt); updatePlayerRally(dt); }
    else if (st === 'rally') { updatePlayerRally(dt); }

    if (st === 'rally' || st === 'toss' || st === 'aiserve') {
      stepBall(dt);
      updateAI(dt);
    }
  }

  /* ---------------- player serve ---------------- */
  function updatePlayerServe(dt) {
    // shuffle along the baseline before the toss
    const ax = PS.input.axisX();
    S.p.x = PS.clamp(S.p.x + ax * 2.2 * dt, S.serveBox.xSign < 0 ? 0.4 : -HW, S.serveBox.xSign < 0 ? HW : -0.4);
    S.p.move = Math.abs(ax) * 0.4;
    // ball held at the hip
    S.ball.pos.set(S.p.x - 0.25, 1.05 * scaleOf(S.p), S.p.z - 0.15);
    S.ball.vel.set(0, 0, 0); S.ball.live = false;

    if (PS.input.wasPressed('A')) {
      S.state = 'toss'; S.stateT = 0;
      S.serve.tossed = true;
      S.ball.vel.set(0, 4.6, 0);
      S.ball.pos.y = 1.3 * scaleOf(S.p);
      S.p.anim = { type: 'serve', phase: -1, t: 0 };
      S.p.ch.userData.armsBusy = true;
      PS.hud.meterShow(0.72, 0.94);
      PS.audio.play('whoosh');
    }
  }

  function updateToss(dt) {
    // ball rises & falls under gravity; strike near the apex
    const b = S.ball;
    b.vel.y -= G * dt;
    b.pos.y += b.vel.y * dt;
    const apex = 1.3 * scaleOf(S.p) + (4.6 * 4.6) / (2 * G);
    PS.hud.meterSet(b.pos.y / apex);

    const ax = PS.input.axisX();
    S.aimServe = PS.clamp((S.aimServe || 0) + ax * dt * 2.4, -1, 1);

    if (PS.input.wasPressed('A')) {
      PS.hud.meterHide();
      strikeServe(b.pos.y / apex);
      return;
    }
    if (b.pos.y < 1.15 * scaleOf(S.p) && b.vel.y < 0) {
      // let it drop — catch and re-toss, no penalty (pros do it too)
      PS.hud.meterHide();
      S.state = 'serve'; S.stateT = 0;
      S.p.anim = null; S.p.ch.userData.armsBusy = false; resetPose(S.p.ch.userData.j);
      PS.popup('re-toss', 'small blue', 800);
    }
  }

  function strikeServe(rel) {
    const q = PS.clamp(1 - Math.abs(rel - 0.84) / 0.3, 0, 1);   // quality vs. ideal strike height
    const power = S.p.stats.power;
    const first = S.serve.num === 1;
    S.p.anim = { type: 'serve', phase: 0, t: 0, dur: 0.5 };
    const box = S.serveBox;
    // aim: wide ↔ down the T
    const aim = (S.aimServe || 0);
    const tx = box.xSign * PS.clamp(2.1 + aim * box.xSign * 1.7, 0.35, 3.9);
    const tz = box.zSign * (first ? 5.9 : 5.2);
    const target = V3(tx, 0.02, tz);
    // quality → error
    const err = (1 - q) * (first ? 2.2 : 0.9) * (1.35 - S.p.stats.touch * 0.5);
    target.x += PS.rand(-err, err);
    target.z += PS.rand(-err, err) * box.zSign * 0.5;
    const speed = first ? 20 + 13 * q * (0.7 + 0.6 * power) : 15 + 4 * q;
    const spin = first ? 0.25 : 0.9;                // second serve: heavy spin for safety
    const from = V3(S.p.x, S.ball.pos.y, S.p.z);
    S.ball.vel.copy(aimShot(from, target, speed, first ? 0.05 : 0.5, spin));
    S.ball.pos.copy(from);
    S.ball.spin = spin;
    S.ball.live = true; S.ball.lastHit = 'p'; S.ball.bounces = 0; S.ball.netTouched = false;
    S.ball.isServe = true;
    S.aimServe = 0;
    beginRallyState();
    PS.audio.play('hit', q);
    if (q > 0.85) { PS.popup('CLEAN STRIKE!', 'small gold', 900); PS.audio.play('chime'); }
    PS.shake(0.06 * q);
  }

  /* ---------------- AI serve ---------------- */
  function updateAIServe(dt) {
    const o = S.o;
    S.ball.live = false;
    S.ball.pos.set(o.x - 0.25 * o.f, 1.05 * scaleOf(o), o.z + 0.15 * o.f);
    if (S.stateT > 0.7 && !o.anim) {
      o.anim = { type: 'serve', phase: -1, t: 0 };
      o.ch.userData.armsBusy = true;
    }
    if (S.stateT > 1.45) {
      o.anim = { type: 'serve', phase: 0, t: 0, dur: 0.5 };
      const d = S.d;
      const fault = S.serve.num === 1 && Math.random() < d.faultRate;
      const box = S.serveBox;
      const q = PS.clamp(PS.rand(0.55, 1) * (0.7 + d.power * 0.3), 0, 1);
      const tx = box.xSign * PS.rand(0.5, 3.8);
      const tz = box.zSign * (S.serve.num === 1 ? 5.9 : 5.1);
      const target = V3(tx, 0.02, tz);
      if (fault) { target.z += box.zSign * PS.rand(1.2, 2.5); }   // sails long
      const from = V3(o.x, 2.6 * scaleOf(o) * 0.85, o.z);
      const speed = S.serve.num === 1 ? 19 + 13 * q * d.power : 14.5;
      const spin = S.serve.num === 1 ? 0.25 : 0.9;
      S.ball.pos.copy(from);
      S.ball.vel.copy(aimShot(from, target, speed, 0.06, spin));
      S.ball.spin = spin;
      S.ball.live = true; S.ball.lastHit = 'o'; S.ball.bounces = 0;
      S.ball.netTouched = false; S.ball.isServe = true;
      beginRallyState();
      PS.audio.play('hit', q);
    }
  }

  /* ---------------- player rally control ---------------- */
  function updatePlayerRally(dt) {
    const p = S.p;
    const moveSpeed = 3.6 + 2.6 * p.stats.speed;
    const swingLock = p.anim && p.anim.type !== 'serve' && p.anim.phase >= 0 && p.anim.t < 0.25;
    const ax = swingLock ? 0 : PS.input.axisX();
    const ay = swingLock ? 0 : PS.input.axisY();
    const mv = Math.hypot(ax, ay);
    p.x = PS.clamp(p.x + ax * moveSpeed * dt, -HW - 2.2, HW + 2.2);
    p.z = PS.clamp(p.z + ay * moveSpeed * dt, 1.4, BL + 3.2);
    p.move = mv;
    p.runSpeed = mv * moveSpeed;

    // begin backswing: hold a stroke button, release to swing
    if (!p.anim) {
      for (const [btn, stroke] of [['A', 'drive'], ['B', 'slice'], ['C', 'lob']]) {
        if (PS.input.isDown(btn)) {
          const side = localBallX(p) >= 0 ? 'fh' : 'bh';
          p.anim = { type: 'stroke', stroke, side, btn, phase: -1, t: 0, charge: 0 };
          p.ch.userData.armsBusy = true;
          break;
        }
      }
    } else if (p.anim.type === 'stroke' && p.anim.phase < 0) {
      p.anim.charge = Math.min(1, p.anim.charge + dt / 0.55);
      // track fh/bh while preparing (you can change your mind until you swing)
      p.anim.side = localBallX(p) >= 0 ? 'fh' : 'bh';
      if (!PS.input.isDown(p.anim.btn)) {
        p.anim.phase = 0; p.anim.t = 0; p.anim.dur = 0.42;
        p.anim.contactDone = false;
        PS.audio.play('whoosh');
      }
    }

    // contact window during the forward swing
    if (p.anim && p.anim.type === 'stroke' && p.anim.phase >= 0 && !p.anim.contactDone) {
      const sw = p.anim.t / p.anim.dur;
      if (sw > 0.12 && sw < 0.55) tryContact(p, 'p');
    }
  }

  function localBallX(who) {
    // ball x in the character's local space; +ve → racket (forehand) side
    return who.f * (S.ball.pos.x - who.x);
  }

  function tryContact(who, tag) {
    const b = S.ball;
    if (!b.live || b.lastHit === tag) return;
    const dx = b.pos.x - who.x;
    const dzFwd = (who.z - b.pos.z) * (who.f === -1 ? 1 : -1); // + = ball out in front
    const reach = who.reach + 0.5;
    const sc = scaleOf(who);
    if (Math.abs(dx) > reach + 0.35) return;
    if (dzFwd < -0.55 || dzFwd > 1.3 * sc) return;
    if (b.pos.y < 0.1 || b.pos.y > 1.55 * sc + 0.6) return;

    // contact quality: out in front & comfortably to the side = clean
    const idealFwd = 0.45 * sc;
    const qFwd = PS.clamp(1 - Math.abs(dzFwd - idealFwd) / 0.85, 0, 1);
    const qSide = PS.clamp(1 - Math.max(0, Math.abs(dx) - reach * 0.55) / (reach * 0.8), 0, 1);
    const qRun = who.runSpeed > 4.5 ? 0.82 : 1;
    const q = PS.clamp(qFwd * 0.55 + qSide * 0.35 + 0.1, 0, 1) * qRun;
    hitBall(who, tag, q);
  }

  function hitBall(who, tag, q) {
    const p = who;
    const anim = p.anim;
    anim.contactDone = true;
    const isPlayer = tag === 'p';
    const stats = isPlayer ? p.stats : { power: S.d.power, touch: 1 - S.d.err / 2.5, speed: 0 };
    const charge = isPlayer ? anim.charge : PS.rand(0.55, 1);
    const stroke = anim.stroke;
    const oppSide = isPlayer ? -1 : 1;      // z sign of the target half

    // aim: lateral input at the moment of contact steers the shot
    let aim = isPlayer ? PS.input.axisX() : 0;
    let targetX, targetZ, speed, spin, margin;
    if (stroke === 'lob') {
      speed = 10.5 + 4 * charge;
      spin = -0.25;
      targetX = aim * 2.4; targetZ = oppSide * PS.rand(8.5, 11);
      margin = 3.6;
    } else if (stroke === 'slice') {
      speed = 12.5 + 6.5 * charge * (0.7 + 0.5 * stats.power);
      spin = -0.8;
      targetX = aim * 3.1; targetZ = oppSide * (5.2 + 4.5 * charge);
      margin = 0.55;
    } else {
      speed = 15 + 13.5 * charge * (0.62 + 0.65 * stats.power);
      spin = 0.9 + 0.5 * charge;
      targetX = aim * 3.3; targetZ = oppSide * (7.2 + 4.0 * charge);
      margin = 0.5 - 0.25 * q;
    }

    if (!isPlayer) {
      // AI shot selection: pull the player around, sometimes attack the corner
      const d = S.d;
      const away = S.p.x > 0 ? -1 : 1;
      targetX = Math.random() < 0.35 + (d === DIFF.hard ? 0.3 : 0) ? away * PS.rand(2.2, 3.6) : PS.rand(-2.6, 2.6);
      targetZ = oppSide * PS.rand(6.8, 11.0); // oppSide is +1 for the AI → the player's half
      speed = (14 + 12 * charge) * d.power;
      spin = 0.9; margin = 0.55;
      const err = d.err;
      targetX += PS.rand(-err, err);
      targetZ += PS.rand(-err, err) * 0.8;
    } else {
      const err = (1 - q) * (2.7 - stats.touch * 1.5);
      targetX += PS.rand(-err, err);
      targetZ += PS.rand(-err, err) * oppSide * -0.6;
      targetZ = PS.clamp(Math.abs(targetZ), 3, 11.4) * oppSide;
      targetX = PS.clamp(targetX, -HW - 0.6, HW + 0.6);
    }

    const b = S.ball;
    const from = b.pos.clone();
    let mishit = false;
    if (q < 0.22) { mishit = true; speed *= 0.45; spin = 0; margin = 0.1; }
    b.vel.copy(aimShot(from, V3(targetX, 0.02, targetZ), speed, margin, spin));
    b.spin = spin;
    b.lastHit = tag; b.bounces = 0; b.netTouched = false; b.isServe = false;
    if (isPlayer) S.stats.rallyHits++;

    PS.audio.play('hit', q * (0.5 + charge * 0.5));
    S.particles.burst(b.pos, 0xd9ee4b, 8, 2.2, 1.6);
    if (isPlayer) {
      if (mishit) PS.popup('MISHIT!', 'small red', 800);
      else if (q > 0.88) { PS.popup('PERFECT!', 'small gold', 800); PS.audio.play('chime'); }
      PS.shake(0.05 + 0.07 * charge * q);
    }
  }

  /* ---------------- opponent AI ---------------- */
  function updateAI(dt) {
    const o = S.o, b = S.ball, d = S.d;

    // start/advance opponent swing animation bookkeeping happens in updateCharacters
    const incoming = b.live && b.lastHit === 'p';
    if (incoming) {
      // predict where the ball will be when it reaches the pig's z-range
      const pred = predictBallAtZ(o.z + o.f * 0.5);
      o.tx = pred ? PS.clamp(pred.x, -HW - 2.4, HW + 2.4) : 0;
      o.tz = PS.clamp(-BL - 0.4 + (d === DIFF.hard ? 1.2 : 0), -BL - 2.5, -3);
      // prepare a backswing when the ball is approaching
      const distZ = Math.abs(b.pos.z - o.z);
      if (!o.anim && distZ < 9 && b.vel.z < 0) {
        // AI faces +z, so its forehand side is world +x
        o.anim = { type: 'stroke', stroke: 'drive', side: (b.pos.x - o.x) >= 0 ? 'fh' : 'bh', phase: -1, t: 0, charge: 0 };
        o.ch.userData.armsBusy = true;
        o.reactClock = d.react;
      }
      if (o.anim && o.anim.type === 'stroke' && o.anim.phase < 0) {
        o.anim.charge = Math.min(1, o.anim.charge + dt / 0.5);
        // release the swing when the ball enters the strike zone
        const dzFwd = (o.z - b.pos.z) * -1;
        if (dzFwd < 1.1 * scaleOf(o) && Math.abs(b.pos.x - o.x) < o.reach + 1.1 && b.pos.y < 2.0 * scaleOf(o)) {
          o.reactClock -= dt;
          if (o.reactClock <= 0) { o.anim.phase = 0; o.anim.t = 0; o.anim.dur = 0.4; o.anim.contactDone = false; }
        }
      }
      if (o.anim && o.anim.type === 'stroke' && o.anim.phase >= 0 && !o.anim.contactDone) {
        const sw = o.anim.t / o.anim.dur;
        if (sw > 0.1 && sw < 0.6) tryContact(o, 'o');
      }
    } else {
      // recover toward the centre of the baseline
      if (!b.live || b.lastHit !== 'p') {
        if (S.state === 'rally') { o.tx = b.live ? b.pos.x * 0.25 : 0; o.tz = -BL - 0.5; }
      }
      if (o.anim && o.anim.type === 'stroke' && o.anim.phase < 0 && (!b.live || b.lastHit === 'o')) {
        o.anim = null; o.ch.userData.armsBusy = false; resetPose(o.ch.userData.j);
      }
    }

    // movement
    if (S.state === 'rally' || S.state === 'toss') {
      const dx = o.tx - o.x, dz = o.tz - o.z;
      const dist = Math.hypot(dx, dz);
      const spd = d.speed;
      if (dist > 0.08) {
        const step = Math.min(dist, spd * dt);
        o.x += (dx / dist) * step; o.z += (dz / dist) * step;
        o.move = PS.clamp(dist, 0, 1);
      } else o.move = 0;
    }
  }

  function predictBallAtZ(zTarget) {
    // cheap forward simulation of the current ball
    const p = S.ball.pos.clone(), v = S.ball.vel.clone();
    let spin = S.ball.spin, bounced = 0;
    const dt = 1 / 40;
    for (let i = 0; i < 220; i++) {
      v.y -= G * dt;
      v.y -= MAGNUS * spin * Math.hypot(v.x, v.z) * dt;
      p.addScaledVector(v, dt);
      if (p.y < BALL_R && v.y < 0) {
        p.y = BALL_R; v.y = -v.y * 0.72;
        v.x *= 0.78; v.z *= 0.78 + Math.max(0, spin) * 0.06;
        spin *= 0.4; bounced++;
        if (bounced > 1) return p;
      }
      if ((zTarget < 0 && p.z <= zTarget) || (zTarget > 0 && p.z >= zTarget)) return p;
    }
    return p;
  }

  /* ---------------- ball physics & line calls ---------------- */
  function stepBall(dt) {
    const b = S.ball;
    if (!b.live) return;
    const prevZ = b.pos.z;
    b.vel.y -= G * dt;
    // Magnus effect: topspin dips, slice floats
    b.vel.y -= MAGNUS * b.spin * Math.hypot(b.vel.x, b.vel.z) * dt;
    b.vel.multiplyScalar(Math.max(0, 1 - 0.02 * dt));
    b.pos.addScaledVector(b.vel, dt);
    S.trail.push(b.pos);

    // net
    if (prevZ !== b.pos.z && Math.sign(prevZ) !== Math.sign(b.pos.z) && Math.abs(prevZ) > 1e-6) {
      const f = prevZ / (prevZ - b.pos.z);
      const xc = b.pos.x, yc = b.pos.y + (1 - f) * 0; // close enough at this dt
      if (Math.abs(xc) < DHW + 0.4 && yc < netHeightAt(xc) + BALL_R) {
        b.pos.z = Math.sign(prevZ) * 0.05;
        b.vel.z *= -0.22; b.vel.x *= 0.45; b.vel.y = Math.min(b.vel.y, 0.5); b.spin = 0;
        b.netTouched = true;
        PS.audio.play('board');
      }
    }

    // bounce
    if (b.pos.y < BALL_R && b.vel.y < 0) {
      b.pos.y = BALL_R;
      b.vel.y = -b.vel.y * 0.72;
      b.vel.x *= 0.78;
      b.vel.z *= 0.78 + Math.max(0, b.spin) * 0.06; // topspin kicks through
      b.spin *= 0.4;
      if (Math.hypot(b.vel.x, b.vel.z) > 2) PS.audio.play('bounce');
      b.bounces++;
      if (b.bounces === 1) judgeLanding();
      else if (b.bounces >= 2 && S.state === 'rally') {
        // double bounce: last hitter wins the rally
        // (isServe is still true only if the return was never touched)
        if (b.lastHit === 'p') {
          if (b.isServe) { S.stats.aces++; endPoint('p', 'ACE!', 'gold'); }
          else { S.stats.winners++; endPoint('p', 'WINNER!', 'green'); }
        } else {
          endPoint('o', b.isServe ? 'ACE…' : 'Too good!', 'red');
        }
      }
    }
    // safety: ball escaped the arena
    if (Math.abs(b.pos.x) > 22 || Math.abs(b.pos.z) > 26 || (b.bounces > 4)) {
      if (S.state === 'rally') endPoint(b.lastHit === 'p' ? 'p' : 'o', null);
    }
  }

  function judgeLanding() {
    const b = S.ball;
    const hitter = b.lastHit, receiverSide = hitter === 'p' ? -1 : 1;
    const x = b.pos.x, z = b.pos.z;
    showMarker(x, z, true);

    if (b.netTouched && Math.sign(z) !== receiverSide) {
      // dropped back on the hitter's own side
      endPoint(hitter === 'p' ? 'o' : 'p', 'NET!', hitter === 'p' ? 'red' : 'green');
      return;
    }
    if (Math.sign(z) !== receiverSide) {
      // never crossed — treat as into the net / dumped short
      endPoint(hitter === 'p' ? 'o' : 'p', 'NET!', hitter === 'p' ? 'red' : 'green');
      return;
    }

    let inBounds;
    if (b.isServe && !b.oppTouched) {
      const box = S.serveBox;
      const okX = box.xSign < 0 ? x <= 0.1 && x >= -HW - 0.05 : x >= -0.1 && x <= HW + 0.05;
      const okZ = Math.abs(z) <= SL + 0.1 && Math.sign(z) === box.zSign;
      inBounds = okX && okZ;
      if (!inBounds) {
        showMarker(x, z, false);
        if (S.serve.num === 1) {
          S.serve.num = 2;
          PS.popup('FAULT', 'small red', 900);
          PS.audio.play('bad');
          // re-serve
          const sv = server();
          S.state = sv === 'p' ? 'serve' : 'aiserve'; S.stateT = 0;
          S.ball.live = false; S.trail.clear();
          const svChar = sv === 'p' ? S.p : S.o;
          svChar.anim = null; svChar.ch.userData.armsBusy = false; resetPose(svChar.ch.userData.j);
          updateHint();
        } else {
          endPoint(hitter === 'p' ? 'o' : 'p', 'DOUBLE FAULT', hitter === 'p' ? 'red' : 'green');
        }
        return;
      }
    } else {
      inBounds = Math.abs(x) <= HW + BALL_R && Math.abs(z) <= BL + BALL_R;
      if (!inBounds) {
        showMarker(x, z, false);
        endPoint(hitter === 'p' ? 'o' : 'p', 'OUT!', hitter === 'p' ? 'red' : 'green');
        return;
      }
    }
    // good ball — rally continues
  }

  function showMarker(x, z, ok) {
    S.marker.position.set(x, 0.012, z);
    S.marker.material.color = PS.C(ok ? 0x57d98a : 0xff5b5b);
    S.marker.material.opacity = 0.95;
  }

  /* ---------------- characters & animation ---------------- */
  function scaleOf(who) { return who.ch.userData.dims.scale; }

  function updateCharacters(dt, t) {
    for (const who of [S.p, S.o]) {
      const ch = who.ch;
      ch.position.set(who.x, 0, who.z);
      ch.rotation.y = who.f === -1 ? Math.PI : 0;
      PS.animLocomotion(ch, t, who.move || 0);
      who.move = Math.max(0, (who.move || 0) - dt * 2);

      const a = who.anim;
      if (a) {
        a.t += dt;
        const j = ch.userData.j;
        if (a.type === 'serve') {
          if (a.phase < 0) poseServe(j, -1);
          else {
            poseServe(j, a.t / a.dur);
            if (a.t >= a.dur) { who.anim = null; ch.userData.armsBusy = false; resetPose(j); }
          }
        } else if (a.type === 'stroke') {
          if (a.phase < 0) poseStroke(j, a.side, -1, a.charge);
          else {
            poseStroke(j, a.side, a.t / a.dur, a.charge);
            if (a.t >= a.dur) { who.anim = null; ch.userData.armsBusy = false; resetPose(j); }
          }
        }
      }
    }
  }

  function updateBallVisual(dt) {
    const b = S.ball;
    S.ballMesh.position.copy(b.pos);
    if (b.live) {
      S.ballMesh.rotation.x += (b.spin > 0 ? -1 : 1) * 14 * dt;
      S.ballMesh.rotation.z += 4 * dt;
    }
  }

  function updateCamera(dt) {
    const p = S.p;
    const want = V3(p.x * 0.45, 4.9, PS.clamp(p.z + 6.2, BL + 3.5, BL + 9));
    if (S.state === 'serve' || S.state === 'toss') { want.y = 3.6; want.z = p.z + 4.6; want.x = p.x * 0.7; }
    S.camPos.lerp(want, 1 - Math.pow(0.0018, dt));
    const lookWant = V3(S.ball.live ? S.ball.pos.x * 0.35 : p.x * 0.2, 1.0, -2.5);
    S.camLook.lerp(lookWant, 1 - Math.pow(0.002, dt));
    PS.shakeOffset(dt, S.shakeV);
    S.cam.position.copy(S.camPos).add(S.shakeV);
    S.cam.lookAt(S.camLook);
  }
})();
