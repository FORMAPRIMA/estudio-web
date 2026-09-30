import { cookies } from 'next/headers'
import { getPropuestaWeb, cargarDossier, type PropuestaWeb } from '@/lib/propuestas/registro'
import { propuestaCookieName, propuestaCookieValue } from '@/lib/propuestas/acceso'
import { obrasDestacadas } from '@/lib/propuestas/obras'
import type { ProyectoEnlace } from '@/components/propuesta/SlideSiguiente'

// El documento de un dossier interactivo ('dc'), tal como salió de Claude Design,
// con su propio runtime. Lo pinta un iframe de /propuesta/<slug> y solo se sirve
// con la cookie del PIN: aquí van las cifras.
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
        <div style="position:relative;overflow:hidden;aspect-ratio:16/11;background:#e6ddd0;"><img src="${esc(o.imagen)}" alt="${esc(o.nombre)}" loading="lazy" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block;"></div>
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
  document.addEventListener('slidechange', function (e) {
    var d = e.detail || {}; send({ t: 'slide', i: d.index, n: d.total, lang: document.documentElement.lang || 'es' });
  }, true);
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
</script>`

export async function GET(req: Request, { params }: { params: { slug: string } }) {
  const p = getPropuestaWeb(params.slug)
  const ok = !!p && p.tipo === 'dc' && cookies().get(propuestaCookieName(p.slug))?.value === propuestaCookieValue(p.slug)
  if (!p || !ok) return new Response('No disponible', { status: 404, headers: { 'Cache-Control': 'no-store' } })

  let html = await cargarDossier(p.slug)
  if (!html) return new Response('No disponible', { status: 404 })

  const pedido = parseInt(new URL(req.url).searchParams.get('alto') || '', 10)
  const alto = Number.isFinite(pedido) ? Math.max(1920, Math.min(2600, pedido)) : 1920

  // Numeración: la siguiente al último capítulo romano del dossier (VI → VII).
  const ROMANOS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII']
  const usados = Array.from(html.matchAll(/serif;font-size:32px;font-weight:500;opacity:\.8;">([IVX]+)</g)).map((m) => ROMANOS.indexOf(m[1]))
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
