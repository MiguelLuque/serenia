import { Instrument_Serif } from 'next/font/google'

/** Serif de titulares: landing, acceso y el título de cada página de la app. */
export const brandSerif = Instrument_Serif({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-landing-serif',
  display: 'swap',
})
