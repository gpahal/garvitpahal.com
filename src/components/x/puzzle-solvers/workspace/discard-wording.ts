import type { Question } from '@/hooks/use-discard-confirmation'

/**
 * A new read replaces the puzzle only once it succeeds, but a cage draft goes at once: the editor
 * remounts.
 */

const DISCARD_CAGE = 'Discard the cage you are editing?'

const REPLACE_WORDING = {
  read: {
    clean: {
      read: {
        title: 'Replace your corrections?',
        body: 'A successful read replaces the corrections you made. If it fails, they stay',
        confirm: 'Read again',
      },
      entered: {
        title: 'Replace the puzzle you entered?',
        body: 'A successful read replaces the puzzle you entered. If it fails, it stays',
        confirm: 'Read again',
      },
    },
    draft: {
      read: {
        title: DISCARD_CAGE,
        body: 'Reading again discards the unfinished cage, and a successful read replaces your other corrections',
        confirm: 'Discard and read',
      },
      entered: {
        title: DISCARD_CAGE,
        body: 'Reading again discards the unfinished cage, and a successful read replaces the rest of the puzzle you entered',
        confirm: 'Discard and read',
      },
    },
  },
  picture: {
    clean: {
      read: {
        title: 'Replace your corrections?',
        body: 'A successful read of a new picture replaces the corrections you made. If it fails, they stay',
        confirm: 'Use a new picture',
      },
      entered: {
        title: 'Replace the puzzle you entered?',
        body: 'A successful read of a picture replaces the puzzle you entered. If it fails, it stays',
        confirm: 'Use a picture',
      },
    },
    draft: {
      read: {
        title: DISCARD_CAGE,
        body: 'Reading a new picture discards the unfinished cage, and a successful read replaces your other corrections',
        confirm: 'Discard and continue',
      },
      entered: {
        title: DISCARD_CAGE,
        body: 'Reading a picture discards the unfinished cage, and a successful read replaces the rest of the puzzle you entered',
        confirm: 'Discard and continue',
      },
    },
  },
} as const satisfies Record<string, Record<string, Record<string, Question>>>

/**
 * An untouched read still asks, since it cost a read to make.
 */
const START_OVER = {
  entered: {
    title: 'Start over?',
    body: 'This clears the puzzle you entered',
    confirm: 'Start over',
  },
  edited: {
    title: 'Start over?',
    body: 'This clears the puzzle and the corrections you made',
    confirm: 'Start over',
  },
  read: {
    title: 'Start over?',
    body: 'This clears the puzzle read from the picture',
    confirm: 'Start over',
  },
} as const satisfies Record<string, Question>

export const DISCARD_CAGE_AND_UNDO: Question = {
  title: DISCARD_CAGE,
  body: 'Undo discards the unfinished cage',
  confirm: 'Discard and undo',
}

export function replaceWording(
  action: keyof typeof REPLACE_WORDING,
  { hasDraft, isEntered }: { hasDraft: boolean; isEntered: boolean },
): Question {
  return REPLACE_WORDING[action][hasDraft ? 'draft' : 'clean'][isEntered ? 'entered' : 'read']
}

export function startOverWording({
  isEntered,
  hasWorkToLose,
}: {
  isEntered: boolean
  hasWorkToLose: boolean
}): Question {
  return START_OVER[isEntered ? 'entered' : hasWorkToLose ? 'edited' : 'read']
}
