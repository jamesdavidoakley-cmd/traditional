/* Snap-slot construction system.
   Children pick a part from the palette, then tap a glowing slot in the world.
   Constrained on purpose: parts only fit valid points, rotation is automatic,
   removing a part is one tap, resetting is free, testing is always safe. */
PIP.builder = (function () {
  var U = PIP.util;
  var A = PIP.assets;
  var state = null; // active build session
  var raycaster = new THREE.Raycaster();
  var pointer = new THREE.Vector2();

  function start(cfg) {
    // cfg: {scene, camera:{pos:V3, look:V3}, parts:[], slots:[], tip,
    //        onTest(api), canTest():string|null, onExit(), allowBack:bool}
    return new Promise(function (resolve) {
      state = {
        cfg: cfg, resolve: resolve, selected: null,
        stock: {}, ghosts: [], placed: {}, testing: false, time: 0
      };
      cfg.parts.forEach(function (p) { state.stock[p.id] = p.count; });

      // ghost meshes for every slot
      cfg.slots.forEach(function (slot) {
        var ghost = slot.ghost ? slot.ghost() : defaultGhost();
        ghost.position.copy(slot.pos);
        if (slot.rot) ghost.rotation.copy(slot.rot);
        ghost.visible = false;
        ghost.userData.slotId = slot.id;
        cfg.scene.add(ghost);
        slot._ghost = ghost;
        slot.placed = null;
        state.ghosts.push(ghost);
      });

      renderPalette();
      U.setText('builder-tip', cfg.tip || 'Pick a part, then tap a glowing spot!');
      U.show('builder-ui');
      U.el('build-back').classList.toggle('hidden', cfg.allowBack === false);
      updateGhosts();
    });
  }

  function defaultGhost() {
    var m = new THREE.Mesh(
      new THREE.SphereGeometry(0.42, 10, 8),
      new THREE.MeshBasicMaterial({ color: 0xffe27a, transparent: true, opacity: 0.4, depthWrite: false })
    );
    return m;
  }

  function isActive() { return !!state; }

  function renderPalette() {
    var pal = U.el('palette');
    pal.innerHTML = '';
    state.cfg.parts.forEach(function (p) {
      var left = state.stock[p.id];
      var card = document.createElement('div');
      card.className = 'part-card' + (state.selected === p.id ? ' selected' : '') + (left <= 0 ? ' empty' : '');
      card.innerHTML = '<div class="part-icon">' + p.icon + '</div><div class="part-name">' + p.name +
        '</div><div class="part-count">× ' + left + '</div>';
      card.addEventListener('click', function () {
        if (state.selected === p.id) state.selected = null;
        else state.selected = p.id;
        PIP.audio.play('pop');
        if (state.selected && p.tip) PIP.narrate.callout(p.tip);
        renderPalette(); updateGhosts();
      });
      pal.appendChild(card);
    });
  }

  function updateGhosts() {
    if (!state) return;
    state.cfg.slots.forEach(function (slot) {
      var show = !slot.placed && state.selected &&
        slot.accepts.indexOf(state.selected) !== -1 &&
        (!slot.enabled || slot.enabled());
      slot._ghost.visible = !!show;
    });
  }

  function slotById(id) {
    for (var i = 0; i < state.cfg.slots.length; i++)
      if (state.cfg.slots[i].id === id) return state.cfg.slots[i];
    return null;
  }
  function partById(id) {
    for (var i = 0; i < state.cfg.parts.length; i++)
      if (state.cfg.parts[i].id === id) return state.cfg.parts[i];
    return null;
  }

  function place(slot, partId) {
    var part = partById(partId);
    if (!part || state.stock[partId] <= 0) return;
    var m = part.make();
    m.position.copy(slot.pos);
    if (slot.rot) m.rotation.copy(slot.rot);
    if (slot.placeTransform) slot.placeTransform(m);
    state.cfg.scene.add(m);
    slot.placed = { partId: partId, mesh: m };
    state.stock[partId]--;
    if (state.stock[partId] <= 0 && state.selected === partId) state.selected = null;
    PIP.audio.play('place');
    if (slot.onPlace) slot.onPlace(partId);
    renderPalette(); updateGhosts();
  }
  function remove(slot) {
    if (!slot.placed) return;
    state.cfg.scene.remove(slot.placed.mesh);
    state.stock[slot.placed.partId]++;
    slot.placed = null;
    PIP.audio.play('pop');
    renderPalette(); updateGhosts();
  }
  function resetAll() {
    state.cfg.slots.forEach(function (s) { if (s.placed) remove(s); });
    PIP.audio.play('whoosh');
  }

  function counts() {
    var c = {};
    state.cfg.slots.forEach(function (s) {
      if (s.placed) {
        c[s.placed.partId] = (c[s.placed.partId] || 0) + 1;
        if (s.group) c['group:' + s.group] = (c['group:' + s.group] || 0) + 1;
      }
    });
    return c;
  }
  function placements() { return state ? state.cfg.slots : []; }

  function onPointerDown(e, camera) {
    if (!state || state.testing) return false;
    var el = e.target;
    if (el && el !== document.body && el.id !== 'game-canvas') return false; // UI click
    pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
    pointer.y = -(e.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);

    // Mistake-proof modes: while a part card is held, taps can ONLY place
    // (a near-miss never yanks out a piece you already placed). With the
    // card put down, taps take placed parts back.
    var placedMeshes = [];
    state.cfg.slots.forEach(function (s) { if (s.placed) placedMeshes.push(s.placed.mesh); });
    if (state.selected) {
      var ghostHits = raycaster.intersectObjects(state.ghosts.filter(function (g) { return g.visible; }), true);
      if (ghostHits.length) {
        var g = ghostHits[0].object;
        while (g && !g.userData.slotId) g = g.parent;
        if (g) { place(slotById(g.userData.slotId), state.selected); return true; }
      }
      if (raycaster.intersectObjects(placedMeshes, true).length) {
        PIP.narrate.callout('Tap the part card again to put it down — then you can take pieces back.');
        return true;
      }
      return false;
    }
    var placedHits = raycaster.intersectObjects(placedMeshes, true);
    if (placedHits.length) {
      var obj = placedHits[0].object;
      for (var i = 0; i < state.cfg.slots.length; i++) {
        var s = state.cfg.slots[i];
        if (s.placed && (s.placed.mesh === obj || isDescendant(s.placed.mesh, obj))) { remove(s); return true; }
      }
    }
    return false;
  }
  function isDescendant(root, obj) {
    var found = false;
    root.traverse(function (o) { if (o === obj) found = true; });
    return found;
  }

  function update(dt) {
    if (!state) return;
    state.time += dt;
    // pulse outwards only, so the clickable area never shrinks below full size
    var pulse = 1.08 + Math.sin(state.time * 4) * 0.12;
    state.ghosts.forEach(function (g) { if (g.visible) g.scale.setScalar(pulse); });
  }

  function finish(result) {
    if (!state) return;
    cleanup(false);
    var r = state.resolve; var st = state; state = null;
    U.hide('builder-ui');
    if (st.cfg.onExit) st.cfg.onExit();
    r(result || { done: true });
  }
  function cancel() {
    if (!state) return;
    // return parts, remove ghosts and placed meshes stay? On cancel keep placements (child may come back)
    cleanup(true);
    var r = state.resolve; var st = state; state = null;
    U.hide('builder-ui');
    if (st.cfg.onExit) st.cfg.onExit();
    r(null);
  }
  function cleanup(removePlaced) {
    state.ghosts.forEach(function (g) { state.cfg.scene.remove(g); });
    if (removePlaced) state.cfg.slots.forEach(function (s) {
      if (s.placed) { state.cfg.scene.remove(s.placed.mesh); s.placed = null; }
    });
  }

  function setTesting(v) { if (state) state.testing = v; }
  function stockOf(id) { return state ? state.stock[id] : 0; }

  function initButtons() {
    U.el('build-test').addEventListener('click', function () {
      if (!state || state.testing) return;
      var why = state.cfg.canTest ? state.cfg.canTest() : null;
      if (why) { PIP.narrate.say(why); PIP.audio.play('notyet'); return; }
      state.cfg.onTest({ counts: counts(), slots: state.cfg.slots });
    });
    U.el('build-reset').addEventListener('click', function () { if (state && !state.testing) resetAll(); });
    U.el('build-back').addEventListener('click', function () { if (state && !state.testing) cancel(); });
  }

  return {
    start: start, isActive: isActive, onPointerDown: onPointerDown, update: update,
    finish: finish, cancel: cancel, counts: counts, placements: placements,
    setTesting: setTesting, initButtons: initButtons, stockOf: stockOf,
    updateGhosts: updateGhosts
  };
})();
