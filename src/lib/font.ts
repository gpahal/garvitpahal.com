import { Golos_Text, Source_Code_Pro } from 'next/font/google'

export const sansSerifFont = Golos_Text({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-sans-serif',
})

export const monoFont = Source_Code_Pro({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-mono',
})
