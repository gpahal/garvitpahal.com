export type PuzzleEditorProps<TPuzzle> = {
  puzzle: TPuzzle
  /**
   * Cancels the running read and takes the one undo step, so commit nothing that changes nothing.
   * `isContinuingEdit` marks a later keystroke of one edit, so undo goes back to before it began.
   */
  onChange: (puzzle: TPuzzle, isContinuingEdit?: boolean) => void
  /**
   * Why solving now would answer the wrong question. `solveBlocker` cannot see a half-finished edit,
   * since it is uncommitted, so only the editor can report one. Clear it on unmount: the editor
   * remounts on every read and undo.
   */
  onBlockerChange: (blocker: string | undefined) => void
}

export type PuzzleSolutionProps<TPuzzle> = {
  puzzle: TPuzzle
  solution: Uint8Array
}
