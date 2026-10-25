import type { Task } from './doc-types'

/**
 * "Now" is a parameter, so every list on a screen is split by the same reading.
 */
export function isDue(task: Task, now: number): boolean {
  return task.showAt <= now
}

export function dueTasks(tasks: Array<Task>, now: number): Array<Task> {
  return tasks.filter((task) => isDue(task, now))
}

export function scheduledTasks(tasks: Array<Task>, now: number): Array<Task> {
  return tasks.filter((task) => !isDue(task, now))
}

/**
 * Past this, the Later today link says only that there are more.
 */
export const LATER_TODAY_COUNTED = 10

/**
 * `read` holds up to one more than `LATER_TODAY_COUNTED` outstanding tasks to the end of the day.
 * Tasks due by `now` are still left out, for a stale read that stands in while the next one loads.
 */
export function laterTodayLabel(
  read: { rows: Array<Task>; hasMore: boolean },
  now: number,
): string | undefined {
  const count = scheduledTasks(read.rows, now).length
  if (count > LATER_TODAY_COUNTED || read.hasMore) {
    return `Later today (${String(LATER_TODAY_COUNTED)}+)`
  }
  return count === 0 ? undefined : `Later today (${String(count)})`
}
