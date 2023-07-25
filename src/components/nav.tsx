'use client'

import * as React from 'react'

import { LayoutGroup, motion } from 'framer-motion'

import { NAV_LINK_ITEMS } from '@/lib/nav'
import { Link } from '@/components/lib/link'

export function Nav() {
  return (
    <LayoutGroup>
      <nav>
        <ul className="relative mx-[-0.6rem] flex items-center space-x-0.5 text-[1.05rem] tracking-tight">
          {NAV_LINK_ITEMS.map(({ label, path, requiresExactMatch }) => (
            <li key={label}>
              <Link
                variant="unstyled"
                href={path}
                requiresExactMatch={requiresExactMatch}
                className="relative inline-block px-2.5 py-0.5 text-fg-subtle/80 hocus-visible:text-fg"
                activeClassName="text-fg group"
              >
                {({ isActive, isChildActive }) => (
                  <span className="relative">
                    {label}
                    {(isActive || (!requiresExactMatch && isChildActive)) && (
                      <motion.div
                        className="absolute top-[1.35rem] z-[-1] h-[2px] w-full bg-neutral-7"
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
