import { expect, test } from 'vitest'

import { inspectImage } from './image-header'

test('reads a JPEG whose standalone markers come before its frame', async () => {
  // SOI, RST0, TEM, a 10 by 20 SOF0 with three zeroed components, then EOI.
  const jpeg = Buffer.from(`ffd8ffd0ff01ffc0001108000a001403${'00'.repeat(9)}ffd9`, 'hex')
  await expect(inspectImage(new Blob([jpeg]))).resolves.toEqual({ width: 20, height: 10 })
})
