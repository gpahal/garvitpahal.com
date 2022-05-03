import NavLink from "~components/nav-link";

import type { ReactNode } from "react";

export type NavItemData = {
  name: string;
  href: string;
};

const navItems: NavItemData[] = [
  { name: "Home", href: "/" },
  { name: "Blog", href: "/blog" },
];

type ContainerProps = {
  currentUrl: URL;
  children?: ReactNode | undefined;
};

export default function Container({ currentUrl, children }: ContainerProps) {
  return (
    <div>
      <div className="flex flex-col justify-center px-8">
        <nav className="relative mx-auto flex w-full max-w-2xl items-center justify-between border-gray-200 bg-opacity-60 pt-8 pb-8 text-gray-900 dark:border-gray-700 dark:text-gray-100 sm:pb-16">
          <div className="ml-[-0.60rem]">
            {navItems.map((link) => (
              <NavLink key={link.name} currentUrl={currentUrl} href={link.href}>
                {link.name}
              </NavLink>
            ))}
          </div>
        </nav>
      </div>
      <main id="skip" className="flex flex-col justify-center px-8">
        {children}
      </main>
    </div>
  );
}
