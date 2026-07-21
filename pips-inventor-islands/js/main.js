/* Boot, render loop and world switching. */
(function () {
  var U = PIP.util;
  var game = PIP.game = {
    renderer: null, scene: null, camera: null,
    world: null, worldId: null,
    running: false, camTween: null
  };
  var clock = null, playTimeAcc = 0;

  function boot() {
    var canvas = U.el('game-canvas');
    game.renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
    game.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    game.renderer.setSize(window.innerWidth, window.innerHeight);
    game.renderer.shadowMap.enabled = true;
    game.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    game.scene = new THREE.Scene();
    game.camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.1, 300);
    game.camera.position.set(0, 6, 10);

    window.addEventListener('resize', function () {
      game.camera.aspect = window.innerWidth / window.innerHeight;
      game.camera.updateProjectionMatrix();
      game.renderer.setSize(window.innerWidth, window.innerHeight);
    });

    PIP.player.create(game.scene);
    PIP.input.setupTouch();
    PIP.input.setupDrag(canvas);
    PIP.builder.initButtons();
    PIP.ui.init({
      onVillage: function () { if (game.worldId !== 'hub') gotoWorld('hub'); },
      onInstructions: function () {
        PIP.narrate.say('Explore, jump, and look for sparkles! Walk up to creatures and press the DO button to talk.');
      }
    });
    PIP.ui.updateHUD();

    // builder taps on the 3D view
    canvas.addEventListener('pointerdown', function (e) {
      if (PIP.builder.isActive()) PIP.builder.onPointerDown(e, game.camera);
    });

    // title buttons
    var started = PIP.save.data.started;
    U.el('btn-play').textContent = started ? '▶ Keep playing' : '▶ Play';
    if (started) U.show('btn-new');
    U.el('btn-play').addEventListener('click', startGame);
    U.el('btn-new').addEventListener('click', function () {
      if (confirm('Start a brand-new adventure? The old one will be erased.')) {
        PIP.save.reset();
        location.reload();
      }
    });
    document.body.addEventListener('pointerdown', PIP.audio.onFirstGesture, { once: true });
    window.addEventListener('keydown', PIP.audio.onFirstGesture, { once: true });
    window.addEventListener('beforeunload', function () { PIP.save.persist(); });
  }

  function startGame() {
    PIP.audio.onFirstGesture();
    U.hide('title-screen');
    U.show('loading');
    setTimeout(function () {
      gotoWorld('hub').then(function () {
        U.hide('loading');
        U.show('hud');
        if ('ontouchstart' in window) U.show('touch-ui');
        game.running = true;
        clock = performance.now();
        requestAnimationFrame(loop);
      });
    }, 60);
  }

  /* ---------- world switching ---------- */
  var switching = false;
  function gotoWorld(id) {
    if (switching) return Promise.resolve();
    switching = true;
    if (PIP.builder.isActive()) PIP.builder.cancel();
    PIP.challenge.abandon();
    PIP.ui.clearGoal();
    PIP.narrate.stop();
    var firstTime = !game.world;
    return (firstTime ? Promise.resolve() : PIP.ui.fade(true)).then(function () {
      if (game.world) {
        game.scene.remove(game.world.group);
        game.world = null;
      }
      var world = PIP.worlds[id]();
      game.world = world;
      game.worldId = id;
      game.scene.add(world.group);
      game.scene.background = new THREE.Color(world.sky);
      game.scene.fog = new THREE.Fog(world.sky, 46, 95);
      PIP.player.teleport(world.spawn.x, world.spawn.z, world.spawn.angle, world);
      PIP.audio.playMusic(world.music);
      PIP.ui.updateHUD();
      return PIP.ui.fade(false);
    }).then(function () {
      switching = false;
      if (game.world.postEnter) return game.world.postEnter();
    });
  }
  game.gotoWorld = gotoWorld;

  /* ---------- camera tween (build mode & cutscenes) ---------- */
  game.tweenCamera = function (pos, look) {
    game.camTween = {
      fromP: game.camera.position.clone(), toP: pos,
      look: look, t: 0
    };
  };
  function updateCamTween(dt) {
    var tw = game.camTween;
    if (!tw) return;
    tw.t = Math.min(1, tw.t + dt * 1.6);
    var e = tw.t * tw.t * (3 - 2 * tw.t);
    game.camera.position.lerpVectors(tw.fromP, tw.toP, e);
    game.camera.lookAt(tw.look);
    if (tw.t >= 1 && !PIP.builder.isActive()) game.camTween = null;
    else if (tw.t >= 1) { game.camera.position.copy(tw.toP); game.camera.lookAt(tw.look); }
  }

  /* ---------- interactables ---------- */
  function scanInteractables() {
    var world = game.world;
    if (!world) return null;
    var ps = PIP.player.state.pos;
    var best = null, bestD = Infinity, bestHit = null;
    for (var i = 0; i < world.interactables.length; i++) {
      var it = world.interactables[i];
      if (it.enabled && !it.enabled()) continue;
      if (it.dynamic) {
        var hit = it.near();
        if (hit) { best = it; bestHit = hit; bestD = 0; break; }
        continue;
      }
      var d = U.dist2(ps.x, ps.z, it.x, it.z);
      if (d < it.radius * it.radius && d < bestD) { best = it; bestD = d; bestHit = null; }
    }
    if (best) {
      PIP.ui.showPrompt(best.prompt, 'E');
      PIP.player.setNearInteractable(true);
      if (PIP.input.state.actPressed) {
        PIP.input.state.actPressed = false;
        PIP.audio.play('pop');
        best.onInteract(bestHit);
      }
    } else {
      PIP.ui.hidePrompt();
      PIP.player.setNearInteractable(false);
    }
    return best;
  }

  /* ---------- main loop ---------- */
  function loop(now) {
    requestAnimationFrame(loop);
    var dt = Math.min(0.05, (now - clock) / 1000 || 0.016);
    clock = now;

    PIP.input.update();
    var busy = PIP.ui.busy() || PIP.builder.isActive();

    if (PIP.input.state.pausePressed && !busy) PIP.ui.openPause();

    if (!busy) {
      scanInteractables();
      if (PIP.input.state.grabPressed && game.world && !PIP.player.state.carrying) game.world.vinePull();
      PIP.player.update(dt, game.world, PIP.input);
    } else {
      PIP.ui.hidePrompt();
      // keep Pip's idle animation alive
      PIP.player.update(0, game.world, PIP.input);
    }
    if (game.world) game.world.update(dt);
    PIP.builder.update(dt);
    updateCamTween(dt);

    playTimeAcc += dt;
    if (playTimeAcc > 10) { PIP.save.addPlayTime(playTimeAcc * 1000); playTimeAcc = 0; }

    game.renderer.render(game.scene, game.camera);
    PIP.input.endFrame();
  }

  window.addEventListener('DOMContentLoaded', boot);
})();
