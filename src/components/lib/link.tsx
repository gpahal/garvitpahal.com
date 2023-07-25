'use client'

import * as React from 'react'
import { hasBasePath } from 'next/dist/client/has-base-path'
import { removeBasePath } from 'next/dist/client/remove-base-path'
import { formatUrl } from 'next/dist/shared/lib/router/utils/format-url'
import NextLink from 'next/link'
import { usePathname } from 'next/navigation'

import type { VariantProps } from 'class-variance-authority'

import { isString } from '@gpahal/std/string'
import { isAbsoluteUrl, isPathnameActive } from '@gpahal/std/url'

import { cn } from '@/lib/styles'
import { linkStyles } from '@/components/lib/styles'

const FORCE_EXTERNAL_LINK_PATTERNS = [/\/references/]

export type ActiveLinkState = { isActive: boolean; isChildActive?: boolean }

export type LinkProps = Omit<React.ComponentPropsWithoutRef<typeof NextLink>, 'legacyBehavior' | 'className'> &
  VariantProps<typeof linkStyles> & {
    activeLinkState?: ActiveLinkState
    className?: string
    inactiveClassName?: string
    activeClassName?: string
    childActiveClassName?: string
  }

export const Link = React.forwardRef<React.ElementRef<typeof NextLink>, LinkProps>(
  (
    {
      href,
      target,
      rel,
      variant,
      activeLinkState,
      className: classNameProp,
      inactiveClassName,
      activeClassName,
      childActiveClassName,
      children,
      ...props
    },
    ref,
  ) => {
    const hrefString = React.useMemo(() => (isString(href) ? href : formatUrl(href)), [href])

    const pathname = usePathname()

    const [isExternal, setIsExternal] = React.useState(isAbsoluteUrl(hrefString))
    const [className, setClassName] = React.useState(
      getClassName(
        activeLinkState || {
          isActive: false,
        },
        variant,
        classNameProp,
        inactiveClassName,
        activeClassName,
        childActiveClassName,
      ),
    )

    React.useEffect(() => {
      const currentUrl = new URL(window.location.href)
      const currentOrigin = currentUrl.origin

      let isExternal = isAbsoluteUrl(hrefString)
      let hrefPathname: string | undefined
      if (isExternal) {
        const url = new URL(hrefString)
        isExternal = url.origin !== currentOrigin || !hasBasePath(url.pathname)
        hrefPathname = isExternal ? undefined : removeBasePath(url.pathname)
      } else {
        const url = new URL(hrefString, 'http://test.com')
        hrefPathname = url.pathname
      }

      if (!isExternal && hrefPathname) {
        isExternal = FORCE_EXTERNAL_LINK_PATTERNS.some((pattern) => hrefPathname && pattern.test(hrefPathname))
      }

      setIsExternal(isExternal)
      setClassName(
        getClassName(
          activeLinkState ||
            (hrefPathname != null
              ? isPathnameActive(pathname, hrefPathname)
              : {
                  isActive: false,
                }),
          variant,
          classNameProp,
          inactiveClassName,
          activeClassName,
          childActiveClassName,
        ),
      )
    }, [
      variant,
      classNameProp,
      hrefString,
      pathname,
      activeLinkState,
      inactiveClassName,
      activeClassName,
      childActiveClassName,
    ])

    rel = rel || (target === '_blank' ? 'noopener noreferrer' : undefined)
    return isExternal ? (
      <a ref={ref} href={hrefString} target={target} rel={rel} className={className} {...props}>
        {children}
      </a>
    ) : (
      <BasicLink ref={ref} href={hrefString} target={target} rel={rel} className={className} {...props}>
        {children}
      </BasicLink>
    )
  },
)
Link.displayName = 'Link'

function getClassName(
  state: ActiveLinkState,
  variant: LinkProps['variant'],
  className: LinkProps['className'],
  inactiveClassName?: LinkProps['inactiveClassName'],
  activeClassName?: LinkProps['activeClassName'],
  childActiveClassName?: LinkProps['childActiveClassName'],
): string | undefined {
  return cn(
    linkStyles({ variant }),
    className,
    !state.isActive && !state.isChildActive && cn('inactive', inactiveClassName),
    state.isActive && cn('active', activeClassName),
    state.isChildActive && cn('child-active', childActiveClassName),
  )
}

type BasicLinkProps = Omit<LinkProps, 'href' | 'className'> & {
  href: string
  className?: string
}

const BasicLink = React.forwardRef<React.ElementRef<typeof NextLink>, BasicLinkProps>((props, ref) =>
  props.href.startsWith('#') ? <BasicSmoothScollLink ref={ref} {...props} /> : <NextLink ref={ref} {...props} />,
)
BasicLink.displayName = 'BasicLink'

const BasicSmoothScollLink = React.forwardRef<React.ElementRef<typeof NextLink>, BasicLinkProps>(
  ({ onClick, ...props }, ref) => {
    const onClickWrapper = (e: React.MouseEvent<HTMLAnchorElement>) => {
      e.preventDefault()
      const targetId = props.href.slice(1)
      if (targetId) {
        const el = document.getElementById(targetId)
        if (el) {
          el.scrollIntoView({ behavior: 'smooth' })
        }
      }
      onClick?.(e)
    }

    return <NextLink ref={ref} scroll={false} onClick={onClickWrapper} {...props} />
  },
)
BasicSmoothScollLink.displayName = 'BasicSmoothScollLink'
