import { createAdminClient } from '@/lib/supabase/admin'

// Contenido del estudio para la etapa Bienvenida (mismo que la landing actual).
export const HERO_IMAGE =
  'https://xzzxxpwshgnqpnpahgoh.supabase.co/storage/v1/object/public/proyecto-imagenes/bf625278-6d96-4f81-b543-d3556ff65f3f/1775244561811.png'

export interface StudioContent {
  tagline: string
  descripcion: string
  proyectos: string
  paises: string
  fundacion: string
  socios: { nombre: string; titulo: string; bio: string }[]
}

const STUDIO_ES: StudioContent = {
  tagline: 'Estudio de arquitectura e interiorismo',
  descripcion: `En un mundo donde prevalece la uniformidad arquitectónica, donde la conexión con el entorno construido se desvanece, surge una nueva propuesta. Forma Prima abraza la diversidad como fuente de fortaleza. Creemos que la verdadera armonía no se encuentra en la uniformidad, sino en la amalgama estratégica de contrastes que invitan a la exploración.

Espacios donde la luz y la sombra mantienen una conversación perfectamente sincronizada, donde la suavidad de las curvas se encuentra con la rigidez de las líneas ortogonales, y donde la rusticidad de los materiales dialoga con la pulcritud de las superficies. Nuestra misión es transformar la tensión entre estos opuestos en una experiencia arquitectónica enriquecedora y memorable.

Forma Prima representa el encuentro entre la diversidad y la cohesión, donde los extremos convergen para estimular los sentidos y nutrir experiencias.`,
  proyectos: '+60',
  paises: 'España · México · Ecuador',
  fundacion: '2023',
  socios: [
    {
      nombre: 'Gabriela Hidalgo',
      titulo: 'Arquitecta · Cofundadora',
      bio: `Gabriela es arquitecta por la Universidad de Navarra en Pamplona (2020) y continuó su formación con un máster habilitante en arquitectura en Madrid, complementado con formación empresarial en IESE Business School (2021).

Su dedicación la llevó a París, donde profundizó su especialización en interiorismo. De vuelta en Madrid, cofundó Forma Prima junto a José Lora en 2023. Hoy, su equipo aporta una valiosa experiencia internacional en proyectos desarrollados en España y México.`,
    },
    {
      nombre: 'José Lora',
      titulo: 'Arquitecto · Socio',
      bio: `José es arquitecto por la Universidad de Navarra en Pamplona, donde simultáneamente colaboró en proyectos en México con arquitectos locales. Posteriormente se trasladó a Madrid para cursar un doble máster en Arquitectura y Dirección de Empresas en IESE Business School, junto con un Máster en Diseño Ambiental y Gestión de la Edificación (UNAV 2021).

Tras finalizar sus estudios, se incorporó al estudio de Juan Herreros & Jens Richter, contribuyendo a proyectos y concursos internacionales en Noruega, Alemania, Argentina y Arabia Saudí. En 2023 cofundó Forma Prima con Gabriela Hidalgo.`,
    },
  ],
}

const STUDIO_EN: StudioContent = {
  tagline: 'Architecture and interior design studio',
  descripcion: `In a world where architectural uniformity prevails, where the connection with the built environment fades away, a new proposal emerges. Forma Prima embraces diversity as a source of strength. We believe that true harmony is not found in uniformity, but in the strategic amalgamation of contrasts that invite exploration.

Spaces where light and shadow engage in a perfectly synchronized discussion, where the softness of curves meets the rigidity of orthogonal lines, and where the rusticity of materials converses with the neatness of surfaces. Our mission is to transform the tension between these opposites into an enriching and memorable architectural experience.

Forma Prima represents the encounter between diversity and cohesion, where extremes converge to stimulate the senses and nurture experiences.`,
  proyectos: '+60',
  paises: 'Spain · Mexico · Ecuador',
  fundacion: '2023',
  socios: [
    {
      nombre: 'Gabriela Hidalgo',
      titulo: 'Architect · Co-founder',
      bio: `Gabriela graduated in architecture from the University of Navarra in Pamplona (2020) and continued her education with a qualifying master's degree in architecture in Madrid, complemented by business training at IESE Business School (2021).

Her dedication took her to Paris, where she deepened her specialisation in interior design. Back in Madrid, she co-founded Forma Prima together with José Lora in 2023. Today, their team brings valuable international experience from projects developed across Spain and Mexico.`,
    },
    {
      nombre: 'José Lora',
      titulo: 'Architect · Partner',
      bio: `José graduated in architecture from the University of Navarra in Pamplona, where he simultaneously worked on projects in Mexico with local architects. He later moved to Madrid to complete a double master's degree in Architecture and Business Management at IESE Business School, along with a Master's in Environmental Design and Building Management (UNAV 2021).

After completing his studies, he joined the firm of Juan Herreros & Jens Richter, contributing to international projects and competitions in Norway, Germany, Argentina and Saudi Arabia. In 2023, he co-founded Forma Prima with Gabriela Hidalgo.`,
    },
  ],
}

export function getStudio(lang: 'es' | 'en'): StudioContent {
  return lang === 'en' ? STUDIO_EN : STUDIO_ES
}

export interface ProyectoImage { nombre: string; url: string; tipologia: string | null }

// Imágenes para el carrusel del hero, con Castelló 42 siempre primero.
export async function getOrderedProyectoImages(): Promise<ProyectoImage[]> {
  const admin = createAdminClient()
  const { data: proyectos } = await admin
    .from('proyectos')
    .select('id, nombre, imagen_url, tipologia')
    .not('imagen_url', 'is', null)
    .eq('estado', 'activo')
    .order('created_at', { ascending: false })
    .limit(10)

  const images: ProyectoImage[] = (proyectos ?? [])
    .filter((p) => !!p.imagen_url)
    .map((p) => ({ nombre: p.nombre as string, url: p.imagen_url as string, tipologia: p.tipologia as string | null }))

  const castello = images.find(p => p.url === HERO_IMAGE)
    ?? { nombre: 'Castelló 42', url: HERO_IMAGE, tipologia: 'Interiorismo' }
  return [castello, ...images.filter(p => p.url !== HERO_IMAGE)]
}
