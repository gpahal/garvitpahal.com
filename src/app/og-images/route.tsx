import * as React from 'react'
import { ImageResponse } from 'next/server'

import { ogSize } from '@/lib/og'
import { loadOgFonts } from '@/lib/og.server'

export const runtime = 'edge'

export async function GET(request: Request) {
  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          background: `url(${new URL('/images/og/default-bg.png', request.url).toString()})`,
          color: '#ededed',
        }}
      >
        <div
          style={{ position: 'absolute', top: '352px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}
        >
          <div style={{ fontSize: '42px', fontWeight: 600 }}>Garvit Pahal</div>
          <div style={{ fontSize: '34px', fontWeight: 400, color: '#a0a0a0', textAlign: 'center' }}>
            Software engineer
          </div>
        </div>
      </div>
    ),
    {
      ...ogSize,
      fonts: await loadOgFonts(),
    },
  )
}
