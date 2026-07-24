/* Original procedural music + sound effects via WebAudio.
   Marimba-ish plucks over a pentatonic scale, soft noise percussion.
   No samples, no copyrighted material — every sound is synthesised here. */
PIP.audio = (function () {
  var U = PIP.util;
  var ctx = null, musicGain = null, sfxGain = null, ready = false;
  var seq = { timer: null, step: 0, next: 0, song: null };

  function init() {
    if (ready) return;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    musicGain = ctx.createGain(); musicGain.connect(ctx.destination);
    sfxGain = ctx.createGain(); sfxGain.connect(ctx.destination);
    applyVolumes();
    ready = true;
  }
  function applyVolumes() {
    if (!ready) return;
    musicGain.gain.value = PIP.save.settings.musicVol * 0.5;
    sfxGain.gain.value = PIP.save.settings.sfxVol;
  }
  function resume() { if (ctx && ctx.state === 'suspended') ctx.resume(); }

  /* ---------- voices ---------- */
  function pluck(freq, when, dur, vol, dest, type) {
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type || 'triangle'; o.frequency.value = freq;
    var o2 = ctx.createOscillator(), g2 = ctx.createGain();
    o2.type = 'sine'; o2.frequency.value = freq * 2; g2.gain.value = 0.35;
    g.gain.setValueAtTime(0, when);
    g.gain.linearRampToValueAtTime(vol, when + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0004, when + dur);
    o.connect(g); o2.connect(g2); g2.connect(g); g.connect(dest);
    o.start(when); o.stop(when + dur + 0.05);
    o2.start(when); o2.stop(when + dur + 0.05);
  }
  function noiseHit(when, dur, vol, freq, dest) {
    var len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    var buf = ctx.createBuffer(1, len, ctx.sampleRate);
    var d = buf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    var src = ctx.createBufferSource(); src.buffer = buf;
    var f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = 1.2;
    var g = ctx.createGain(); g.gain.value = vol;
    src.connect(f); f.connect(g); g.connect(dest);
    src.start(when);
  }

  /* ---------- music sequencer ---------- */
  // pentatonic degrees over a friendly major feel
  var SCALES = {
    meadow:  [0, 2, 4, 7, 9, 12, 14, 16],
    hub:     [0, 2, 4, 7, 9, 12, 14, 16],
    grove:   [0, 3, 5, 7, 10, 12, 15, 17],
    harbour: [0, 2, 5, 7, 9, 12, 14, 17],
    factory: [0, 2, 4, 7, 9, 12, 14, 16]
  };
  var SONGS = {
    hub:     { base: 261.63, bpm: 92,  scale: 'hub',     bassEvery: 4, hatEvery: 2, density: 0.55 },
    meadow:  { base: 293.66, bpm: 104, scale: 'meadow',  bassEvery: 4, hatEvery: 2, density: 0.62 },
    grove:   { base: 246.94, bpm: 84,  scale: 'grove',   bassEvery: 2, hatEvery: 4, density: 0.5 },
    harbour: { base: 277.18, bpm: 98,  scale: 'harbour', bassEvery: 4, hatEvery: 2, density: 0.5 }
  };
  var melodyMemory = 0;

  function scheduleStep(song, stepIndex, when) {
    var scale = SCALES[song.scale];
    var stepDur = 60 / song.bpm / 2; // quavers
    if (stepIndex % song.bassEvery === 0) {
      var bassDeg = [0, 0, 3, 1][Math.floor(stepIndex / song.bassEvery) % 4];
      pluck(song.base / 2 * Math.pow(2, scale[bassDeg] / 12), when, stepDur * 3.2, 0.16, musicGain, 'sine');
    }
    if (stepIndex % song.hatEvery === 1) noiseHit(when, 0.04, 0.05, 6000, musicGain);
    if (Math.random() < song.density) {
      // small melodic walk so tunes feel intentional, never a copied melody
      melodyMemory += U.randInt(-2, 2);
      melodyMemory = U.clamp(melodyMemory, 0, scale.length - 1);
      pluck(song.base * Math.pow(2, scale[melodyMemory] / 12), when, stepDur * 1.8, 0.12, musicGain);
      if (Math.random() < 0.18)
        pluck(song.base * Math.pow(2, (scale[melodyMemory] + 12) / 12), when + stepDur / 2, stepDur, 0.06, musicGain);
    }
  }
  function playMusic(songId) {
    if (!ready) { seq.pendingSong = songId; return; }
    stopMusic();
    var song = SONGS[songId] || SONGS.hub;
    seq.song = song; seq.step = 0; seq.next = ctx.currentTime + 0.1;
    seq.timer = setInterval(function () {
      if (!ctx) return;
      var stepDur = 60 / song.bpm / 2;
      while (seq.next < ctx.currentTime + 0.35) {
        scheduleStep(song, seq.step, seq.next);
        seq.step = (seq.step + 1) % 64;
        seq.next += stepDur;
      }
    }, 120);
  }
  function stopMusic() { if (seq.timer) { clearInterval(seq.timer); seq.timer = null; } }

  /* ---------- sound effects ---------- */
  var SFX = {
    jump:    function (t) { sweep(300, 560, t, 0.12, 0.16, 'sine'); },
    flutter: function (t) { sweep(500, 460, t, 0.3, 0.05, 'triangle'); },
    land:    function (t) { noiseHit(t, 0.09, 0.2, 300, sfxGain); },
    stomp:   function (t) { sweep(220, 60, t, 0.18, 0.3, 'sine'); noiseHit(t + 0.05, 0.15, 0.3, 200, sfxGain); },
    collect: function (t) { pluck(880, t, 0.25, 0.25, sfxGain); pluck(1318, t + 0.07, 0.3, 0.2, sfxGain); },
    place:   function (t) { pluck(392, t, 0.18, 0.3, sfxGain, 'square'); noiseHit(t, 0.05, 0.1, 900, sfxGain); },
    pop:     function (t) { sweep(500, 900, t, 0.07, 0.2, 'sine'); },
    count:   function (t, n) { pluck(523 * Math.pow(2, ((n || 0) % 8) / 12), t, 0.3, 0.3, sfxGain); },
    ding:    function (t) { pluck(1046, t, 0.5, 0.25, sfxGain); },
    chime:   function (t) { [523, 659, 784].forEach(function (f, i) { pluck(f, t + i * 0.09, 0.5, 0.22, sfxGain); }); },
    success: function (t) { [523, 659, 784, 1046, 1318].forEach(function (f, i) { pluck(f, t + i * 0.1, 0.6, 0.24, sfxGain); }); },
    fanfare: function (t) {
      [392, 523, 659, 784, 659, 784, 1046].forEach(function (f, i) { pluck(f, t + i * 0.13, 0.7, 0.25, sfxGain); });
      noiseHit(t + 0.9, 0.4, 0.15, 4000, sfxGain);
    },
    notyet:  function (t) { pluck(392, t, 0.3, 0.2, sfxGain); pluck(349, t + 0.15, 0.4, 0.2, sfxGain); },
    wobble:  function (t) {
      for (var i = 0; i < 6; i++) pluck(196 + (i % 2) * 24, t + i * 0.09, 0.12, 0.22, sfxGain, 'sawtooth');
    },
    splash:  function (t) { noiseHit(t, 0.3, 0.35, 900, sfxGain); sweep(400, 150, t, 0.25, 0.1, 'sine'); },
    whoosh:  function (t) { noiseHit(t, 0.2, 0.2, 1600, sfxGain); },
    unlock:  function (t) { [659, 784, 988, 1318].forEach(function (f, i) { pluck(f, t + i * 0.11, 0.7, 0.25, sfxGain); }); },
    creak:   function (t) { sweep(180, 120, t, 0.3, 0.15, 'sawtooth'); },
    talk:    function (t) { pluck(U.rand(500, 700), t, 0.08, 0.08, sfxGain); },
    gear:    function (t) { for (var i = 0; i < 4; i++) noiseHit(t + i * 0.11, 0.05, 0.12, 1200, sfxGain); }
  };
  function sweep(f0, f1, when, dur, vol, type) {
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, when);
    o.frequency.exponentialRampToValueAtTime(Math.max(30, f1), when + dur);
    g.gain.setValueAtTime(vol, when);
    g.gain.exponentialRampToValueAtTime(0.0004, when + dur);
    o.connect(g); g.connect(sfxGain);
    o.start(when); o.stop(when + dur + 0.05);
  }
  function play(name, arg) {
    if (!ready) return;
    resume();
    var fn = SFX[name];
    if (fn) fn(ctx.currentTime + 0.01, arg);
  }

  function onFirstGesture() {
    init(); resume();
    if (seq.pendingSong) { var s = seq.pendingSong; seq.pendingSong = null; playMusic(s); }
  }

  return { init: init, onFirstGesture: onFirstGesture, play: play, playMusic: playMusic, stopMusic: stopMusic, applyVolumes: applyVolumes };
})();
