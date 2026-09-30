// Arreglos que se aplican a un dossier de Claude Design al importarlo, para que
// aguante en un móvil real. Salen de la auditoría de Casa Zurbano (30 sep 2026):
// en un iPhone la página se quedaba sin memoria y Safari la recargaba.
//
// Cada arreglo busca un fragmento exacto del diseño. Si el diseño cambia y el
// fragmento ya no está, el importador PARA y lo dice: mejor enterarse aquí que
// con un cliente con el móvil en la mano.

function cambia(texto, buscar, poner, nombre) {
  const hay = typeof buscar === 'string' ? texto.includes(buscar) : buscar.test(texto)
  if (!hay) throw new Error(`Arreglo "${nombre}": no encuentro el fragmento esperado (¿ha cambiado el diseño?)`)
  return texto.replace(buscar, poner)
}

const LOGO = /logo|sophiq|isotipo/i

/**
 * El documento del dossier.
 *  1. Imágenes bajo demanda. deck-stage monta TODAS las diapositivas a la vez
 *     (apiladas y ocultas), así que el móvil decodificaba las 71 imágenes al
 *     abrir: ~310 MB. A partir de la tercera diapositiva, `src` pasa a
 *     `data-fp-src` y el puente (deck/route.ts) solo carga la diapositiva
 *     actual y sus vecinas, y descarga las lejanas. Los logos se quedan.
 *  2. La animación de entrada animaba también lo que está oculto (opacidad 0):
 *     en el Recorrido los 9 renders apilados aparecían a la vez —se veía el baño,
 *     el último, antes que el salón— y los rótulos de cada estancia se pisaban.
 *  3. El vídeo largo ya no se descarga entero al abrir: se va cargando al verse.
 *  4. Los controles (Índice · idioma) arriba; el gesto de ocultarse, hacia arriba.
 */
export function arreglarDossier(html) {
  let n = 0
  html = html.replace(/<section\b[\s\S]*?<\/section>/g, (sec) => {
    n++
    if (n <= 2) return sec
    return sec.replace(/<img\b([^>]*?)\ssrc="([^"]+)"/g, (m, a, s) => (LOGO.test(s) ? m : `<img${a} data-fp-src="${s}"`))
  })

  html = cambia(html,
    "const isLogo = (el) => el.tagName === 'IMG' && /logo|isotipo/.test(el.getAttribute('src') || '');",
    "const isLogo = (el) => el.tagName === 'IMG' && /logo|isotipo/.test(el.getAttribute('src') || '');\n    const fpOculto = (el) => parseFloat(getComputedStyle(el).opacity) < 0.02;",
    'animación: detectar ocultos')
  html = cambia(html, 'if (isLogo(b)) return;', 'if (isLogo(b) || fpOculto(b)) return;', 'animación: bloques ocultos')
  html = cambia(html, 'if (isLogo(img)) return;', 'if (isLogo(img) || fpOculto(img)) return;', 'animación: imágenes ocultas')

  html = cambia(html, /(<video data-video=""[^>]*?)preload="auto"/, '$1preload="metadata"', 'vídeo: carga progresiva')

  html = cambia(html, "c.style.transform = 'translateX(-50%) translateY(8px)'", "c.style.transform = 'translateX(-50%) translateY(-6px)'", 'controles: ocultarse hacia arriba')
  return html
}

/**
 * <cz-maqueta>, la maqueta 3D.
 *  1. Arrancaba al "verse" según un IntersectionObserver, pero todas las
 *     diapositivas están apiladas en el mismo sitio: las tres maquetas de
 *     Distribuciones arrancaban al abrir el dossier. Ahora arranca solo cuando
 *     su diapositiva está activa y ella es visible, y libera su WebGL al salir.
 *  2. Pintaba al tamaño de maqueta del lienzo de diseño (1080 de ancho) ×2, no
 *     al de la pantalla: 3,6 veces más píxeles de los que se ven. Ahora, al de
 *     pantalla. Sombras a 1024 y sin preserveDrawingBuffer.
 *  3. Las maquetas de la ficha de Distribuciones (sin `pins`) son fijas: el dedo
 *     pasa de diapositiva en vez de girarlas. Tras su animación de entrada se
 *     convierten en imagen y sueltan el WebGL. Tocarlas abre su detalle.
 *     Las del detalle (con `pins`) siguen girando.
 */
