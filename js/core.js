/* ============================================================
   PIG SPORTS — core engine
   Shared 3D helpers, characters, stadium, audio, input, UI flow
   ============================================================ */
(function () {
  'use strict';
  const PS = (window.PS = {});
  const $ = (id) => document.getElementById(id);

  /* ---------------- tiny utils ---------------- */
  PS.clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  PS.lerp = (a, b, t) => a + (b - a) * t;
  PS.rand = (a, b) => a + Math.random() * (b - a);
  PS.choice = (arr) => arr[(Math.random() * arr.length) | 0];
  // colors authored in sRGB, converted for the lit pipeline
  PS.C = (hex) => new THREE.Color(hex).convertSRGBToLinear();

  PS.std = function (hex, rough = 0.75, metal = 0.0) {
    return new THREE.MeshStandardMaterial({ color: PS.C(hex), roughness: rough, metalness: metal });
  };

  PS.canvasTexture = function (w, h, draw) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    const tex = new THREE.CanvasTexture(c);
    tex.encoding = THREE.sRGBEncoding;
    tex.anisotropy = 4;
    return tex;
  };

  PS.disposeScene = function (scene) {
    scene.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        mats.forEach((m) => { if (m.map) m.map.dispose(); m.dispose(); });
      }
    });
  };

  /* ---------------- pig roster ---------------- */
  PS.PIGS = [
    { id: 'rosie', name: 'Rosie', emoji: '🐷', body: 0xf7a8c0, snout: 0xef8fae, dark: 0xd9769c,
      desc: 'The all-rounder. Calm, kind, and deadly from the baseline.',
      stats: { speed: 0.75, power: 0.75, touch: 0.8 }, scale: 1.0 },
    { id: 'truffle', name: 'Truffle', emoji: '🐽', body: 0xcf9060, snout: 0xb87a4e, dark: 0x9c6238,
      desc: 'Tiny, turbo-charged and truffle-fuelled. Catch her if you can.',
      stats: { speed: 1.0, power: 0.55, touch: 0.7 }, scale: 0.9 },
    { id: 'bigham', name: 'Big Ham', emoji: '🐖', body: 0xeb93a2, snout: 0xdd7f90, dark: 0xc06678,
      desc: 'Slow of trotter, mighty of wallop. Feel the thunder.',
      stats: { speed: 0.5, power: 1.0, touch: 0.6 }, scale: 1.18 },
    { id: 'ziggy', name: 'Ziggy', emoji: '🌀', body: 0x9fe0c9, snout: 0x7fc9ae, dark: 0x5fae92,
      desc: 'Spin wizard. Feathery drop shots and wicked angles.',
      stats: { speed: 0.7, power: 0.6, touch: 1.0 }, scale: 0.96 },
  ];

  /* ============================================================
     AUDIO — tiny synthesizer, no assets needed
     ============================================================ */
  const audio = (PS.audio = {
    ctx: null, master: null, crowdGain: null, muted: false,
    ensure() {
      if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.55;
      this.master.connect(this.ctx.destination);
      this._startCrowd();
    },
    setMuted(m) { this.muted = m; if (this.master) this.master.gain.value = m ? 0 : 0.55; },
    _startCrowd() {
      // endless murmur: looped filtered noise
      const ctx = this.ctx;
      const len = ctx.sampleRate * 2;
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      const src = ctx.createBufferSource();
      src.buffer = buf; src.loop = true;
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 700; bp.Q.value = 0.4;
      this.crowdGain = ctx.createGain(); this.crowdGain.gain.value = 0.035;
      src.connect(bp); bp.connect(this.crowdGain); this.crowdGain.connect(this.master);
      src.start();
    },
    tone(f0, f1, dur, type, vol, when = 0) {
      if (!this.ctx || this.muted) return;
      const t = this.ctx.currentTime + when;
      const o = this.ctx.createOscillator(), g = this.ctx.createGain();
      o.type = type || 'sine';
      o.frequency.setValueAtTime(f0, t);
      o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(this.master);
      o.start(t); o.stop(t + dur + 0.05);
    },
    noise(dur, opts = {}, when = 0) {
      if (!this.ctx || this.muted) return;
      const ctx = this.ctx, t = ctx.currentTime + when;
      const len = Math.max(1, (ctx.sampleRate * dur) | 0);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      const src = ctx.createBufferSource(); src.buffer = buf;
      let node = src;
      if (opts.lp || opts.hp) {
        const f = ctx.createBiquadFilter();
        f.type = opts.hp ? 'highpass' : 'lowpass';
        f.frequency.setValueAtTime(opts.hp || opts.lp, t);
        if (opts.sweepTo) f.frequency.exponentialRampToValueAtTime(opts.sweepTo, t + dur);
        src.connect(f); node = f;
      }
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(opts.vol || 0.3, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      node.connect(g); g.connect(this.master);
      src.start(t);
    },
    play(name, a) {
      if (!this.ctx || this.muted) return;
      switch (name) {
        case 'bounce': this.tone(190, 120, 0.09, 'sine', 0.5); this.noise(0.04, { lp: 900, vol: 0.2 }); break;
        case 'hit': { const p = a || 0.5; this.noise(0.05, { lp: 4200, vol: 0.45 }); this.tone(300 + 320 * p, 190, 0.08, 'square', 0.3); break; }
        case 'whoosh': this.noise(0.22, { hp: 500, sweepTo: 2400, vol: 0.35 }); break;
        case 'swish': this.noise(0.32, { hp: 2400, sweepTo: 500, vol: 0.5 }); break;
        case 'rim': this.tone(243, 236, 0.42, 'triangle', 0.4); this.tone(367, 352, 0.3, 'triangle', 0.22); break;
        case 'board': this.tone(130, 85, 0.12, 'square', 0.4); this.noise(0.06, { lp: 600, vol: 0.3 }); break;
        case 'dribble': this.tone(150, 95, 0.08, 'sine', 0.4); break;
        case 'whistle': this.tone(2150, 2100, 0.22, 'sine', 0.3); this.tone(2150, 2100, 0.22, 'sine', 0.3, 0.26); break;
        case 'buzzer': this.tone(170, 150, 0.95, 'sawtooth', 0.5); break;
        case 'oink': this.tone(150, 80, 0.11, 'square', 0.35); this.tone(520, 200, 0.09, 'sawtooth', 0.15); break;
        case 'ook': this.tone(370, 540, 0.12, 'sine', 0.45); this.tone(560, 310, 0.16, 'sine', 0.45, 0.15); break;
        case 'chime': this.tone(880, 880, 0.1, 'sine', 0.35); this.tone(1318, 1318, 0.16, 'sine', 0.3, 0.09); break;
        case 'bad': this.tone(220, 110, 0.25, 'sawtooth', 0.3); break;
        case 'cheer': this.noise(1.1, { lp: 3200, vol: a ? 0.5 : 0.3 });
          if (this.crowdGain) { const t = this.ctx.currentTime; this.crowdGain.gain.cancelScheduledValues(t);
            this.crowdGain.gain.setValueAtTime(0.14, t); this.crowdGain.gain.exponentialRampToValueAtTime(0.035, t + 2.2); }
          break;
        case 'aww': this.noise(0.8, { lp: 1000, vol: 0.18 }); this.tone(300, 200, 0.5, 'sine', 0.12); break;
      }
    },
  });

  /* ============================================================
     INPUT — keyboard + virtual touch controls
     ============================================================ */
  const input = (PS.input = {
    down: {}, pressed: {}, released: {},
    joy: { x: 0, y: 0, active: false },
    isDown(n) { return !!this.down[n]; },
    wasPressed(n) { return !!this.pressed[n]; },
    wasReleased(n) { return !!this.released[n]; },
    axisX() { // -1 left … +1 right
      let v = (this.isDown('right') ? 1 : 0) - (this.isDown('left') ? 1 : 0);
      if (this.joy.active) v = PS.clamp(v + this.joy.x, -1, 1);
      return v;
    },
    axisY() { // -1 forward(up) … +1 back(down)
      let v = (this.isDown('down') ? 1 : 0) - (this.isDown('up') ? 1 : 0);
      if (this.joy.active) v = PS.clamp(v + this.joy.y, -1, 1);
      return v;
    },
    _set(n, isDown) {
      if (isDown && !this.down[n]) this.pressed[n] = true;
      if (!isDown && this.down[n]) this.released[n] = true;
      this.down[n] = isDown;
    },
    endFrame() { this.pressed = {}; this.released = {}; },
  });

  const KEYMAP = {
    ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down',
    ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
    Space: 'A', Enter: 'A', KeyX: 'B', ShiftLeft: 'B', ShiftRight: 'B',
    KeyC: 'C', KeyE: 'C',
  };
  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    audio.ensure();
    if (e.code === 'Escape' || e.code === 'KeyP') { PS.togglePause(); return; }
    const n = KEYMAP[e.code];
    if (n) { input._set(n, true); if (['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)) e.preventDefault(); }
  });
  window.addEventListener('keyup', (e) => { const n = KEYMAP[e.code]; if (n) input._set(n, false); });

  function setupTouch() {
    const isTouch = 'ontouchstart' in window && navigator.maxTouchPoints > 0;
    if (!isTouch) return;
    document.body.classList.add('touch');
    const zone = $('joy-zone'), base = $('joy-base'), knob = $('joy-knob');
    let jid = null, cx = 0, cy = 0;
    zone.addEventListener('touchstart', (e) => {
      audio.ensure();
      const t = e.changedTouches[0]; jid = t.identifier;
      cx = t.clientX; cy = t.clientY;
      base.style.display = knob.style.display = 'block';
      base.style.left = cx - 55 + 'px'; base.style.top = cy - 55 + 'px';
      knob.style.left = cx - 26 + 'px'; knob.style.top = cy - 26 + 'px';
      input.joy.active = true;
      e.preventDefault();
    }, { passive: false });
    zone.addEventListener('touchmove', (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier !== jid) continue;
        let dx = t.clientX - cx, dy = t.clientY - cy;
        const m = Math.hypot(dx, dy), max = 52;
        if (m > max) { dx *= max / m; dy *= max / m; }
        knob.style.left = cx + dx - 26 + 'px'; knob.style.top = cy + dy - 26 + 'px';
        input.joy.x = dx / max; input.joy.y = dy / max;
      }
      e.preventDefault();
    }, { passive: false });
    const endJoy = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier !== jid) continue;
        jid = null; input.joy.x = input.joy.y = 0; input.joy.active = false;
        base.style.display = knob.style.display = 'none';
      }
    };
    zone.addEventListener('touchend', endJoy); zone.addEventListener('touchcancel', endJoy);
    [['tbtn-a', 'A'], ['tbtn-b', 'B'], ['tbtn-c', 'C']].forEach(([id, name]) => {
      const el = $(id);
      el.addEventListener('touchstart', (e) => { audio.ensure(); input._set(name, true); e.preventDefault(); }, { passive: false });
      el.addEventListener('touchend', (e) => { input._set(name, false); e.preventDefault(); }, { passive: false });
      el.addEventListener('touchcancel', () => input._set(name, false));
    });
  }
  PS.setTouchLabels = function (a, b, c) {
    $('tbtn-a-lbl').textContent = a; $('tbtn-b-lbl').textContent = b; $('tbtn-c-lbl').textContent = c;
    $('tbtn-c').style.display = c ? 'flex' : 'none';
  };

  /* ============================================================
     CHARACTERS — cartoon pigs & giant monkeys (procedural)
     Both share the same joint layout so animation code is common:
     userData.j = { armL, armR, elbowL, elbowR, handL, handR,
                    legL, legR, head, body, earL, earR, tail }
     Model faces +Z in local space. Root origin at the ground.
     ============================================================ */
  function capsuleMesh(r, len, mat) {
    // r128 has no CapsuleGeometry — cylinder + end spheres
    const g = new THREE.Group();
    const cyl = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 12), mat);
    const s1 = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 8), mat);
    const s2 = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 8), mat);
    s1.position.y = len / 2; s2.position.y = -len / 2;
    g.add(cyl, s1, s2);
    return g;
  }

  function curlyTail(mat) {
    class Helix extends THREE.Curve {
      getPoint(t) {
        const a = t * Math.PI * 4.2;
        return new THREE.Vector3(Math.cos(a) * 0.055, Math.sin(a) * 0.055, -t * 0.16);
      }
    }
    const geo = new THREE.TubeGeometry(new Helix(), 40, 0.02, 6, false);
    return new THREE.Mesh(geo, mat);
  }

  PS.makePig = function (def, opts = {}) {
    const s = (def.scale || 1) * (opts.scale || 1);
    const bodyM = PS.std(def.body, 0.65);
    const snoutM = PS.std(def.snout, 0.6);
    const darkM = PS.std(def.dark, 0.6);
    const whiteM = PS.std(0xffffff, 0.4);
    const blackM = PS.std(0x2a1e28, 0.5);

    const root = new THREE.Group();
    const j = {};

    // legs
    for (const side of [-1, 1]) {
      const leg = new THREE.Group();
      leg.position.set(0.14 * side, 0.5, 0);
      const limb = capsuleMesh(0.085, 0.3, bodyM); limb.position.y = -0.18; leg.add(limb);
      const foot = new THREE.Mesh(new THREE.SphereGeometry(0.095, 12, 8), darkM);
      foot.position.set(0, -0.42, 0.02); foot.scale.set(1, 0.8, 1.15); leg.add(foot);
      root.add(leg);
      j[side < 0 ? 'legL' : 'legR'] = leg;
    }

    // body
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.35, 24, 18), bodyM);
    body.position.y = 0.74; body.scale.set(1.02, 1.0, 0.92);
    root.add(body); j.body = body;
    const belly = new THREE.Mesh(new THREE.SphereGeometry(0.27, 18, 14), PS.std(0xffe3ec, 0.7));
    belly.position.set(0, 0.68, 0.14); belly.scale.set(0.85, 0.85, 0.7);
    root.add(belly);

    // tail
    const tail = curlyTail(snoutM);
    tail.position.set(0, 0.8, -0.32); tail.rotation.y = Math.PI;
    root.add(tail); j.tail = tail;

    // arms (pivot at shoulder)
    for (const side of [-1, 1]) {
      const arm = new THREE.Group();
      arm.position.set(0.34 * side, 0.95, 0.02);
      const upper = capsuleMesh(0.07, 0.24, bodyM); upper.position.y = -0.12; arm.add(upper);
      const elbow = new THREE.Group(); elbow.position.y = -0.26; arm.add(elbow);
      const fore = capsuleMesh(0.06, 0.2, bodyM); fore.position.y = -0.1; elbow.add(fore);
      const hand = new THREE.Group(); hand.position.y = -0.24; elbow.add(hand);
      const hoof = new THREE.Mesh(new THREE.SphereGeometry(0.08, 12, 8), darkM); hand.add(hoof);
      root.add(arm);
      const L = side < 0;
      j[L ? 'armL' : 'armR'] = arm; j[L ? 'elbowL' : 'elbowR'] = elbow; j[L ? 'handL' : 'handR'] = hand;
    }

    // head
    const head = new THREE.Group();
    head.position.set(0, 1.16, 0.08);
    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.27, 24, 18), bodyM);
    skull.scale.set(1, 0.94, 0.96); head.add(skull);
    const snout = new THREE.Mesh(new THREE.CylinderGeometry(0.105, 0.12, 0.13, 16), snoutM);
    snout.rotation.x = Math.PI / 2; snout.position.set(0, -0.03, 0.26); head.add(snout);
    for (const side of [-1, 1]) {
      const nost = new THREE.Mesh(new THREE.SphereGeometry(0.02, 8, 6), darkM);
      nost.position.set(0.04 * side, -0.03, 0.325); head.add(nost);
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.048, 12, 8), whiteM);
      eye.position.set(0.1 * side, 0.07, 0.21); head.add(eye);
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.024, 8, 6), blackM);
      pupil.position.set(0.1 * side, 0.07, 0.252); head.add(pupil);
      const ear = new THREE.Mesh(new THREE.ConeGeometry(0.085, 0.17, 10), snoutM);
      ear.position.set(0.17 * side, 0.23, 0.0);
      ear.rotation.z = -0.5 * side; ear.rotation.x = -0.25;
      head.add(ear); j[side < 0 ? 'earL' : 'earR'] = ear;
      const blush = new THREE.Mesh(new THREE.CircleGeometry(0.045, 12),
        new THREE.MeshBasicMaterial({ color: PS.C(0xff7fa0), transparent: true, opacity: 0.45 }));
      blush.position.set(0.16 * side, -0.04, 0.215); blush.rotation.y = 0.35 * side; head.add(blush);
    }
    root.add(head); j.head = head;

    root.scale.setScalar(s);
    root.traverse((o) => { if (o.isMesh) { o.castShadow = true; } });
    root.userData.j = j;
    root.userData.dims = { height: 1.45 * s, reach: 0.62 * s, scale: s, kind: 'pig' };
    return root;
  };

  PS.makeMonkey = function (opts = {}) {
    const s = opts.scale || 2.2;
    const furM = PS.std(0x5d4228, 0.85);
    const faceM = PS.std(0xd9b48f, 0.7);
    const darkM = PS.std(0x3c2a17, 0.8);
    const whiteM = PS.std(0xffffff, 0.4);
    const blackM = PS.std(0x191014, 0.5);

    const root = new THREE.Group();
    const j = {};

    for (const side of [-1, 1]) {
      const leg = new THREE.Group();
      leg.position.set(0.16 * side, 0.62, 0);
      const limb = capsuleMesh(0.1, 0.42, furM); limb.position.y = -0.24; leg.add(limb);
      const foot = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 8), darkM);
      foot.position.set(0, -0.56, 0.05); foot.scale.set(1, 0.7, 1.5); leg.add(foot);
      root.add(leg); j[side < 0 ? 'legL' : 'legR'] = leg;
    }

    const body = new THREE.Mesh(new THREE.SphereGeometry(0.4, 24, 18), furM);
    body.position.y = 0.98; body.scale.set(1.0, 1.22, 0.9);
    root.add(body); j.body = body;
    const chest = new THREE.Mesh(new THREE.SphereGeometry(0.3, 18, 14), faceM);
    chest.position.set(0, 0.95, 0.16); chest.scale.set(0.8, 1.0, 0.6); root.add(chest);
    const tail = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.035, 8, 20, Math.PI * 1.5), furM);
    tail.position.set(0, 0.72, -0.4); tail.rotation.x = 0.7; root.add(tail); j.tail = tail;

    // long powerful arms
    for (const side of [-1, 1]) {
      const arm = new THREE.Group();
      arm.position.set(0.42 * side, 1.32, 0.02);
      const upper = capsuleMesh(0.1, 0.4, furM); upper.position.y = -0.2; arm.add(upper);
      const elbow = new THREE.Group(); elbow.position.y = -0.42; arm.add(elbow);
      const fore = capsuleMesh(0.085, 0.36, furM); fore.position.y = -0.18; elbow.add(fore);
      const hand = new THREE.Group(); hand.position.y = -0.42; elbow.add(hand);
      const paw = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 8), faceM); hand.add(paw);
      root.add(arm);
      const L = side < 0;
      j[L ? 'armL' : 'armR'] = arm; j[L ? 'elbowL' : 'elbowR'] = elbow; j[L ? 'handL' : 'handR'] = hand;
    }

    // head
    const head = new THREE.Group();
    head.position.set(0, 1.72, 0.05);
    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.3, 24, 18), furM); head.add(skull);
    const face = new THREE.Mesh(new THREE.SphereGeometry(0.22, 18, 14), faceM);
    face.position.set(0, -0.02, 0.14); face.scale.set(0.95, 0.85, 0.7); head.add(face);
    const muzzle = new THREE.Mesh(new THREE.SphereGeometry(0.14, 14, 10), faceM);
    muzzle.position.set(0, -0.1, 0.24); muzzle.scale.set(1.1, 0.75, 0.8); head.add(muzzle);
    const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.012, 6, 12, Math.PI), blackM);
    mouth.position.set(0, -0.1, 0.35); mouth.rotation.z = Math.PI; head.add(mouth);
    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 8), whiteM);
      eye.position.set(0.1 * side, 0.08, 0.24); head.add(eye);
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.026, 8, 6), blackM);
      pupil.position.set(0.1 * side, 0.08, 0.28); head.add(pupil);
      const brow = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.03, 0.04), darkM);
      brow.position.set(0.1 * side, 0.16, 0.25); brow.rotation.z = -0.25 * side; head.add(brow);
      const ear = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 8), furM);
      ear.position.set(0.3 * side, 0.02, -0.02); ear.scale.set(0.5, 1, 0.8); head.add(ear);
      const earIn = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 8), faceM);
      earIn.position.set(0.31 * side, 0.02, 0.02); earIn.scale.set(0.4, 0.8, 0.6); head.add(earIn);
      j[side < 0 ? 'earL' : 'earR'] = ear;
    }
    root.add(head); j.head = head;

    root.scale.setScalar(s);
    root.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    root.userData.j = j;
    root.userData.dims = { height: 2.05 * s, reach: 1.05 * s, scale: s, kind: 'monkey' };
    return root;
  };

  PS.makeRacket = function () {
    const g = new THREE.Group();
    const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.028, 0.3, 10), PS.std(0x27354f, 0.6));
    grip.position.y = 0.15; g.add(grip);
    const throatL = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.14, 8), PS.std(0xe8484f, 0.4, 0.3));
    throatL.position.set(-0.05, 0.35, 0); throatL.rotation.z = 0.5; g.add(throatL);
    const throatR = throatL.clone(); throatR.position.x = 0.05; throatR.rotation.z = -0.5; g.add(throatR);
    const hoop = new THREE.Mesh(new THREE.TorusGeometry(0.155, 0.02, 10, 24), PS.std(0xe8484f, 0.4, 0.3));
    hoop.position.y = 0.56; g.add(hoop);
    const strings = new THREE.Mesh(new THREE.CircleGeometry(0.148, 20),
      new THREE.MeshBasicMaterial({ color: PS.C(0xf3f6ff), transparent: true, opacity: 0.4, side: THREE.DoubleSide }));
    strings.position.y = 0.56; g.add(strings);
    g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    return g;
  };

  /* ------------- shared locomotion animation ------------- */
  // Swings legs/arms while running; gentle bob when idle. Set
  // char.userData.armsBusy = true while a stroke pose owns the arms.
  PS.animLocomotion = function (char, t, moveAmt) {
    const j = char.userData.j;
    const run = PS.clamp(moveAmt, 0, 1);
    const w = t * 11;
    const legSwing = Math.sin(w) * 0.85 * run;
    j.legL.rotation.x = legSwing;
    j.legR.rotation.x = -legSwing;
    if (!char.userData.armsBusy) {
      j.armL.rotation.set(-legSwing * 0.7, 0, 0.18);
      j.armR.rotation.set(legSwing * 0.7, 0, -0.18);
      j.elbowL.rotation.x = -0.35 - 0.3 * run;
      j.elbowR.rotation.x = -0.35 - 0.3 * run;
    }
    const bob = run > 0.05 ? Math.abs(Math.sin(w)) * 0.05 * run : Math.sin(t * 2.2) * 0.015;
    j.body.position.y = (char.userData.dims.kind === 'monkey' ? 0.98 : 0.74) + bob;
    j.head.position.y = (char.userData.dims.kind === 'monkey' ? 1.72 : 1.16) + bob;
    j.earL.rotation.x = -0.25 + Math.sin(t * 3.1) * 0.08;
    j.earR.rotation.x = -0.25 + Math.sin(t * 3.4 + 1) * 0.08;
  };

  /* ============================================================
     STADIUM — stands, animated crowd, sky, floodlights, banners
     ============================================================ */
  PS.makeStadium = function (scene, opts) {
    const innerW = opts.innerW, innerL = opts.innerL;
    const theme = opts.theme || {};

    // sky dome
    const skyTex = PS.canvasTexture(64, 256, (ctx, w, h) => {
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, theme.skyTop || '#3f8fe0');
      g.addColorStop(0.55, theme.skyMid || '#8ec7f2');
      g.addColorStop(1, theme.skyBot || '#e8f4ff');
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    });
    const sky = new THREE.Mesh(new THREE.SphereGeometry(150, 20, 14),
      new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide, fog: false }));
    scene.add(sky);
    scene.fog = new THREE.Fog(PS.C(theme.fog || 0xcfe4f7), 70, 150);

    // sun + sky light
    const hemi = new THREE.HemisphereLight(PS.C(0xcfe2ff), PS.C(0x5a4a42), 0.85);
    scene.add(hemi);
    const sun = new THREE.DirectionalLight(PS.C(0xfff2dd), 1.15);
    sun.position.set(18, 34, 16);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const sc = Math.max(innerW, innerL) * 1.4;
    sun.shadow.camera.left = -sc; sun.shadow.camera.right = sc;
    sun.shadow.camera.top = sc; sun.shadow.camera.bottom = -sc;
    sun.shadow.camera.far = 120;
    sun.shadow.bias = -0.0008;
    scene.add(sun);

    // surrounding ground
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(300, 300),
      PS.std(theme.ground || 0x2f7a4d, 0.95));
    ground.rotation.x = -Math.PI / 2; ground.position.y = -0.02; ground.receiveShadow = true;
    scene.add(ground);

    // hoarding boards with PIG SPORTS branding
    const boardTex = PS.canvasTexture(1024, 96, (ctx, w, h) => {
      ctx.fillStyle = theme.board || '#d63d75'; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = 'rgba(255,255,255,.95)';
      ctx.font = 'bold 52px Arial'; ctx.textBaseline = 'middle';
      for (let x = 20; x < w; x += 340) ctx.fillText('🐷 PIG SPORTS', x, h / 2);
    });
    boardTex.wrapS = THREE.RepeatWrapping;
    const bw = innerW + 3, bl = innerL + 3, bh = 1.0;
    const mkBoard = (len, x, z, rotY) => {
      const t2 = boardTex.clone(); t2.needsUpdate = true; t2.wrapS = THREE.RepeatWrapping; t2.repeat.x = len / 8;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(len, bh), new THREE.MeshStandardMaterial({ map: t2, roughness: 0.8 }));
      m.position.set(x, bh / 2, z); m.rotation.y = rotY; m.castShadow = true;
      scene.add(m); return m;
    };
    mkBoard(bw * 2, 0, -bl, 0); mkBoard(bw * 2, 0, bl, Math.PI);
    mkBoard(bl * 2, -bw, 0, Math.PI / 2); mkBoard(bl * 2, bw, 0, -Math.PI / 2);

    // stands: stepped concrete rings
    const standM = PS.std(0x66738f, 0.9);
    const ROWS = 6;
    for (let r = 0; r < ROWS; r++) {
      const off = 2.5 + r * 1.6, y = 0.5 + r * 0.9;
      const long = new THREE.BoxGeometry((innerW + off) * 2 + 4, 0.9, 1.6);
      const s1 = new THREE.Mesh(long, standM); s1.position.set(0, y, -(innerL + off)); scene.add(s1);
      const s2 = new THREE.Mesh(long, standM); s2.position.set(0, y, innerL + off); scene.add(s2);
      const side = new THREE.BoxGeometry(1.6, 0.9, (innerL + off) * 2 - 1);
      const s3 = new THREE.Mesh(side, standM); s3.position.set(-(innerW + off), y, 0); scene.add(s3);
      const s4 = new THREE.Mesh(side, standM); s4.position.set(innerW + off, y, 0); scene.add(s4);
    }

    // crowd — instanced fans that do the wave when excited
    const fanGeo = new THREE.SphereGeometry(0.32, 8, 6);
    const fanMat = new THREE.MeshStandardMaterial({ roughness: 0.9 });
    const spots = [];
    for (let r = 0; r < ROWS; r++) {
      const off = 2.5 + r * 1.6, y = 1.25 + r * 0.9;
      const nLong = 26 + r * 3, nSide = 18 + r * 2;
      for (let i = 0; i < nLong; i++) {
        const x = -(innerW + off) + ((i + 0.5) / nLong) * (innerW + off) * 2;
        spots.push([x + PS.rand(-0.2, 0.2), y, -(innerL + off) + PS.rand(-0.3, 0.3)]);
        spots.push([x + PS.rand(-0.2, 0.2), y, innerL + off + PS.rand(-0.3, 0.3)]);
      }
      for (let i = 0; i < nSide; i++) {
        const z = -(innerL + off) + ((i + 0.5) / nSide) * (innerL + off) * 2;
        spots.push([-(innerW + off) + PS.rand(-0.3, 0.3), y, z]);
        spots.push([innerW + off + PS.rand(-0.3, 0.3), y, z]);
      }
    }
    const crowd = new THREE.InstancedMesh(fanGeo, fanMat, spots.length);
    const palette = [0xffb3c1, 0xfff1a8, 0xa8e6ff, 0xc3ffa8, 0xffd8a8, 0xe3b8ff, 0xffffff, 0xff8fa3];
    const dummy = new THREE.Object3D();
    const phases = new Float32Array(spots.length);
    spots.forEach((p, i) => {
      dummy.position.set(p[0], p[1], p[2]);
      dummy.updateMatrix();
      crowd.setMatrixAt(i, dummy.matrix);
      crowd.setColorAt(i, PS.C(PS.choice(palette)));
      phases[i] = Math.random() * Math.PI * 2;
    });
    crowd.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    scene.add(crowd);

    // floodlight towers
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const px = (innerW + 11) * sx, pz = (innerL + 11) * sz;
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.35, 16, 8), PS.std(0x8b95ab, 0.5, 0.6));
      pole.position.set(px, 8, pz); scene.add(pole);
      const headG = new THREE.Group(); headG.position.set(px, 16.4, pz); headG.lookAt(0, 0, 0);
      const panel = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.7, 0.3), PS.std(0x39415a, 0.6));
      headG.add(panel);
      const glow = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 1.4),
        new THREE.MeshBasicMaterial({ color: 0xfff8d8 }));
      glow.position.z = 0.17; headG.add(glow);
      scene.add(headG);
    }

    let cheerAmt = 0;
    return {
      cheer(amt = 1) { cheerAmt = Math.max(cheerAmt, amt); },
      update(t, dt) {
        cheerAmt = Math.max(0, cheerAmt - dt * 0.5);
        const amp = 0.06 + cheerAmt * 0.35;
        for (let i = 0; i < spots.length; i++) {
          const p = spots[i];
          dummy.position.set(p[0], p[1] + Math.max(0, Math.sin(t * (3 + cheerAmt * 6) + phases[i])) * amp, p[2]);
          dummy.updateMatrix();
          crowd.setMatrixAt(i, dummy.matrix);
        }
        crowd.instanceMatrix.needsUpdate = true;
        sky.rotation.y = t * 0.004;
      },
    };
  };

  /* ---------------- ball trail ---------------- */
  PS.Trail = class {
    constructor(scene, color, size = 0.06, n = 14) {
      this.n = n; this.meshes = []; this.idx = 0; this.scene = scene;
      const geo = new THREE.SphereGeometry(size, 6, 5);
      for (let i = 0; i < n; i++) {
        const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: PS.C(color), transparent: true, opacity: 0 }));
        scene.add(m); this.meshes.push(m);
      }
    }
    push(pos) {
      const m = this.meshes[this.idx % this.n];
      m.position.copy(pos); m.material.opacity = 0.5;
      this.idx++;
    }
    update() { for (const m of this.meshes) m.material.opacity = Math.max(0, m.material.opacity - 0.03); }
    clear() { for (const m of this.meshes) m.material.opacity = 0; }
  };

  /* ---------------- particle bursts ---------------- */
  PS.Particles = class {
    constructor(scene, n = 90) {
      this.pool = [];
      const geo = new THREE.PlaneGeometry(0.09, 0.09);
      for (let i = 0; i < n; i++) {
        const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, side: THREE.DoubleSide }));
        m.visible = false; scene.add(m);
        this.pool.push({ m, v: new THREE.Vector3(), life: 0, spin: 0 });
      }
    }
    burst(pos, color, n = 12, speed = 3, up = 2) {
      let spawned = 0;
      for (const p of this.pool) {
        if (p.life > 0) continue;
        p.m.material.color = PS.C(color);
        p.m.position.copy(pos);
        p.v.set(PS.rand(-1, 1) * speed, PS.rand(0.3, 1) * up, PS.rand(-1, 1) * speed);
        p.life = PS.rand(0.5, 0.9); p.spin = PS.rand(-8, 8);
        p.m.visible = true; p.m.material.opacity = 1;
        if (++spawned >= n) break;
      }
    }
    confettiRain(cx, cz, w, l, n = 60) {
      const colors = [0xffcf5c, 0xff7fa8, 0x5cc8ff, 0x57d98a, 0xffffff];
      let spawned = 0;
      for (const p of this.pool) {
        if (p.life > 0) continue;
        p.m.material.color = PS.C(PS.choice(colors));
        p.m.position.set(cx + PS.rand(-w, w), PS.rand(6, 11), cz + PS.rand(-l, l));
        p.v.set(PS.rand(-0.5, 0.5), PS.rand(-1.2, -0.6), PS.rand(-0.5, 0.5));
        p.life = PS.rand(2.5, 4.5); p.spin = PS.rand(-6, 6);
        p.m.visible = true; p.m.material.opacity = 1;
        if (++spawned >= n) break;
      }
    }
    update(dt) {
      for (const p of this.pool) {
        if (p.life <= 0) continue;
        p.life -= dt;
        if (p.life <= 0) { p.m.visible = false; continue; }
        p.v.y -= 4 * dt * (p.v.y > -1.5 ? 1 : 0);
        p.m.position.addScaledVector(p.v, dt);
        p.m.rotation.x += p.spin * dt; p.m.rotation.y += p.spin * 0.7 * dt;
        p.m.material.opacity = Math.min(1, p.life * 2);
      }
    }
  };

  /* ---------------- camera shake ---------------- */
  let shakeAmt = 0;
  PS.shake = (amt) => { shakeAmt = Math.max(shakeAmt, amt); };
  PS.shakeOffset = function (dt, out) {
    shakeAmt = Math.max(0, shakeAmt - dt * 2.2);
    out.set((Math.random() - 0.5) * shakeAmt, (Math.random() - 0.5) * shakeAmt, 0);
    return out;
  };

  /* ============================================================
     HUD + UI helpers
     ============================================================ */
  PS.hud = {
    show() { $('hud').classList.remove('hidden'); },
    hide() { $('hud').classList.add('hidden'); $('hud-msg').innerHTML = ''; },
    setNames(youName, youIcon, themName, themIcon) {
      $('sb-you-name').textContent = youName; $('sb-you-icon').textContent = youIcon;
      $('sb-them-name').textContent = themName; $('sb-them-icon').textContent = themIcon;
    },
    setScore(a, b) { $('sb-you-pts').textContent = a; $('sb-them-pts').textContent = b; },
    setTimer(sec, label) {
      const s = Math.max(0, Math.ceil(sec));
      $('timer-text').textContent = `${(s / 60) | 0}:${String(s % 60).padStart(2, '0')}`;
      $('hud-timer').classList.toggle('low', sec <= 15 && sec > 0);
      if (label !== undefined) $('timer-label').textContent = label;
    },
    setHint(html) { $('hint').innerHTML = html; },
    meterShow(lo, hi) {
      $('meter-wrap').classList.remove('hidden');
      const t = $('meter-target');
      t.style.bottom = lo * 100 + '%'; t.style.height = (hi - lo) * 100 + '%';
    },
    meterSet(v) { $('meter-fill').style.height = PS.clamp(v, 0, 1) * 100 + '%'; },
    meterHide() { $('meter-wrap').classList.add('hidden'); },
  };

  PS.popup = function (text, cls = '', ms = 1500) {
    const el = document.createElement('div');
    el.className = 'popup ' + cls;
    el.textContent = text;
    $('hud-msg').appendChild(el);
    setTimeout(() => el.remove(), ms);
  };

  const SCREENS = ['screen-title', 'screen-pig', 'screen-sport', 'screen-diff', 'screen-pause', 'screen-end'];
  PS.showScreen = function (id) {
    SCREENS.forEach((s) => $(s).classList.toggle('hidden', s !== id));
    // drop button focus so Space/Enter drive the game, not the last-clicked button
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  };

  /* ============================================================
     GAME FLOW — boot, menus, main loop, pause, match end
     ============================================================ */
  PS.config = { pig: PS.PIGS[0], sport: 'tennis', difficulty: 'normal' };
  PS.modes = {};
  PS.currentMode = null;
  let paused = false;
  let menuScene = null;
  let previewScene = null;
  let lastTime = 0;

  PS.togglePause = function () {
    if (!PS.currentMode) return;
    paused = !paused;
    $('screen-pause').classList.toggle('hidden', !paused);
  };

  PS.startGame = function () {
    audio.ensure();
    PS.showScreen(null);
    if (menuScene) { PS.disposeScene(menuScene.scene); menuScene = null; }
    paused = false;
    const mode = PS.modes[PS.config.sport];
    PS.currentMode = mode;
    mode.start({
      pig: PS.config.pig,
      difficulty: PS.config.difficulty,
      renderer: PS.renderer,
    });
    PS.hud.show();
  };

  PS.quitToMenu = function () {
    if (PS.currentMode) { PS.currentMode.dispose(); PS.currentMode = null; }
    paused = false;
    PS.hud.hide();
    PS.hud.meterHide();
    buildMenuScene();
    PS.showScreen('screen-title');
  };

  PS.matchOver = function (res) {
    // res: {you, them, stats:[{num,lbl}], win:'you'|'them'|'draw'}
    const mode = PS.currentMode;
    setTimeout(() => {
      const title = $('end-title');
      if (res.win === 'you') { title.textContent = 'YOU WIN! 🏆'; title.className = 'win'; audio.play('cheer', true); }
      else if (res.win === 'them') { title.textContent = 'DEFEAT… 🐽'; title.className = 'lose'; audio.play('aww'); }
      else { title.textContent = 'DRAW!'; title.className = 'draw'; }
      $('end-score').textContent = `${res.you} – ${res.them}`;
      $('end-stats').innerHTML = (res.stats || [])
        .map((s) => `<div class="endstat"><div class="num">${s.num}</div><div class="lbl">${s.lbl}</div></div>`)
        .join('');
      PS.showScreen('screen-end');
    }, 1600);
  };

  /* -------- menu background: podium + slowly orbiting camera -------- */
  function buildMenuScene() {
    const scene = new THREE.Scene();
    const cam = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.1, 400);
    const stadium = PS.makeStadium(scene, { innerW: 8, innerL: 10, theme: {} });
    const podium = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.9, 0.5, 32), PS.std(0xffcf5c, 0.4, 0.2));
    podium.position.y = 0.25; podium.receiveShadow = true; podium.castShadow = true;
    scene.add(podium);
    const court = new THREE.Mesh(new THREE.CircleGeometry(14, 40), PS.std(0x3e6eb8, 0.9));
    court.rotation.x = -Math.PI / 2; court.receiveShadow = true; scene.add(court);
    let pigMesh = null;
    const setPig = (def) => {
      if (pigMesh) { scene.remove(pigMesh); }
      pigMesh = PS.makePig(def);
      pigMesh.position.y = 0.5;
      scene.add(pigMesh);
    };
    setPig(PS.config.pig);
    // props
    const tball = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 12), PS.std(0xd8f24a, 0.55));
    tball.position.set(1.2, 0.72, 0.6); tball.castShadow = true; scene.add(tball);
    const bball = new THREE.Mesh(new THREE.SphereGeometry(0.32, 16, 12), PS.std(0xe07a33, 0.7));
    bball.position.set(-1.25, 0.82, 0.5); bball.castShadow = true; scene.add(bball);
    menuScene = {
      scene, cam, stadium, setPig,
      update(t, dt) {
        stadium.update(t, dt);
        const a = t * 0.25;
        cam.position.set(Math.sin(a) * 7.5, 3.4 + Math.sin(t * 0.5) * 0.4, Math.cos(a) * 7.5);
        cam.lookAt(0, 1.2, 0);
        if (pigMesh) {
          PS.animLocomotion(pigMesh, t, 0);
          pigMesh.rotation.y = Math.sin(t * 0.7) * 0.6;
        }
        PS.renderer.render(scene, cam);
      },
    };
  }

  /* -------- small pig preview on select screen -------- */
  function buildPreview() {
    const holder = $('pig-preview');
    const r = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    r.setPixelRatio(Math.min(devicePixelRatio, 2));
    r.setSize(holder.clientWidth, holder.clientHeight);
    r.outputEncoding = THREE.sRGBEncoding;
    holder.appendChild(r.domElement);
    const scene = new THREE.Scene();
    const cam = new THREE.PerspectiveCamera(40, holder.clientWidth / holder.clientHeight, 0.1, 50);
    cam.position.set(0, 1.35, 3.1); cam.lookAt(0, 0.85, 0);
    scene.add(new THREE.HemisphereLight(PS.C(0xdfeaff), PS.C(0x554444), 1.0));
    const key = new THREE.DirectionalLight(PS.C(0xfff2dd), 1.1); key.position.set(2, 4, 3); scene.add(key);
    let pig = null;
    previewScene = {
      renderer: r, scene, cam,
      setPig(def) {
        if (pig) scene.remove(pig);
        pig = PS.makePig(def);
        scene.add(pig);
      },
      update(t) {
        if (!pig) return;
        pig.rotation.y = t * 1.1;
        PS.animLocomotion(pig, t, 0);
        r.render(scene, cam);
      },
    };
    previewScene.setPig(PS.config.pig);
  }

  /* -------- menu wiring -------- */
  function wireMenus() {
    $('btn-play').onclick = () => { audio.ensure(); audio.play('chime'); PS.showScreen('screen-pig'); };
    $('btn-pig-back').onclick = () => PS.showScreen('screen-title');
    $('btn-pig-next').onclick = () => { audio.play('chime'); PS.showScreen('screen-sport'); };
    $('btn-sport-back').onclick = () => PS.showScreen('screen-pig');
    $('btn-sport-next').onclick = () => { audio.play('chime'); PS.showScreen('screen-diff'); };
    $('btn-diff-back').onclick = () => PS.showScreen('screen-sport');
    $('btn-start').onclick = () => { audio.play('cheer'); PS.startGame(); };
    $('btn-resume').onclick = () => PS.togglePause();
    $('btn-quit').onclick = () => { PS.showScreen(null); PS.quitToMenu(); };
    $('btn-rematch').onclick = () => { PS.showScreen(null); if (PS.currentMode) PS.currentMode.dispose(); PS.currentMode = null; PS.startGame(); };
    $('btn-menu').onclick = () => PS.quitToMenu();
    $('btn-pause').onclick = () => PS.togglePause();
    $('btn-mute').onclick = () => {
      audio.ensure();
      audio.setMuted(!audio.muted);
      $('btn-mute').textContent = audio.muted ? '🔇' : '🔊';
    };

    // pig cards
    const cardsEl = $('pig-cards');
    PS.PIGS.forEach((def) => {
      const card = document.createElement('div');
      card.className = 'card' + (def === PS.config.pig ? ' selected' : '');
      const st = def.stats;
      const bar = (lbl, v) =>
        `<div class="statbar"><span>${lbl}</span><div class="track"><div class="fill" style="width:${v * 100}%"></div></div></div>`;
      card.innerHTML = `<div class="emoji">${def.emoji}</div><h3>${def.name}</h3><p>${def.desc}</p>
        <div class="stats">${bar('SPD', st.speed)}${bar('PWR', st.power)}${bar('TCH', st.touch)}</div>`;
      card.onclick = () => {
        audio.play('oink');
        PS.config.pig = def;
        [...cardsEl.children].forEach((c) => c.classList.remove('selected'));
        card.classList.add('selected');
        if (previewScene) previewScene.setPig(def);
        if (menuScene) menuScene.setPig(def);
      };
      cardsEl.appendChild(card);
    });

    // sport cards
    const sportSel = (id, sport) => {
      $(id).onclick = () => {
        audio.play('chime');
        PS.config.sport = sport;
        $('card-tennis').classList.toggle('selected', sport === 'tennis');
        $('card-basketball').classList.toggle('selected', sport === 'basketball');
      };
    };
    sportSel('card-tennis', 'tennis'); sportSel('card-basketball', 'basketball');
    $('card-tennis').classList.add('selected');

    // difficulty cards
    const diffSel = (id, d) => {
      $(id).onclick = () => {
        audio.play(d === 'hard' ? 'ook' : 'chime');
        PS.config.difficulty = d;
        ['card-easy', 'card-normal', 'card-hard'].forEach((c) => $(c).classList.remove('selected'));
        $(id).classList.add('selected');
      };
    };
    diffSel('card-easy', 'easy'); diffSel('card-normal', 'normal'); diffSel('card-hard', 'hard');
    $('card-normal').classList.add('selected');
  }

  /* -------- boot -------- */
  PS.boot = function () {
    const canvas = $('game-canvas');
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.setSize(innerWidth, innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    PS.renderer = renderer;

    window.addEventListener('resize', () => {
      renderer.setSize(innerWidth, innerHeight);
      if (menuScene) { menuScene.cam.aspect = innerWidth / innerHeight; menuScene.cam.updateProjectionMatrix(); }
      if (PS.currentMode && PS.currentMode.onResize) PS.currentMode.onResize();
    });

    setupTouch();
    wireMenus();
    buildPreview();
    buildMenuScene();
    PS.showScreen('screen-title');
    $('loading').style.display = 'none';

    lastTime = performance.now();
    const tick = (now) => {
      requestAnimationFrame(tick);
      const dt = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;
      const t = now / 1000;
      if (PS.currentMode) {
        if (!paused) PS.currentMode.update(dt, t);
      } else if (menuScene) {
        menuScene.update(t, dt);
        if (previewScene && !$('screen-pig').classList.contains('hidden')) previewScene.update(t);
      }
      input.endFrame();
    };
    requestAnimationFrame(tick);
  };
})();
