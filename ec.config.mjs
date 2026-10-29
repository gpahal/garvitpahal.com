// @ts-check
import { defineEcConfig } from 'astro-expressive-code'

/**
 * `--sidebar`, `--sidebar-foreground` and `--muted-foreground` from `src/styles/global.css`, as hex:
 * Expressive Code checks token contrast against the background at build time, which a CSS
 * variable would hide from it. Change them with those tokens.
 */
const SITE_COLORS = {
  light: { background: '#fafaf9', foreground: '#0c0a09', muted: '#79716b' },
  dark: { background: '#1c1917', foreground: '#fafaf9', muted: '#a6a09b' },
}

/**
 * Plain punctuation, muted whatever colour the theme gives it, so both modes match; punctuation
 * outside these, such as a Markdown heading's `#`, keeps the theme's colour.
 */
const PUNCTUATION_SCOPES = [
  'punctuation.separator',
  'punctuation.terminator',
  'punctuation.accessor',
  'punctuation.definition.block',
  'punctuation.definition.parameters',
  'meta.brace',
]
const VARIABLE_SCOPES = [
  'variable.other',
  'variable.parameter',
  'meta.object-literal.key',
  'support.variable.property',
]

/**
 * By the selector's last scope, the one it colours: One Light writes rules such as
 * `source.ts punctuation.separator.comma`.
 *
 * @param {string} selector @param {ReadonlyArray<string>} prefixes
 */
const isUnder = (selector, prefixes) => {
  const scope = selector.trim().split(/\s+/).at(-1) ?? ''
  return prefixes.some((prefix) => scope === prefix || scope.startsWith(`${prefix}.`))
}

/** @param {string | undefined} color */
const normalised = (color) => color?.toLowerCase().slice(0, 7)

/**
 * Keeps One's accents and swaps its neutrals for the site's: its text colour and variables become
 * the site's foreground, and its comments and plain punctuation the site's muted text. A rule
 * spanning several scopes is split, so each scope gets its own colour.
 *
 * @param {import('astro-expressive-code').ExpressiveCodeTheme} theme
 */
function withSiteNeutrals(theme) {
  const site = SITE_COLORS[theme.type]
  const themeForeground = normalised(theme.fg)
  const themeComment = normalised(
    theme.settings.find((rule) => [rule.scope ?? []].flat().includes('comment'))?.settings
      .foreground,
  )
  const neutralFor = (/** @type {string} */ scope, /** @type {string | undefined} */ color) => {
    if (
      isUnder(scope, ['comment']) ||
      isUnder(scope, PUNCTUATION_SCOPES) ||
      (color !== undefined && color === themeComment)
    ) {
      return site.muted
    }
    if (color === themeForeground || isUnder(scope, VARIABLE_SCOPES)) {
      return site.foreground
    }
    return undefined
  }
  theme.settings = theme.settings.flatMap((rule) => {
    const scopes = [rule.scope ?? []].flat()
    if (scopes.length === 0) {
      return [rule]
    }
    const color = normalised(rule.settings.foreground)
    /** @type {Map<string, Array<string>>} */
    const byForeground = new Map()
    for (const scope of scopes) {
      const foreground = neutralFor(scope, color) ?? rule.settings.foreground ?? ''
      byForeground.set(foreground, [...(byForeground.get(foreground) ?? []), scope])
    }
    return [...byForeground].map(([foreground, group]) => ({
      ...rule,
      scope: group,
      settings: { ...rule.settings, ...(foreground !== '' && { foreground }) },
    }))
  })
  theme.settings.push(
    { scope: PUNCTUATION_SCOPES, settings: { foreground: site.muted } },
    { scope: ['comment'], settings: { foreground: site.muted, fontStyle: 'italic' } },
  )
  theme.colors['editor.background'] = site.background
  theme.colors['editor.foreground'] = site.foreground
  theme.bg = site.background
  theme.fg = site.foreground
  return theme
}

/**
 * Lucide's `copy`, the icon set the rest of the site uses, as the mask Expressive Code paints.
 */
const LUCIDE_COPY_ICON = `url("data:image/svg+xml,${encodeURIComponent(
  "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'><rect width='14' height='14' x='8' y='8' rx='2' ry='2'/><path d='M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2'/></svg>",
)}")`

/**
 * In this file rather than `astro.config.ts`, because the integration cannot serialise
 * `customizeTheme` from options passed to it.
 */
export default defineEcConfig({
  // Dark first, the default; the light theme follows `prefers-color-scheme`, like the site.
  themes: ['one-dark-pro', 'one-light'],
  customizeTheme: withSiteNeutrals,
  // WCAG AA. Expressive Code darkens or lightens any token below it, keeping its hue.
  minSyntaxHighlightingColorContrast: 4.5,
  // Wrapped, so a long line never scrolls the block sideways in the narrow column.
  defaultProps: { wrap: true, preserveIndent: true },
  styleOverrides: {
    borderRadius: 'var(--radius)',
    borderColor: 'var(--border)',
    codeBackground: 'var(--sidebar)',
    codeFontSize: '0.875rem',
    codeLineHeight: '1.7',
    codePaddingBlock: '1rem',
    codePaddingInline: '1.25rem',
    uiFontFamily: 'var(--font-sans)',
    // The copy button as the site's outline icon buttons: a border, an accent fill on hover and
    // Lucide's icon.
    frames: {
      frameBoxShadowCssValue: 'none',
      inlineButtonBackground: 'var(--accent)',
      inlineButtonBackgroundIdleOpacity: '0',
      inlineButtonBackgroundHoverOrFocusOpacity: '1',
      inlineButtonBackgroundActiveOpacity: '1',
      inlineButtonForeground: 'var(--muted-foreground)',
      inlineButtonBorder: 'var(--border)',
      inlineButtonBorderOpacity: '1',
      tooltipSuccessBackground: 'var(--foreground)',
      tooltipSuccessForeground: 'var(--background)',
      copyIcon: LUCIDE_COPY_ICON,
    },
  },
})
