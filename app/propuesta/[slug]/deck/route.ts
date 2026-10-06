import { cookies } from 'next/headers'
import { getPropuestaWeb, cargarDossier, type PropuestaWeb } from '@/lib/propuestas/registro'
import { accesoDossier } from '@/lib/salas/servidor'
import { obrasDestacadas } from '@/lib/propuestas/obras'
import type { ProyectoEnlace } from '@/components/propuesta/SlideSiguiente'
import { escritorioDe } from '@/lib/propuestas/escritorio'

// El documento de un dossier interactivo ('dc'), tal como salió de Claude Design,
// con su propio runtime. Lo pinta un iframe de /propuesta/<slug>. Si la propuesta
// tiene PIN, solo se sirve con su cookie: aquí van las cifras.
//
// Sobre el documento se hacen tres cosas al servirlo:
//   · <base> apuntando a public/propuestas/<slug>/, donde viven runtime y assets,
//     para que todas sus rutas relativas ("assets/…", "./support.js") resuelvan;
//   · el alto del lienzo se ajusta a la pantalla (?alto=), como en las propuestas
//     'deck': cada diapositiva llena el móvil entero;
//   · se inserta la diapositiva final y un puente que avisa a la página de qué
//     diapositiva se está viendo y de cuándo se pulsa "Me interesa".

export const dynamic = 'force-dynamic'

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!))
const bi = (es: string, en: string) => `<span data-es="">${es}</span><span data-en="" style="display:none;">${en}</span>`

function slideSiguiente(p: PropuestaWeb, obras: ProyectoEnlace[], numero: string): string {
  const INK = '#2b2622', ACC = '#8c6a55', LINE = 'rgba(43,38,34,.18)'
  const serif = "font-family:'Cormorant Garamond',serif;font-variant-numeric:lining-nums;"
  const mail = `mailto:contacto@formaprima.es?subject=${encodeURIComponent(p.proyecto)}`
  const boton = 'display:block;width:100%;text-align:center;font-family:inherit;font-size:24px;font-weight:500;letter-spacing:.2em;text-transform:uppercase;padding:38px 40px;cursor:pointer;text-decoration:none;'
  const tarjetas = obras.map((o) => `
      <a href="https://formaprima.es/proyectos/${esc(o.slug)}" target="_blank" rel="noopener" style="color:${INK};text-decoration:none;display:flex;flex-direction:column;gap:14px;">
        <div style="position:relative;overflow:hidden;aspect-ratio:16/11;background:#e6ddd0;"><img data-fp-src="${esc(o.imagen)}" alt="${esc(o.nombre)}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block;"></div>
        <div><div style="font-size:26px;font-weight:400;">${esc(o.nombre)}</div><div style="margin-top:4px;font-size:20px;font-weight:300;opacity:.6;">${esc(o.ubicacion ?? '')}</div></div>
      </a>`).join('')

  return `
<section data-label="Siguiente paso" data-fp-final="" style="background:#f6f1ea;color:${INK};font-family:'Hanken Grotesk',sans-serif;display:flex;flex-direction:column;justify-content:space-between;padding:96px 72px 88px;">
  <div style="display:flex;justify-content:space-between;align-items:center;">
    <span style="display:flex;align-items:baseline;gap:14px;font-size:28px;font-weight:400;color:${ACC};"><span style="${serif}font-size:32px;font-weight:500;opacity:.8;">${numero}</span>${bi('Siguiente paso', 'Next step')}</span>
    <span style="display:flex;align-items:center;gap:16px;opacity:.85;"><img src="assets/logo-h-black.png" alt="Forma Prima" style="height:16px;width:auto;display:block;"><span style="width:1px;height:26px;background:rgba(43,38,34,.35);"></span><img src="assets/sophiq-black.png" alt="Sophiq Properties" style="height:28px;width:auto;display:block;"></span>
  </div>
  <div>
    <h2 style="${serif}margin:0;font-size:104px;font-weight:500;letter-spacing:-.01em;line-height:1.02;">${bi('¿Te imaginas<br>viviendo aquí?', 'Can you picture<br>yourself here?')}</h2>
    <div style="width:80px;height:1px;background:${ACC};margin:44px 0 32px;"></div>
    <p style="margin:0;font-size:30px;font-weight:300;line-height:1.5;opacity:.78;">${bi(
      'Déjanos tus datos y te llamamos para enseñarte el piso, resolver tus dudas y preparar el diseño con la distribución y el nivel que elijas.',
      'Leave us your details and we will call you to show you the apartment, answer your questions and prepare the design with the layout and level you choose.',
    )}</p>
  </div>
  <div data-fp-cta="" style="display:flex;flex-direction:column;gap:20px;">
    <button type="button" data-fp-interes="" style="${boton}background:${INK};color:#f6f1ea;border:1px solid ${INK};">${bi('Me interesa', 'I’m interested')}</button>
    <a href="${mail}" style="${boton}background:transparent;color:${INK};border:1px solid rgba(43,38,34,.35);">${bi('Tengo dudas · escríbenos', 'Questions? · write to us')}</a>
  </div>
  <div data-fp-hecho="" style="display:none;border-top:1px solid ${ACC};padding-top:36px;">
    <div style="${serif}font-size:64px;font-weight:500;line-height:1.05;">${bi('Recibido. Gracias.', 'Received. Thank you.')}</div>
    <p style="margin:18px 0 0;font-size:28px;font-weight:300;line-height:1.5;opacity:.72;">${bi('Te llamamos muy pronto para organizar la visita.', 'We will call you very soon to arrange a visit.')}</p>
  </div>
  <div style="display:flex;flex-direction:column;gap:32px;">
    <span style="font-size:22px;font-weight:600;letter-spacing:.2em;text-transform:uppercase;color:${ACC};">${bi('Mientras tanto, conoce el estudio', 'Meanwhile, discover the studio')}</span>
    <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:28px;">${tarjetas}</div>
  </div>
  <div style="display:flex;flex-direction:column;gap:24px;">
    <a href="https://formaprima.es" target="_blank" rel="noopener" style="display:flex;justify-content:space-between;align-items:baseline;color:${INK};text-decoration:none;border-top:1px solid ${LINE};padding-top:30px;">
      <span style="${serif}font-size:52px;font-weight:500;">${bi('Visitar formaprima.es', 'Visit formaprima.es')}</span><span style="font-size:44px;font-weight:200;color:${ACC};">→</span>
    </a>
    <div style="font-size:21px;font-weight:300;opacity:.55;">contacto@formaprima.es · Príncipe de Vergara 56, Madrid</div>
  </div>
</section>`
}

