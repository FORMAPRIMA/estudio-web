// Casa Zurbano en escritorio: el dossier vertical (1080 × 1920) pintado en un
// lienzo apaisado de 2304 × 1200–1600 (deck/route.ts, ?escritorio=1).
//
// No se duplica el diseño: se sirve el mismo documento con una capa de estilos
// que reordena cada diapositiva en horizontal —casi siempre título y texto a la
// izquierda, el contenido a la derecha— y tres retoques de su código:
//   · el vídeo de inicio pasa a la versión horizontal (zurbano6-video-h.*);
//   · el carrusel del Portafolio corre de lado en vez de hacia arriba;
//   · la maqueta del detalle de cada distribución no va girada;
//   · los textos de "Desliza" dicen cómo se avanza con ratón o teclado.
//
// Los estilos del diseño van en línea (style="…"), por eso aquí todo lleva
// !important; y van por la posición de cada bloque dentro de su diapositiva:
// si el diseño cambia en Claude Design, hay que revisar esta capa.

const S = (label: string) => `[data-fp-escritorio] section[data-label="${label}"]`
const TODAS = ['Índice', 'Recorrido', 'Distribuciones', 'Presupuesto', 'Capítulos', 'Calidades', 'Cronograma', 'Equipo · perfiles', 'Portafolio', 'Siguiente paso']
const todas = (sufijo = '') => TODAS.map((l) => S(l) + sufijo).join(',\n')

