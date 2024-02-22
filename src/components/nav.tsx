'use client'

import * as React from 'react'

import { LayoutGroup, motion } from 'framer-motion'

import { NAV_LINK_ITEMS } from '@/lib/nav'
import { Link } from '@/components/lib/link'

export function Nav() {
  return (
    <LayoutGroup>
      <nav className="flex w-full items-center justify-center sm:mx-auto sm:max-w-[42rem] sm:px-2">
        <div className="relative mx-[-0.6rem] flex h-10 w-full items-center justify-between border-t px-[0.875rem] py-1 tracking-tight shadow-sm sm:mx-0 sm:h-[2.325rem] sm:rounded-full sm:border sm:px-4">
          <Link
            variant="unstyled"
            href="/"
            className="relative inline-block px-1 text-[0.9375rem] font-semimedium text-fg/80 hocus-visible:text-fg sm:text-base"
          >
            Garvit Pahal
          </Link>
          <ul className="relative flex items-center space-x-2 sm:space-x-2.5">
            {NAV_LINK_ITEMS.filter((item) => !item.shouldHideInMainNav).map(({ label, path, requiresExactMatch }) => (
              <li key={label}>
                <Link
                  variant="unstyled"
                  href={path}
                  requiresExactMatch={requiresExactMatch}
                  className="relative inline-block px-1 text-sm text-fg-subtle/80 hocus-visible:text-fg sm:text-[0.9375rem]"
                  activeClassName="text-fg group"
                >
                  {({ isActive, isChildActive }) => (
                    <span className="relative">
                      {label}
                      {(isActive || (!requiresExactMatch && isChildActive)) && (
                        <motion.div
                          className="absolute top-[-0.8rem] z-[1] h-[0.15rem] w-full bg-fg sm:top-[1.525rem]"
                          layoutId="nav"
                          transition={{
                            type: 'spring',
                            stiffness: 350,
                            damping: 30,
                          }}
                        />
                      )}
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </nav>
    </LayoutGroup>
  )
}
