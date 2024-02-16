'use client'

import * as React from 'react'

import { IS_SERVER } from '@/lib/env'
import { useIsomorphicLayoutEffect } from '@/hooks/use-isomorphic-layout-effect'

const SYMBOL_KEY = '__wrap_b'
const SYMBOL_OBSERVER_KEY = '__wrap_o'

type WrapperElement = HTMLElement & {
  [SYMBOL_OBSERVER_KEY]?: ResizeObserver | undefined
}

function relayout(id: string | number, ratio: number, wrapper?: WrapperElement): void {
  wrapper = wrapper || document.querySelector<WrapperElement>(`[data-br="${id}"]`) || undefined
  if (!wrapper) {
    return
  }

  const container = wrapper.parentElement
  if (!container) {
    return
  }

  const update = (width: number) => {
    wrapper!.style.maxWidth = width + 'px'
  }

  wrapper.style.maxWidth = ''
  const width = container.clientWidth
  const height = container.clientHeight

  // Synchronously do binary search and calculate the layout
  let lower: number = width / 2 - 0.25
  let upper: number = width + 0.5
  let middle: number

  if (width) {
    update(lower)
    lower = Math.max(wrapper.scrollWidth, lower)

    while (lower + 1 < upper) {
      middle = Math.round((lower + upper) / 2)
      update(middle)
      if (container.clientHeight === height) {
        upper = middle
      } else {
        lower = middle
      }
    }

    update(upper * ratio + width * (1 - ratio))
  }

  if (!wrapper[SYMBOL_OBSERVER_KEY]) {
    if (typeof ResizeObserver !== 'undefined') {
      ;(wrapper[SYMBOL_OBSERVER_KEY] = new ResizeObserver(() => {
        self.__wrap_b(0, +wrapper!.dataset.brr!, wrapper)
      })).observe(container)
    } else {
      if (process.env.NODE_ENV === 'development') {
        console.warn(
          'The browser you are using does not support the ResizeObserver API. Please consider adding a polyfill for this API to avoid potential layout shifts or upgrade your browser. Read more: https://github.com/shuding/react-wrap-balancer#browser-support-information',
        )
      }
    }
  }
}

const RELAYOUT_STR = relayout.toString()

type RelayoutFn = typeof relayout

declare global {
  // eslint-disable-next-line @typescript-eslint/consistent-type-definitions
  interface Window {
    [SYMBOL_KEY]: RelayoutFn
  }
}

function BalancerScriptUnmemoized() {
  return (
    <script
      id="balancer-script"
      dangerouslySetInnerHTML={{
        __html: `self.${SYMBOL_KEY}=${RELAYOUT_STR};`,
      }}
      suppressHydrationWarning
    />
  )
}

export const BalancerScript = React.memo(BalancerScriptUnmemoized, () => true)

type BalancerOwnProps<ElementType extends React.ElementType = React.ElementType> = React.HTMLAttributes<HTMLElement> & {
  as?: ElementType
  ratio?: number
  children?: React.ReactNode
}

type BalancerProps<ElementType extends React.ElementType> = BalancerOwnProps<ElementType> &
  Omit<React.ComponentPropsWithoutRef<ElementType>, keyof BalancerOwnProps>

export function Balancer<ElementType extends React.ElementType = React.ElementType>({
  ratio = 1,
  children,
  ...props
}: BalancerProps<ElementType>) {
  const id = React.useId()
  const wrapperRef = React.useRef<WrapperElement>()
  const Wrapper: React.ElementType = props.as || 'span'

  useIsomorphicLayoutEffect(() => {
    if (wrapperRef.current) {
      ;(self[SYMBOL_KEY] = relayout)(0, ratio, wrapperRef.current)
    }
  }, [children, ratio])

  useIsomorphicLayoutEffect(() => {
    return () => {
      if (!wrapperRef.current) return

      const resizeObserver = wrapperRef.current[SYMBOL_OBSERVER_KEY]
      if (!resizeObserver) return

      resizeObserver.disconnect()
      delete wrapperRef.current[SYMBOL_OBSERVER_KEY]
    }
  }, [])

  return (
    <>
      <Wrapper
        {...props}
        data-br={id}
        data-brr={ratio}
        ref={wrapperRef}
        style={{
          display: 'inline-block',
          verticalAlign: 'top',
          textDecoration: 'inherit',
        }}
        suppressHydrationWarning
      >
        {children}
      </Wrapper>
      <script
        suppressHydrationWarning
        dangerouslySetInnerHTML={{
          __html: `self.${SYMBOL_KEY}("${id}",${ratio});`,
        }}
      />
    </>
  )
}

if (!IS_SERVER && process.env.NODE_ENV !== 'production') {
  const nextDevStyle = document.querySelector<HTMLElement>('[data-next-hide-fouc]')
  if (nextDevStyle) {
    const callback: MutationCallback = (mutationList) => {
      for (const mutation of mutationList) {
        for (const node of Array.from(mutation.removedNodes)) {
          if (node !== nextDevStyle) continue

          observer.disconnect()
          const elements = document.querySelectorAll<WrapperElement>('[data-br]')

          for (const element of Array.from(elements)) {
            self[SYMBOL_KEY](0, +element.dataset.brr!, element)
          }
        }
      }
    }
    const observer = new MutationObserver(callback)
    observer.observe(document.head, { childList: true })
  }
}