// Retícula (px del lienzo de 2304; en un portátil de 1440, × 0,625):
//   márgenes 144 a los lados y 112 arriba y abajo; 12 columnas de 124 con
//   calles de 48. Texto en las columnas 1–4 (640); la columna 5 queda vacía;
//   contenido en las 6–12 (1156, desde x = 1004).
//   Filas: cabecera (48) · aire (96) · título · controles · extra · resto · pie.
//   Así el título de todas las diapositivas cae en la misma línea (y = 256), el
//   contenido de la derecha arranca a esa misma altura y las notas al pie
//   apoyan todas en el margen inferior.
// Escala tipográfica: títulos 84 · entradilla 26/1,55 · notas 19/1,5.
const CSS = `
${todas()} {
  display: grid !important; padding: 112px 144px 112px !important; gap: 0 48px !important;
  grid-template-columns: repeat(12, minmax(0, 1fr)) !important;
  grid-template-rows: 48px 96px auto auto auto minmax(0, 1fr) auto !important;
  justify-content: stretch !important; align-content: stretch !important;
}
/* Cabecera (capítulo a la izquierda, logos a la derecha) */
${todas(' > :nth-child(1)')}, ${S('Índice')} > :nth-child(4) {
  grid-column: 1 / -1 !important; grid-row: 1 !important; align-self: center !important; margin: 0 !important; }
${S('Índice')} > :nth-child(1) { grid-area: auto !important; }
${S('Índice')} > :nth-child(4) { flex-direction: row-reverse !important; }
[data-fp-escritorio] section img[src$="logo-h-black.png"]:not([style*="height:28px"]) { height: 20px !important; }
[data-fp-escritorio] section img[src$="sophiq-black.png"]:not([style*="height:44px"]) { height: 35px !important; }
[data-fp-escritorio] section > :nth-child(1) > span > span[style*="height: 26px"],
[data-fp-escritorio] section > :nth-child(1) > span > span[style*="height:26px"] { height: 32px !important; }

/* Tipografía común */
${todas(' h2')}, ${S('El estudio')} h2 {
  font-size: 84px !important; line-height: 1.04 !important; letter-spacing: -.01em !important; margin: -17px 0 0 !important; text-wrap: balance !important; }
/* (−17 px: la altura de las mayúsculas del título queda en la línea y = 256, la
   misma en la que arrancan las imágenes y tablas de la derecha.) */
${todas(' h2 + p')}, ${S('El estudio')} h2 + p {
  font-size: 26px !important; line-height: 1.55 !important; font-weight: 300 !important; opacity: .75 !important; margin: 32px 0 0 !important; text-wrap: pretty !important; }

/* Piezas de la columna izquierda: título, controles, extra y nota */
.fp-izq-titulo { grid-column: 1 / 5 !important; grid-row: 3 !important; align-self: start !important; margin: 0 !important; }
.fp-izq-control { grid-column: 1 / 5 !important; grid-row: 4 !important; align-self: start !important; margin: 64px 0 0 !important; }
.fp-izq-extra { grid-column: 1 / 5 !important; grid-row: 5 !important; align-self: start !important; margin: 40px 0 0 !important; }
.fp-izq-pie { grid-column: 1 / 5 !important; grid-row: 7 !important; align-self: end !important; margin: 48px 0 0 !important; }
.fp-nota { font-size: 19px !important; line-height: 1.5 !important; font-weight: 300 !important; opacity: .55 !important; }
.fp-der { grid-column: 6 / 13 !important; grid-row: 3 / 8 !important; min-height: 0 !important; margin: 0 !important; }

/* ---------- Portada ---------- */
${S('Portada')} > :nth-child(4) { padding: 112px 144px !important; }
${S('Portada')} > :nth-child(2) { height: 640px !important; }

/* ---------- Índice ---------- */
${S('Índice')} > :nth-child(6) { align-self: start !important; }
${S('Índice')} > :nth-child(6) > button { padding: 28px 0 !important; }
${S('Índice')} > :nth-child(3) { background: radial-gradient(ellipse 75% 85% at 62% 55%, rgba(246,241,234,.72) 0%, rgba(246,241,234,.5) 70%, rgba(246,241,234,.3) 100%) !important; }

/* ---------- Recorrido: foto en las columnas 1–7; rótulo y maqueta en las 9–12 ---------- */
${S('Recorrido')} > :nth-child(2) { grid-column: 1 / 8 !important; grid-row: 3 / 8 !important; margin: 0 !important; display: flex !important; padding: 20px !important; }
${S('Recorrido')} > :nth-child(2) > :first-child { aspect-ratio: auto !important; height: 100% !important; width: 100% !important; }
${S('Recorrido')} > :nth-child(3) { grid-column: 9 / 13 !important; grid-row: 3 !important; margin: 0 !important; min-height: 0 !important; }
${S('Recorrido')} > :nth-child(4) { grid-column: 9 / 13 !important; grid-row: 6 / 8 !important; align-self: end !important; flex: none !important; }

/* ---------- Distribuciones: título y las tres en fila (4 columnas cada una) ---------- */
${S('Distribuciones')} > h2 { grid-column: 1 / -1 !important; grid-row: 3 !important; }
${S('Distribuciones')} > :nth-child(3) { grid-column: 1 / 5 !important; }
${S('Distribuciones')} > :nth-child(4) { grid-column: 5 / 9 !important; }
${S('Distribuciones')} > :nth-child(5) { grid-column: 9 / 13 !important; }
${S('Distribuciones')} > :nth-child(n+3):nth-child(-n+5) { grid-row: 4 / 8 !important; align-self: stretch !important; margin-top: 72px !important; padding-top: 24px !important; min-height: 0 !important; }
${S('Distribuciones')} > :nth-child(n+3):nth-child(-n+5) > div { padding-top: 20px !important; }
/* Detalle de una distribución: misma retícula; datos a la izquierda, maqueta a la derecha */
${S('Distribuciones')} [data-plan-detail]:not([style*="display: none"]) {
  display: grid !important; padding: 112px 144px 112px !important; gap: 0 48px !important;
  grid-template-columns: repeat(12, minmax(0, 1fr)) !important;
  grid-template-rows: 48px 96px auto auto auto minmax(0, 1fr) auto !important; align-content: stretch !important; }
${S('Distribuciones')} [data-plan-detail] > :nth-child(1) { grid-column: 1 / -1 !important; grid-row: 1 !important; align-self: center !important; }
${S('Distribuciones')} [data-plan-detail] > :nth-child(2) { grid-column: 1 / 6 !important; grid-row: 3 !important; }
${S('Distribuciones')} [data-plan-detail] > :nth-child(3) { grid-column: 1 / 5 !important; grid-row: 4 !important; margin-top: 56px !important; }
${S('Distribuciones')} [data-plan-detail] > :nth-child(4) { grid-column: 6 / 13 !important; grid-row: 3 / 8 !important; min-height: 0 !important; }
${S('Distribuciones')} [data-plan-detail] > :nth-child(5) { grid-column: 1 / 5 !important; grid-row: 5 !important; margin-top: 48px !important; }
${S('Distribuciones')} [data-plan-detail] > :nth-child(6) { grid-column: 1 / 5 !important; grid-row: 7 !important; align-self: end !important; flex-direction: column !important; gap: 10px !important; }

/* ---------- Presupuesto ---------- */
${S('Presupuesto')} > :nth-child(4) { display: none !important; } /* "toca un nivel o desliza el panel" */
${S('Presupuesto')} > :nth-child(5) { display: flex !important; flex-direction: column !important; justify-content: center !important; }
${S('Presupuesto')} > :nth-child(3) { margin-top: 48px !important; }
${S('Presupuesto')} > :nth-child(5) > :nth-child(3) { padding: 56px 64px !important; gap: 30px !important; }
${S('Presupuesto')} > :nth-child(6) > :nth-child(2) > div { padding-top: 12px !important; padding-bottom: 12px !important; }

/* ---------- Capítulos ---------- */
${S('Capítulos')} > :nth-child(3) { align-self: start !important; }
${S('Capítulos')} > :nth-child(3) > div { padding-top: 13px !important; padding-bottom: 13px !important; }

/* ---------- Calidades: lista en una columna, etiqueta en 2 columnas de la retícula ---------- */
${S('Calidades')} > :nth-child(4) { justify-content: flex-start !important; }
${S('Calidades')} > :nth-child(4) > div { grid-template-columns: 296px minmax(0, 1fr) !important; column-gap: 48px !important; padding: 15px 0 !important; }

/* ---------- Cronograma ---------- */
${S('Cronograma')} > :nth-child(4) { margin-top: 40px !important; }

/* ---------- El estudio: foto a sangre hasta la columna 6; texto en las 8–12 ---------- */
${S('El estudio')} { flex-direction: row !important; }
${S('El estudio')} > :nth-child(1) { flex: 0 0 1128px !important; }
${S('El estudio')} > :nth-child(1) img { height: 100% !important; aspect-ratio: auto !important; }
${S('El estudio')} > :nth-child(2) { padding: 112px 144px 112px 220px !important; display: grid !important;
  grid-template-rows: 48px 96px auto minmax(0, 1fr) auto !important; justify-content: stretch !important; }
${S('El estudio')} > :nth-child(2) > :nth-child(1) { grid-row: 1 !important; align-self: center !important; }
${S('El estudio')} > :nth-child(2) > :nth-child(2) { grid-row: 3 !important; }
${S('El estudio')} > :nth-child(2) > :nth-child(3) { grid-row: 5 !important; align-self: end !important; gap: 48px !important; }

/* ---------- Equipo: retratos en 4 columnas en el bloque derecho ---------- */
${S('Equipo · perfiles')} > :nth-child(3) { grid-template-columns: repeat(4, minmax(0, 1fr)) !important; grid-template-rows: repeat(2, minmax(0, 1fr)) !important; gap: 48px !important; }
${S('Equipo · perfiles')} > :nth-child(3) > div > div { height: 92px !important; margin-top: 16px !important; }

/* ---------- Portafolio: carrusel de lado, tarjetas de 4 columnas ---------- */
${S('Portafolio')} > :nth-child(2) { grid-column: 1 / -1 !important; grid-row: 3 / 8 !important; margin: 0 !important; }
${S('Portafolio')} [data-carousel] { flex-direction: row !important; column-gap: 48px !important; height: 100% !important; }
${S('Portafolio')} [data-carousel] > div { flex: 0 0 640px !important; }
${S('Portafolio')} [data-carousel] > div > img { height: auto !important; flex: 1 1 0 !important; min-height: 0 !important; }
${S('Portafolio')} > :nth-child(2) > :nth-child(2) { inset: 0 auto 0 0 !important; width: 48px !important; height: auto !important; background: linear-gradient(90deg, #f6f1ea, rgba(246,241,234,0)) !important; }
${S('Portafolio')} > :nth-child(2) > :nth-child(3) { inset: 0 0 0 auto !important; width: 48px !important; height: auto !important; background: linear-gradient(270deg, #f6f1ea, rgba(246,241,234,0)) !important; }

/* ---------- Siguiente paso ---------- */
${S('Siguiente paso')} > :nth-child(2) > div { margin: 40px 0 0 !important; }
${S('Siguiente paso')} > :nth-child(2) > p { font-size: 26px !important; line-height: 1.55 !important; margin: 32px 0 0 !important; opacity: .75 !important; }
${S('Siguiente paso')} > :nth-child(3) > * { padding-top: 30px !important; padding-bottom: 30px !important; font-size: 20px !important; }
${S('Siguiente paso')} > :nth-child(5) { grid-row: 3 / 6 !important; gap: 28px !important; }
${S('Siguiente paso')} > :nth-child(5) > span { font-size: 18px !important; }
${S('Siguiente paso')} > :nth-child(5) > div { grid-template-columns: repeat(4, minmax(0, 1fr)) !important; gap: 48px 24px !important; }
${S('Siguiente paso')} > :nth-child(5) > div > a > div:first-child { aspect-ratio: 4 / 5 !important; }
${S('Siguiente paso')} > :nth-child(5) > div > a > div:last-child > div:first-child { font-size: 22px !important; }
${S('Siguiente paso')} > :nth-child(5) > div > a > div:last-child > div:last-child { font-size: 18px !important; }
${S('Siguiente paso')} > :nth-child(6) { grid-column: 6 / 13 !important; grid-row: 7 !important; align-self: end !important; }
`

