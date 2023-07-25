'use client'

import * as React from 'react'
import { hasBasePath } from 'next/dist/client/has-base-path'
import { removeBasePath } from 'next/dist/client/remove-base-path'
import { formatUrl } from 'next/dist/shared/lib/router/utils/format-url'
import NextLink from 'next/link'
import { usePathname } from 'next/navigation'

import type { VariantProps } from 'class-variance-authority'

import { isFunction } from '@gpahal/std/function'
import { isString } from '@gpahal/std/string'
import { isAbsoluteUrl, isPathnameActive } from '@gpahal/std/url'

import { cn } from '@/lib/styles'
import { linkStyles } from '@/components/lib/styles'

const FORCE_EXTERNAL_LINK_PATTERNS = [/\/references/]

export type ActiveLinkState = { isActive: boolean; isChildActive?: boolean }
export type ActiveLinkClassNameFn = (_: ActiveLinkState) => string | undefined | null
export type ActiveLinkChildrenFn = (_: ActiveLinkState) => React.ReactNode

export type LinkProps = Omit<
  React.ComponentPropsWithoutRef<typeof NextLink>,
  'legacyBehavior' | 'className' | 'children'
> &
  VariantProps<typeof linkStyles> & {
    activeLinkState?: ActiveLinkState
    requiresExactMatch?: boolean
    className?: string | ActiveLinkClassNameFn
    activeClassName?: string
    children?: React.ReactNode | ActiveLinkChildrenFn
    activeChildren?: React.ReactNode
  }

export const Link = React.forwardRef<React.ElementRef<typeof NextLink>, LinkProps>(
  (
    {
      href,
      target,
      rel,
      variant,
      activeLinkState,
      requiresExactMatch,
      className: classNameProp,
      activeClassName,
      children: childrenProp,
      activeChildren,
      ...props
    },
    ref,
  ) => {
    const hrefString = React.useMemo(() => (isString(href) ? href : formatUrl(href)), [href])

    const pathname = usePathname()

    const [dependentProps, setDependentProps] = React.useState({
      isExternal: isAbsoluteUrl(hrefString),
      className: getClassName(
        variant,
        activeLinkState || {
          isActive: false,
        },
        requiresExactMatch,
        classNameProp,
        activeClassName,
      ),
      children: getChildren(
        activeLinkState || {
          isActive: false,
        },
        requiresExactMatch,
        childrenProp,
        activeChildren,
      ),
    })

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

      const state =
        activeLinkState ||
        (hrefPathname != null
          ? isPathnameActive(pathname, hrefPathname)
          : {
              isActive: false,
            })

      setDependentProps({
        isExternal,
        className: getClassName(variant, state, requiresExactMatch, classNameProp, activeClassName),
        children: getChildren(state, requiresExactMatch, childrenProp, activeChildren),
      })
    }, [
      variant,
      classNameProp,
      hrefString,
      pathname,
      activeLinkState,
      activeClassName,
      requiresExactMatch,
      childrenProp,
      activeChildren,
    ])

    rel = rel || (target === '_blank' ? 'noopener noreferrer' : undefined)
    return dependentProps.isExternal ? (
      <a {...props} ref={ref} href={hrefString} target={target} rel={rel} className={dependentProps.className}>
        {dependentProps.children}
      </a>
    ) : (
      <BasicLink {...props} ref={ref} href={hrefString} target={target} rel={rel} className={dependentProps.className}>
        {dependentProps.children}
      </BasicLink>
    )
  },
)
Link.displayName = 'Link'

function getClassName(
  variant: LinkProps['variant'],
  state: ActiveLinkState,
  requiresExactMatch: LinkProps['requiresExactMatch'],
  className: LinkProps['className'],
  activeClassName: LinkProps['activeClassName'],
): string | undefined {
  const isActive = state.isActive || (!requiresExactMatch && state.isChildActive)
  return cn(
    linkStyles({ variant }),
    (className && isFunction(className) ? className(state) : className) as string | undefined,
    isActive ? cn('active', activeClassName) : 'inactive',
  )
}

function getChildren(
  state: ActiveLinkState,
  requiresExactMatch: LinkProps['requiresExactMatch'],
  children: LinkProps['children'],
  activeChildren: LinkProps['activeChildren'],
): React.ReactNode {
  const isActive = state.isActive || (!requiresExactMatch && state.isChildActive)
  return isActive && activeChildren
    ? activeChildren
    : ((isFunction(children) ? children(state) : children) as React.ReactNode)
}

type BasicLinkProps = Omit<LinkProps, 'href' | 'className' | 'children'> & {
  href: string
  className?: string
  children?: React.ReactNode
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
