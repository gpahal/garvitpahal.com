import { useEffect, useId, useRef } from 'react'
import type { ReactNode } from 'react'

import { drawPixels } from '@/lib/x/puzzle-solvers/capture/canvas-pixels'
import type { PixelImage } from '@/lib/x/puzzle-solvers/capture/pixels'
import { nearestCorner } from '@/lib/x/puzzle-solvers/capture/quad'
import type { Point, Quad } from '@/lib/x/puzzle-solvers/capture/quad'

const CORNER_LABELS = ['Top-left', 'Top-right', 'Bottom-right', 'Bottom-left'] as const

/**
 * Of the picture's long edge.
 */
const NUDGE_FRACTION = 0.01

type QuadEditorProps = {
  image: PixelImage
  quad: Quad
  onChange: (quad: Quad) => void
}

function describePosition(image: PixelImage, point: Point): string {
  const across = Math.round((point.x / image.width) * 100)
  const down = Math.round((point.y / image.height) * 100)
  return `${String(across)}% across, ${String(down)}% down`
}

function clampToImage(image: PixelImage, point: Point): Point {
  return {
    x: Math.min(image.width, Math.max(0, point.x)),
    y: Math.min(image.height, Math.max(0, point.y)),
  }
}

/**
 * The SVG overlay shares the canvas's image coordinates and contain-fit, so handles sit on their
 * pixels without measuring. Both carry a handle's reach as margin, so an edge corner can be grabbed
 * from any side.
 */
export function QuadEditor({ image, quad, onChange }: QuadEditorProps): ReactNode {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const svgRef = useRef<SVGSVGElement | null>(null)
  const handlesRef = useRef<Array<SVGCircleElement | null>>([])
  const hintId = useId()

  const longEdge = Math.max(image.width, image.height)
  // In image units: about a 40px hit target for a portrait picture on a 375×548 phone screen.
  const hitRadius = longEdge * 0.075
  const dotRadius = longEdge * 0.012
  const strokeWidth = longEdge * 0.004
  const focusRadius = dotRadius * 2.5
  // Whole pixels, so the canvas border and the SVG's match exactly.
  const margin = Math.ceil(hitRadius)

  useEffect(() => {
    if (canvasRef.current) {
      drawPixels(canvasRef.current, image, margin)
    }
  }, [image, margin])

  function toImagePoint(clientX: number, clientY: number): Point | undefined {
    const svg = svgRef.current
    const matrix = svg?.getScreenCTM()
    if (!svg || !matrix) {
      return undefined
    }
    const point = new DOMPoint(clientX, clientY).matrixTransform(matrix.inverse())
    return { x: point.x, y: point.y }
  }

  function moveCorner(index: number, point: Point): void {
    const next = [...quad] as Quad
    next[index] = point
    onChange(next)
  }

  return (
    <div className="relative size-full">
      <p id={hintId} className="sr-only">
        Drag a corner, or use the arrow keys, to move it onto the corner of the grid. Hold Shift for
        bigger steps
      </p>
      <canvas ref={canvasRef} className="size-full object-contain" aria-hidden="true" />
      <svg
        ref={svgRef}
        viewBox={`${String(-margin)} ${String(-margin)} ${String(image.width + 2 * margin)} ${String(image.height + 2 * margin)}`}
        preserveAspectRatio="xMidYMid meet"
        className="absolute inset-0 size-full touch-none"
        role="group"
        aria-label="Corners of the grid"
      >
        <polygon
          points={quad.map((point) => `${String(point.x)},${String(point.y)}`).join(' ')}
          fill="rgba(255,255,255,0.08)"
          stroke="white"
          strokeWidth={strokeWidth}
        />
        {quad.map((point, index) => (
          <g key={CORNER_LABELS[index]}>
            <circle
              cx={point.x}
              cy={point.y}
              r={dotRadius}
              fill="white"
              stroke="black"
              strokeWidth={strokeWidth}
              pointerEvents="none"
            />
            {/* The ring after it shows focus in black and white, so it stands out on any picture. */}
            <circle
              ref={(element) => {
                handlesRef.current[index] = element
              }}
              cx={point.x}
              cy={point.y}
              r={hitRadius}
              fill="transparent"
              className="peer cursor-move focus-visible:outline-none"
              role="slider"
              tabIndex={0}
              aria-label={`${CORNER_LABELS[index] ?? ''} corner`}
              aria-describedby={hintId}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round((point.x / image.width) * 100)}
              aria-valuetext={describePosition(image, point)}
              onPointerDown={(event) => {
                // Also stops the press giving focus, so the handle is focused below.
                event.preventDefault()
                const pressed = toImagePoint(event.clientX, event.clientY)
                const handle =
                  (pressed && handlesRef.current[nearestCorner(quad, pressed)]) ??
                  event.currentTarget
                handle.setPointerCapture(event.pointerId)
                // So arrow keys carry on from the drag; the ring waits for a key press.
                handle.focus({ preventScroll: true, focusVisible: false })
              }}
              onPointerMove={(event) => {
                // The browser drops capture on release and on cancel alike.
                if (!event.currentTarget.hasPointerCapture(event.pointerId)) {
                  return
                }
                const next = toImagePoint(event.clientX, event.clientY)
                if (next) {
                  moveCorner(index, clampToImage(image, next))
                }
              }}
              onPointerUp={(event) => {
                event.currentTarget.releasePointerCapture(event.pointerId)
              }}
              onKeyDown={(event) => {
                const step = longEdge * NUDGE_FRACTION * (event.shiftKey ? 5 : 1)
                const delta: Record<string, Point> = {
                  ArrowUp: { x: 0, y: -step },
                  ArrowDown: { x: 0, y: step },
                  ArrowLeft: { x: -step, y: 0 },
                  ArrowRight: { x: step, y: 0 },
                }
                const move = delta[event.key]
                if (!move) {
                  return
                }
                event.preventDefault()
                moveCorner(index, clampToImage(image, { x: point.x + move.x, y: point.y + move.y }))
              }}
            />
            <circle
              cx={point.x}
              cy={point.y}
              r={focusRadius}
              fill="none"
              stroke="black"
              strokeWidth={strokeWidth * 3}
              pointerEvents="none"
              className="opacity-0 peer-focus-visible:opacity-100"
            />
            <circle
              cx={point.x}
              cy={point.y}
              r={focusRadius}
              fill="none"
              stroke="white"
              strokeWidth={strokeWidth * 1.5}
              pointerEvents="none"
              className="opacity-0 peer-focus-visible:opacity-100"
            />
          </g>
        ))}
      </svg>
    </div>
  )
}