// Qué bloque va en cada sitio de la retícula, por diapositiva (posición del hijo
// dentro de la <section>). Se marcan con clases al pintar, porque el runtime de
// Claude Design monta el DOM en el navegador.
const PIEZAS: Record<string, Record<string, number[]>> = {
  'Índice': { 'fp-izq-titulo': [5], 'fp-der': [6] },
  'Presupuesto': { 'fp-izq-titulo': [2], 'fp-izq-control': [3], 'fp-izq-pie': [6], 'fp-der': [5] },
  'Capítulos': { 'fp-izq-titulo': [2], 'fp-izq-pie fp-nota': [4], 'fp-der': [3] },
  'Calidades': { 'fp-izq-titulo': [2], 'fp-izq-control': [3], 'fp-izq-pie fp-nota': [5], 'fp-der': [4] },
  'Cronograma': { 'fp-izq-titulo': [2], 'fp-izq-control': [3], 'fp-izq-extra': [4], 'fp-izq-pie': [6], 'fp-der': [5] },
  'Equipo · perfiles': { 'fp-izq-titulo': [2], 'fp-der': [3] },
  'Siguiente paso': { 'fp-izq-titulo': [2], 'fp-izq-pie': [3, 4], 'fp-der': [5] },
}
const MARCAR = `<script>
(function () {
  var P = ${JSON.stringify(PIEZAS)};
  function marcar() {
    for (var l in P) {
      var s = document.querySelector('deck-stage > section[data-label="' + l + '"]');
      if (!s) continue;
      for (var c in P[l]) P[l][c].forEach(function (n) {
        var el = s.children[n - 1];
        if (el) c.split(' ').forEach(function (k) { el.classList.add(k); });
      });
    }
  }
  var pendiente = 0;
  new MutationObserver(function () { if (!pendiente) pendiente = requestAnimationFrame(function () { pendiente = 0; marcar(); }); })
    .observe(document.documentElement, { childList: true, subtree: true });
})();
</script>`

