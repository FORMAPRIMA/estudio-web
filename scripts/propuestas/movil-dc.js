(function () {
  // Versión móvil de una propuesta horizontal (importar-dc.mjs --movil): una
  // página de scroll, no una presentación. Este script
  //  · avisa de la sección que se está leyendo con el mismo evento que deck-stage
  //    (`slidechange`), así el puente mide en Salas igual que en la presentación;
  //  · anima cada sección la primera vez que entra: bloques que suben, imágenes
  //    que funden y cifras que cuentan desde 0 (como animacion-dc.js).
  var MOV = !matchMedia('(prefers-reduced-motion: reduce)').matches;
  var E = 'cubic-bezier(.16,1,.3,1)';
  var secciones = [], actual = -1, vistas = new WeakSet();

  function visibles() {
    var todas = document.querySelectorAll('main > section');
    var r = [];
    for (var i = 0; i < todas.length; i++) if (todas[i].offsetHeight > 0) r.push(todas[i]);
    return r;
  }

  function avisar(i, motivo) {
    if (i === actual || i < 0) return;
    actual = i;
    var s = secciones[i];
    document.dispatchEvent(new CustomEvent('slidechange', { detail: { index: i, total: secciones.length, slide: s, reason: motivo } }));
  }

  // La sección que se lee: la que ocupa la línea al 40 % de la pantalla.
  var pend = 0;
  function medir() {
    pend = 0;
    var y = window.innerHeight * 0.4, k = -1;
    for (var i = 0; i < secciones.length; i++) {
      var r = secciones[i].getBoundingClientRect();
      if (r.top <= y && r.bottom > y) { k = i; break; }
    }
    // Al final de la página, la última aunque no llegue a la línea.
    if ((window.innerHeight + window.scrollY) >= document.documentElement.scrollHeight - 4) k = secciones.length - 1;
    if (k >= 0) avisar(k, 'scroll');
  }
  function alScroll() { if (!pend) pend = requestAnimationFrame(medir); }

  function cifras(sec, retardo) {
    var re = /^([^\d]*?)(\d{1,3}(?:\.\d{3})+|\d+)(,\d+)?([^\d]*)$/;
    var w = document.createTreeWalker(sec, NodeFilter.SHOW_TEXT), ns = [];
    while (w.nextNode()) {
      var n = w.currentNode, t = n.nodeValue.trim(), m = t.match(re);
      if (!m || !n.parentElement) continue;
      var fs = parseFloat(getComputedStyle(n.parentElement).fontSize);
      if (fs < 20 || /^0\d$/.test(m[2]) || m[1].length > 6 || m[4].length > 8) continue;
      if (n.parentElement.closest('[data-fp-final]')) continue;
      ns.push(n);
    }
    ns.forEach(function (n) {
      var orig = n.nodeValue, t = orig.trim(), m = t.match(re);
      var lead = orig.slice(0, orig.indexOf(t)) + m[1], trail = m[4] + orig.slice(orig.indexOf(t) + t.length);
      var dec = m[3] ? m[3].length - 1 : 0;
      var obj = parseFloat(m[2].replace(/\./g, '') + (m[3] ? '.' + m[3].slice(1) : ''));
      var grupos = m[2].indexOf('.') >= 0 || obj >= 10000;
      var fmt = function (v) { var p = v.toFixed(dec).split('.'), a = p[0]; if (grupos) a = a.replace(/\B(?=(\d{3})+(?!\d))/g, '.'); return lead + a + (p[1] ? ',' + p[1] : '') + trail; };
      var dur = Math.min(2400, 1400 + Math.log10(obj + 1) * 180), t0 = null, pe = n.parentElement, prev = pe.style.fontVariantNumeric;
      pe.style.fontVariantNumeric = 'tabular-nums';
      n.nodeValue = fmt(0);
      var paso = function (ts) {
        if (t0 === null) t0 = ts + retardo;
        var p = Math.min(1, Math.max(0, (ts - t0) / dur));
        if (p < 1) { n.nodeValue = fmt(obj * (1 - Math.pow(1 - p, 4))); requestAnimationFrame(paso); }
        else { n.nodeValue = orig; pe.style.fontVariantNumeric = prev; }
      };
      requestAnimationFrame(paso);
    });
  }

  function animar(sec) {
    if (vistas.has(sec)) return;
    vistas.add(sec);
    if (!MOV) return;
    // Bloques: los hijos directos, y si un hijo es un contenedor alto, sus hijos.
    var bloques = [];
    [].forEach.call(sec.children, function (c) {
      if (getComputedStyle(c).position === 'absolute') return;
      if (c.offsetHeight > window.innerHeight * 0.6 && c.children.length > 1 && c.tagName !== 'IMG') [].forEach.call(c.children, function (k) { if (getComputedStyle(k).position !== 'absolute') bloques.push(k); });
      else bloques.push(c);
    });
    bloques.forEach(function (b, i) {
      var d = 80 + Math.min(i, 8) * 90;
      b.animate([{ opacity: 0, transform: 'translate3d(0,22px,0)' }, { opacity: 1, transform: 'none' }], { duration: 1100, delay: d, easing: E, fill: 'backwards' });
    });
    [].forEach.call(sec.querySelectorAll('img'), function (im) {
      if (/logo|isotipo/.test(im.getAttribute('src') || '')) return;
      im.animate([{ opacity: 0, transform: 'scale(1.05)' }, { opacity: 1, transform: 'none' }], { duration: 1600, delay: 150, easing: 'cubic-bezier(.22,1,.36,1)', fill: 'backwards' });
    });
    cifras(sec, 350);
  }

  function arrancar() {
    secciones = visibles();
    if (!secciones.length) return false;
    if ('IntersectionObserver' in window) {
      // Se anima al asomar un 15 %: antes de que el ojo llegue al contenido.
      var io = new IntersectionObserver(function (es) {
        es.forEach(function (e) { if (e.isIntersecting) { animar(e.target); io.unobserve(e.target); } });
      }, { threshold: 0.15 });
      secciones.forEach(function (s, i) { if (i === 0) vistas.add(s); else io.observe(s); });
    }
    window.addEventListener('scroll', alScroll, { passive: true });
    window.addEventListener('resize', alScroll, { passive: true });
    avisar(0, 'init');
    medir();
    return true;
  }
  // El runtime de Claude Design monta su copia del documento al cargar: se
  // espera a que haya secciones visibles.
  var intentos = 0, t = setInterval(function () { if (arrancar() || ++intentos > 100) clearInterval(t); }, 100);
})();
