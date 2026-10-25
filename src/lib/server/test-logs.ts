import { vi } from 'vitest'

/**
 * Call `captureLogs` in `beforeEach` and `vi.restoreAllMocks` in `afterEach`.
 */

export function captureLogs(): void {
  vi.spyOn(console, 'log').mockImplementation(() => undefined)
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
}

export function loggedLines(level?: 'log' | 'error'): Array<Record<string, unknown>> {
  const levels = level ? [level] : (['log', 'error'] as const)
  return levels.flatMap((each) =>
    vi
      // eslint-disable-next-line no-console -- reads the spied log sink
      .mocked(console[each])
      .mock.calls.map(([line]) => JSON.parse(String(line)) as Record<string, unknown>),
  )
}

export function loggedEvent(event: string): Record<string, unknown> | undefined {
  return loggedLines().find((fields) => fields.event === event)
}
