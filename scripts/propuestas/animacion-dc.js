class Component extends DCLogic {
  // Animación de entrada de Torre del Mangle (bloques escalonados, telón en las
  // imágenes, cifras que suben), sin lo propio de Torre (vídeos, descuento).
  // importar-dc.mjs --animar la añade a un deck que no trae script propio.
  componentDidMount() {
    this._printing = false;
    this._onSlide = (e) => this.queue(e.detail && e.detail.slide);
    document.addEventListener('slidechange', this._onSlide);
    this._onPrint = () => { this._printing = true; this.finishAll(); };
    this._onAfterPrint = () => { this._printing = false; setTimeout(() => this.queue(this.activeSlide(), true), 120); };
    window.addEventListener('beforeprint', this._onPrint);
    window.addEventListener('afterprint', this._onAfterPrint);
    this._onVis = () => { if (!document.hidden) this.queue(this.activeSlide(), true); };
    document.addEventListener('visibilitychange', this._onVis);
    const attach = (n) => {
      const deck = document.querySelector('deck-stage');
      if (!deck || !deck.querySelector('section')) { if (n < 80) this._attachT = setTimeout(() => attach(n + 1), 100); return; }
      this._mo = new MutationObserver((muts) => {
        for (const m of muts) if (m.target.tagName === 'SECTION' && m.target.hasAttribute('data-deck-active') && m.oldValue === null) this.queue(m.target);
      });
      this._mo.observe(deck, { subtree: true, attributes: true, attributeFilter: ['data-deck-active'], attributeOldValue: true });
      this.queue(this.activeSlide(), true);
    };
    attach(0);
  }
  componentWillUnmount() {
    document.removeEventListener('slidechange', this._onSlide);
    window.removeEventListener('beforeprint', this._onPrint);
    window.removeEventListener('afterprint', this._onAfterPrint);
    document.removeEventListener('visibilitychange', this._onVis);
    if (this._mo) this._mo.disconnect();
    clearTimeout(this._attachT);
    cancelAnimationFrame(this._qRaf);
    this.finishAll();
  }
  activeSlide() { return document.querySelector('deck-stage > section[data-deck-active]') || document.querySelector('deck-stage section[data-deck-active]'); }
  queue(slide, force) {
    if (!slide) return;
    const allActive = document.querySelectorAll('deck-stage section[data-deck-active]').length > 1;
    if (this._printing || allActive) { this.finishAll(); return; }
    if (!force && this._lastSlide === slide && Date.now() - (this._lastT || 0) < 500) return;
    // El lienzo del visor es blanco: una diapositiva oscura que entra fundiendo
    // destellaba en blanco. Detrás, el fondo de la que sale (fundido cruzado).
    const deck = document.querySelector('deck-stage');
    const canvas = deck && deck.shadowRoot && deck.shadowRoot.querySelector('.canvas');
    if (canvas) {
      const prev = this._lastSlide && this._lastSlide !== slide ? this._lastSlide : slide;
      const bg = getComputedStyle(prev).backgroundColor;
      canvas.style.background = bg && bg !== 'rgba(0, 0, 0, 0)' ? bg : '#0d0d0d';
    }
    cancelAnimationFrame(this._qRaf);
    this._qRaf = requestAnimationFrame(() => { this._qRaf = requestAnimationFrame(() => this.animateSlide(slide)); });
    this._lastSlide = slide; this._lastT = Date.now();
  }
  finishAll() {
    (this._anims || []).forEach(a => { try { a.finish(); } catch (e) {} });
    (this._counters || []).forEach(c => c.done());
  }
  motionOff() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }
  animateSlide(slide) {
    if (!slide || this.motionOff() || !slide.hasAttribute('data-deck-active')) return;
    this.finishAll();
    this._anims = []; this._counters = [];
    const E = 'cubic-bezier(.16,1,.3,1)';
    const run = (el, kf, o) => { const a = el.animate(kf, Object.assign({ easing: E, fill: 'backwards' }, o)); this._anims.push(a); return a; };

    // slide transition
    run(slide, [{ opacity: 0 }, { opacity: 1 }], { duration: 700, easing: 'cubic-bezier(.4,0,.2,1)' });

    // staggered blocks
    const isLogo = (el) => el.tagName === 'IMG' && /logo|isotipo/.test(el.getAttribute('src') || '');
    const blocks = [];
    const collect = (el, depth) => {
      const kids = [...el.children].filter(k => k.offsetWidth > 0 && getComputedStyle(k).position !== 'absolute' || k.tagName === 'IMG');
      if (depth < 2 && kids.length > 1 && el !== slide && el.offsetHeight > 160 && !/^H\d$/.test(el.tagName)) { kids.forEach(k => collect(k, depth + 1)); return; }
      blocks.push(el);
    };
    [...slide.children].forEach(c => {
      const cs = getComputedStyle(c);
      if (cs.position === 'absolute' && c.children.length > 1) [...c.children].forEach(k => collect(k, 1));
      else if (cs.position === 'absolute') return;
      else collect(c, 0);
    });
    let i = 0;
    const delayOf = new Map();
    blocks.forEach(b => {
      const d = 220 + Math.min(i, 14) * 70; i++;
      delayOf.set(b, d);
      if (isLogo(b)) return;
      if (/^H\d$/.test(b.tagName)) {
        run(b, [{ opacity: 0, transform: 'translate3d(0,28px,0)' }, { opacity: 1, transform: 'translate3d(0,0,0)' }], { duration: 1400, delay: d });
      } else {
        run(b, [{ opacity: 0, transform: 'translate3d(0,16px,0)' }, { opacity: 1, transform: 'translate3d(0,0,0)' }], { duration: 1200, delay: d });
      }
    });
    const delayFor = (el) => { let n = el; while (n && n !== slide) { if (delayOf.has(n)) return delayOf.get(n); n = n.parentElement; } return 300; };

    // images: curtain reveal + slow settle
    slide.querySelectorAll('img').forEach(img => {
      if (isLogo(img)) return;
      const d = delayFor(img);
      run(img, [{ opacity: 0 }, { opacity: 1 }], { duration: 1800, delay: d, easing: 'cubic-bezier(.33,0,.2,1)' });
      run(img, [{ transform: 'scale3d(1.05,1.05,1)' }, { transform: 'scale3d(1,1,1)' }], { duration: 3200, delay: d, easing: 'cubic-bezier(.22,1,.36,1)' });
    });

    // logos / isotipo
    slide.querySelectorAll('img').forEach(img => {
      if (!isLogo(img)) return;
      const d = 500 + (img.offsetHeight > 30 ? 200 : 0);
      run(img, [{ opacity: 0, transform: 'translate3d(0,6px,0)' }, { opacity: getComputedStyle(img).opacity, transform: 'translate3d(0,0,0)' }], { duration: 1600, delay: d, easing: 'cubic-bezier(.33,0,.2,1)' });
    });

    // number ramp-up: un solo número por texto, con prefijo/sufijo ("USD 80.850", "USD 2.800 / mes")
    const re = /^([^\d]*?)(\d{1,3}(?:\.\d{3})+|\d+)(,\d+)?([^\d]*)$/;
    const walker = document.createTreeWalker(slide, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) {
      const n = walker.currentNode; const t = n.nodeValue.trim();
      const m = t.match(re);
      if (!m || !n.parentElement) continue;
      const fs = parseFloat(getComputedStyle(n.parentElement).fontSize);
      if (fs < 22 || /line-through/.test(n.parentElement.style.textDecoration || '')) continue;
      if (/^0\d$/.test(m[2]) || m[1].length > 6 || m[4].length > 8) continue;
      nodes.push(n);
    }
    nodes.forEach((n) => {
      const orig = n.nodeValue;
      const [, pre, ip, dp, post] = orig.trim().match(re);
      const lead = orig.slice(0, orig.indexOf(orig.trim())) + pre;
      const trail = post + orig.slice(orig.indexOf(orig.trim()) + orig.trim().length);
      const dec = dp ? dp.length - 1 : 0;
      const target = parseFloat(ip.replace(/\./g, '') + (dp ? '.' + dp.slice(1) : ''));
      const grouped = ip.includes('.') || target >= 10000;
      const fmt = (v) => { let s = v.toFixed(dec); let [a, b] = s.split('.'); if (grouped) a = a.replace(/\B(?=(\d{3})+(?!\d))/g, '.'); return lead + a + (b ? ',' + b : '') + trail; };
      const delay = delayFor(n.parentElement) + 250, dur = Math.min(2600, 1600 + Math.log10(target + 1) * 180);
      const pe = n.parentElement, prevNum = pe.style.fontVariantNumeric;
      pe.style.fontVariantNumeric = 'tabular-nums';
      let raf, start = null, finished = false, last = '';
      const done = () => { if (finished) return; finished = true; cancelAnimationFrame(raf); n.nodeValue = orig; pe.style.fontVariantNumeric = prevNum; };
      n.nodeValue = fmt(0);
      const ease = (p) => p < 1 ? 1 - Math.pow(1 - p, 4) : 1;
      const step = (ts) => {
        if (finished) return;
        if (start === null) start = ts + delay;
        const p = Math.min(1, Math.max(0, (ts - start) / dur));
        const v = fmt(target * ease(p));
        if (v !== last) { n.nodeValue = v; last = v; }
        if (p < 1) raf = requestAnimationFrame(step); else done();
      };
      raf = requestAnimationFrame(step);
      this._counters.push({ done });
    });
  }
}
