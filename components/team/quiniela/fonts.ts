// Fuentes del tema arcade de La Porra. Se cargan con next/font (buen rendimiento,
// sin layout shift) y se exponen como CSS variables para usarlas en estilos inline.
// Solo se importa desde los route files (server components).
import { Press_Start_2P, Silkscreen, Space_Grotesk } from 'next/font/google'

const pressStart = Press_Start_2P({ weight: '400', subsets: ['latin'], variable: '--q-pixel', display: 'swap' })
const silkscreen = Silkscreen({ weight: ['400', '700'], subsets: ['latin'], variable: '--q-label', display: 'swap' })
const spaceGrotesk = Space_Grotesk({ weight: ['400', '500', '600', '700'], subsets: ['latin'], variable: '--q-body', display: 'swap' })

/** className con las tres CSS variables; ponlo en el contenedor que envuelve la quiniela. */
export const quinielaFontVars = `${pressStart.variable} ${silkscreen.variable} ${spaceGrotesk.variable}`
