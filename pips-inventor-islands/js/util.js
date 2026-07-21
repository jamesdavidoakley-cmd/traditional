/* Pip's Inventor Islands — shared helpers */
window.PIP = window.PIP || {};

PIP.util = (function () {
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  // frame-rate independent damping factor
  function damp(a, b, smoothing, dt) { return lerp(a, b, 1 - Math.pow(smoothing, dt)); }
  function angleLerp(a, b, t) {
    var d = (b - a) % (Math.PI * 2);
    if (d > Math.PI) d -= Math.PI * 2;
    if (d < -Math.PI) d += Math.PI * 2;
    return a + d * t;
  }
  function dist2(ax, az, bx, bz) { var dx = ax - bx, dz = az - bz; return dx * dx + dz * dz; }
  function rand(a, b) { return a + Math.random() * (b - a); }
  function randInt(a, b) { return Math.floor(rand(a, b + 1)); }
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }
  // smooth gaussian-ish hill used for analytic terrain
  function hill(x, z, cx, cz, radius, height) {
    var d = Math.sqrt(dist2(x, z, cx, cz));
    if (d >= radius) return 0;
    var t = d / radius;
    return height * (Math.cos(t * Math.PI) * 0.5 + 0.5);
  }
  function el(id) { return document.getElementById(id); }
  function show(id) { el(id).classList.remove('hidden'); }
  function hide(id) { el(id).classList.add('hidden'); }
  function setText(id, txt) { el(id).textContent = txt; }
  function wait(ms) { return new Promise(function (res) { setTimeout(res, ms); }); }

  // spoken number words for gentle counting
  var WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
    'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty'];
  function numWord(n) { return (n >= 0 && n <= 20) ? WORDS[n] : String(n); }

  return {
    clamp: clamp, lerp: lerp, damp: damp, angleLerp: angleLerp, dist2: dist2,
    rand: rand, randInt: randInt, pick: pick, shuffle: shuffle, hill: hill,
    el: el, show: show, hide: hide, setText: setText, wait: wait, numWord: numWord
  };
})();
