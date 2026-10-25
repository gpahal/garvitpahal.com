type LoggedAt = { at: number; atLocal: number }

type LogLike = { started: LoggedAt }
type TaskLike = { done?: LoggedAt | undefined }

export type LoggedEntry<Log, Task> = LoggedAt &
  ({ kind: 'log'; log: Log } | { kind: 'task'; task: Task })

/**
 * A cut read holds exactly the limit it asked for (`takeCapped` in `convex/lib/documents.ts`), so
 * one cut short of `max` either stands in while a raised limit loads or can be raised.
 */
export function isReadFurther(
  read: { rows: Array<unknown>; hasMore: boolean },
  max: number,
): boolean {
  return read.hasMore && read.rows.length < max
}

/**
 * Sorted newest reading first, ties by instant, as the server caps each source, so a clocks-back
 * repeat or zone change cannot put a row read later above rows already shown. `cut` marks a source
 * read to its limit; entries from its last reading back are held so reading more only adds rows
 * below. Once nothing more will be read, pass both false or omit `cut`.
 */
export function mergeLogged<Log extends LogLike, Task extends TaskLike>(
  logs: Array<Log>,
  tasks: Array<Task>,
  cut?: { logs: boolean; tasks: boolean },
): Array<LoggedEntry<Log, Task>> {
  const wholeAfter = Math.max(
    (cut?.logs ? logs.at(-1)?.started.atLocal : undefined) ?? -Infinity,
    (cut?.tasks ? tasks.at(-1)?.done?.atLocal : undefined) ?? -Infinity,
  )
  const entries: Array<LoggedEntry<Log, Task>> = logs.map((log) => ({
    kind: 'log',
    log,
    at: log.started.at,
    atLocal: log.started.atLocal,
  }))
  for (const task of tasks) {
    if (task.done) {
      entries.push({ kind: 'task', task, at: task.done.at, atLocal: task.done.atLocal })
    }
  }
  return entries
    .filter((entry) => entry.atLocal > wholeAfter)
    .toSorted((a, b) => (a.atLocal === b.atLocal ? b.at - a.at : b.atLocal - a.atLocal))
}
