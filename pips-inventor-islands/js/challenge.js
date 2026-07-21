/* Reusable maths-challenge framework.
   - one-sentence spoken + visible goals
   - three hint levels: attention cue → strategy cue → guided first step
   - warm feedback, never "wrong again"
   - every attempt feeds the adaptive tracker in save.js */
PIP.challenge = (function () {
  var U = PIP.util;
  var active = null; // {id, concept, hints:[], hintLevel, hintsUsed, attempts, onGuided}

  var PRAISE = [
    'You tested it — that is real inventing!',
    'Lovely counting!',
    'You worked that out beautifully.',
    'Great thinking, inventor!',
    'You found it!',
    'Brilliant — your idea worked!'
  ];
  var NOT_YET = [
    'Not yet — let’s test another idea.',
    'Hmm, not that one. Have another look.',
    'Good try! What could we change?',
    'You found one part of the answer. Keep going!'
  ];

  function begin(opts) {
    active = {
      id: opts.id, concept: opts.concept,
      hints: opts.hints || [], hintLevel: 0, hintsUsed: 0, attempts: 0,
      onGuided: opts.onGuided || null,
      onHint: opts.onHint || null
    };
    if (opts.goal) PIP.ui.setGoal(opts.goal, opts.speak !== false);
  }

  function requestHint() {
    if (!active || !active.hints.length) {
      PIP.narrate.say('Have a look around — something is sparkling!');
      return;
    }
    var lvl = Math.min(active.hintLevel, active.hints.length - 1);
    active.hintsUsed++;
    active.hintLevel = Math.min(active.hintLevel + 1, active.hints.length);
    PIP.audio.play('ding');
    var text = active.hints[lvl];
    if (text) PIP.narrate.say(text);
    if (active.onHint) active.onHint(lvl);
    if (lvl === 2 && active.onGuided) active.onGuided();
  }

  function attempt(ok) {
    if (!active) return;
    active.attempts++;
    if (!ok) PIP.audio.play('notyet');
  }
  function praise() { return U.pick(PRAISE); }
  function notYet() { return U.pick(NOT_YET); }

  function record(ok) {
    if (!active) return;
    PIP.save.recordAttempt(active.concept, ok, active.hintsUsed);
  }

  /* Finish a challenge: shows the summary card linking the physical action to
     the maths sentence, records adaptive data, clears the goal banner. */
  function complete(opts) {
    record(true);
    var a = active; active = null;
    PIP.ui.clearGoal();
    return PIP.ui.summary({
      title: opts.title || praise(),
      maths: opts.maths || null,
      text: opts.text || '',
      speak: opts.speak || opts.text || '',
      stars: opts.stars
    });
  }
  function abandon() { active = null; PIP.ui.clearGoal(); }

  /* ---------- shared "pick the number" interaction ----------
     Physical first, symbols second: the visual row shows real quantities
     (filled dots = what you have, dashed dots = what is missing). */
  function numberPick(opts) {
    // opts: {question, answer, options[], visual:{total,filled} | {emoji,count} , concept}
    return new Promise(function (resolve) {
      PIP.ui.pushModal();
      var panel = U.el('challenge-panel');
      U.setText('ch-question', opts.question);
      PIP.narrate.say(opts.question);

      var vis = U.el('ch-visual');
      vis.innerHTML = '';
      if (opts.visual && opts.visual.total != null) {
        for (var i = 0; i < opts.visual.total; i++) {
          var d = document.createElement('div');
          d.className = 'dot' + (i < opts.visual.filled ? '' : ' empty');
          vis.appendChild(d);
        }
      } else if (opts.visual && opts.visual.emoji) {
        for (var j = 0; j < opts.visual.count; j++) {
          var s = document.createElement('span');
          s.textContent = opts.visual.emoji;
          vis.appendChild(s);
        }
      }

      var optsRow = U.el('ch-options');
      optsRow.innerHTML = '';
      var wrong = 0;
      opts.options.forEach(function (n) {
        var b = document.createElement('button');
        b.className = 'num-btn';
        b.textContent = String(n);
        b.addEventListener('click', function () {
          attempt(n === opts.answer);
          if (n === opts.answer) {
            b.classList.add('correct');
            PIP.audio.play('chime');
            PIP.narrate.callout(U.numWord(n) + '! ' + praise());
            setTimeout(function () {
              panel.classList.add('hidden');
              PIP.ui.popModal();
              resolve(n);
            }, 900);
          } else {
            wrong++;
            b.classList.add('dim');
            PIP.narrate.say(notYet());
            if (wrong === 1 && active) PIP.narrate.say(opts.nudge || 'Try counting the empty spaces one by one.');
            if (wrong >= 2) {
              // guided step: dim everything except the answer
              optsRow.querySelectorAll('.num-btn').forEach(function (btn) {
                if (btn.textContent !== String(opts.answer)) btn.classList.add('dim');
              });
              PIP.narrate.say('Let’s find it together — count the dashed circles with me.');
              if (active) active.hintsUsed++;
            }
          }
        });
        optsRow.appendChild(b);
      });
      panel.classList.remove('hidden');
    });
  }

  return {
    begin: begin, requestHint: requestHint, attempt: attempt, record: record,
    complete: complete, abandon: abandon, numberPick: numberPick,
    praise: praise, notYet: notYet,
    isActive: function () { return !!active; }
  };
})();
