'use client'

import * as React from 'react'

import { LayoutGroup, motion } from 'framer-motion'

import { NAV_LINK_ITEMS } from '@/lib/nav'
import { Link } from '@/components/lib/link'

export function Nav() {
  return (
    <LayoutGroup>
      <nav className="flex w-full items-center justify-center border-t bg-bg-emphasis-2 sm:mx-auto sm:border-b sm:border-t-0">
        <div className="relative flex h-10 w-full items-center justify-between px-[0.875rem] py-1 tracking-tight sm:mx-0 sm:h-[2.35rem] sm:max-w-[42rem] sm:px-6">
          <Link
            variant="unstyled"
            href="/"
            className="relative inline-block text-[0.9375rem] font-semibold text-fg hocus-visible:text-fg sm:text-base"
          >
            Garvit Pahal
          </Link>
          <ul className="relative flex items-center space-x-2 sm:space-x-2.5">
            {NAV_LINK_ITEMS.map(({ label, path, requiresExactMatch }) => (
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
                          className="absolute top-[-0.8rem] z-[1] h-[0.15rem] w-full bg-fg sm:top-[1.575rem]"
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
