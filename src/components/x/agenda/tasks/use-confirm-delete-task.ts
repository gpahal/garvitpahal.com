import { useMutation } from 'convex/react'

import { api } from '@convex/_generated/api'

import type { Task } from '@/lib/x/agenda/doc-types'
import { useConfirmDelete } from '@/hooks/use-confirm-delete'
import type { ConfirmDelete } from '@/hooks/use-confirm-delete'
import type { Submit } from '@/hooks/use-submit'

export function useConfirmDeleteTask(
  task: Task,
  submit: Submit,
  onClose: () => void,
): ConfirmDelete {
  const remove = useMutation(api.tasks.remove)
  return useConfirmDelete({
    question: 'Delete this task for good?',
    submit,
    remove: async () => remove({ id: task._id }),
    onDeleted: onClose,
  })
}
