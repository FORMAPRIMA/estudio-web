// Caché de lectura de la web pública.
//
// Todas las páginas del sitio son dinámicas —el layout lee la sesión para el Modo
// Diseño, y leer cookies obliga a Next a renderizar en cada petición— así que no
// se puede cachear la página entera. Lo que sí se puede, y es donde está el
// problema, son las CONSULTAS: hoy cada visita a cada página interroga a Supabase
// varias veces, y una de ellas se trae una tabla completa.
//
// El día que PostgREST se encalló (21 sep 2026), formaprima.es desapareció entera
// durante una hora. No dio una versión antigua: no dio nada. Con esto, la mayoría
// de las peticiones ni llegan a Supabase, así que un corte suyo deja de ser un
// corte nuestro.

/** Etiquetas de invalidación. Cada mutación del CMS revalida la suya. */
export const TAG = {
  contenido:   'web:contenido',
  assets:      'web:assets',
  proyectos:   'web:proyectos',
  mapa:        'web:mapa',
  equipo:      'web:equipo',
  propiedades: 'web:propiedades',
  fpTools:     'web:fp-tools',
} as const

/**
 * Cuánto vive una entrada antes de refrescarse sola.
 *
 * No es el mecanismo principal para que los cambios se vean: de eso se encargan
 * las etiquetas, que el CMS invalida al guardar, así que una edición sigue
 * apareciendo al instante. Esto es la red por debajo, para que nada se quede
 * atascado si alguna vez falta un `revalidateTag`.
 */
export const VIDA = {
  /** Contenido y fichas: se editan a mano, unas pocas veces al día como mucho. */
  normal: 300,
  /** El manifiesto de variantes solo cambia cuando alguien SUBE un archivo. */
  largo: 3600,
} as const

/** Lo que se espera a Supabase antes de darlo por perdido. */
export const ESPERA_MS = 2500

/**
 * Corta la espera y LANZA. Lo de lanzar no es un descuido, es el punto entero:
 *
 * Esta función se usa DENTRO de `unstable_cache`. Si al expirar el tiempo
 * devolviera una lista vacía, esa lista vacía se guardaría en la caché como si
 * fuera la respuesta buena, y tendríamos la web vacía durante los siguientes
 * cinco minutos — exactamente el fallo que esto viene a evitar. Lanzando, no se
 * guarda nada: Next conserva el valor anterior y lo sigue sirviendo.
 *
 * Quien llama envuelve en try/catch y decide el respaldo para la primera vez, que
 * es el único caso en el que no hay nada anterior que servir.
 */
export function conEspera<T>(p: PromiseLike<T>, quien: string, ms: number = ESPERA_MS): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const reloj = setTimeout(
      () => reject(new Error(`[cache] ${quien}: Supabase no contestó en ${ms} ms`)),
      ms,
    )
    Promise.resolve(p).then(
      (v) => { clearTimeout(reloj); resolve(v) },
      (e) => { clearTimeout(reloj); reject(e) },
    )
  })
}
