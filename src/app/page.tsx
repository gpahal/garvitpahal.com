import type { Metadata } from 'next'

import selfImage from '@public/images/self/self-320x320.jpg'

import { getTopLevelBlogPosts } from '@/lib/blog.server'
import { generatePageMetadata } from '@/lib/metadata'
import { PROJECTS } from '@/lib/project'
import { SOCIAL_LINKS } from '@/lib/social'
import { cn } from '@/lib/styles'
import { H1, H2 } from '@/components/lib/heading'
import { Image } from '@/components/lib/image'
import { Link } from '@/components/lib/link'
import { BlogPostSummaries } from '@/components/blog/blog-post-summaries'
import { ProjectSummaries } from '@/components/project/project-summaries'

export const runtime = 'edge'

export const metadata: Metadata = generatePageMetadata({
  pathname: '/',
})

export default function HomePage() {
  const blogPosts = getTopLevelBlogPosts()

  return (
    <>
      <div className="flex flex-col-reverse items-start sm:flex-row">
        <div className="flex flex-col pr-8">
          <header className="mb-5">
            <H1>Hey, I&apos;m Garvit</H1>
          </header>

          <div className="prose">
            <p>
              I&apos;m a software engineer from India. I&apos;m currently a founding engineer at{' '}
              <Link href="https://joinperch.com/">Perch</Link>. We help creators host their very own ama page.
            </p>
            <p>
              I spend my days fixing bugs, rooting for FC Barcelona, watching movies and stuck in Bangalore traffic.
            </p>
          </div>
        </div>
        <div className="relative mb-6 mr-auto w-[128px] sm:mb-0 sm:mt-14 sm:w-auto sm:min-w-[128px] md:ml-4">
          <Image src={selfImage} alt="Garvit Pahal" className="w-full rounded-full object-cover filter" priority />
        </div>
      </div>
      <div className="prose mt-8">
        <H2>Projects</H2>
        <ProjectSummaries projects={PROJECTS.slice(0, 4)} />
        {PROJECTS.length > 4 && (
          <Link
            variant="unstyled"
            href="/projects"
            className="mt-4 inline-block w-full border border-neutral-6/50 bg-bg-emphasis-2 px-3 pb-[0.55rem] pt-[0.5rem] hocus-visible:bg-bg-emphasis-3"
          >
            All projects →
          </Link>
        )}

        <H2 className="mt-10">Blog</H2>
        <BlogPostSummaries blogPosts={blogPosts.slice(0, 3)} />
        {blogPosts.length > 3 && (
          <Link
            variant="unstyled"
            href="/blog"
            className="mt-4 inline-block w-full border border-neutral-6/50 bg-bg-emphasis-2 px-3 pb-[0.55rem] pt-[0.5rem] hocus-visible:bg-bg-emphasis-3"
          >
            All posts →
          </Link>
        )}

        <H2 className="mt-10">Reach out</H2>
        <div className="flex flex-wrap items-center gap-2">
          {SOCIAL_LINKS.map(({ label, href, Icon, filledClassName }) => (
            <Link
              key={label}
              variant="unstyled"
              href={href}
              className={cn(
                'flex items-center gap-2 border border-neutral-6/50 bg-bg-emphasis-2 px-3 py-1',
                filledClassName,
              )}
            >
              <Icon className="h-4 w-4" />
              <span>{label}</span>
            </Link>
          ))}
        </div>
      </div>
    </>
  )
}