// Diapositiva final de una propuesta de honorarios horizontal (1920×1080) para
// un cliente: aceptar o preguntar, y la puerta a la web con las obras. El mismo
// lenguaje que SlideSiguiente (tipo 'deck') y que el diseño de Torre del Mangle:
// Hanken Grotesk + Newsreader en cursiva, #0d0d0d / #fbfbfa / verde #8fa596.
// La aceptación la tramita la página (puente: 'aceptar' → 'aceptada' | 'error').
function slideSiguienteCliente(p: PropuestaWeb, obras: ProyectoEnlace[], numero: string): string {
  const INK = '#0d0d0d', PAPER = '#fbfbfa', SAGE = '#8fa596', LINE = 'rgba(251,251,250,.18)'
  const mail = `mailto:contacto@formaprima.es?subject=${encodeURIComponent(`Propuesta de honorarios · ${p.proyecto}`)}`
  const boton = 'appearance:none;cursor:pointer;font-family:inherit;font-size:14px;font-weight:500;letter-spacing:.2em;text-transform:uppercase;padding:24px 40px;border-radius:0;text-align:center;text-decoration:none;display:inline-block;transition:background .25s,color .25s,border-color .25s;'
  const primario = `${boton}background:${PAPER};color:${INK};border:1px solid ${PAPER};`
  const secundario = `${boton}background:transparent;color:${PAPER};border:1px solid rgba(251,251,250,.32);`
  const tarjetas = obras.map((o) => `
        <a href="https://formaprima.es/proyectos/${esc(o.slug)}" target="_blank" rel="noopener" data-fp-obra="" style="color:${PAPER};text-decoration:none;display:flex;flex-direction:column;gap:14px;min-width:0;">
          <div style="position:relative;overflow:hidden;aspect-ratio:16/10;background:#1a1a1a;"><img data-fp-src="${esc(o.imagen)}" alt="${esc(o.nombre)}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block;filter:saturate(.75);"></div>
          <div style="display:flex;justify-content:space-between;align-items:baseline;gap:12px;"><span style="font-size:18px;font-weight:400;letter-spacing:-.005em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(o.nombre)}</span><span style="font-size:13px;font-weight:300;opacity:.55;white-space:nowrap;">${esc(o.ubicacion ?? '')}</span></div>
        </a>`).join('')

  return `
<section data-label="Siguiente paso" data-fp-final="" style="background:${INK};color:${PAPER};font-family:'Hanken Grotesk',sans-serif;display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.1fr);">
  <div style="padding:96px 88px 96px 104px;display:flex;flex-direction:column;justify-content:space-between;min-width:0;">
    <span style="display:inline-flex;align-items:baseline;gap:12px;color:${SAGE};"><span style="font-size:12px;font-weight:500;letter-spacing:.02em;font-variant-numeric:tabular-nums;">${numero}</span><span style="font-family:'Newsreader',serif;font-style:italic;font-size:19px;font-weight:400;">Siguiente paso</span></span>
    <div>
      <h2 style="margin:0;font-size:88px;font-weight:200;letter-spacing:-.035em;line-height:.98;">¿Empezamos,<br>${esc(p.nombreCliente)}?</h2>
      <div style="width:64px;height:1px;background:${SAGE};margin:40px 0 28px;"></div>
      <p style="margin:0;max-width:620px;font-size:22px;font-weight:300;line-height:1.5;opacity:.75;">Si la propuesta encaja, acéptala aquí. Te escribimos hoy mismo para enviarte el documento a firma y fijar la fecha de arranque.</p>
    </div>
    <div data-fp-paso="inicio" style="display:flex;gap:20px;">
      <button type="button" data-fp-accion="confirmar" style="${primario}">Aceptar propuesta</button>
      <a href="${mail}" style="${secundario}">Tengo dudas · escríbenos</a>
    </div>
    <div data-fp-paso="confirmar" style="display:none;flex-direction:column;gap:18px;">
      <div style="font-size:18px;font-weight:300;line-height:1.45;opacity:.85;">Vas a aceptar la propuesta de honorarios de ${esc(p.proyecto)}.</div>
      <textarea data-fp-comentario="" rows="2" placeholder="¿Quieres comentarnos algo? (opcional)" style="font-family:inherit;font-size:16px;font-weight:300;color:${PAPER};line-height:1.45;background:rgba(251,251,250,.04);border:1px solid rgba(251,251,250,.2);border-radius:0;padding:16px;resize:none;outline:none;"></textarea>
      <div data-fp-error="" style="display:none;font-size:14px;color:#e0a39a;"></div>
      <div style="display:flex;gap:16px;">
        <button type="button" data-fp-accion="aceptar" style="${primario}">Confirmar aceptación</button>
        <button type="button" data-fp-accion="volver" style="${secundario}">Volver</button>
      </div>
    </div>
    <div data-fp-paso="hecho" style="display:none;border-top:1px solid ${SAGE};padding-top:28px;">
      <div style="font-size:34px;font-weight:200;letter-spacing:-.02em;line-height:1.1;">Recibido, ${esc(p.nombreCliente)}.</div>
      <p style="margin:14px 0 0;font-size:18px;font-weight:300;line-height:1.5;opacity:.7;">Te escribimos hoy mismo con el documento para firmar y la fecha de arranque.</p>
    </div>
    <div style="font-size:14px;font-weight:300;line-height:1.6;opacity:.5;"><a href="mailto:contacto@formaprima.es" style="color:inherit;text-decoration:none;">contacto@formaprima.es</a> · Príncipe de Vergara 56, Madrid</div>
  </div>
  <div style="background:#141414;padding:96px 104px 96px 88px;display:flex;flex-direction:column;justify-content:space-between;gap:40px;min-width:0;">
    <div style="display:flex;justify-content:space-between;align-items:center;">
      <span style="font-size:11px;font-weight:600;letter-spacing:.22em;text-transform:uppercase;color:${SAGE};">Mientras tanto, conoce el estudio</span>
      <img src="assets/logo-h-white.png" alt="Forma Prima" style="height:20px;width:auto;display:block;opacity:.7;">
    </div>
    <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:28px;">${tarjetas}</div>
    <a href="https://formaprima.es" target="_blank" rel="noopener" data-fp-web="" style="display:flex;justify-content:space-between;align-items:baseline;color:${PAPER};text-decoration:none;border-top:1px solid ${LINE};padding-top:22px;">
      <span style="font-size:30px;font-weight:200;letter-spacing:-.025em;">Visitar formaprima.es</span><span data-fp-flecha="" style="font-size:30px;font-weight:200;color:${SAGE};transition:transform .3s cubic-bezier(.16,1,.3,1);">→</span>
    </a>
  </div>
  <style>
    [data-fp-final] [data-fp-accion="confirmar"]:hover, [data-fp-final] [data-fp-accion="aceptar"]:hover { background: transparent !important; color: ${PAPER} !important; }
    [data-fp-final] a[href^="mailto"][style*="uppercase"]:hover, [data-fp-final] [data-fp-accion="volver"]:hover { border-color: ${PAPER} !important; }
    [data-fp-final] [data-fp-web]:hover [data-fp-flecha] { transform: translateX(8px); }
    [data-fp-final] [data-fp-obra] img { transition: transform 1.2s cubic-bezier(.16,1,.3,1), filter .6s; }
    [data-fp-final] [data-fp-obra]:hover img { transform: scale(1.04); filter: saturate(1) !important; }
  </style>
</section>`
}

