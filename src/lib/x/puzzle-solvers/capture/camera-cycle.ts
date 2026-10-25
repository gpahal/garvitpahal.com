/**
 * Cycles device ids rather than toggling `facingMode`, which desktop webcams do not report. With
 * the open camera missing from `ids`, there is no next one, since the first might be the open one.
 */
export function nextCameraId(
  ids: ReadonlyArray<string>,
  current: string | undefined,
): string | undefined {
  if (current === undefined || ids.length < 2) return undefined
  const index = ids.indexOf(current)
  return index === -1 ? undefined : ids[(index + 1) % ids.length]
}
