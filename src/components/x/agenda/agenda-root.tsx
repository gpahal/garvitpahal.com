import type { ReactNode } from 'react'

import { AgendaProvider } from './shell/convex-provider'
import { Agenda } from './views/agenda'
import { RoutinesView } from './views/routines-view'
import { TasksView } from './views/tasks-view'

export type AgendaView = 'agenda' | 'tasks' | 'routines'

/**
 * Each page subscribes to at least one owner query, whose rejection throws into a boundary: that is
 * how a page reports an auth failure instead of rendering as if signed in.
 */
export function AgendaRoot({ view }: { view: AgendaView }): ReactNode {
  return (
    <AgendaProvider>
      {view === 'agenda' ? <Agenda /> : view === 'tasks' ? <TasksView /> : <RoutinesView />}
    </AgendaProvider>
  )
}
