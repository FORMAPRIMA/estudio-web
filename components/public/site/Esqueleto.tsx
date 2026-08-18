'use client'

// Esqueletos de carga del sitio público.
//
// Antes había TRES cargas contadas de tres maneras: un spinner con borde de acento
// en la parrilla de maquetas, el texto «Cargando maqueta…» en la ficha de proyecto
// y un rectángulo plano y mudo detrás de cada foto. Tres respuestas a una sola
// pregunta.
//
// Un spinner dice «el sistema está ocupado». Un esqueleto dice «tu contenido está
// llegando y va a ocupar este sitio». Con GLB de varios megas la segunda frase es
// la verdadera, y además reserva el hueco: al resolverse no salta nada.
//
// Solo animan `opacity` y `background-position` — cero layout, todo en el
// compositor. Con `prefers-reduced-motion` el bloque se queda quieto.

/** Marca de agua del degradado, en tinta del sitio (#141414) a muy baja opacidad. */
export const ESQUELETO_CSS = `
.fp-skel {
  position: relative;
  overflow: hidden;
  background-color: rgba(20, 20, 20, 0.05);
  background-image: linear-gradient(
    100deg,
    rgba(20, 20, 20, 0)    30%,
    rgba(20, 20, 20, 0.05) 48%,
    rgba(20, 20, 20, 0)    66%
  );
  background-repeat: no-repeat;
  background-size: 260% 100%;
  animation: fp-skel-respira 2.9s cubic-bezier(.42,0,.35,1) infinite;
}

/* La barrida y la respiración van en el mismo ciclo: el brillo cruza mientras el
   bloque entero sube y baja de intensidad. Por separado se leían como dos cosas. */
@keyframes fp-skel-respira {
  0%   { background-position: 150% 0; opacity: 0.62; }
  45%  { opacity: 1; }
  100% { background-position: -50% 0; opacity: 0.62; }
}

/* Relleno: detrás de una foto que aún no ha pintado. Se retira al cargar. */
.fp-skel-fill {
  position: absolute;
  inset: 0;
  transition: opacity .45s cubic-bezier(.4,0,.2,1);
}
.fp-skel-off { opacity: 0 !important; animation: none; }

/* Plinto: bloque exento para los huecos donde va a aterrizar una maqueta 3D.
   Lleva su sombra de contacto —la misma que después tendrá el modelo— porque sin
   caja ni borde es la sombra la que dice «aquí se apoya algo». */
.fp-skel-plinto {
  position: relative;
  display: block;
  width: 132px;
  height: 106px;
}
.fp-skel-plinto::after {
  content: '';
  position: absolute;
  left: 50%;
  bottom: -13px;
  transform: translateX(-50%);
  width: 76%;
  height: 15px;
  border-radius: 50%;
  background: radial-gradient(50% 50% at 50% 50%, rgba(20, 20, 20, 0.13), rgba(20, 20, 20, 0) 72%);
  pointer-events: none;
}
.fp-skel-plinto > .fp-skel {
  width: 100%;
  height: 100%;
  border-radius: 9px;
}
@media (max-width: 760px) {
  .fp-skel-plinto { width: 108px; height: 88px; }
}

@media (prefers-reduced-motion: reduce) {
  .fp-skel { animation: none; opacity: 0.82; background-image: none; }
  .fp-skel-fill { transition: none; }
}
`

/** Se monta UNA vez, en el layout del sitio. */
export function EsqueletoCSS() {
  return <style dangerouslySetInnerHTML={{ __html: ESQUELETO_CSS }} />
}

/** Relleno para el hueco de una foto. `cargada` lo apaga con un fundido. */
export function EsqueletoFoto({ cargada }: { cargada: boolean }) {
  return <div className={`fp-skel fp-skel-fill${cargada ? ' fp-skel-off' : ''}`} aria-hidden="true" />
}

/** Bloque exento con sombra de contacto, para el hueco de una maqueta. */
export function EsqueletoPlinto({ style }: { style?: React.CSSProperties }) {
  return (
    <div className="fp-skel-plinto" style={style} aria-hidden="true">
      <div className="fp-skel" />
    </div>
  )
}
