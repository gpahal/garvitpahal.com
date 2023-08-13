'use client'

import * as React from 'react'

import { LayoutGroup, motion } from 'framer-motion'

import logoLightImage from '@public/images/logo/logo-light.png'
import logoImage from '@public/images/logo/logo.png'

import { NAV_LINK_ITEMS } from '@/lib/nav'
import { Image } from '@/components/lib/image'
import { Link } from '@/components/lib/link'

export function Nav() {
  return (
    <LayoutGroup>
      <nav className="flex items-center justify-center">
        <ul className="relative mx-[-0.6rem] flex h-11 w-full items-center justify-end space-x-1 border-t border-neutral-6/80 py-1 pl-[2.425rem] pr-[0.75rem] tracking-tight sm:h-9 sm:w-auto sm:justify-center sm:rounded-full sm:border sm:pr-[1.125rem]">
          <li className="absolute left-[0.75rem] top-[0.475rem] opacity-90 sm:left-[0.2rem] sm:top-[0.165rem]">
            <Link href="/">
              <Image
                src={logoImage}
                alt="Garvit Pahal"
                data-theme="light"
                className="h-[1.8rem] w-[1.8rem] rounded-md sm:rounded-full"
                priority
              />
              <Image
                src={logoLightImage}
                alt="Garvit Pahal"
                data-theme="dark"
                className="h-[1.8rem] w-[1.8rem] rounded-md sm:rounded-full"
                priority
              />
            </Link>
          </li>
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
                        className="absolute top-[-0.675rem] z-[1] h-[2px] w-full bg-fg sm:top-[1.675rem]"
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
