// Rúbrica de niveles de calidad para reformas, adaptada de «Qué hay detrás de cada
// nivel» (propuesta de Arturo Soria, oct 2026). La usa la IA para proponer el nivel
// de cada capítulo de un presupuesto real; la decisión final es de una persona.

export const RUBRICA_NIVELES: { tema: string; functional: string; select: string; masterpiece: string }[] = [
  { tema: 'Carpintería exterior', functional: 'Aluminio con rotura de puente térmico o PVC de serie', select: 'Aluminio de perfil mínimo, correderas elevables', masterpiece: 'Sin marco visto, paños de suelo a techo a medida, madera de alta gama' },
  { tema: 'Vidrio y protección solar', functional: 'Doble bajo emisivo, persiana de lamas', select: 'Control solar y laminado, estores motorizados', masterpiece: 'Acústico y control solar en gran formato, lamas orientables' },
  { tema: 'Tabiquería', functional: 'Pladur simple con lana mineral', select: 'Pladur doble placa con aislamiento acústico', masterpiece: 'Doble placa acústica y bandas elásticas' },
  { tema: 'Pavimentos', functional: 'Porcelánico 60×60 y tarima laminada', select: 'Tarima multicapa de roble y porcelánico de gran formato', masterpiece: 'Roble macizo en espiga, piedra natural, microcemento continuo' },
  { tema: 'Puertas y armarios', functional: 'Lacadas de serie, 2,10 m; armarios modulares', select: 'Macizas lacadas a medida, 2,40 m; armarios equipados', masterpiece: 'Suelo a techo con herrajes ocultos; armarios de roble con LED' },
  { tema: 'Cocina', functional: 'Muebles de serie, encimera compacta o laminada', select: 'Muebles a medida, encimera Silestone o Dekton', masterpiece: 'Diseño a medida en madera y piedra natural' },
  { tema: 'Electrodomésticos', functional: 'Gama nacional (Balay, Teka)', select: 'Gama media-alta (Siemens, Bosch) integrados', masterpiece: 'Gama alta (Miele, Gaggenau) integrados' },
  { tema: 'Baños', functional: 'Gama nacional (Roca), grifería vista', select: 'Duravit, Hansgrohe, grifería empotrada', masterpiece: 'Villeroy & Boch, Dornbracht, sanitarios suspendidos' },
  { tema: 'Climatización y ACS', functional: 'Splits o caldera, radiadores de serie', select: 'Aerotermia, conductos por zonas, radiadores de diseño', masterpiece: 'Suelo radiante-refrescante, recuperador de calor, control de humedad' },
  { tema: 'Electricidad e iluminación', functional: 'Mecanismos estándar y downlights LED', select: 'Mecanismos de diseño, LED regulable, foseados, domótica básica', masterpiece: 'Domótica KNX completa y proyecto lumínico con escenas' },
]

export function rubricaTexto(): string {
  return RUBRICA_NIVELES.map(r => `- ${r.tema}: Functional = ${r.functional} · Select = ${r.select} · Masterpiece = ${r.masterpiece}`).join('\n')
}
