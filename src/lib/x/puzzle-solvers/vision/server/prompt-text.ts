/**
 * Matches `cellName` in `grid/geometry.ts`.
 */
export const CELL_NAMING = `Cells are named like spreadsheet cells: the column letter counting from the left, then the row
number counting from 1 at the top. A1 is the top-left cell of the grid, B1 is the cell to its right,
A2 is the cell below it.`

export function formatSizeChoices(sizes: ReadonlyArray<number>): string {
  return new Intl.ListFormat('en-GB', { type: 'disjunction' }).format(sizes.map(String))
}

export const PROMPT_CLOSING = 'Do not solve the puzzle. Report only what is printed.'

/**
 * Phrased as observations to check: a wrong hint is worse than none, so the model stays free to
 * trust the picture over it.
 */
export function formatMeasuredHints(lines: Array<string>): string {
  return lines.length === 0
    ? ''
    : 'Measured from the picture before it was sent, so check each against the image and trust ' +
        `the image if they disagree:\n\n${lines.map((line) => `- ${line}`).join('\n')}\n\n`
}
