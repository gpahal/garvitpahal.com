/**
 * Not CLI output, which defines this in `toggle.tsx`: a module that exports a component and
 * anything else cannot be hot-reloaded. Only the CLI's `outline` variant and `sm` size, the ones
 * in use.
 */
export const toggleClass =
  "group/toggle inline-flex h-7 min-w-7 items-center justify-center gap-1 rounded-[min(var(--radius-md),12px)] border border-input bg-transparent px-2.5 text-[0.8rem] font-medium whitespace-nowrap transition-all outline-none hover:bg-muted hover:text-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 aria-invalid:border-destructive aria-invalid:ring-destructive/20 aria-pressed:bg-muted data-[state=on]:bg-muted dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-3.5"
