import { Instrument_Serif } from 'next/font/google'

/** Serif de titulares de las páginas públicas (landing y acceso). */
export const brandSerif = Instrument_Serif({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-landing-serif',
  display: 'swap',
})