function cambia(texto: string, buscar: string, poner: string): string {
  if (!texto.includes(buscar)) throw new Error(`Escritorio Casa Zurbano: no encuentro «${buscar.slice(0, 60)}»`)
  return texto.split(buscar).join(poner)
}

export function casaZurbano(html: string): string {
  // Vídeo de inicio: la versión horizontal.
  html = cambia(html, 'assets/zurbano6-video.av1.mp4?v=2', 'assets/zurbano6-video-h.av1.mp4?v=1')
  html = cambia(html, 'assets/zurbano6-video.hevc.mp4?v=2', 'assets/zurbano6-video-h.hevc.mp4?v=1')
  // Carrusel del Portafolio: de lado (mismo bucle, eje x).
  html = cambia(html, 'const gap = parseFloat(getComputedStyle(track).rowGap) || 0;', 'const gap = parseFloat(getComputedStyle(track).columnGap) || 0;')
  html = cambia(html, 'const pos = items.map((n) => n.offsetTop), alt = items.map((n) => n.offsetHeight);', 'const pos = items.map((n) => n.offsetLeft), alt = items.map((n) => n.offsetWidth);')
  html = cambia(html, 'vista = track.parentElement ? track.parentElement.clientHeight : H;', 'vista = track.parentElement ? track.parentElement.clientWidth : H;')
  html = cambia(html, "items[i].style.transform = 'translate3d(0,' + (y - pos[i]).toFixed(1) + 'px,0)';", "items[i].style.transform = 'translate3d(' + (y - pos[i]).toFixed(1) + 'px,0,0)';")
  // Maqueta del detalle de cada distribución: en un móvil va girada para llenar
  // la pantalla en vertical; aquí, tal cual, como las tres de la diapositiva.
  html = cambia(html, 'pins="" portrait=""', 'pins=""')
  // "Desliza": en escritorio se avanza con la rueda o las flechas.
  html = cambia(html, '<span data-es="">Desliza</span><span data-en="" style="display:none;">Swipe</span>', '<span data-es="">Rueda o flechas</span><span data-en="" style="display:none;">Scroll or arrow keys</span>')
  html = cambia(html, '<span data-es="">Desliza de nuevo para saltar</span><span data-en="" style="display:none;">Swipe again to skip</span>', '<span data-es="">Avanza de nuevo para saltar</span><span data-en="" style="display:none;">Advance again to skip</span>')

  return html
    .replace(/<html\b/i, '<html data-fp-escritorio=""')
    .replace('</head>', `<style>${CSS}</style>\n${MARCAR}\n</head>`)
}