export function arreglarMaqueta(js) {
  js = cambia(js,
    `      const stop = (e) => e.stopPropagation();
      ['touchstart', 'touchmove', 'touchend', 'wheel'].forEach((t) => this.addEventListener(t, stop, { passive: true }));
      const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { io.disconnect(); this._boot(); } }, { rootMargin: '200px' });
      io.observe(this);
      this._io = io;`,
    `      this._vivo = this.hasAttribute('pins');
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
      document.addEventListener('slidechange', this._check);`,
    'maqueta: arranque perezoso')

  js = cambia(js,
    `    disconnectedCallback() {
      if (this._io) this._io.disconnect();`,
    `    disconnectedCallback() {
      document.removeEventListener('slidechange', this._check);
      clearTimeout(this._bootT);
      if (this._io) this._io.disconnect();`,
    'maqueta: limpieza')

  js = cambia(js,
    `    async _boot() {
      const [THREE, M] = await load();`,
    `    _release() {
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
      if (!this._quiere()) return;`,
    'maqueta: liberar WebGL')

  // Dentro de _boot, los listeners van con la señal para poder soltarlos.
  const i = js.indexOf('async _boot() {')
  js = js.slice(0, i) + js.slice(i).replace(/this\.addEventListener\(/g, 'add(')
  js = js.replace("const add = (t, fn, o) => add(", "const add = (t, fn, o) => this.addEventListener(")

  js = cambia(js, 'preserveDrawingBuffer: true', 'preserveDrawingBuffer: false', 'maqueta: sin preserveDrawingBuffer')
  js = cambia(js, "r.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));", 'r.setPixelRatio(1);', 'maqueta: densidad')
  js = cambia(js, 'key.shadow.mapSize.set(2048, 2048)', 'key.shadow.mapSize.set(1024, 1024)', 'maqueta: sombras')
  js = cambia(js,
    'r.setSize(w, h, false); cam.aspect = w / h;',
    'const rc = this.getBoundingClientRect(), k = Math.min(2, window.devicePixelRatio || 1); r.setSize(Math.max(1, Math.round(rc.width * k)), Math.max(1, Math.round(rc.height * k)), false); cam.aspect = w / h;',
    'maqueta: resolución de pantalla')
  js = cambia(js, "layer.style.cssText = 'position:absolute;inset:0;pointer-events:none;';", "layer.setAttribute('data-fp-pins', ''); layer.style.cssText = 'position:absolute;inset:0;pointer-events:none;';", 'maqueta: capa de pins')

  // Fijas: sin arrastre, y a imagen al terminar la entrada.
  js = cambia(js, "      let drag = null;\n      add('pointerdown',", "      let drag = null;\n      if (this._vivo) add('pointerdown',", 'maqueta: arrastre solo en el detalle')
  js = cambia(js,
    "        dirty = true; if (k < 1) requestAnimationFrame(intro);",
    `        dirty = true; if (k < 1) { requestAnimationFrame(intro); return; }
        if (!this._vivo) requestAnimationFrame(() => {
          if (!this._r) return;
          place(); r.render(scene, cam);
          const im = new Image(); im.alt = ''; im.style.cssText = canvas.style.cssText + 'pointer-events:none;';
          im.src = r.domElement.toDataURL('image/png');
          this.appendChild(im); this._snap = true; this._release();
        });`,
    'maqueta: fija a imagen')
  return js
}

/**
 * <deck-stage>, el reproductor. Trae el contador "‹ 4/14 › Reset R" del editor,
 * que aparece abajo en cada cambio de diapositiva. En una página publicada
 * sobra: los controles del dossier ya son los suyos (Índice · idioma).
 */
export function arreglarDeckStage(js) {
  return cambia(js,
    ':host([data-rail-anim]) .overlay {',
    '.overlay { display: none !important; }\n    :host([data-rail-anim]) .overlay {',
    'deck-stage: sin contador del editor')
}
