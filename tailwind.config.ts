import type { Config } from 'tailwindcss'

import { darkTheme } from './color-themes/dark'
import { lightTheme } from './color-themes/light'

const config: Config = {
  content: ['./src/components/**/*.{js,ts,jsx,tsx,mdx}', './src/app/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    fontWeight: {
      inherit: 'inherit',
      thin: '100',
      extralight: '200',
      light: '300',
      semilight: '350',
      subtlelight: '375',
      normal: '400',
      subtlemedium: '425',
      semimedium: '450',
      medium: '500',
      extramedium: '550',
      semibold: '600',
      bold: '700',
      extrabold: '800',
      black: '900',
    },
    colors: {
      transparent: 'transparent',
      white: '#ffffff',
      black: '#000000',
      inherit: 'inherit',
      current: 'currentColor',
    },
    extend: {
      typography: {
        DEFAULT: {
          css: {
            '--tw-prose-headings': 'rgb(var(--colors-fg))',
            '--tw-prose-invert-headings': 'rgb(var(--colors-fg))',
            '--tw-prose-body': 'rgb(var(--colors-fg) / 0.8)',
            '--tw-prose-invert-body': 'rgb(var(--colors-fg) / 0.8)',
            '--tw-prose-lead': 'rgb(var(--colors-fg-muted) / 0.75)',
            '--tw-prose-invert-lead': 'rgb(var(--colors-fg-muted) / 0.75)',
            '--tw-prose-links': 'inherit',
            '--tw-prose-invert-links': 'inherit',
            '--tw-prose-code': 'inherit',
            '--tw-prose-invert-code': 'inherit',
            '--tw-prose-pre-bg': 'inherit',
            '--tw-prose-invert-pre-bg': 'inherit',
            '--tw-prose-pre-code': 'inherit',
            '--tw-prose-invert-pre-code': 'inherit',
            '--tw-prose-quotes': 'rgb(var(--colors-fg-muted) / 0.75)',
            '--tw-prose-invert-quotes': 'rgb(var(--colors-fg-muted) / 0.75)',
            '--tw-prose-quote-borders': 'rgb(var(--colors-neutral-6))',
            '--tw-prose-invert-quote-borders': 'rgb(var(--colors-neutral-6))',
            '--tw-prose-th-borders': 'rgb(var(--colors-neutral-7))',
            '--tw-prose-invert-th-borders': 'rgb(var(--colors-neutral-7))',
            '--tw-prose-td-borders': 'rgb(var(--colors-neutral-7))',
            '--tw-prose-invert-td-borders': 'rgb(var(--colors-neutral-7))',
            '--tw-prose-captions': 'rgb(var(--colors-fg-muted) / 0.75)',
            '--tw-prose-invert-captions': 'rgb(var(--colors-fg-muted) / 0.75)',
            '--tw-prose-counters': 'rgb(var(--colors-fg-muted) / 0.5)',
            '--tw-prose-invert-counters': 'rgb(var(--colors-fg-muted) / 0.5)',
            '--tw-prose-bullets': 'rgb(var(--colors-fg-muted) / 0.325)',
            '--tw-prose-invert-bullets': 'rgb(var(--colors-fg-muted) / 0.325)',
            '--tw-prose-hr': 'rgb(var(--colors-neutral-6) / 0.75)',
            '--tw-prose-invert-hr': 'rgb(var(--colors-neutral-6))',
            '--tw-prose-bold': 'inherit',
            '--tw-prose-invert-bold': 'inherit',

            width: '100%',
            margin: 0,
            padding: 0,
            fontSize: '1rem',
            lineHeight: '1.5625rem',
            fontWeight: '400',

            strong: {
              color: 'rgb(var(--colors-fg))',
              fontWeight: 600,
            },
            '*:not(strong)': {
              fontWeight: 'inherit',
            },
            p: {
              margin: '1.125rem 0',
            },
            "[role='alert'] > div > p": {
              margin: 0,
            },

            'h1, h2, h3, h4, h5, h6': {
              position: 'relative',
              scrollMarginTop: '100px',
            },

            h1: {
              marginTop: 0,
              marginBottom: '1em',
            },

            h2: {
              marginTop: '1.5em',
              marginBottom: '0.675em',
            },

            h3: {
              marginTop: '1.4em',
              marginBottom: '0.375em',
            },

            h4: {
              marginTop: '1.375em',
              marginBottom: '0.4em',
            },

            'a:not(.heading-anchor)': {
              fontWeight: 'inherit',
              color: 'rgb(var(--colors-fg))',
            },

            'a.heading-anchor': {
              visibility: 'hidden',
              position: 'absolute',
              top: 0,
              right: 0,
              bottom: 0,
              left: 0,
              cursor: 'pointer',
              textDecorationLine: 'none !important',
              fontWeight: 'inherit',

              '&:hover': {
                visibility: 'visible',
              },
            },
            'a.heading-anchor::after': {
              content: "'#'",
              marginLeft: '-1.25rem',
              color: 'rgb(var(--colors-neutral-8))',
            },
            '*:hover > a.heading-anchor': {
              visibility: 'visible',
            },
            'a.heading-anchor + a': {
              zIndex: 1,
            },

            li: {
              marginTop: '0.2rem',
              marginBottom: '0.2rem',
            },

            img: {
              margin: 0,
            },

            code: {
              backgroundColor: 'rgb(var(--colors-code-bg))',
              padding: '0.25rem 0.5rem',
              borderRadius: '0.25rem',
              fontSize: '0.875rem',
              lineHeight: 'inherit',
              fontWeight: 400,
            },
            'code::before': {
              content: 'none',
            },
            'code::after': {
              content: 'none',
            },

            pre: {
              backgroundColor: 'rgb(var(--colors-code-bg))',
              margin: 0,
              padding: '0.5rem 0 0.55rem 0',
              borderRadius: 0,

              '> code': {
                backgroundColor: 'transparent',
                borderRadius: 0,
                paddingLeft: 0,
                paddingRight: 0,
                fontSize: '0.875rem',
                lineHeight: '1.5rem',
                fontWeight: 400,

                '[data-line]': {
                  paddingLeft: '0.875rem',
                  paddingRight: '1rem',
                  borderLeftWidth: '2px',
                  borderColor: 'transparent',
                },
                '[data-line-highlighted]': {
                  backgroundColor: 'rgb(var(--colors-info-5) / 0.4)',
                  paddingLeft: '0.875rem',
                  paddingRight: '1rem',
                  borderColor: 'rgb(var(--colors-info-8))',
                },
              },

              '> code[data-show-line-numbers]': {
                display: 'grid',
                counterReset: 'line',

                '[data-line]::before': {
                  display: 'inline-block',
                  width: '1rem',
                  marginRight: '1.25rem',
                  color: 'rgb(var(--colors-fg) / 0.4)',
                  content: 'counter(line)',
                  counterIncrement: 'line',
                  textAlign: 'right',
                },
                '[data-line-highlighted]::before': {
                  color: 'rgb(var(--colors-fg) / 0.6)',
                },
              },
            },
          },
        },
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
    require('tailwindcss-animate'),
    require('@gpahal/tailwindcss-color-themes').default({
      default: lightTheme,
      defaultDark: darkTheme,
      themes: [
        {
          selector: '.light',
          theme: lightTheme,
        },
        {
          selector: '.dark',
          theme: darkTheme,
        },
      ],
    }),
    require('@gpahal/tailwindcss-variants').default,
  ],
}
export default config
