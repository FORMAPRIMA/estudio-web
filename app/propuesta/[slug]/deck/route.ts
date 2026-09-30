import { cookies } from 'next/headers'
import { getPropuestaWeb, cargarDossier, type PropuestaWeb } from '@/lib/propuestas/registro'
import { propuestaCookieName, accesoConcedido } from '@/lib/propuestas/acceso'
import { obrasDestacadas } from '@/lib/propuestas/obras'
import type { ProyectoEnlace } from '@/components/propuesta/SlideSiguiente'

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
    send({ t: 'slide', i: d.index, n: d.total, lang: document.documentElement.lang || 'es' });
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
    return tactil ? (en ? 'Swipe to continue' : 'Desliza para continuar') : (en ? 'Scroll or press ↓ to continue' : 'Usa la rueda o ↓ para continuar');
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

  var intentos = 0, arranque = setInterval(function () {
    if (document.querySelector('deck-stage > section') || ++intentos > 100) { clearInterval(arranque); cargar(activa()); }
  }, 100);
  document.addEventListener('click', function (e) {
    var b = e.target && e.target.closest && e.target.closest('[data-fp-interes]');
    if (!b) return;
    e.preventDefault(); e.stopPropagation();
    send({ t: 'interes', lang: document.documentElement.lang || 'es' });
  }, true);
  window.addEventListener('message', function (e) {
    if (e.origin !== location.origin || !e.data || !e.data.fp) return;
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
  const ok = !!p && p.tipo === 'dc' && accesoConcedido(p, cookies().get(propuestaCookieName(p.slug))?.value)
  if (!p || !ok) return new Response('No disponible', { status: 404, headers: { 'Cache-Control': 'no-store' } })

  let html = await cargarDossier(p.slug)
  if (!html) return new Response('No disponible', { status: 404 })

  const pedido = parseInt(new URL(req.url).searchParams.get('alto') || '', 10)
  const alto = Number.isFinite(pedido) ? Math.max(1920, Math.min(2600, pedido)) : 1920

  // Numeración: la siguiente al último capítulo romano del dossier (VI → VII).
  const ROMANOS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII']
  const usados = Array.from(html.matchAll(/font-size:32px;font-weight:500;opacity:\.8;">([IVX]+)</g)).map((m) => ROMANOS.indexOf(m[1]))
  const numero = ROMANOS[Math.max(-1, ...usados) + 1] ?? ''

  const obras = await obrasDestacadas().catch(() => [])
  html = html
    .replace('<!--FP:SIGUIENTE-->', slideSiguiente(p, obras, numero))
    .replace(/(<x-import\b[^>]*\bheight=")1920(")/, `$1${alto}$2`)
    .replace(/<head>/i, `<head>\n<base href="/propuestas/${p.slug}/">\n<meta name="robots" content="noindex, nofollow">\n<title>${esc(p.proyecto)} — Forma Prima</title>\n${PUENTE}`)

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'private, no-store',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  })
}
