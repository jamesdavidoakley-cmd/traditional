/* Voice narration via the browser's built-in speech synthesis, always paired
   with on-screen subtitles. Everything spoken is also shown visually. */
PIP.narrate = (function () {
  var U = PIP.util;
  var voice = null, voiceLoaded = false;
  var subTimer = null;
  var current = null;

  function pickVoice() {
    if (!window.speechSynthesis) return;
    var vs = speechSynthesis.getVoices();
    if (!vs.length) return;
    // prefer a friendly UK English voice, fall back to any English
    voice = null;
    var prefer = ['en-GB', 'en_GB', 'en-'];
    for (var p = 0; p < prefer.length && !voice; p++)
      for (var i = 0; i < vs.length; i++)
        if (vs[i].lang && vs[i].lang.indexOf(prefer[p]) === 0) { voice = vs[i]; break; }
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

  /* say(text, opts) -> Promise resolves when speech ends (or after a reading-time
     estimate if the voice is off/unavailable). opts: {sub:false} to skip subtitle. */
  function say(text, opts) {
    opts = opts || {};
    var estimate = Math.max(1400, 320 * text.split(/\s+/).length);
    if (opts.sub !== false) showSubtitle(text, estimate + 800);
    return new Promise(function (resolve) {
      if (!PIP.save.settings.voice || !window.speechSynthesis) {
        setTimeout(resolve, opts.quick ? 200 : estimate);
        return;
      }
      try {
        var u = new SpeechSynthesisUtterance(text);
        if (voice) u.voice = voice;
        u.rate = 0.92; u.pitch = 1.12; u.volume = 1;
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
  function stop() {
    if (window.speechSynthesis) try { speechSynthesis.cancel(); } catch (e) {}
    current = null;
  }
  // fire-and-forget short call-outs ("three!", "lovely!")
  function callout(text) {
    if (!PIP.save.settings.voice || !window.speechSynthesis) { showSubtitle(text, 1200); return; }
    try {
      var u = new SpeechSynthesisUtterance(text);
      if (voice) u.voice = voice;
      u.rate = 1.0; u.pitch = 1.2;
      speechSynthesis.speak(u);
    } catch (e) {}
    showSubtitle(text, 1400);
  }

  return { say: say, stop: stop, callout: callout, hideSubtitle: hideSubtitle };
})();
