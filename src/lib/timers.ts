export type SetTimer = (callback: () => void, ms: number) => () => void

export const setTimer: SetTimer = (callback, ms) => {
  const id = setTimeout(callback, ms)
  return () => clearTimeout(id)
}
