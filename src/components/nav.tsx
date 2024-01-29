'use client'

import * as React from 'react'

import { LayoutGroup, motion } from 'framer-motion'

import { NAV_LINK_ITEMS } from '@/lib/nav'
import { Link } from '@/components/lib/link'

export function Nav() {
  return (
    <LayoutGroup>
      <nav className="flex items-center justify-center">
        <ul className="relative mx-[-0.6rem] flex h-11 w-full items-center justify-end space-x-1 border-t border-neutral-6/80 px-[0.875rem] py-1 tracking-tight sm:h-9 sm:w-auto sm:justify-center sm:rounded-full sm:border sm:px-4">
          {NAV_LINK_ITEMS.map(({ label, path, requiresExactMatch }) => (
            <li key={label}>
              <Link
                variant="unstyled"
                href={path}
                requiresExactMatch={requiresExactMatch}
                className="relative inline-block px-2.5 text-[0.9375rem] text-fg-subtle/80 hocus-visible:text-fg"
                activeClassName="text-fg group"
              >
                {({ isActive, isChildActive }) => (
                  <span className="relative">
                    {label}
                    {(isActive || (!requiresExactMatch && isChildActive)) && (
                      <motion.div
                        className="absolute top-[-0.8rem] z-[1] h-[0.15rem] w-full bg-fg sm:top-[1.55rem]"
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
      </nav>
    </LayoutGroup>
  )
}
