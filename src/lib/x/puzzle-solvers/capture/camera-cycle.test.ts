import { describe, expect, it } from 'vitest'

import { nextCameraId } from './camera-cycle'

describe('nextCameraId', () => {
  it('moves to the next camera, wrapping at the end, and offers no switch from an unknown one', () => {
    expect(nextCameraId(['a', 'b', 'c'], 'b')).toBe('c')
    expect(nextCameraId(['a', 'b', 'c'], 'c')).toBe('a')
    expect(nextCameraId(['a', 'b'], 'z')).toBeUndefined()
    expect(nextCameraId(['a', 'b'], undefined)).toBeUndefined()
  })
})
