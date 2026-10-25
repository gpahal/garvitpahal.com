import type { ComponentProps, ReactNode } from 'react'

import { Plus } from 'lucide-react'

import { Button } from '@/components/ui/button'

type AddButtonProps = Omit<ComponentProps<typeof Button>, 'children'> & { label: string }

export function AddButton({ label, ...button }: AddButtonProps): ReactNode {
  return (
    <Button {...button}>
      <Plus data-icon="inline-start" />
      {label}
    </Button>
  )
}
