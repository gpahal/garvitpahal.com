import { cellsByCage } from './model'
import type { KenKenGrid } from './model'
import { cageIssue } from './validate'

/**
 * `cageIssue` for one cage, for tests with no grid pass to share.
 */
export function issueOf(grid: KenKenGrid, cageId: number): ReturnType<typeof cageIssue> {
  return cageIssue(grid, cageId, cellsByCage(grid)[cageId] ?? [])
}
