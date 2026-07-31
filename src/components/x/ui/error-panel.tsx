import type { ReactNode } from 'react'

type ErrorPanelProps = {
  message: string
  className?: string
}

export function ErrorPanel({ message, className = '' }: ErrorPanelProps): ReactNode {
  return (
    <div
      role="alert"
      className={`unstyled flex items-start gap-2.5 rounded-lg border border-gray-7 bg-gray-3 px-3 py-2.5 text-left ${className}`}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className="mt-px size-4 shrink-0 stroke-[1.5] text-gray-12"
      >
        <path d="M10.363 3.591 2.257 17.125a1.914 1.914 0 0 0 1.636 2.871h16.214a1.914 1.914 0 0 0 1.636-2.87L13.637 3.59a1.914 1.914 0 0 0-3.274 0Z" />
        <path d="M12 9v4" />
        <path d="M12 16h.01" />
      </svg>
      <p className="unstyled my-0! text-sm text-gray-12">{message}</p>
    </div>
  )
}