// Puente con la página que contiene el iframe (mismo origen).
const PUENTE = `<script>
(function () {
  var P = window.parent !== window ? window.parent : null;
  function send(m) { try { if (P) { m.fp = 1; P.postMessage(m, location.origin); } } catch (e) {} }
  // Imágenes bajo demanda (ver scripts/propuestas/arreglos-dc.mjs): la diapositiva
  // actual y sus vecinas, cargadas; de tres en adelante, descargadas.
  var VACIA = 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==';
  function cargar(i) {
    var ss = document.querySelectorAll('deck-stage > section');
    for (var j = 0; j < ss.length; j++) {
      var d = Math.abs(j - i), ims = ss[j].querySelectorAll('img[data-fp-src]');
      for (var k = 0; k < ims.length; k++) {
        var im = ims[k], real = im.getAttribute('data-fp-src');
        if (d <= 1) { if (im.getAttribute('src') !== real) im.setAttribute('src', real); }
        else if (d >= 3 && im.getAttribute('src') === real) im.setAttribute('src', VACIA);
      }
      // Vídeos de fondo que el dossier asigna por código: se precargan al
      // acercarse (la actual y la siguiente), no todos al abrir.
      if (j === i || j === i + 1) {
        var vv = ss[j].querySelectorAll('video[preload="metadata"]');
        for (var q = 0; q < vv.length; q++) vv[q].setAttribute('preload', 'auto');
      }
    }
  }
  function activa() {
    var ss = document.querySelectorAll('deck-stage > section');
    for (var j = 0; j < ss.length; j++) if (ss[j].hasAttribute('data-deck-active')) return j;
    return 0;
  }
  document.addEventListener('slidechange', function (e) {
    var d = e.detail || {};
    cargar(d.index || 0);
    actual = d.index || 0; total = d.total || 0; etiqueta = d.slide ? d.slide.getAttribute('data-label') || '' : '';
    if (d.slide) document.documentElement.setAttribute('data-fp-slide', etiqueta);
    clearTimeout(tPista); clearTimeout(tFuera); if (pista) pista.classList.remove('on');
    tPista = setTimeout(mostrarPista, 5000);
    send({ t: 'slide', i: d.index, n: d.total, l: etiqueta, lang: document.documentElement.lang || 'es' });
  }, true);
  // Vídeos: sus fuentes llegan inertes (data-fp-src) para que la plantilla
  // estática no las descargue; se activan solo en la versión interactiva.
  // (Ojo: nada en este script puede contener la etiqueta del runtime escrita
  // literalmente: el runtime busca su primera aparición en el documento.)
  function activarVideos() {
    var vs = document.querySelectorAll('#dc-root video');
    for (var i = 0; i < vs.length; i++) {
      var v = vs[i], ss = v.querySelectorAll('source[data-fp-src]'), cambio = false;
      for (var j = 0; j < ss.length; j++) {
        var r = ss[j].getAttribute('data-fp-src');
        if (ss[j].getAttribute('src') !== r) { ss[j].setAttribute('src', r); cambio = true; }
      }
      if (cambio) { try { v.load(); } catch (e) {} }
    }
  }
  var pendiente = 0;
  new MutationObserver(function () {
    if (pendiente) return;
    pendiente = requestAnimationFrame(function () { pendiente = 0; activarVideos(); });
  }).observe(document.documentElement, { childList: true, subtree: true });

  // Sin zoom con los dedos (iOS ignora user-scalable=no): el zoom de una página
  // así dispara la memoria del iPhone y Safari la recargaba.
  document.addEventListener('gesturestart', function (e) { e.preventDefault(); }, { passive: false });
  document.addEventListener('touchmove', function (e) { if (e.touches && e.touches.length > 1) e.preventDefault(); }, { passive: false });
  var ultimoToque = 0;
  document.addEventListener('touchend', function (e) {
    var t = Date.now(); if (t - ultimoToque < 320 && !(e.target.closest && e.target.closest('button,a,input,select,textarea'))) e.preventDefault(); ultimoToque = t;
  }, { passive: false });

  // "Desliza para continuar": tras 5 s en una diapositiva (y 2,5 s sin tocar),
  // aparece abajo una vez y se va sola. No en el vídeo, ni en la última, ni con
  // un detalle abierto.
  var pista = null, tPista = 0, tFuera = 0, tocado = 0, actual = 0, total = 0, etiqueta = '';
  ['touchstart', 'pointerdown', 'wheel', 'keydown'].forEach(function (ev) { window.addEventListener(ev, function () { tocado = Date.now(); if (pista) pista.classList.remove('on'); }, { passive: true }); });
  function textoPista() {
    var en = (document.documentElement.lang || 'es') === 'en';
    var tactil = matchMedia('(pointer: coarse)').matches;
    return tactil ? (en ? 'Swipe to continue' : 'Desliza para continuar') : (en ? 'Scroll or use the arrow keys to continue' : 'Usa la rueda o las flechas para continuar');
  }
  function mostrarPista() {
    if (etiqueta === 'Vídeo' || actual >= total - 1 || document.querySelector('[data-plan-detail][data-open]')) return;
    if (Date.now() - tocado < 2500) { tPista = setTimeout(mostrarPista, 2500 - (Date.now() - tocado)); return; }
    if (!pista) {
      pista = document.createElement('div'); pista.setAttribute('data-fp-pista', ''); pista.setAttribute('aria-hidden', 'true');
      pista.innerHTML = '<span class="fp-flecha"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 15l6-6 6 6"/></svg></span><span class="fp-texto"></span>';
      document.body.appendChild(pista);
    }
    pista.querySelector('.fp-texto').textContent = textoPista();
    pista.classList.add('on');
    clearTimeout(tFuera); tFuera = setTimeout(function () { if (pista) pista.classList.remove('on'); }, 3400);
  }

  // Medición (Salas): señales de vida para que la página solo cuente el tiempo
  // real, y las interacciones con nombre. Un vídeo en silencio de fondo no es
  // "vida"; uno con sonido, o que se arranca tras un toque, sí.
  var vidaT = 0, d3 = -1;
  function vida() { var t = Date.now(); if (t - vidaT > 10000) { vidaT = t; send({ t: 'act' }); } }
  ['touchstart', 'pointerdown', 'wheel', 'keydown'].forEach(function (ev) { window.addEventListener(ev, vida, { passive: true, capture: true }); });
  document.addEventListener('play', function (e) {
    if (e.target && e.target.tagName === 'VIDEO' && (Date.now() - tocado < 3000 || !e.target.muted)) send({ t: 'ev', k: 'video', l: etiqueta });
  }, true);
  setInterval(function () {
    var vs = document.querySelectorAll('video');
    for (var i = 0; i < vs.length; i++) if (!vs[i].paused && !vs[i].ended && !vs[i].muted) { send({ t: 'act' }); return; }
  }, 10000);
  window.addEventListener('pointerdown', function (e) {
    if (e.target && e.target.closest && e.target.closest('canvas') && d3 !== actual) { d3 = actual; send({ t: 'ev', k: '3d', l: etiqueta }); }
  }, { passive: true, capture: true });

  var intentos = 0, arranque = setInterval(function () {
    if (document.querySelector('deck-stage > section') || ++intentos > 100) { clearInterval(arranque); cargar(activa()); }
  }, 100);
  // Aceptar la propuesta (cliente): inicio → confirmar → (la página tramita) → hecho.
  function paso(nombre) {
    document.querySelectorAll('[data-fp-paso]').forEach(function (n) { n.style.display = n.getAttribute('data-fp-paso') === nombre ? 'flex' : 'none'; });
  }
  document.addEventListener('click', function (e) {
    var b = e.target && e.target.closest && e.target.closest('[data-fp-accion]');
    if (!b) return;
    e.preventDefault(); e.stopPropagation();
    var a = b.getAttribute('data-fp-accion'), err = document.querySelector('[data-fp-error]');
    if (err) err.style.display = 'none';
    if (a === 'confirmar') { paso('confirmar'); var ta = document.querySelector('[data-fp-comentario]'); if (ta && !matchMedia('(pointer: coarse)').matches) ta.focus(); }
    else if (a === 'volver') paso('inicio');
    else if (a === 'aceptar') {
      if (b.disabled) return;
      b.disabled = true; b.style.opacity = '.6'; b.textContent = 'Enviando…';
      var c = document.querySelector('[data-fp-comentario]');
      send({ t: 'aceptar', comentario: c ? c.value : '' });
    }
  }, true);
  document.addEventListener('click', function (e) {
    var b = e.target && e.target.closest && e.target.closest('[data-fp-interes]');
    if (!b) return;
    e.preventDefault(); e.stopPropagation();
    send({ t: 'interes', lang: document.documentElement.lang || 'es' });
  }, true);
  window.addEventListener('message', function (e) {
    if (e.origin !== location.origin || !e.data || !e.data.fp) return;
    if (e.data.t === 'aceptada') paso('hecho');
    if (e.data.t === 'error') {
      var b = document.querySelector('[data-fp-accion="aceptar"]'), err = document.querySelector('[data-fp-error]');
      if (b) { b.disabled = false; b.style.opacity = ''; b.textContent = 'Confirmar aceptación'; }
      if (err) { err.textContent = e.data.msg || 'No se ha podido enviar. Inténtalo de nuevo.'; err.style.display = ''; }
    }
    if (e.data.t === 'hecho') {
      document.querySelectorAll('[data-fp-cta]').forEach(function (n) { n.style.display = 'none'; });
      document.querySelectorAll('[data-fp-hecho]').forEach(function (n) { n.style.display = ''; });
    }
  });
})();
</script>
<style>
  html, body { height: 100%; overflow: hidden; overscroll-behavior: none; }
  /* Controles (Índice · idioma): arriba, sin burbuja, con contraste automático. */
  [data-ctrl] { top: max(6px, env(safe-area-inset-top)) !important; bottom: auto !important; padding: 0 !important; gap: 0 !important;
    background: transparent !important; box-shadow: none !important; -webkit-backdrop-filter: none !important; backdrop-filter: none !important;
    mix-blend-mode: difference; align-items: center; }
  [data-ctrl] button { color: #fff !important; font-size: 10px !important; font-weight: 500 !important; letter-spacing: .26em !important;
    height: 30px !important; min-height: 30px !important; padding: 0 12px !important; }
  [data-ctrl] [data-index-btn]::after { content: ''; display: inline-block; width: 1px; height: 9px; background: currentColor; opacity: .55; margin-left: 20px; vertical-align: -1px; }
  html[data-fp-slide="Vídeo"] [data-ctrl] { display: none !important; }
  html, body { touch-action: pan-x pan-y; }
  [data-fp-pista] { position: fixed; left: 50%; bottom: calc(env(safe-area-inset-bottom) + 20px); z-index: 2147483001;
    display: flex; align-items: center; gap: 10px; padding: 11px 18px 11px 14px; border-radius: 999px; pointer-events: none;
    background: rgba(43,38,34,.74); -webkit-backdrop-filter: blur(10px); backdrop-filter: blur(10px); color: #f6f1ea;
    font: 500 11px/1 'Hanken Grotesk', sans-serif; letter-spacing: .22em; text-transform: uppercase; white-space: nowrap;
    box-shadow: 0 6px 24px rgba(43,38,34,.18);
    opacity: 0; transform: translate(-50%, 12px); transition: opacity .7s cubic-bezier(.4,0,.2,1), transform .9s cubic-bezier(.16,1,.3,1); }
  [data-fp-pista].on { opacity: 1; transform: translate(-50%, 0); }
  [data-fp-pista] .fp-flecha { display: flex; animation: fp-sube 1.6s ease-in-out infinite; }
  @keyframes fp-sube { 0%, 100% { transform: translateY(2px); opacity: .6; } 50% { transform: translateY(-3px); opacity: 1; } }
  @media (prefers-reduced-motion: reduce) { [data-fp-pista], [data-fp-pista] .fp-flecha { transition: opacity .3s; animation: none; } }
</style>`

