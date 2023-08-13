import { Poppins, Source_Code_Pro } from 'next/font/google'

export const sansSerifFont = Poppins({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700', '800'],
  style: ['normal', 'italic'],
  display: 'swap',
  variable: '--font-sans-serif',
})

export const monoFont = Source_Code_Pro({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-mono',
})
