/* Save data, settings and the lightweight adaptive-learning tracker.
   Everything lives in localStorage on this device. No accounts, no network. */
PIP.save = (function () {
  var KEY = 'pip-inventor-islands-v1';
  var U = PIP.util;

  var DEFAULTS = {
    version: 1,
    started: false,
    seeds: {},            // worldId -> [seedId, ...]
    cores: {},            // worldId -> true
    missions: {},         // 'meadow.stones' -> 'done'
    badges: {},           // badgeId -> true
    designs: [],          // {name, icon, note}
    playMs: 0,
    sessions: 0,
    concepts: {},         // conceptId -> {attempts, correct, hints, streak, level}
    settings: {
      musicVol: 0.6, sfxVol: 0.8, voice: true, subtitles: true,
      bigText: false, highContrast: false, reducedMotion: false,
      assistCam: true, chatter: true,
      emphasis: 'balanced',       // 'maths' | 'dt' | 'balanced'
      numberRange: 'auto',        // 'auto' | 'small' | 'standard' | 'stretch'
      ttsKey: '',                 // optional OpenAI API key for the storyteller voice
      ttsVoice: 'nova'            // OpenAI voice name
    }
  };

  var data = load();

  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return JSON.parse(JSON.stringify(DEFAULTS));
      var d = JSON.parse(raw);
      // merge forwards-compatibly
      var base = JSON.parse(JSON.stringify(DEFAULTS));
      for (var k in d) if (k !== 'settings') base[k] = d[k];
      if (d.settings) for (var s in d.settings) base.settings[s] = d.settings[s];
      return base;
    } catch (e) { return JSON.parse(JSON.stringify(DEFAULTS)); }
  }

  var saveTimer = null;
  function persist() {
    if (saveTimer) return;
    saveTimer = setTimeout(function () {
      saveTimer = null;
      try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { /* storage full/blocked: play on */ }
    }, 250);
  }

  function reset() {
    data = JSON.parse(JSON.stringify(DEFAULTS));
    try { localStorage.removeItem(KEY); } catch (e) {}
    persist();
  }

  /* ---------- progress ---------- */
  function collectSeed(worldId, seedId) {
    var list = data.seeds[worldId] || (data.seeds[worldId] = []);
    if (list.indexOf(seedId) !== -1) return false;
    list.push(seedId); persist(); return true;
  }
  function hasSeed(worldId, seedId) {
    return (data.seeds[worldId] || []).indexOf(seedId) !== -1;
  }
  function seedCount() {
    var n = 0; for (var w in data.seeds) n += data.seeds[w].length; return n;
  }
  function setMission(id, state) { data.missions[id] = state; persist(); }
  function mission(id) { return data.missions[id]; }
  function grantCore(worldId) { data.cores[worldId] = true; persist(); }
  function hasCore(worldId) { return !!data.cores[worldId]; }
  function coreCount() { var n = 0; for (var w in data.cores) if (data.cores[w]) n++; return n; }
  function grantBadge(id) {
    if (data.badges[id]) return false;
    data.badges[id] = true; persist(); return true;
  }
  function addDesign(design) {
    for (var i = 0; i < data.designs.length; i++)
      if (data.designs[i].name === design.name) { data.designs[i] = design; persist(); return; }
    data.designs.push(design); persist();
  }

  /* ---------- adaptive learning tracker ----------
     Levels: 0 = gentler numbers & extra scaffolding
             1 = standard Year 1 pitch
             2 = stretch (bigger numbers, distractors, second steps)   */
  function concept(id) {
    return data.concepts[id] || (data.concepts[id] = { attempts: 0, correct: 0, hints: 0, streak: 0, level: 1 });
  }
  function recordAttempt(id, ok, hintsUsed) {
    var c = concept(id);
    c.attempts++;
    if (ok) { c.correct++; c.streak = Math.max(0, c.streak) + 1; }
    else { c.streak = Math.min(0, c.streak) - 1; }
    c.hints += (hintsUsed || 0);
    // gentle drift: three clean successes step up, two stumbles step down
    if (c.streak >= 3 && hintsUsed === 0) { c.level = Math.min(2, c.level + 1); c.streak = 0; }
    if (c.streak <= -2) { c.level = Math.max(0, c.level - 1); c.streak = 0; }
    persist();
  }
  function levelFor(id) {
    var r = data.settings.numberRange;
    if (r === 'small') return 0;
    if (r === 'standard') return 1;
    if (r === 'stretch') return 2;
    return concept(id).level;
  }
  // adult-facing wording — never clinical
  function conceptState(id) {
    var c = data.concepts[id];
    if (!c || c.attempts === 0) return null;
    var ratio = c.correct / c.attempts;
    if (c.level === 2 && ratio > 0.8) return 'Ready for a greater challenge';
    if (ratio > 0.75 && c.attempts >= 3) return 'Usually secure';
    if (ratio > 0.45) return 'Developing';
    return 'Practising';
  }

  function addPlayTime(ms) { data.playMs += ms; persist(); }

  return {
    get data() { return data; },
    get settings() { return data.settings; },
    persist: persist, reset: reset,
    collectSeed: collectSeed, hasSeed: hasSeed, seedCount: seedCount,
    setMission: setMission, mission: mission,
    grantCore: grantCore, hasCore: hasCore, coreCount: coreCount,
    grantBadge: grantBadge, addDesign: addDesign,
    concept: concept, recordAttempt: recordAttempt, levelFor: levelFor, conceptState: conceptState,
    addPlayTime: addPlayTime
  };
})();
