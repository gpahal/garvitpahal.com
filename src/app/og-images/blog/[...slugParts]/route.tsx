import * as React from 'react'
import { notFound } from 'next/navigation'
import { ImageResponse } from 'next/server'

import { getBlogPostBySlugParts } from '@/lib/blog.server'
import { ogSize } from '@/lib/og'
import { loadOgFonts } from '@/lib/og.server'

export const runtime = 'edge'

type BlogPostPageProps = { params: { slugParts: string[] } }

export async function GET(request: Request, { params: { slugParts } }: BlogPostPageProps) {
  const blogPost = getBlogPostBySlugParts(slugParts)
  if (!blogPost) {
    return notFound()
  }

  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          background: `url(${new URL('/images/og/blog/blog-post-bg.png', request.url).toString()})`,
          color: '#ededed',
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: '656px',
            display: 'flex',
            flexDirection: 'column',
            position: 'absolute',
            top: '96px',
            left: '128px',
          }}
        >
          <h1
            style={{
              fontSize: '56px',
              lineHeight: '66px',
              letterSpacing: '-1.25px',
              fontWeight: 700,
              wordBreak: 'break-word',
            }}
          >
            {blogPost.data.frontmatter.title}
          </h1>
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            position: 'absolute',
            top: '420px',
            left: '236px',
          }}
        >
          <div style={{ fontSize: '36px', fontWeight: 600 }}>Garvit Pahal</div>
          <div style={{ fontSize: '28px', fontWeight: 400, color: '#a0a0a0' }}>Software Engineer</div>
        </div>
      </div>
    ),
    {
      ...ogSize,
      fonts: await loadOgFonts(),
    },
  )
}
