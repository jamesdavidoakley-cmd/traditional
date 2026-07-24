/* Unified input: keyboard, touch (virtual joystick + big buttons) and gamepad.
   Movement is given in stick space; the player controller makes it camera-relative. */
PIP.input = (function () {
  var U = PIP.util;
  var keys = {};
  var state = {
    moveX: 0, moveZ: 0,
    jumpHeld: false, jumpPressed: false,
    actPressed: false, grabPressed: false, stompPressed: false,
    twirlPressed: false, sparklePressed: false,
    pausePressed: false,
    camDX: 0, camDY: 0,
    touchMode: false
  };
  var joy = { active: false, id: null, cx: 0, cy: 0, x: 0, y: 0 };
  var touchJumpHeld = false;
  var drag = { active: false, id: null, lx: 0, ly: 0 };
  var padHadJump = false, padHadAct = false, padHadGrab = false;

  var KEYMAP = {
    up: ['KeyW', 'ArrowUp'], down: ['KeyS', 'ArrowDown'],
    left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'],
    jump: ['Space'], act: ['KeyE', 'Enter'], grab: ['KeyQ'],
    stomp: ['KeyX', 'ControlLeft', 'ControlRight'], pause: ['Escape', 'KeyP'],
    twirl: ['KeyF'], sparkle: ['KeyG']
  };
  function anyDown(list) { for (var i = 0; i < list.length; i++) if (keys[list[i]]) return true; return false; }

  window.addEventListener('keydown', function (e) {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    if (!keys[e.code]) {
      if (KEYMAP.jump.indexOf(e.code) !== -1) state.jumpPressed = true;
      if (KEYMAP.act.indexOf(e.code) !== -1) state.actPressed = true;
      if (KEYMAP.grab.indexOf(e.code) !== -1) state.grabPressed = true;
      if (KEYMAP.stomp.indexOf(e.code) !== -1) state.stompPressed = true;
      if (KEYMAP.twirl.indexOf(e.code) !== -1) state.twirlPressed = true;
      if (KEYMAP.sparkle.indexOf(e.code) !== -1) state.sparklePressed = true;
      if (KEYMAP.pause.indexOf(e.code) !== -1) state.pausePressed = true;
    }
    keys[e.code] = true;
    if (e.code === 'Space' || e.code.indexOf('Arrow') === 0) e.preventDefault();
  });
  window.addEventListener('keyup', function (e) { keys[e.code] = false; });
  window.addEventListener('blur', function () { keys = {}; });

  /* ---------- touch joystick ---------- */
  function setupTouch() {
    var joyEl = U.el('joy'), knob = U.el('joy-knob');
    function setKnob(dx, dy) {
      knob.style.left = (45 + dx * 45) + 'px';
      knob.style.top = (45 + dy * 45) + 'px';
    }
    joyEl.addEventListener('pointerdown', function (e) {
      state.touchMode = true;
      joy.active = true; joy.id = e.pointerId;
      var r = joyEl.getBoundingClientRect();
      joy.cx = r.left + r.width / 2; joy.cy = r.top + r.height / 2;
      joyEl.setPointerCapture(e.pointerId);
      e.preventDefault();
    });
    joyEl.addEventListener('pointermove', function (e) {
      if (!joy.active || e.pointerId !== joy.id) return;
      var dx = (e.clientX - joy.cx) / 60, dy = (e.clientY - joy.cy) / 60;
      var m = Math.hypot(dx, dy);
      if (m > 1) { dx /= m; dy /= m; }
      joy.x = dx; joy.y = dy; setKnob(dx, dy);
    });
    function joyEnd(e) {
      if (e.pointerId !== joy.id) return;
      joy.active = false; joy.x = 0; joy.y = 0; setKnob(0, 0);
    }
    joyEl.addEventListener('pointerup', joyEnd);
    joyEl.addEventListener('pointercancel', joyEnd);

    function bindBtn(id, press, release) {
      var el = U.el(id);
      el.addEventListener('pointerdown', function (e) { state.touchMode = true; press(); e.preventDefault(); });
      if (release) {
        el.addEventListener('pointerup', release);
        el.addEventListener('pointercancel', release);
      }
    }
    bindBtn('btn-jump', function () { state.jumpPressed = true; touchJumpHeld = true; },
      function () { touchJumpHeld = false; });
    bindBtn('btn-act', function () { state.actPressed = true; });
    bindBtn('btn-grab', function () { state.grabPressed = true; });
    if (U.el('btn-twirl')) bindBtn('btn-twirl', function () { state.twirlPressed = true; });
    if (U.el('btn-sparkle')) bindBtn('btn-sparkle', function () { state.sparklePressed = true; });
  }

  /* ---------- camera drag on the canvas ---------- */
  function setupDrag(canvas) {
    canvas.addEventListener('pointerdown', function (e) {
      drag.active = true; drag.id = e.pointerId; drag.lx = e.clientX; drag.ly = e.clientY;
    });
    window.addEventListener('pointermove', function (e) {
      if (!drag.active || e.pointerId !== drag.id) return;
      state.camDX += (e.clientX - drag.lx) * 0.006;
      state.camDY += (e.clientY - drag.ly) * 0.006;
      drag.lx = e.clientX; drag.ly = e.clientY;
    });
    function end(e) { if (e.pointerId === drag.id) drag.active = false; }
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
  }

  /* ---------- per-frame ---------- */
  function update() {
    var mx = 0, mz = 0;
    if (anyDown(KEYMAP.left)) mx -= 1;
    if (anyDown(KEYMAP.right)) mx += 1;
    if (anyDown(KEYMAP.up)) mz -= 1;
    if (anyDown(KEYMAP.down)) mz += 1;
    if (joy.active) { mx = joy.x; mz = joy.y; }

    // gamepad
    var pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (var i = 0; i < pads.length; i++) {
      var p = pads[i];
      if (!p || !p.connected) continue;
      if (Math.abs(p.axes[0]) > 0.22) mx = p.axes[0];
      if (Math.abs(p.axes[1]) > 0.22) mz = p.axes[1];
      if (p.axes.length > 3) {
        if (Math.abs(p.axes[2]) > 0.25) state.camDX += p.axes[2] * 0.04;
        if (Math.abs(p.axes[3]) > 0.25) state.camDY += p.axes[3] * 0.03;
      }
      var j = p.buttons[0] && p.buttons[0].pressed;
      var a = p.buttons[2] && p.buttons[2].pressed;
      var g = p.buttons[1] && p.buttons[1].pressed;
      if (j && !padHadJump) state.jumpPressed = true;
      if (a && !padHadAct) state.actPressed = true;
      if (g && !padHadGrab) state.grabPressed = true;
      if (j) state.jumpHeld = true;
      padHadJump = j; padHadAct = a; padHadGrab = g;
      break;
    }

    var m = Math.hypot(mx, mz);
    if (m > 1) { mx /= m; mz /= m; }
    state.moveX = mx; state.moveZ = mz;
    state.jumpHeld = state.jumpHeld || anyDown(KEYMAP.jump) || touchJumpHeld;
  }
  function endFrame() {
    state.jumpPressed = false; state.actPressed = false; state.grabPressed = false;
    state.stompPressed = false; state.pausePressed = false;
    state.twirlPressed = false; state.sparklePressed = false;
    state.camDX = 0; state.camDY = 0;
    state.jumpHeld = anyDown(KEYMAP.jump) || touchJumpHeld;
  }

  return {
    state: state, update: update, endFrame: endFrame,
    setupTouch: setupTouch, setupDrag: setupDrag
  };
})();
