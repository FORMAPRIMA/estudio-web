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
export function arreglarDossier(html, { quitar = [], perfil = '', scroll = false } = {}) {
  // Instrumentación del editor de Claude Design ("omelette"), que el servidor de
  // vista previa inyecta al descargar: reenvía la consola a la ventana padre,
  // intercepta fetch y abre un canal eval() para el editor. En una página
  // pública no pinta nada. Fuera.
  html = html.replace(/<(script|style) data-omelette-injected[^>]*>[\s\S]*?<\/\1>/g, '')
  if (html.includes('data-omelette-injected')) throw new Error('Arreglo "sin instrumentación del editor": queda algo de omelette')

  // Diapositivas que se quitan (p. ej. un cierre que sobra al añadir la nuestra).
  // Lo que apuntaba a ellas (el índice) pasa a apuntar a "Siguiente paso".
  for (const label of quitar) {
    const re = new RegExp(`<section data-label="${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[\\s\\S]*?<\\/section>\\s*`)
    html = cambia(html, re, '', `quitar diapositiva "${label}"`)
    html = html.split(`data-goto="${label}"`).join('data-goto="Siguiente paso"')
  }

  // Los arreglos de la animación de entrada solo aplican si el diseño la trae
  // (Zurbano, Torre del Mangle). Un deck estático (NE 56th St) no tiene ese script.
  const animado = html.includes("const isLogo = (el) =>")
  const cambiaAnim = animado ? cambia : (texto) => texto

  let n = 0
  html = html.replace(/<section\b[\s\S]*?<\/section>/g, (sec) => {
    n++
    if (n <= 2) return sec
    // Página de scroll (versión móvil): carga diferida del propio navegador.
    if (scroll) return sec.replace(/<img\b/g, '<img loading="lazy" decoding="async"')
    return sec.replace(/<img\b([^>]*?)\ssrc="([^"]+)"/g, (m, a, s) => (LOGO.test(s) ? m : `<img${a} data-fp-src="${s}"`))
  })

  html = cambiaAnim(html,
    "const isLogo = (el) => el.tagName === 'IMG' && /logo|isotipo/.test(el.getAttribute('src') || '');",
    "const isLogo = (el) => el.tagName === 'IMG' && /logo|isotipo/.test(el.getAttribute('src') || '');\n    const fpOculto = (el) => parseFloat(getComputedStyle(el).opacity) < 0.02;",
    'animación: detectar ocultos')
  html = cambiaAnim(html, 'if (isLogo(b)) return;', 'if (isLogo(b) || fpOculto(b)) return;', 'animación: bloques ocultos')
  html = cambiaAnim(html, 'if (isLogo(img)) return;', 'if (isLogo(img) || fpOculto(img)) return;', 'animación: imágenes ocultas')

  // Lo que sigue hasta el cierre del bloque es solo de Casa Zurbano (presupuesto,
  // recorrido, carrusel vertical, vídeo de portada, controles Índice · idioma).
  if (perfil === 'zurbano') {
  // Nivel por defecto: Select. El Presupuesto arranca en Functional y pasa a
  // Select a los 1,5 s; si se pasaba antes, Calidades y Cronograma heredaban
  // Functional. Ahora heredan solo lo que el visitante elige a mano.
  html = cambia(html,
    'curLevel() { return this._b2 != null ? this._b2 : this._budP == null ? 1 : Math.round(this._budP); }',
    'curLevel() { return this._budTouched && this._b2 != null ? this._b2 : 1; }',
    'nivel por defecto: Select')

  }

  // Transición entre diapositivas más suave (ver también arreglarDeckStage).
  html = cambiaAnim(html,
    "run(slide, [{ opacity: 0 }, { opacity: 1 }], { duration: 700, easing: 'cubic-bezier(.4,0,.2,1)' });",
    `run(slide, [{ opacity: 0 }, { opacity: 1 }], { duration: 1100, easing: 'cubic-bezier(.45,0,.25,1)' });
    // Equipo: telón de abajo arriba en diagonal, y el nombre detrás de cada foto.
    if (slide.getAttribute('data-label') === 'Equipo · perfiles') {
      const cab = slide.firstElementChild, h2 = slide.querySelector('h2');
      if (cab) run(cab, [{ opacity: 0 }, { opacity: 1 }], { duration: 1000, delay: 250 });
      if (h2) run(h2, [{ opacity: 0, transform: 'translate3d(0,28px,0)' }, { opacity: 1, transform: 'none' }], { duration: 1400, delay: 300 });
      [...slide.querySelectorAll('img')].filter((im) => !/logo|isotipo|sophiq/.test(im.getAttribute('src') || im.getAttribute('data-fp-src') || '')).forEach((im, i) => {
        const d = 550 + (Math.floor(i / 3) + (i % 3)) * 170;
        run(im, [{ opacity: 0, clipPath: 'inset(0 0 100% 0)', transform: 'translate3d(0,36px,0)' }, { opacity: 1, clipPath: 'inset(0 0 0% 0)', transform: 'none' }], { duration: 1500, delay: d, easing: 'cubic-bezier(.22,1,.36,1)' });
        const pie = im.nextElementSibling;
        if (pie) run(pie, [{ opacity: 0, transform: 'translate3d(0,14px,0)' }, { opacity: 1, transform: 'none' }], { duration: 1000, delay: d + 550 });
      });
      return;
    }`,
    'transición de entrada + equipo')

  if (perfil === 'zurbano') {
  // Recorrido: flechas sutiles a los lados del render para recorrerlos como un
  // carrusel (tocar las estancias del plano no es evidente). Cada paso pasa por
  // tourGo, así que el render funde y se enciende su punto en la maqueta.
  html = cambia(html,
    '      pickView: (e) =>',
    "      tourStep: (e) => this.tourStep(+e.currentTarget.getAttribute('data-tour-step')),\n      pickView: (e) =>",
    'recorrido: acción de las flechas')
  html = cambia(html,
    '  tourGo(r, v, force) {',
    `  tourStep(d) {
    const keys = [...document.querySelectorAll('[data-tour-img]')].map((im) => im.getAttribute('data-tour-img'));
    if (!keys.length) return;
    const cur = this._tour ? this._tour[0] + '-' + this._tour[1] : keys[0];
    const i = (Math.max(0, keys.indexOf(cur)) + d + keys.length) % keys.length;
    const [r, v] = keys[i].split('-').map(Number);
    this.tourGo(r, v);
  }
  tourGo(r, v, force) {`,
    'recorrido: paso del carrusel')
  const imgsTour = [...html.matchAll(/<img data-tour-img="[^"]*"[^>]*>/g)]
  if (!imgsTour.length) throw new Error('Arreglo "recorrido: flechas": no encuentro los renders del recorrido')
  const tras = imgsTour[imgsTour.length - 1]
  const flecha = (paso, lado, d) => `<button type="button" data-tour-step="${paso}" onClick="{{ tourStep }}" aria-label="${paso < 0 ? 'Anterior' : 'Siguiente'}" style="position:absolute;${lado}:20px;top:50%;transform:translateY(-50%);z-index:3;width:68px;height:68px;border-radius:999px;border:0;padding:0;background:rgba(246,241,234,.62);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;cursor:pointer;"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#2b2622" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d}"></path></svg></button>`
  const i = tras.index + tras[0].length
  html = html.slice(0, i) + flecha(-1, 'left', 'M14.5 5.5 8 12l6.5 6.5') + flecha(1, 'right', 'M9.5 5.5 16 12l-6.5 6.5') + html.slice(i)

  // Vídeos: el navegador instancia el <x-dc> estático antes de que arranque el
  // runtime, y luego React crea los suyos: cada vídeo se descargaba dos veces
  // (~40 MB al abrir). Las <source> van inertes (data-fp-src) y el puente las
  // activa solo en los vídeos de la versión interactiva (#dc-root).
  html = cambia(html, /<source src="/g, '<source data-fp-src="', 'vídeo: fuentes inertes')

  }

  // Sin zoom con los dedos dentro del dossier: en iPhone el zoom de una página
  // así dispara la memoria (y es lo que "reiniciaba" la página).
  html = cambia(html,
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    '<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">',
    'viewport sin zoom')

  // Animación de entrada: movía cada bloque con `transform`, pisando el que el
  // bloque ya tuviera. El título de la Portada va centrado con
  // translateY(-50%): durante la animación perdía el centrado y al terminar
  // saltaba hacia arriba. Ahora el movimiento se SUMA al transform propio.
  html = cambiaAnim(html,
    "run(b, [{ opacity: 0, transform: 'translate3d(0,28px,0)' }, { opacity: 1, transform: 'translate3d(0,0,0)' }], { duration: 1400, delay: d });",
    "run(b, [{ opacity: 0, transform: ((b.style.transform || '') + ' translate3d(0,28px,0)').trim() }, { opacity: 1, transform: b.style.transform || 'translate3d(0,0,0)' }], { duration: 1400, delay: d });",
    'animación: títulos con transform propio')
  html = cambiaAnim(html,
    "run(b, [{ opacity: 0, transform: 'translate3d(0,16px,0)' }, { opacity: 1, transform: 'translate3d(0,0,0)' }], { duration: 1200, delay: d });",
    "run(b, [{ opacity: 0, transform: ((b.style.transform || '') + ' translate3d(0,16px,0)').trim() }, { opacity: 1, transform: b.style.transform || 'translate3d(0,0,0)' }], { duration: 1200, delay: d });",
    'animación: bloques con transform propio')

  if (perfil === 'zurbano') {
  // Carrusel del Portafolio: movía una sola pista de 12.580 px de diseño
  // (~13.600 px reales en un iPhone) con los 9 proyectos duplicados. Rasterizar
  // y desplazar esa capa agotaba la memoria del iPhone a mitad del carrusel.
  // Ahora cada tarjeta se mueve por separado y, al salir por arriba, vuelve a
  // entrar por abajo: el mismo bucle sin duplicados, y las que no se ven no se
  // pintan.
  html = cambia(html,
    `    const dup = track.querySelector('[data-dup]');
    if (!dup) return;
    const loop = dup.offsetTop;
    if (!loop) return;
    this._carA = track.animate([{ transform: 'translate3d(0,0,0)' }, { transform: 'translate3d(0,' + (-loop) + 'px,0)' }], { duration: loop / 45 * 1000, iterations: Infinity, easing: 'linear' });
  }`,
    `    const items = [...track.children].filter((n) => !n.hasAttribute('data-dup'));
    if (!items.length) return;
    track.querySelectorAll(':scope > [data-dup]').forEach((d) => { d.style.display = 'none'; });
    const gap = parseFloat(getComputedStyle(track).rowGap) || 0;
    const pos = items.map((n) => n.offsetTop), alt = items.map((n) => n.offsetHeight);
    const H = alt.reduce((a, h) => a + h + gap, 0), vista = track.parentElement ? track.parentElement.clientHeight : H;
    if (!H) return;
    items.forEach((n) => { n.style.willChange = 'transform'; });
    let t0 = null;
    const paso = (t) => {
      if (t0 === null) t0 = t;
      const off = ((t - t0) * 0.045) % H;
      for (let i = 0; i < items.length; i++) {
        let y = ((pos[i] - off) % H + H) % H;
        if (y > H - alt[i] - gap) y -= H;
        items[i].style.transform = 'translate3d(0,' + (y - pos[i]).toFixed(1) + 'px,0)';
        items[i].style.visibility = y > vista + 40 || y + alt[i] < -40 ? 'hidden' : '';
      }
      this._carRaf = requestAnimationFrame(paso);
    };
    this._carRaf = requestAnimationFrame(paso);
  }`,
    'carrusel por tarjetas')
  html = cambia(html,
    "    document.querySelectorAll('[data-carousel]').forEach(t => { t.getAnimations().forEach(a => a.cancel()); t.style.transform = ''; });",
    "    cancelAnimationFrame(this._carRaf);\n    document.querySelectorAll('[data-carousel]').forEach(t => { t.getAnimations().forEach(a => a.cancel()); t.style.transform = ''; [...t.children].forEach((n) => { n.style.transform = ''; n.style.visibility = ''; n.style.willChange = ''; if (n.hasAttribute('data-dup')) n.style.display = ''; }); });",
    'carrusel: parar')

  html = cambia(html, /(<video data-video=""[^>]*?)preload="auto"/, '$1preload="metadata"', 'vídeo: carga progresiva')

  // Rueda: un gesto = una diapositiva (la inercia del trackpad dura más de los
  // 700 ms del bloqueo original y pasaba dos). Se espera a que el gesto acabe.
  html = cambia(html,
    "    this._wh = (e) => { if (Math.abs(e.deltaY) < 20 || Date.now() < lock) return; lock = Date.now() + 700; nav(e.deltaY > 0 ? 1 : -1); };",
    "    let tW = 0, enG = false;\n    this._wh = (e) => { const ahora = Date.now(); if (ahora - tW > 200) enG = false; tW = ahora; if (enG || Math.abs(e.deltaY) < 20) return; enG = true; nav(e.deltaY > 0 ? 1 : -1); };",
    'rueda: un gesto, una diapositiva')

  html = cambia(html, "c.style.transform = 'translateX(-50%) translateY(8px)'", "c.style.transform = 'translateX(-50%) translateY(-6px)'", 'controles: ocultarse hacia arriba')
  }
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

  // three.js desde nuestro dominio (public/propuestas/_rt), no desde unpkg: si
  // unpkg cae, la maqueta no carga; y aquí no había comprobación de integridad.
  js = cambia(js, "const THREE_URL = 'https://unpkg.com/three@0.184.0/build/three.module.js';", "const THREE_URL = '/propuestas/_rt/three.module.min.js';", 'maqueta: three.js propio')
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
  // Sin el carril de miniaturas del editor: en una pantalla ancha (las
  // presentaciones horizontales) aparecía a la izquierda y desplazaba la diapositiva.
  js = cambia(js,
    "if (/[?&]_snthumb=/.test(location.search)) this.setAttribute('no-rail', '');",
    "this.setAttribute('no-rail', '');",
    'deck-stage: sin carril de miniaturas')
  js = cambia(js,
    ':host([data-rail-anim]) .overlay {',
    '.overlay { display: none !important; }\n    :host([data-rail-anim]) .overlay {',
    'deck-stage: sin contador del editor')
  // La diapositiva actual se apuntaba con history.replaceState(null, '', '#7'),
  // que se resuelve contra el <base> del dossier: la URL del iframe pasaba a ser
  // /propuestas/<slug>/#7 (la carpeta de assets). Si Safari recargaba el iframe,
  // cargaba una dirección que no existe. Ahora conserva ruta y parámetros.
  const n = (js.match(/history\.replaceState\(null, '', '#' \+ /g) || []).length
  if (n < 1) throw new Error('Arreglo "deck-stage: URL del hash": no encuentro replaceState')
  js = js.replace(/history\.replaceState\(null, '', '#' \+ /g, "history.replaceState(null, '', location.pathname + location.search + '#' + ")

  // Fundido cruzado: la diapositiva que entra (encima) funde en 1,1 s y la que
  // sale se queda debajo, visible, hasta que la otra la ha tapado. Antes la que
  // salía desaparecía de golpe.
  js = cambia(js,
    `      opacity: 0;
      pointer-events: none;
      visibility: hidden;
    }
    ::slotted([data-deck-active]) {
      opacity: 1;
      pointer-events: auto;
      visibility: visible;
    }`,
    `      opacity: 0;
      pointer-events: none;
      visibility: hidden;
      z-index: 1;
    }
    ::slotted([data-fp-saliente]) {
      opacity: 1;
      visibility: visible;
    }
    ::slotted([data-deck-active]) {
      opacity: 1;
      pointer-events: auto;
      visibility: visible;
      z-index: 2;
      transition: opacity 1.1s cubic-bezier(.45,0,.25,1);
    }`,
    'deck-stage: fundido cruzado')
  // La que sale se marca con data-fp-saliente durante el fundido (1,1 s). Antes
  // esto se hacía con una transición retardada de \`visibility\`, y Chrome dejaba
  // a veces el CONTENIDO de una diapositiva ya vista oculto al volver a ella
  // (se veía solo el fondo: Equipo, Honorarios… en negro). Sin transiciones de
  // visibility, el problema no puede darse.
  js = cambia(js,
    `      this._slides.forEach((s, i) => {
        if (i === curr) s.setAttribute('data-deck-active', '');
        else s.removeAttribute('data-deck-active');
      });`,
    `      clearTimeout(this._fpSalT);
      this._slides.forEach((s, i) => {
        if (i === curr) { s.setAttribute('data-deck-active', ''); s.removeAttribute('data-fp-saliente'); }
        else if (i === prev && reason !== 'init') { s.removeAttribute('data-deck-active'); s.setAttribute('data-fp-saliente', ''); }
        else { s.removeAttribute('data-deck-active'); s.removeAttribute('data-fp-saliente'); }
      });
      this._fpSalT = setTimeout(() => this._slides.forEach((s) => s.removeAttribute('data-fp-saliente')), 1150);
      // Chrome no siempre propaga a los hijos el cambio de visibility que
      // viene de ::slotted(): la diapositiva aparecía con su contenido aún
      // oculto (solo el fondo). Un estilo en línea fugaz fuerza el recálculo.
      // Se reasigna en línea la herencia de cada elemento de la que entra.
      const sEnt = this._slides[curr];
      if (sEnt) {
        const ns = [...sEnt.querySelectorAll('*')].filter((n) => !n.style.visibility || n.style.visibility === 'inherit');
        ns.forEach((n) => { n.style.visibility = ''; });
        void sEnt.offsetWidth;
        ns.forEach((n) => { n.style.visibility = 'inherit'; });
      }`,
    'deck-stage: diapositiva saliente')
  return js
}

/**
 * support.js, el runtime de Claude Design. Cargaba React y ReactDOM de unpkg.com:
 * si unpkg cae, el dossier no abre. Ahora vienen de public/propuestas/_rt (los
 * mismos ficheros, byte a byte: la comprobación de integridad SRI se mantiene).
 */
export function arreglarSupport(js) {
  js = cambia(js, '"https://unpkg.com/react@18.3.1/umd/react.production.min.js"', '"/propuestas/_rt/react.production.min.js"', 'runtime: React propio')
  js = cambia(js, '"https://unpkg.com/react-dom@18.3.1/umd/react-dom.production.min.js"', '"/propuestas/_rt/react-dom.production.min.js"', 'runtime: ReactDOM propio')
  return js
}
