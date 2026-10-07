// Las dos familias de la invitación del Open House (Claude Design): Hanken
// Grotesk para el texto y Cormorant Garamond en cursiva para los titulares.
// Solo se importa desde los route files (server components).
import { Cormorant_Garamond, Hanken_Grotesk } from 'next/font/google'

const hanken = Hanken_Grotesk({ weight: ['300', '400', '500', '600'], subsets: ['latin'], variable: '--rc-sans', display: 'swap' })
const cormorant = Cormorant_Garamond({ weight: ['400', '500'], style: ['italic', 'normal'], subsets: ['latin'], variable: '--rc-serif', display: 'swap' })

export const rcFontVars = `${hanken.variable} ${cormorant.variable}`
