# Agenda

Tasks and recurring goals (routines) for one owner, on the `tasks`, `routines`, `routineLogs`, `routineLogNotes` and `routineDeletions` tables ([backend conventions](convex.md)).

## Time and goals

A task's completion and a log's start store their UTC instant with the local reading and zone frozen at write time, so they stay on their recorded day whatever zone is current later. Day lists select by those local readings, outstanding tasks by UTC instants.

The current zone is the device's ([`use-device-time-zone.ts`](../src/hooks/use-device-time-zone.ts)). The current day, goal boundaries and reminder times follow it, so travelling moves them and two devices in different zones each show their own today. The server keeps only the last zone a page reported, for [notifications](#notifications). The server checks only that a zone it is sent is a known IANA name that matches the reading, and that the reading is no earlier than 2025 (`EARLIEST_YEAR` in [`limits.ts`](../convex/shared/limits.ts)), so a device in any zone can save.

A form reads and saves its times in the zone the device had when it opened (`useFormTimeZone`), and its time field names that zone. A log form also keeps the goal it opened with, which sets its duration boxes. One-click actions such as Mark done read the zone at the click.

## Views

The chosen day lives only in the URL (`?day=`, absent for today; [`day.ts`](../src/lib/x/agenda/day.ts)), and the `DayKind` comment in [`views/agenda.tsx`](../src/components/x/agenda/views/agenda.tsx) defines what each kind of day lists. The three pages share one React root under one `transition:persist` identity, so the providers survive navigation. Nothing is kept in browser storage.

Lists are whole reads with growing limits, not pagination, so deleting a row lets the next one in, and a truncated result says so. Logs and done tasks are read newest local time first, and a day's rows keep that order, so 'Load more' adds older rows; outstanding tasks are read oldest show-at time first.

## Notifications

Convex publishes to the `agenda` topic of an ntfy server ([`ntfy.ts`](../convex/lib/ntfy.ts)), with nothing running between notifications: each pending one is a scheduled function, recorded in `notificationJobs` so a later write can replace or cancel it ([`notifications.ts`](../convex/lib/notifications.ts)).

- A task notifies at its show-at time if it is still outstanding. A show-at time already past when saved, such as Immediately, notifies nothing.
- A routine notifies at each reminder while it owes something for the interval, by the rule the Agenda screen uses ([`reminders.ts`](../convex/shared/reminders.ts)), then sets its next reminder.
- The morning summary at 06:00 lists the tasks shown by the end of the day and the routines owing by then, or says that nothing is due. It also re-sets every routine's next reminder.

Triggers in [`functionBuilders.ts`](../convex/lib/functionBuilders.ts) keep each task's and routine's job in step with its writes. Routine reminders and the summary follow the `settings` row's zone, which [`record-time-zone.tsx`](../src/components/x/agenda/shell/record-time-zone.tsx) sets whenever an open page's device zone differs, so they follow whichever device opened Agenda last. Until a page first reports a zone, only tasks notify; that first report, and each change of zone, reschedules every routine and the summary. Tasks need nothing, as a show-at time is an instant, so a task saved before notifications existed never notifies.

A publish runs through the action retrier, which retries an unreachable server for about 14 minutes. Each notification carries a sequence ID per task or routine, so a newer one, or a retried copy, replaces the one on the phone. Tapping one opens `/x/agenda` in production, even from the dev deployment.

## Aggregate and deletion

[`routineLogAggregate.ts`](../convex/lib/routineLogAggregate.ts) keeps each routine's log count and elapsed UTC duration through a synchronous trigger that the shared mutation builders install, so zone changes, goal edits, archive and restore need no rebuild.

Deleting an archived routine removes it at once, and a `routineDeletions` row drains its logs and notes in batches (`remove` and `drainBatch` in [`routines.ts`](../convex/routines.ts)); an hourly cron restarts stalled drains. Never clear the aggregate namespace while draining: the trigger would fail on the missing entry and stop the chain.

## Verification

Handler tests ([convex.md](convex.md#tests)) check aggregate totals against source scans, and [`notifications.test.ts`](../convex/notifications.test.ts) steps the clock through a day of notifications. Check in a browser: draft preservation; clock and zone changes, where the day, goals and reminders follow the device while an open form keeps its zone; and the persisted root across navigation, expiry and connection loss.
