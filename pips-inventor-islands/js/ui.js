/* HUD, dialogue, toasts, goal banner, menus, settings and the grown-up area. */
PIP.ui = (function () {
  var U = PIP.util;
  var modalCount = 0;          // >0 while any overlay wants player control frozen
  var dlg = { open: false, lines: [], idx: 0, resolve: null, face: '🪨', name: '' };
  var currentGoalText = '';

  function busy() { return modalCount > 0; }
  function pushModal() { modalCount++; }
  function popModal() { modalCount = Math.max(0, modalCount - 1); }

  /* ---------- HUD ---------- */
  function updateHUD() {
    U.setText('seed-count', String(PIP.save.seedCount()));
    var order = ['meadow', 'grove', 'harbour', 'mountain', 'factory'];
    var s = '';
    order.forEach(function (w) { s += PIP.save.hasCore(w) ? '●' : '○'; });
    U.setText('core-icons', s);
  }
  function showPrompt(text, key) {
    U.setText('prompt-text', text);
    U.setText('prompt-key', PIP.input.state.touchMode ? 'DO' : (key || 'E'));
    U.show('prompt');
  }
  function hidePrompt() { U.hide('prompt'); }

  function setGoal(text, speak) {
    currentGoalText = text;
    U.setText('goal-text', text);
    U.show('goal-banner');
    if (speak !== false) PIP.narrate.say(text);
  }
  function clearGoal() { currentGoalText = ''; U.hide('goal-banner'); }

  function toast(icon, text, ms) {
    var zone = U.el('toast-zone');
    var t = document.createElement('div');
    t.className = 'toast';
    t.innerHTML = '<span style="font-size:26px">' + icon + '</span><span></span>';
    t.lastChild.textContent = text;
    zone.appendChild(t);
    setTimeout(function () {
      t.style.opacity = '0'; t.style.transition = 'opacity .4s';
      setTimeout(function () { zone.removeChild(t); }, 450);
    }, ms || 3200);
  }

  function fade(dark) {
    var f = U.el('fader');
    f.classList.toggle('dark', !!dark);
    return U.wait(PIP.save.settings.reducedMotion ? 150 : 520);
  }

  /* ---------- dialogue ---------- */
  function say(name, face, lines, opts) {
    opts = opts || {};
    if (typeof lines === 'string') lines = [lines];
    return new Promise(function (resolve) {
      pushModal();
      dlg.open = true; dlg.lines = lines; dlg.idx = 0; dlg.resolve = resolve;
      dlg.name = name; dlg.face = face || '🪨';
      U.setText('dlg-name', name);
      U.setText('dlg-face', ''); U.el('dlg-face').textContent = face || '🪨';
      U.show('dialogue');
      showLine();
    });
  }
  function showLine() {
    var text = dlg.lines[dlg.idx];
    U.setText('dlg-text', text);
    U.setText('dlg-next', dlg.idx < dlg.lines.length - 1 ? 'Tap ▶' : 'Tap ✔');
    PIP.audio.play('talk');
    PIP.narrate.stop();
    PIP.narrate.hideSubtitle(); // the dialogue box IS the caption
    PIP.narrate.say(text, { sub: false });
  }
  function advanceDialogue() {
    if (!dlg.open) return;
    if (dlg.idx < dlg.lines.length - 1) { dlg.idx++; showLine(); }
    else closeDialogue();
  }
  function closeDialogue() {
    if (!dlg.open) return;
    dlg.open = false;
    PIP.narrate.stop();
    U.hide('dialogue');
    popModal();
    var r = dlg.resolve; dlg.resolve = null;
    if (r) r();
  }

  /* ---------- summary card ---------- */
  function summary(opts) {
    return new Promise(function (resolve) {
      pushModal();
      U.setText('sum-title', opts.title || 'You did it!');
      var m = U.el('sum-maths');
      if (opts.maths) { m.textContent = opts.maths; m.parentElement.style.display = ''; }
      else m.parentElement.style.display = 'none';
      U.setText('sum-text', opts.text || '');
      U.setText('sum-stars', opts.stars || '⭐⭐⭐');
      U.show('summary-card');
      PIP.audio.play('success');
      var t = opts.title || '';
      if (t && !/[.!?]$/.test(t)) t += '.';
      var spoken = (t ? t + ' ' : '') + (opts.speak || opts.text || '');
      PIP.narrate.say(spoken);
      U.el('sum-ok').onclick = function () {
        PIP.narrate.stop();
        U.hide('summary-card');
        popModal();
        resolve();
      };
    });
  }

  /* ---------- pause / settings / map ---------- */
  function openPause() {
    pushModal(); U.show('pause-menu');
  }
  function closePause() { U.hide('pause-menu'); popModal(); }

  function syncSettingsUI() {
    var s = PIP.save.settings;
    U.el('set-music').value = Math.round(s.musicVol * 100);
    U.el('set-sfx').value = Math.round(s.sfxVol * 100);
    setSwitch('set-voice', s.voice);
    setSwitch('set-subtitles', s.subtitles);
    setSwitch('set-bigtext', s.bigText);
    setSwitch('set-contrast', s.highContrast);
    setSwitch('set-motion', s.reducedMotion);
    setSwitch('set-assistcam', s.assistCam);
    setSwitch('set-chatter', s.chatter);
  }
  function setSwitch(id, on) { U.el(id).classList.toggle('on', !!on); }
  function applyBodyClasses() {
    var s = PIP.save.settings;
    document.body.classList.toggle('big-text', s.bigText);
    document.body.classList.toggle('high-contrast', s.highContrast);
    document.body.classList.toggle('reduced-motion', s.reducedMotion);
  }
  function bindSwitch(id, key, after) {
    U.el(id).addEventListener('click', function () {
      PIP.save.settings[key] = !PIP.save.settings[key];
      PIP.save.persist();
      setSwitch(id, PIP.save.settings[key]);
      applyBodyClasses();
      PIP.audio.play('pop');
      if (after) after();
    });
  }

  var WORLD_INFO = [
    { id: 'meadow', icon: '🍓', name: 'Numberberry Meadow', missions: ['meadow.stones', 'meadow.bridge', 'meadow.picnic'], open: true },
    { id: 'grove', icon: '⚙️', name: 'Gearleaf Grove', missions: ['grove.lift', 'grove.balance'], needsCore: 'meadow', partial: true },
    { id: 'harbour', icon: '⛵', name: 'Shape Sail Harbour', missions: [], soon: true },
    { id: 'mountain', icon: '🏔️', name: 'Measure Mountain', missions: [], soon: true },
    { id: 'factory', icon: '🏭', name: 'Patternworks Factory', missions: [], soon: true }
  ];
  function renderMap() {
    var box = U.el('map-rows');
    box.innerHTML = '';
    WORLD_INFO.forEach(function (w) {
      var row = document.createElement('div');
      row.className = 'world-row';
      var ticks = '';
      w.missions.forEach(function (m) { ticks += PIP.save.mission(m) === 'done' ? '✅' : '⬜'; });
      if (PIP.save.hasCore(w.id)) ticks += ' 💡';
      var status = w.soon ? 'Still being invented — coming soon!' :
        (w.needsCore && !PIP.save.hasCore(w.needsCore)) ? 'Locked — find the ' + w.needsCore + ' Idea Core first' :
        (w.partial ? 'Open! (more missions growing soon)' : 'Open!');
      row.innerHTML = '<div class="w-icon">' + w.icon + '</div>' +
        '<div><div class="w-name">' + w.name + '</div><div class="w-info">' + status + '</div></div>' +
        '<div class="w-ticks">' + ticks + '</div>';
      box.appendChild(row);
    });
  }

  /* ---------- adult area ---------- */
  var adultAnswer = 0;
  function openAdultGate() {
    pushModal();
    U.show('adult-gate');
    U.hide('adult-check');
    U.el('adult-hold-fill').style.clipPath = 'polygon(50% 0,50% 0,50% 0,50% 0)';
  }
  function closeAdultGate() { U.hide('adult-gate'); popModal(); }

  function setupAdultGate() {
    var ring = U.el('adult-hold-ring'), fill = U.el('adult-hold-fill');
    var holdT = null, holdStart = 0;
    function updateFill() {
      var p = Math.min(1, (Date.now() - holdStart) / 3000);
      // reveal ring as a growing pie
      var a = p * Math.PI * 2 - Math.PI / 2;
      var pts = ['50% 50%', '50% 0%'];
      var steps = Math.ceil(p * 24);
      for (var i = 1; i <= steps; i++) {
        var t = -Math.PI / 2 + (i / 24) * Math.PI * 2 * Math.min(1, p / 1);
        if (t > a) t = a;
        pts.push((50 + 60 * Math.cos(t)) + '% ' + (50 + 60 * Math.sin(t)) + '%');
      }
      fill.style.clipPath = 'polygon(' + pts.join(',') + ')';
      if (p >= 1) {
        stopHold();
        // simple adult check: a times-table question a 6-year-old is unlikely to answer
        var a1 = U.randInt(6, 9), b1 = U.randInt(6, 9);
        adultAnswer = a1 * b1;
        U.setText('adult-check-q', 'What is ' + a1 + ' × ' + b1 + '?');
        U.el('adult-check-input').value = '';
        U.show('adult-check');
        U.el('adult-check-input').focus();
      } else holdT = requestAnimationFrame(updateFill);
    }
    function startHold(e) { holdStart = Date.now(); holdT = requestAnimationFrame(updateFill); e.preventDefault(); }
    function stopHold() { if (holdT) cancelAnimationFrame(holdT); holdT = null; }
    ring.addEventListener('pointerdown', startHold);
    ring.addEventListener('pointerup', function () {
      stopHold();
      if (!U.el('adult-check').classList.contains('hidden')) return;
      fill.style.clipPath = 'polygon(50% 0,50% 0,50% 0,50% 0)';
    });
    ring.addEventListener('pointercancel', stopHold);
    U.el('adult-check-go').addEventListener('click', function () {
      if (parseInt(U.el('adult-check-input').value, 10) === adultAnswer) {
        closeAdultGate(); openAdultPanel();
      } else {
        U.el('adult-check-input').value = '';
        U.setText('adult-check-q', 'Not quite — try again. ' + U.el('adult-check-q').textContent.replace('Not quite — try again. ', ''));
      }
    });
    U.el('adult-cancel').addEventListener('click', closeAdultGate);
  }

  var CONCEPT_NAMES = {
    counting: 'Counting objects to 20',
    bonds10: 'Number bonds to 10',
    addition: 'Addition by combining',
    subtraction: 'Subtraction & difference',
    sharing: 'Equal sharing & grouping',
    comparing: 'More, fewer and equal',
    patterns: 'Patterns (repeating & growing)',
    missing: 'Missing numbers (□ + 3 = 8)',
    equality: 'Balance & the equals sign',
    doubles: 'Doubles and halves',
    counting2s: 'Counting in twos',
    shapes: '2D and 3D shapes',
    measure: 'Comparing length & mass',
    dtStructure: 'DT: stable structures',
    dtMechanism: 'DT: wheels, gears & levers',
    dtTest: 'DT: testing & improving',
    dtMaterials: 'DT: choosing materials'
  };
  var BADGE_NAMES = {
    counter: ['🔢', 'Careful Counter'],
    pattern: ['🌸', 'Pattern Finder'],
    tester: ['🧪', 'Brave Tester'],
    improver: ['🔧', 'Clever Improver'],
    shape: ['🔷', 'Shape Spotter'],
    sharer: ['🍓', 'Fair Sharer'],
    mechanism: ['⚙️', 'Mechanism Maker']
  };

  function openAdultPanel() {
    pushModal();
    U.show('adult-panel');
    renderAdultTab('learning');
  }
  function renderAdultTab(tab) {
    var tabs = document.querySelectorAll('.adult-tab');
    tabs.forEach(function (t) { t.classList.toggle('on', t.dataset.tab === tab); });
    var body = U.el('adult-tab-body');
    body.innerHTML = '';
    var d = PIP.save.data;
    if (tab === 'learning') {
      var mins = Math.round(d.playMs / 60000);
      var head = document.createElement('div');
      head.className = 'adult-note';
      head.textContent = 'Approximate play time: ' + (mins < 60 ? mins + ' minutes' : Math.floor(mins / 60) + ' h ' + (mins % 60) + ' min') +
        '. These notes describe what your child has been practising in the game — they are not a test result.';
      body.appendChild(head);
      var any = false;
      for (var id in CONCEPT_NAMES) {
        var state = PIP.save.conceptState(id);
        if (!state) continue;
        any = true;
        var c = d.concepts[id];
        var row = document.createElement('div');
        row.className = 'concept-row';
        var cls = state === 'Usually secure' ? 'secure' : state === 'Developing' ? 'developing' :
          state === 'Ready for a greater challenge' ? 'ready' : 'practising';
        row.innerHTML = '<div>' + CONCEPT_NAMES[id] +
          '<div class="w-info" style="font-size:.8em;color:#9fb8ab">' + c.attempts + ' tries · ' + c.hints + ' hints used</div></div>' +
          '<div class="c-state ' + cls + '">' + state + '</div>';
        body.appendChild(row);
      }
      if (!any) {
        var none = document.createElement('p');
        none.className = 'adult-note';
        none.textContent = 'No activities tried yet — the notes will appear here as your child plays.';
        body.appendChild(none);
      }
      var badges = document.createElement('div');
      badges.className = 'adult-note';
      var earned = [];
      for (var b in BADGE_NAMES) if (d.badges[b]) earned.push(BADGE_NAMES[b][0] + ' ' + BADGE_NAMES[b][1]);
      badges.textContent = earned.length ? 'Inventor Badges earned: ' + earned.join(' · ') : 'No Inventor Badges yet — they reward behaviours like testing bravely and sharing fairly.';
      body.appendChild(badges);
    } else if (tab === 'designs') {
      if (!d.designs.length) {
        body.innerHTML = '<p class="adult-note">Nothing built yet. Finished inventions (bridges, machines…) will be displayed here and in Pip’s workshop.</p>';
      } else d.designs.forEach(function (des) {
        var row = document.createElement('div');
        row.className = 'concept-row';
        row.innerHTML = '<div><span style="font-size:24px">' + des.icon + '</span> <b>' + des.name + '</b>' +
          '<div class="w-info" style="font-size:.85em;color:#9fb8ab">' + des.note + '</div></div>';
        body.appendChild(row);
      });
    } else if (tab === 'options') {
      body.innerHTML =
        '<div class="setting-row"><label>Learning emphasis</label><select id="opt-emphasis">' +
        '<option value="balanced">Balanced</option><option value="maths">More maths</option><option value="dt">More design & technology</option></select></div>' +
        '<div class="setting-row"><label>Number range</label><select id="opt-range">' +
        '<option value="auto">Adapt automatically (recommended)</option><option value="small">Keep numbers small</option>' +
        '<option value="standard">Standard Year 1</option><option value="stretch">Stretch</option></select></div>' +
        '<p class="adult-note">“Adapt automatically” gently adjusts each idea separately: three confident answers nudge a concept up, a couple of stumbles bring in smaller numbers and extra scaffolding. Difficulty never changes the jumping or platforming.</p>' +
        '<div class="setting-row"><label>Erase all progress</label><button class="btn small ghost" id="opt-reset">Erase…</button></div>';
      U.el('opt-emphasis').value = d.settings.emphasis;
      U.el('opt-range').value = d.settings.numberRange;
      U.el('opt-emphasis').onchange = function () { d.settings.emphasis = this.value; PIP.save.persist(); };
      U.el('opt-range').onchange = function () { d.settings.numberRange = this.value; PIP.save.persist(); };
      U.el('opt-reset').onclick = function () {
        if (confirm('Erase all progress and settings on this device? This cannot be undone.')) {
          PIP.save.reset(); location.reload();
        }
      };
    } else if (tab === 'offline') {
      body.innerHTML = '<p class="adult-note">Ideas that carry the game’s learning into real life:</p>' +
        ['🍽️ Share out snacks so everyone gets the same amount — then check by counting each plate.',
          '🧱 Build a bridge between two chairs from cardboard. Test it with a toy. Ask: “What could make it stronger?” Try triangles!',
          '🧦 Make a repeating pattern from socks or pegs and ask your child what comes next — then let them make one for you.',
          '🥄 A mystery-bag game: put some spoons in a bag, show 3 outside, say “there are 8 altogether — how many are hiding?”',
          '📏 Compare heights of teddies with a string “ruler”. Which is tallest? How many hand-widths long is the table?',
          '🛠️ When something at home breaks or wobbles, wonder aloud: “Why did it fail? What one thing could we change?” — that is the whole design cycle.'
        ].map(function (t) { return '<div class="concept-row"><div>' + t + '</div></div>'; }).join('');
    }
  }

  /* ---------- init ---------- */
  function init(hooks) {
    // hooks: {onResume, onVillage, onInstructions}
    U.el('pause-btn').addEventListener('click', function () { PIP.audio.play('pop'); openPause(); });
    U.el('pm-resume').addEventListener('click', function () { PIP.audio.play('pop'); closePause(); });
    U.el('pm-settings').addEventListener('click', function () { PIP.audio.play('pop'); syncSettingsUI(); pushModal(); U.show('settings-panel'); });
    U.el('set-done').addEventListener('click', function () { PIP.audio.play('pop'); U.hide('settings-panel'); popModal(); });
    U.el('pm-village').addEventListener('click', function () { closePause(); hooks.onVillage(); });
    U.el('pm-instructions').addEventListener('click', function () {
      closePause();
      if (currentGoalText) PIP.narrate.say(currentGoalText);
      else if (hooks.onInstructions) hooks.onInstructions();
    });
    U.el('pm-adult').addEventListener('click', function () { closePause(); openAdultGate(); });
    U.el('map-btn').addEventListener('click', function () { PIP.audio.play('pop'); renderMap(); pushModal(); U.show('map-panel'); });
    U.el('map-done').addEventListener('click', function () { PIP.audio.play('pop'); U.hide('map-panel'); popModal(); });
    U.el('goal-replay').addEventListener('click', function () { if (currentGoalText) PIP.narrate.say(currentGoalText); });
    U.el('hint-btn').addEventListener('click', function () { PIP.challenge.requestHint(); });
    U.el('dialogue').addEventListener('click', advanceDialogue);
    U.el('dlg-replay').addEventListener('click', function (e) {
      e.stopPropagation();
      PIP.narrate.stop();
      PIP.narrate.say(dlg.lines[dlg.idx], { sub: false });
    });
    U.el('adult-done').addEventListener('click', function () { U.hide('adult-panel'); popModal(); });
    document.querySelectorAll('.adult-tab').forEach(function (t) {
      t.addEventListener('click', function () { renderAdultTab(t.dataset.tab); });
    });

    U.el('set-music').addEventListener('input', function () {
      PIP.save.settings.musicVol = this.value / 100; PIP.save.persist(); PIP.audio.applyVolumes();
    });
    U.el('set-sfx').addEventListener('input', function () {
      PIP.save.settings.sfxVol = this.value / 100; PIP.save.persist(); PIP.audio.applyVolumes(); PIP.audio.play('pop');
    });
    bindSwitch('set-voice', 'voice', function () { if (!PIP.save.settings.voice) PIP.narrate.stop(); });
    bindSwitch('set-subtitles', 'subtitles');
    bindSwitch('set-bigtext', 'bigText');
    bindSwitch('set-contrast', 'highContrast');
    bindSwitch('set-motion', 'reducedMotion');
    bindSwitch('set-assistcam', 'assistCam');
    bindSwitch('set-chatter', 'chatter');
    setupAdultGate();
    applyBodyClasses();

    // keyboard advance for dialogue — swallow the press so closing a chat
    // never instantly triggers the interactable you are standing next to
    window.addEventListener('keydown', function (e) {
      if (!dlg.open) return;
      if (e.code === 'Space' || e.code === 'Enter' || e.code === 'KeyE') {
        advanceDialogue();
        PIP.input.state.actPressed = false;
        PIP.input.state.jumpPressed = false;
        e.preventDefault();
      }
    });
  }

  return {
    init: init, busy: busy, pushModal: pushModal, popModal: popModal,
    updateHUD: updateHUD, showPrompt: showPrompt, hidePrompt: hidePrompt,
    setGoal: setGoal, clearGoal: clearGoal, toast: toast, fade: fade,
    say: say, dialogueOpen: function () { return dlg.open; }, advanceDialogue: advanceDialogue,
    summary: summary, openPause: openPause, closePause: closePause,
    BADGE_NAMES: BADGE_NAMES, renderMap: renderMap
  };
})();
