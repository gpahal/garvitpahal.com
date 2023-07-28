'use client'

import * as React from 'react'

import { LayoutGroup, motion } from 'framer-motion'

import faviconLightImage from '@public/favicon-light.png'
import faviconImage from '@public/favicon.png'

import { NAV_LINK_ITEMS } from '@/lib/nav'
import { Image } from '@/components/lib/image'
import { Link } from '@/components/lib/link'

export function Nav() {
  return (
    <LayoutGroup>
      <nav className="flex items-center justify-center">
        <ul className="relative mx-[-0.6rem] flex h-9 items-center space-x-1.5 rounded-full border border-neutral-6/80 py-1 pl-[2.55rem] pr-[1.275rem] tracking-tight">
          <Link href="/" className="absolute left-[0.2rem] top-[0.165rem] opacity-90">
            <Image
              src={faviconImage}
              alt="Garvit Pahal"
              data-theme="light"
              className="h-[1.8rem] w-[1.8rem] rounded-full"
              priority
            />
            <Image
              src={faviconLightImage}
              alt="Garvit Pahal"
              data-theme="dark"
              className="h-[1.8rem] w-[1.8rem] rounded-full"
              priority
            />
          </Link>
          {NAV_LINK_ITEMS.map(({ label, path, requiresExactMatch }) => (
            <li key={label}>
              <Link
                variant="unstyled"
                href={path}
                requiresExactMatch={requiresExactMatch}
                className="relative inline-block px-2.5 text-fg-subtle/80 hocus-visible:text-fg"
                activeClassName="text-fg group"
              >
                {({ isActive, isChildActive }) => (
                  <span className="relative">
                    {label}
                    {(isActive || (!requiresExactMatch && isChildActive)) && (
                      <motion.div
                        className="absolute top-[1.575rem] z-[1] h-[2px] w-full bg-fg"
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
