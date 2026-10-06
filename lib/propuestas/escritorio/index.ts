// Versión de escritorio de un dossier vertical ('dc'): lo que hay que hacerle al
// documento para pintarlo en un lienzo apaisado. Uno por dossier, porque cada
// diseño se reordena a su manera; el que no tenga, sigue viéndose como historia
// vertical centrada (PropuestaDossier).

import { casaZurbano } from './casa-zurbano'

const ESCRITORIO: Record<string, (html: string) => string> = {
  'casa-zurbano-xzw9e': casaZurbano,
}

export function escritorioDe(slug: string): ((html: string) => string) | null {
  return ESCRITORIO[slug] ?? null
}
