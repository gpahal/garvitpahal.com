import type { ReactNode } from 'react'

import type { Flip } from '@/lib/capture/flip'

export const CAPTURE_BUTTON =
  'unstyled inline-flex items-center justify-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium focus-visible:ring-anchor focus-visible:outline-none focus-visible:ring-2'

export function FlipToggles({
  flip,
  onChange,
}: {
  flip: Flip
  onChange: (flip: Flip) => void
}): ReactNode {
  return (
    <div className="flex items-center justify-center gap-2">
      <FlipToggle
        isPressed={flip.horizontal}
        onClick={() => {
          onChange({ ...flip, horizontal: !flip.horizontal })
        }}
        label="Flip horizontally"
      >
        <path d="M12 3v18" />
        <path d="m16 7 4 5-4 5" />
        <path d="m8 7-4 5 4 5" />
      </FlipToggle>
      <FlipToggle
        isPressed={flip.vertical}
        onClick={() => {
          onChange({ ...flip, vertical: !flip.vertical })
        }}
        label="Flip vertically"
      >
        <path d="M3 12h18" />
        <path d="m7 8 5-4 5 4" />
        <path d="m7 16 5 4 5-4" />
      </FlipToggle>
    </div>
  )
}

/** `aria-pressed`, because "the preview is mirrored" is otherwise a purely visual fact. */
function FlipToggle({
  isPressed,
  onClick,
  label,
  children,
}: {
  isPressed: boolean
  onClick: () => void
  label: string
  children: ReactNode
}): ReactNode {
  return (
    <button
      type="button"
      aria-pressed={isPressed}
      onClick={onClick}
      className={`${CAPTURE_BUTTON} border ${
        isPressed
          ? 'border-gray-12 bg-gray-12 text-gray-contrast'
          : 'border-gray-6 text-gray-12 hocus:bg-gray-4'
      }`}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className="size-4 shrink-0 stroke-[1.5]"
      >
        {children}
      </svg>
      {label}
    </button>
  )
}
