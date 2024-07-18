import * as React from 'react'
import type { Metadata } from 'next'

import { RssIcon } from 'lucide-react'

import selfImage from '@public/images/self/self-320x320.jpg'

import { getTopLevelBlogPosts } from '@/lib/blog.server'
import { generatePageMetadata } from '@/lib/metadata'
import { NAV_LINK_ITEMS } from '@/lib/nav'
import { MAIL_LINK, SOCIAL_LINKS } from '@/lib/social'
import { cn } from '@/lib/styles'
import { H1, H2 } from '@/components/lib/heading'
import { Image } from '@/components/lib/image'
import { Link } from '@/components/lib/link'
import { buttonStyles } from '@/components/lib/styles'
import { BlogPostSummaries } from '@/components/blog/blog-post-summaries'

export const metadata: Metadata = generatePageMetadata({
  pathname: '/',
})

export default function HomePage() {
  const blogPosts = getTopLevelBlogPosts().filter((blogPost) => blogPost.data.frontmatter.isFeatured)

  return (
    <>
      <div className="flex flex-col-reverse items-start sm:flex-row">
        <div className="flex flex-col pr-8">
          <header className="mb-5">
            <H1>Hi, I&apos;m Garvit</H1>
          </header>

          <div className="prose">
            <p>
              I&apos;m a software developer from India. I spend my days fixing bugs, rooting for FC Barcelona, watching
              movies and stuck in Bangalore traffic.
            </p>

            <p className="flex flex-wrap items-center gap-2 py-1">
              <Link
                key={MAIL_LINK.label}
                variant="unstyled"
                href={MAIL_LINK.href}
                className={cn(buttonStyles({ variant: 'outline', size: 'sm' }), 'gap-1.5')}
                aria-label={MAIL_LINK.label}
              >
                <MAIL_LINK.Icon className="size-3.5" />
                {MAIL_LINK.label}
              </Link>
              {SOCIAL_LINKS.map(({ label, href, Icon }) => (
                <Link
                  key={label}
                  variant="unstyled"
                  href={href}
                  className={cn(buttonStyles({ variant: 'outline', size: 'sm' }), 'gap-1.5')}
                  aria-label={label}
                >
                  <Icon className="size-3" />
                  {label}
                </Link>
              ))}
            </p>
          </div>
        </div>
        <div className="mb-8 mr-auto sm:mb-0 md:ml-4">
          <Image
            src={selfImage}
            alt="Garvit Pahal"
            className="min-w-[128px] rounded-xl border sm:min-w-[160px]"
            priority
          />
        </div>
      </div>
      <div className="prose mt-8">
        <div className="mb-[1.125rem] mt-12 flex items-center justify-between">
          <H2 className="my-0">Featured posts from my blog</H2>
          <Link
            variant="unstyled"
            href="/blog.rss.xml"
            className={cn(buttonStyles({ variant: 'outline', size: 'sm' }), '-mt-0.5 gap-1.5')}
            aria-label="Blog RSS feed"
          >
            <RssIcon className="size-3.5" />
            RSS
          </Link>
        </div>
        <BlogPostSummaries blogPosts={blogPosts} maxBlogPostsVisible={3} />

        <H2>Quick links</H2>
        <ul>
          {NAV_LINK_ITEMS.filter((item) => item.id !== 'about').map(({ id, description, path }) => (
            <li key={id}>
              <Link href={path}>{description}</Link>
            </li>
          ))}
        </ul>
      </div>
    </>
  )
}
