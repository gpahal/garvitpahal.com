import { MAX_ROUTINES, ROUTINE_WARNING_COUNT, ROUTINES_FULL_ISSUE } from '@convex/shared/limits'

type RoutineLimitNotice = { isFull: boolean; title: string; message: string }

/**
 * Archived routines count too, as in the server's check (`storedRoutines`). At the limit it says
 * what the server's refusal says.
 */
export function routineLimitNotice(count: number): RoutineLimitNotice | undefined {
  if (count < ROUTINE_WARNING_COUNT) {
    return undefined
  }
  return count >= MAX_ROUTINES
    ? { isFull: true, title: 'No room for more routines', message: ROUTINES_FULL_ISSUE }
    : {
        isFull: false,
        title: 'Nearly out of room for routines',
        message: `You have ${count} of ${MAX_ROUTINES} routines, counting archived ones. To keep room for new ones, archive and then delete any you no longer use`,
      }
}
