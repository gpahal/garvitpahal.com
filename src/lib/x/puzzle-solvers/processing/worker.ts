/// <reference lib="webworker" />
// For `Uint8Array.prototype.toBase64`, which the preset's es2025 lib lacks. It sets the browser
// floor `canReadPictures` checks. Node 24 lacks it too, so nothing Vitest runs may call it.
/// <reference lib="esnext.typedarrays" />
import type { Failure } from '@/lib/failure'

import { inspectImage, unreadableFileMessage, validateDimensions } from '../capture/image-header'
import { fitJpeg } from '../capture/jpeg-fit'
import { flattenOnWhite } from '../capture/pixels'
import type { PixelImage } from '../capture/pixels'
import { detectQuad } from '../capture/quad'
import { bitmapOptions, drawResampled, resampledSize, scaledSize } from '../capture/resample'
import { puzzleCompute } from '../puzzles/compute-registry'
import { assessSolve } from '../puzzles/solve-result'
import { UserFacingError } from '../user-facing-error'
import { MAX_IMAGE_BYTES } from '../vision/image-limit'
import { OPERATIONS } from './protocol'
import type { Job, JobReply, Operation, Operations, WorkerMessage } from './protocol'

function offscreenContext(width: number, height: number): OffscreenCanvasRenderingContext2D {
  const context = new OffscreenCanvas(width, height).getContext('2d')
  if (!context) throw new Error('OffscreenCanvas has no 2D context')
  return context
}

/**
 * The header check bounds decoding for JPEG, PNG, GIF and WebP, whose headers give their size; any
 * other format is checked only after decoding.
 */
async function decode(source: Blob): Promise<PixelImage> {
  const size = await inspectImage(source)
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(source, bitmapOptions(size))
  } catch {
    throw new UserFacingError(await unreadableFileMessage(source))
  }
  try {
    validateDimensions(bitmap)
    const { width, height } = resampledSize(bitmap.width, bitmap.height)
    const context = offscreenContext(width, height)
    drawResampled(context, bitmap, width, height)
    return flattenOnWhite({ width, height, data: context.getImageData(0, 0, width, height).data })
  } finally {
    bitmap.close()
  }
}

async function encodeJpeg(pixels: PixelImage): Promise<string> {
  const context = offscreenContext(pixels.width, pixels.height)
  context.putImageData(new ImageData(pixels.data, pixels.width, pixels.height), 0, 0)
  const { canvas } = context
  // Each smaller size is drawn from the full crop, not the last attempt, so resampling runs once.
  const image = await fitJpeg(async (attempt) => {
    const options = { type: 'image/jpeg', quality: attempt.quality }
    if (attempt.scale === 1) return canvas.convertToBlob(options)
    const { width, height } = scaledSize(pixels.width, pixels.height, attempt.scale)
    const smaller = offscreenContext(width, height)
    drawResampled(smaller, canvas, width, height)
    return smaller.canvas.convertToBlob(options)
  }, MAX_IMAGE_BYTES)
  return new Uint8Array(await image.arrayBuffer()).toBase64()
}

async function process(job: Job): Promise<Operations[Operation]['output']> {
  switch (job.operation) {
    case 'decode': {
      return decode(job.data.source)
    }
    case 'detect': {
      return detectQuad(job.data.image)
    }
    case 'prepare': {
      const { pixels, hints } = puzzleCompute(job.data.puzzleId).prepare(job.data.capture)
      return { image: await encodeJpeg(pixels), hints }
    }
    case 'assess': {
      const compute = puzzleCompute(job.data.puzzleId)
      const { puzzle } = job.data
      return assessSolve(
        compute.solve(puzzle, { timeoutMs: OPERATIONS.assess.budgetMs }),
        compute.fingerprint(puzzle),
      )
    }
    case 'solve': {
      const { puzzleId, puzzle } = job.data
      return puzzleCompute(puzzleId).solve(puzzle, { timeoutMs: OPERATIONS.solve.budgetMs })
    }
  }
}

async function respond(data: Job): Promise<void> {
  let reply: JobReply
  let transfer: Array<Transferable> = []
  postMessage({ type: 'started', id: data.id } satisfies WorkerMessage)
  try {
    const result = await process(data)
    reply = { id: data.id, ok: true, result }
    // Decoded pixels reach 16 MiB and the Worker has no further use for them, so they are
    // transferred rather than copied.
    if (result && 'data' in result) transfer = [result.data.buffer]
  } catch (error) {
    // Anything but a `UserFacingError`, such as a `RangeError` from a failed allocation, is
    // logged here, since only the operation's failure crosses to the page.
    let failure: Failure
    if (error instanceof UserFacingError) {
      failure = error.failure
    } else {
      console.error(error)
      failure = { message: OPERATIONS[data.operation].failure }
    }
    reply = { id: data.id, ok: false, failure }
  }
  postMessage(reply, { transfer })
}

globalThis.addEventListener('message', ({ data }: MessageEvent<Job>) => {
  respond(data).catch(globalThis.reportError)
})
