import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'

import { drawPixels } from '@/lib/x/puzzle-solvers/capture/canvas-pixels'
import type { Capture } from '@/lib/x/puzzle-solvers/capture/rectify'
import { ScrollDialog, ScrollDialogBody } from '@/components/shared/scroll-dialog'
import { Button } from '@/components/ui/button'

export function PictureDialog({ capture }: { capture: Capture }): ReactNode {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        View picture
      </Button>
      <ScrollDialog isOpen={open} onClose={() => setOpen(false)} title="Puzzle picture">
        <ScrollDialogBody>{open ? <Picture capture={capture} /> : undefined}</ScrollDialogBody>
      </ScrollDialog>
    </>
  )
}

function Picture({ capture }: { capture: Capture }): ReactNode {
  const ref = useRef<HTMLCanvasElement | null>(null)
  const [zoom, setZoom] = useState(false)
  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    drawPixels(canvas, capture.image)
    const context = canvas.getContext('2d')
    if (!context) return
    context.strokeStyle = '#f43f5e'
    context.lineWidth = Math.max(2, capture.image.width / 400)
    context.beginPath()
    for (const [i, point] of capture.quad.entries()) {
      if (i === 0) context.moveTo(point.x, point.y)
      else context.lineTo(point.x, point.y)
    }
    context.closePath()
    context.stroke()
  }, [capture])
  return (
    <>
      <Button variant="outline" onClick={() => setZoom(!zoom)}>
        {zoom ? 'Fit picture' : 'Zoom in'}
      </Button>
      <div
        className="overflow-auto"
        // eslint-disable-next-line jsx-a11y-x/no-noninteractive-tabindex -- a scroll container needs focus
        tabIndex={0}
        role="region"
        aria-label="Puzzle reference picture"
      >
        <canvas
          ref={ref}
          role="img"
          aria-label="Original picture with selected grid boundary"
          style={zoom ? { width: Math.max(960, capture.image.width), height: 'auto' } : undefined}
          className={zoom ? 'max-w-none' : 'h-auto w-full'}
        />
      </div>
    </>
  )
}
