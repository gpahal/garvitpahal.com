# Agenda

Tasks and recurring goals (routines) for one owner, on the `tasks`, `routines`, `routineLogs`, `routineLogNotes` and `routineDeletions` tables ([backend conventions](convex.md)).

## Time and goals

A task's completion and a log's start store their UTC instant with the local reading and zone frozen at write time, so they stay on their recorded day whatever zone is current later. Day lists select by those local readings, outstanding tasks by UTC instants. Browser and server share every rule in `convex/shared/`.

No current zone is stored: it is the device's ([`use-device-time-zone.ts`](../src/hooks/use-device-time-zone.ts)). The current day, goal boundaries and reminder times follow it, so travelling moves them and two devices in different zones each show their own today. The server checks only that a zone it is sent is a known IANA name that matches the reading, and that the reading is no earlier than 2025 (`EARLIEST_YEAR` in [`limits.ts`](../convex/shared/limits.ts)), so a device in any zone can save.

A form reads and saves its times in the zone the device had when it opened (`useFormTimeZone`), and its time field names that zone. A log form also keeps the goal it opened with, which sets its duration boxes. One-click actions such as Mark done read the zone at the click.

## Views

The chosen day lives only in the URL (`?day=`, absent for today; [`day.ts`](../src/lib/x/agenda/day.ts)), and the `DayKind` comment in [`views/agenda.tsx`](../src/components/x/agenda/views/agenda.tsx) defines what each kind of day lists. The three pages share one React root under one `transition:persist` identity, so the providers survive navigation. Nothing is kept in browser storage.

Lists are whole reads with growing limits, not pagination, so deleting a row lets the next one in, and a truncated result says so. Logs and done tasks are read newest local time first, and a day's rows keep that order, so 'Load more' adds older rows; outstanding tasks are read oldest show-at time first.

## Aggregate and deletion

[`routineLogAggregate.ts`](../convex/lib/routineLogAggregate.ts) keeps each routine's log count and elapsed UTC duration through a synchronous trigger that the shared mutation builders install, so zone changes, goal edits, archive and restore need no rebuild.

Deleting an archived routine removes it at once, and a `routineDeletions` row drains its logs and notes in batches (`remove` and `drainBatch` in [`routines.ts`](../convex/routines.ts)); an hourly cron restarts stalled drains. Never clear the aggregate namespace while draining: the trigger would fail on the missing entry and stop the chain.

## Verification

Handler tests ([convex.md](convex.md#tests)) check aggregate totals against source scans. Check in a browser: draft preservation; clock and zone changes, where the day, goals and reminders follow the device while an open form keeps its zone; and the persisted root across navigation, expiry and connection loss.
