// <cz-maqueta plan="1"> — clay model of a Zurbano 6 layout with gentle, bounded rotation.
(function () {
  if (customElements.get('cz-maqueta')) return;
  const THREE_URL = 'https://unpkg.com/three@0.184.0/build/three.module.js';
  let libs = null;
  const load = () => libs || (libs = Promise.all([import(THREE_URL), import(new URL('./zurbano6-maquetas.js', document.baseURI).href)]));
  const YAW = 0.55, PITCH_MIN = 0.62, PITCH_MAX = 1.18, PITCH0 = 0.98;

  class CzMaqueta extends HTMLElement {
    connectedCallback() {
      if (this._init) return; this._init = true;
      this.style.display = this.style.display || 'block';
      this.style.position = this.style.position || 'relative';
      this.style.touchAction = 'none';
      this.style.cursor = 'grab';
      if (!this.hasAttribute('tabindex')) this.setAttribute('tabindex', '0');
      this.style.outline = 'none';
      this._vivo = this.hasAttribute('pins');
      if (this._vivo) {
        const stop = (e) => e.stopPropagation();
        ['touchstart', 'touchmove', 'touchend', 'wheel'].forEach((t) => this.addEventListener(t, stop, { passive: true }));
      } else {
        this.style.touchAction = 'pan-y'; this.style.cursor = 'pointer';
        this.addEventListener('click', (e) => {
          e.stopPropagation();
          let n = this.parentElement;
          while (n && !n.querySelector('[data-plan-open]')) n = n.parentElement;
          const b = n && n.querySelector('[data-plan-open]'); if (b) b.click();
        });
      }
      const activa = () => { const s = this.closest('section'); return !s || s.hasAttribute('data-deck-active'); };
      const visible = () => { const r = this.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
      this._quiere = () => activa() && visible();
      this._check = () => {
        if (this._snap) return;
        if (this._quiere()) {
          if (this._r || this._booting || this._bootT) return;
          this._bootT = setTimeout(() => { this._bootT = 0; if (this._quiere() && !this._r && !this._booting) this._boot(); }, 450);
        } else {
          clearTimeout(this._bootT); this._bootT = 0;
          if (this._r) this._release();
        }
      };
      const io = new IntersectionObserver(() => this._check());
      io.observe(this);
      this._io = io;
      document.addEventListener('slidechange', this._check);
    }
    disconnectedCallback() {
      document.removeEventListener('slidechange', this._check);
      clearTimeout(this._bootT);
      if (this._io) this._io.disconnect();
      if (this._ro) this._ro.disconnect();
      if (this._r) { this._r.dispose(); this._r.forceContextLoss && this._r.forceContextLoss(); }
      cancelAnimationFrame(this._raf);
    }
    _release() {
      if (this._abort) this._abort.abort();
      if (this._ro) { this._ro.disconnect(); this._ro = null; }
      cancelAnimationFrame(this._raf);
      if (this._r) { this._r.dispose(); if (this._r.forceContextLoss) this._r.forceContextLoss(); this._r = null; }
      this.querySelectorAll(':scope > canvas, :scope > [data-fp-pins]').forEach((n) => n.remove());
      this.highlight = null;
    }
    async _boot() {
      this._booting = true;
      this._abort = new AbortController();
      const add = (t, fn, o) => this.addEventListener(t, fn, Object.assign({}, o, { signal: this._abort.signal }));
      const [THREE, M] = await load();
      this._booting = false;
      if (!this._quiere()) return;
      const plan = +(this.getAttribute('plan') || 1);
      const canvas = document.createElement('canvas');
      canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;';
      this.appendChild(canvas);
      const r = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: false });
      r.setPixelRatio(1);
      r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFShadowMap;
      r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.08; r.outputColorSpace = THREE.SRGBColorSpace;
      this._r = r;
      const scene = new THREE.Scene();
      const clay = new THREE.MeshStandardMaterial({ color: '#e4d6c4', roughness: 0.92 });
      const base = new THREE.MeshStandardMaterial({ color: '#f4efe7', roughness: 0.95 });
      const g = M.createBuilder(THREE, clay, base).build(plan, { H: 1.3, furniture: true });
      g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
      const box = new THREE.Box3().setFromObject(g), c = box.getCenter(new THREE.Vector3());
      g.position.sub(c);
      const pivot = new THREE.Group(); pivot.add(g); scene.add(pivot);
      const rad = box.getBoundingSphere(new THREE.Sphere()).radius;
      scene.add(new THREE.HemisphereLight('#fffaf2', '#b9ab98', 1.15));
      const key = new THREE.DirectionalLight('#fff4e6', 2.1);
      key.position.set(-rad * 0.6, rad * 2.4, rad * 1.0); key.castShadow = true; key.shadow.mapSize.set(1024, 1024);
      Object.assign(key.shadow.camera, { left: -rad * 1.3, right: rad * 1.3, top: rad * 1.3, bottom: -rad * 1.3, near: 0.1, far: rad * 6 });
      key.shadow.bias = -0.0004; scene.add(key);
      const cam = new THREE.PerspectiveCamera(20, 1, 0.1, 1000);
      const size = new THREE.Vector3(); box.getSize(size);
      let yaw = 0, pitch = PITCH0, vy = 0, dist = 1, dirty = true;
      const BASE = this.hasAttribute('portrait') ? -Math.PI / 2 : 0;
      const hx = size.x / 2, hz = size.z / 2, hy = size.y / 2;
      const corners = [];
      for (const x of [-hx, hx]) for (const y of [-hy, hy]) for (const z of [-hz, hz]) corners.push(new THREE.Vector3(x, y, z));
      const tc = new THREE.PerspectiveCamera(cam.fov, 1, 0.1, 1e4), tv = new THREE.Vector3(), rot = new THREE.Matrix4();
      const fits = (d, yw, pt) => {
        tc.position.set(0, Math.sin(pt) * d, Math.cos(pt) * d); tc.lookAt(0, 0, 0); tc.updateMatrixWorld(); rot.makeRotationY(yw + BASE);
        return corners.every((p) => { tv.copy(p).applyMatrix4(rot).project(tc); return tv.z < 1 && Math.abs(tv.x) <= 0.96 && Math.abs(tv.y) <= 0.94; });
      };
      const need = (yw, pt) => { let lo = rad * 0.2, hi = rad * 20; for (let i = 0; i < 22; i++) { const m = (lo + hi) / 2; if (fits(m, yw, pt)) hi = m; else lo = m; } return hi; };
      let target = 1;
      const fit = () => {
        const w = this.clientWidth || 1, h = this.clientHeight || 1;
        const rc = this.getBoundingClientRect(), k = Math.min(2, window.devicePixelRatio || 1); r.setSize(Math.max(1, Math.round(rc.width * k)), Math.max(1, Math.round(rc.height * k)), false); cam.aspect = w / h; cam.updateProjectionMatrix();
        tc.fov = cam.fov; tc.aspect = cam.aspect; tc.updateProjectionMatrix();
        target = need(yaw, pitch); dist = target; dirty = true;
      };
      const place = () => {
        pivot.rotation.y = yaw + BASE;
        cam.position.set(0, Math.sin(pitch) * dist, Math.cos(pitch) * dist);
        cam.lookAt(0, 0, 0);
      };
      const pinsOn = this.hasAttribute('pins'), pins = [];
      if (pinsOn) {
        const layer = document.createElement('div');
        layer.setAttribute('data-fp-pins', ''); layer.style.cssText = 'position:absolute;inset:0;pointer-events:none;';
        this.appendChild(layer);
        g.updateMatrixWorld(true);
        Object.entries(M.PLANS[plan].rooms).forEach(([n, [name, x, v]]) => {
          const el = document.createElement('span');
          el.setAttribute('data-room', n);
          el.style.cssText = 'position:absolute;left:0;top:0;width:40px;height:40px;margin:-20px 0 0 -20px;display:flex;align-items:center;justify-content:center;font:400 22px/1 "Hanken Grotesk",sans-serif;font-variant-numeric:tabular-nums;color:#2b2622;text-shadow:0 0 6px rgba(246,241,234,.95),0 0 2px rgba(246,241,234,.95);transition:color .25s;will-change:transform;';
          el.textContent = n;
          layer.appendChild(el);
          pins.push({ el, n, p: new THREE.Vector3(x - M.CX, 0.5, M.CZ - v) });
        });
        this.highlight = (n) => pins.forEach((q) => { const on = q.n === String(n); q.el.style.color = on ? '#8c6a55' : '#2b2622'; q.el.style.fontWeight = on ? '600' : '400'; q.el.style.zIndex = on ? '2' : '1'; q.el.dataset.on = on ? '1' : ''; dirty = true; });
      }
      const wp = new THREE.Vector3();
      const placePins = () => {
        if (!pins.length) return;
        const w = this.clientWidth, h = this.clientHeight;
        g.updateMatrixWorld(true);
        pins.forEach((q) => { wp.copy(q.p); g.localToWorld(wp); wp.project(cam); q.el.style.transform = 'translate(' + ((wp.x * 0.5 + 0.5) * w).toFixed(1) + 'px,' + ((-wp.y * 0.5 + 0.5) * h).toFixed(1) + 'px)' ; });
      };
      this._ro = new ResizeObserver(fit); this._ro.observe(this); fit();
      let drag = null;
      if (this._vivo) add('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY, id: e.pointerId }; try { this.setPointerCapture(e.pointerId); } catch (_) {} this.style.cursor = 'grabbing'; vy = 0; });
      add('pointermove', (e) => {
        if (!drag || e.pointerId !== drag.id) return;
        const s = 1 / Math.max(240, this.clientWidth), dx = e.clientX - drag.x, dy = e.clientY - drag.y;
        drag.x = e.clientX; drag.y = e.clientY;
        vy = dx * s * 2.4; yaw = Math.max(-YAW, Math.min(YAW, yaw + vy));
        pitch = Math.max(PITCH_MIN, Math.min(PITCH_MAX, pitch + dy * s * 1.6));
        target = need(yaw, pitch); dirty = true;
      });
      const end = (e) => { if (drag && e.pointerId === drag.id) { drag = null; this.style.cursor = 'grab'; } };
      add('pointerup', end); add('pointercancel', end);
      add('click', (e) => e.stopPropagation());
      const loop = () => {
        this._raf = requestAnimationFrame(loop);
        if (!drag && Math.abs(vy) > 0.0004) { vy *= 0.9; yaw = Math.max(-YAW, Math.min(YAW, yaw + vy)); target = need(yaw, pitch); dirty = true; }
        if (Math.abs(dist - target) > 0.002) { dist += (target - dist) * 0.18; dirty = true; }
        if (!dirty) return; dirty = false; place(); r.render(scene, cam); placePins();
      };
      // entrance: model rises and turns in
      const t0 = performance.now(), reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
      const ups = []; g.traverse((o) => { if (o.name === 'alzado') ups.push(o); });
      if (!reduce) { ups.forEach((u) => (u.scale.y = 0.001)); yaw = -0.35; }
      const intro = (t) => {
        const k = reduce ? 1 : Math.min(1, (t - t0) / 1400), e = 1 - Math.pow(1 - k, 3);
        ups.forEach((u) => (u.scale.y = Math.max(0.001, e)));
        if (!drag && !reduce) { yaw = -0.35 * (1 - e); target = need(yaw, pitch); dist = target; }
        dirty = true; if (k < 1) { requestAnimationFrame(intro); return; }
        if (!this._vivo) requestAnimationFrame(() => {
          if (!this._r) return;
          place(); r.render(scene, cam);
          const im = new Image(); im.alt = ''; im.style.cssText = canvas.style.cssText + 'pointer-events:none;';
          im.src = r.domElement.toDataURL('image/png');
          this.appendChild(im); this._snap = true; this._release();
        });
      };
      requestAnimationFrame(intro);
      loop();
      this.dispatchEvent(new CustomEvent('ready'));
    }
  }
  customElements.define('cz-maqueta', CzMaqueta);
})();