export async function GET(req: Request, { params }: { params: { slug: string } }) {
  const p = getPropuestaWeb(params.slug)
  const ok = !!p && p.tipo === 'dc' && await accesoDossier(p, cookies())
  if (!p || !ok) return new Response('No disponible', { status: 404, headers: { 'Cache-Control': 'no-store' } })

  let html = await cargarDossier(p.slug)
  if (!html) return new Response('No disponible', { status: 404 })

  const obras = await obrasDestacadas().catch(() => [])

  if (p.formato === 'horizontal') {
    // Presentación 1920×1080: el lienzo no se estira (deck-stage la encaja con
    // bandas). Numeración: la siguiente a la de la última diapositiva ("05 Cierre"
    // → "06"); no la mayor, que dentro de un capítulo hay subnúmeros (01–10).
    const caps = Array.from(html.matchAll(/font-variant-numeric:tabular-nums;">(\d{2})<\/span><span style="font-family:'Newsreader'/g)).map((m) => parseInt(m[1], 10))
    const numero = String((caps[caps.length - 1] ?? 0) + 1).padStart(2, '0')
    html = html.replace('<!--FP:SIGUIENTE-->', slideSiguienteCliente(p, obras, numero))
  } else {
    const q = new URL(req.url).searchParams
    const pedido = parseInt(q.get('alto') || '', 10)
    // Escritorio: el mismo dossier en un lienzo apaisado de 2304 de ancho (en un
    // portátil de 1440 px, un 62,5 %: la letra del diseño móvil queda a tamaño de
    // lectura); el alto sigue a la pantalla (16:9 → 1296, 16:10 → 1440) y una capa
    // de estilos reordena cada diapositiva (lib/propuestas/escritorio/).
    const apaisado = q.get('escritorio') === '1' && !!escritorioDe(p.slug)
    const alto = apaisado
      ? (Number.isFinite(pedido) ? Math.max(1200, Math.min(1600, pedido)) : 1296)
      : (Number.isFinite(pedido) ? Math.max(1920, Math.min(2600, pedido)) : 1920)

    // Numeración: la siguiente al último capítulo romano del dossier (VI → VII).
    const ROMANOS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII']
    const usados = Array.from(html.matchAll(/font-size:32px;font-weight:500;opacity:\.8;">([IVX]+)</g)).map((m) => ROMANOS.indexOf(m[1]))
    const numero = ROMANOS[Math.max(-1, ...usados) + 1] ?? ''

    html = html
      .replace('<!--FP:SIGUIENTE-->', slideSiguiente(p, obras, numero))
      .replace(/(<x-import\b[^>]*\bheight=")1920(")/, `$1${alto}$2`)
    if (apaisado) html = escritorioDe(p.slug)!(html.replace(/(<x-import\b[^>]*\bwidth=")1080(")/, '$12304$2'))
  }
  html = html
    .replace(/<head>/i, `<head>\n<base href="/propuestas/${p.slug}/">\n<meta name="robots" content="noindex, nofollow">\n<title>${esc(p.proyecto)} — Forma Prima</title>\n${PUENTE}`)

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'private, no-store',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  })
}
