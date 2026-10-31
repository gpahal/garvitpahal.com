import { describe, expect, it } from 'vitest'

import type { Doc, Id } from '../_generated/dataModel'
import {
  morningSummaryNotification,
  routineReminderNotification,
  taskDueNotification,
} from './notificationMessages'

const TASK_ID = 'task1' as Id<'tasks'>
const ROUTINE_ID = 'routine1' as Id<'routines'>

function routine(goal: Doc<'routines'>['goal']) {
  return { _id: ROUTINE_ID, name: 'Run', goal }
}

describe('taskDueNotification', () => {
  it('shows the description, shortened, or says the task is due', () => {
    expect(taskDueNotification({ _id: TASK_ID, name: 'Pay rent' })).toEqual({
      sequenceId: 'task-task1',
      title: 'Pay rent',
      message: 'Due now',
    })
    const { message } = taskDueNotification({
      _id: TASK_ID,
      name: 'Pay rent',
      description: 'x'.repeat(600),
    })
    expect(message).toHaveLength(500)
    expect(message.endsWith('…')).toBe(true)
  })
})

describe('routineReminderNotification', () => {
  it('counts what is still owed in the current interval', () => {
    const once = routine({ kind: 'daily', count: 1, reminders: [{ minuteOfDay: 540 }] })
    expect(routineReminderNotification(once, 1)).toEqual({
      sequenceId: 'routine-routine1',
      title: 'Run',
      message: 'Not done yet today',
    })
    const thrice = routine({
      kind: 'weekly',
      count: 3,
      reminders: [1, 3, 5].map((weekday) => ({ weekday, minuteOfDay: 540 })),
    })
    expect(routineReminderNotification(thrice, 2).message).toBe('2 of 3 still to do this week')
  })
})

describe('morningSummaryNotification', () => {
  it('says quietly when nothing is due', () => {
    expect(morningSummaryNotification({ tasks: [], hasMoreTasks: false, routines: [] })).toEqual({
      sequenceId: 'summary',
      title: 'Nothing due today',
      message: 'No tasks or routines are due today',
      priority: 2,
    })
  })

  it('names the first few of each and counts the rest', () => {
    const tasks = Array.from({ length: 10 }, (_, i) => `Task ${String(i + 1)}`)
    expect(morningSummaryNotification({ tasks, hasMoreTasks: false, routines: ['Run'] })).toEqual({
      sequenceId: 'summary',
      title: '10 tasks and 1 routine today',
      message: `Tasks: ${tasks.slice(0, 8).join(', ')} and 2 more\nRoutines: Run`,
    })
    const cut = Array.from({ length: 50 }, (_, i) => `Task ${String(i + 1)}`)
    expect(morningSummaryNotification({ tasks: cut, hasMoreTasks: true, routines: [] })).toEqual({
      sequenceId: 'summary',
      title: '50+ tasks today',
      message: `Tasks: ${cut.slice(0, 8).join(', ')} and more`,
    })
  })
})
