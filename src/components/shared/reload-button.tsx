import type { ReactNode, Ref } from 'react'

import { Button } from '@/components/ui/button'

export function ReloadButton({ ref }: { ref?: Ref<HTMLButtonElement> }): ReactNode {
  return (
    <Button
      ref={ref}
      variant="outline"
      onClick={() => {
        globalThis.location.reload()
      }}
    >
      Reload
    </Button>
  )
}
