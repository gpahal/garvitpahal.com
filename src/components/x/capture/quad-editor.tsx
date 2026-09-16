import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'

import { drawPixels } from '@/lib/capture/encode'
import type { PixelImage } from '@/lib/capture/pixels'
import type { Point, Quad } from '@/lib/capture/quad'

const CORNER_LABELS = ['Top-left', 'Top-right', 'Bottom-right', 'Bottom-left'] as const

/**
Keyboard nudge, as a fraction of the picture's long edge.
*/
const NUDGE_FRACTION = 0.01

type QuadEditorProps = {
  image: PixelImage
  quad: Quad
  onChange: (quad: Quad) => void
}

/**
 * The picture with the four corners of the grid drawn over it, each one draggable. The overlay is
 * an SVG in image coordinates with the same contain-fit as the canvas beneath it, so the handles
 * sit on the pixels they mark at any size without measuring anything; pointer positions come back
 * through the SVG's own transform.
 */
export function QuadEditor({ image, quad, onChange }: QuadEditorProps): ReactNode {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const svgRef = useRef<SVGSVGElement | null>(null)
  const [dragging, setDragging] = useState<number | undefined>(undefined)

  useEffect(() => {
    if (canvasRef.current) {
      drawPixels(canvasRef.current, image)
    }
  }, [image])

  const toImagePoint = useCallback(
    (clientX: number, clientY: number): Point | undefined => {
      const svg = svgRef.current
      const matrix = svg?.getScreenCTM()
      if (!svg || !matrix) {
        return undefined
      }
      const point = new DOMPoint(clientX, clientY).matrixTransform(matrix.inverse())
      return {
        x: Math.min(image.width, Math.max(0, point.x)),
        y: Math.min(image.height, Math.max(0, point.y)),
      }
    },
    [image.height, image.width],
  )

  const moveCorner = useCallback(
    (index: number, point: Point) => {
      const next = [...quad] as Quad
      next[index] = point
      onChange(next)
    },
    [onChange, quad],
  )

  const longEdge = Math.max(image.width, image.height)
  // Sized in image units so they scale with the picture; a phone shows a 1024px crop at roughly
  // 40%, which makes the hit target around 44px.
  const hitRadius = longEdge * 0.055
  const dotRadius = longEdge * 0.012
  const strokeWidth = longEdge * 0.004

  return (
    <div className="relative size-full">
      <canvas ref={canvasRef} className="size-full object-contain" aria-hidden="true" />
      <svg
        ref={svgRef}
        viewBox={`0 0 ${String(image.width)} ${String(image.height)}`}
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
            {/* The hit target: invisible, generous, and the thing that takes focus and keys. */}
            <circle
              cx={point.x}
              cy={point.y}
              r={hitRadius}
              fill="transparent"
              className="cursor-move focus-visible:fill-white/30 focus-visible:outline-none"
              role="button"
              tabIndex={0}
              aria-label={`${CORNER_LABELS[index]} corner. Drag it, or use the arrow keys, to move it onto the corner of the grid`}
              onPointerDown={(event) => {
                event.preventDefault()
                event.currentTarget.setPointerCapture(event.pointerId)
                setDragging(index)
              }}
              onPointerMove={(event) => {
                if (dragging !== index) {
                  return
                }
                const next = toImagePoint(event.clientX, event.clientY)
                if (next) {
                  moveCorner(index, next)
                }
              }}
              onPointerUp={(event) => {
                event.currentTarget.releasePointerCapture(event.pointerId)
                setDragging(undefined)
              }}
              onPointerCancel={() => {
                setDragging(undefined)
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
                moveCorner(index, {
                  x: Math.min(image.width, Math.max(0, point.x + move.x)),
                  y: Math.min(image.height, Math.max(0, point.y + move.y)),
                })
              }}
            />
          </g>
        ))}
      </svg>
    </div>
  )
}
