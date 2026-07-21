/* Voice narration, always paired with on-screen subtitles.
   Two engines:
   1. Browser speech synthesis (default — free, offline, no setup).
   2. Optional "storyteller voice": OpenAI neural text-to-speech (the same
      voices ChatGPT uses). A grown-up can paste an API key in the adult
      area. Clips are cached on the device so repeated lines cost nothing
      and replay offline. Any failure falls back to the browser voice. */
PIP.narrate = (function () {
  var U = PIP.util;
  var voice = null, voiceLoaded = false;
  var subTimer = null;
  var current = null;

  function pickVoice() {
    if (!window.speechSynthesis) return;
    var vs = speechSynthesis.getVoices();
    if (!vs.length) return;
    // Prefer the most natural-sounding English voice the browser offers.
    // Modern "Natural" / Google / Enhanced voices sound far better than the
    // basic local synthesiser, so score and pick the best available.
    function score(v) {
      var s = 0, n = (v.name || '').toLowerCase(), l = v.lang || '';
      if (/^en[-_]gb/i.test(l)) s += 4;
      else if (/^en/i.test(l)) s += 2;
      else return -1;
      if (n.indexOf('natural') !== -1) s += 6;
      if (n.indexOf('google') !== -1) s += 4;
      if (n.indexOf('enhanced') !== -1 || n.indexOf('premium') !== -1) s += 4;
      if (n.indexOf('espeak') !== -1) s -= 3;
      return s;
    }
    voice = null;
    var best = -1;
    for (var i = 0; i < vs.length; i++) {
      var sc = score(vs[i]);
      if (sc > best) { best = sc; voice = vs[i]; }
    }
    voiceLoaded = true;
  }
  if (window.speechSynthesis) {
    pickVoice();
    speechSynthesis.onvoiceschanged = pickVoice;
  }

  function showSubtitle(text, ms) {
    if (!PIP.save.settings.subtitles) return;
    var el = U.el('subtitle');
    el.textContent = text;
    el.classList.remove('hidden');
    if (subTimer) clearTimeout(subTimer);
    subTimer = setTimeout(function () { el.classList.add('hidden'); }, ms);
  }
  function hideSubtitle() {
    if (subTimer) clearTimeout(subTimer);
    U.el('subtitle').classList.add('hidden');
  }

  /* ---------- optional neural "storyteller" voice (OpenAI TTS) ---------- */
  var prem = { db: undefined, mem: {}, audio: null, broken: false };
  function premReady() {
    var s = PIP.save.settings;
    return !prem.broken && s.voice && s.ttsKey && s.ttsKey.length > 10 && navigator.onLine !== false;
  }
  function clipKey(text) {
    var s = PIP.save.settings;
    var str = (s.ttsVoice || 'nova') + '|' + text;
    var h = 5381;
    for (var i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) >>> 0;
    return 'c' + h.toString(36) + '_' + str.length;
  }
  function openDB() {
    return new Promise(function (res) {
      if (prem.db !== undefined) return res(prem.db);
      try {
        var rq = indexedDB.open('pip-tts-cache', 1);
        rq.onupgradeneeded = function () { rq.result.createObjectStore('clips'); };
        rq.onsuccess = function () { prem.db = rq.result; res(prem.db); };
        rq.onerror = function () { prem.db = null; res(null); };
      } catch (e) { prem.db = null; res(null); }
    });
  }
  function cacheGet(key) {
    if (prem.mem[key]) return Promise.resolve(prem.mem[key]);
    return openDB().then(function (db) {
      if (!db) return null;
      return new Promise(function (res) {
        try {
          var rq = db.transaction('clips').objectStore('clips').get(key);
          rq.onsuccess = function () { res(rq.result || null); };
          rq.onerror = function () { res(null); };
        } catch (e) { res(null); }
      });
    });
  }
  function cachePut(key, blob) {
    prem.mem[key] = blob;
    openDB().then(function (db) {
      if (!db) return;
      try { db.transaction('clips', 'readwrite').objectStore('clips').put(blob, key); } catch (e) {}
    });
  }
  function fetchClip(text) {
    var s = PIP.save.settings;
    return fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + s.ttsKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o-mini-tts',
        voice: s.ttsVoice || 'nova',
        input: text,
        response_format: 'mp3',
        instructions: 'A warm, gentle storyteller reading to a six-year-old. Clear, unhurried, encouraging and kind. British English.'
      })
    }).then(function (r) {
      if (!r.ok) throw new Error('tts http ' + r.status);
      return r.blob();
    });
  }
  function getClip(text) {
    var key = clipKey(text);
    return cacheGet(key).then(function (hit) {
      if (hit) return hit;
      return fetchClip(text).then(function (blob) { cachePut(key, blob); return blob; });
    });
  }
  function speakPremium(text) {
    return getClip(text).then(function (blob) {
      return new Promise(function (resolve, reject) {
        try {
          var url = URL.createObjectURL(blob);
          var a = new Audio(url);
          a.volume = 1;
          prem.audio = a;
          var done = false;
          var finish = function () {
            if (done) return;
            done = true;
            URL.revokeObjectURL(url);
            if (prem.audio === a) prem.audio = null;
            resolve();
          };
          a.onended = finish;
          a.onerror = function () { if (!done) { done = true; URL.revokeObjectURL(url); reject(new Error('audio')); } };
          a.play().catch(function (e) { if (!done) { done = true; URL.revokeObjectURL(url); reject(e); } });
        } catch (e) { reject(e); }
      });
    });
  }
  // exposed so the adult area can test a freshly pasted key
  function testPremium(text) {
    prem.broken = false;
    return speakPremium(text);
  }

  /* ---------- browser-voice engine ---------- */
  function speakBrowser(text, estimate) {
    return new Promise(function (resolve) {
      if (!window.speechSynthesis) { setTimeout(resolve, estimate); return; }
      try {
        var u = new SpeechSynthesisUtterance(text);
        if (voice) u.voice = voice;
        // natural voice: normal pitch, just a touch unhurried for young ears
        u.rate = 0.95; u.pitch = 1.0; u.volume = 1;
        var done = false;
        var finish = function () { if (!done) { done = true; current = null; resolve(); } };
        u.onend = finish; u.onerror = finish;
        // safety: some browsers drop events
        setTimeout(finish, estimate + 4000);
        current = u;
        speechSynthesis.speak(u);
      } catch (e) { setTimeout(resolve, estimate); }
    });
  }

  /* say(text, opts) -> Promise resolves when speech ends (or after a reading-time
     estimate if the voice is off/unavailable). opts: {sub:false} to skip subtitle. */
  function say(text, opts) {
    opts = opts || {};
    var estimate = Math.max(1400, 320 * text.split(/\s+/).length);
    if (opts.sub !== false) showSubtitle(text, estimate + 800);
    if (!PIP.save.settings.voice) {
      return new Promise(function (resolve) { setTimeout(resolve, opts.quick ? 200 : estimate); });
    }
    if (premReady()) {
      return speakPremium(text).catch(function () {
        // key wrong / offline / audio blocked: fall back for the rest of the session
        prem.broken = true;
        return speakBrowser(text, estimate);
      });
    }
    return speakBrowser(text, estimate);
  }
  function stop() {
    if (window.speechSynthesis) try { speechSynthesis.cancel(); } catch (e) {}
    if (prem.audio) { try { prem.audio.pause(); } catch (e) {} prem.audio = null; }
    current = null;
  }
  // fire-and-forget short call-outs ("three!", "lovely!")
  function callout(text) {
    showSubtitle(text, 1400);
    if (!PIP.save.settings.voice) return;
    if (premReady()) { speakPremium(text).catch(function () { prem.broken = true; }); return; }
    if (!window.speechSynthesis) return;
    try {
      var u = new SpeechSynthesisUtterance(text);
      if (voice) u.voice = voice;
      u.rate = 1.0; u.pitch = 1.0;
      speechSynthesis.speak(u);
    } catch (e) {}
  }

  return { say: say, stop: stop, callout: callout, hideSubtitle: hideSubtitle, testPremium: testPremium };
})();
