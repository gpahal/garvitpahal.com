import clsx from "clsx";

import { isHrefActive } from "~/lib/url";

import type { AnchorHTMLAttributes, DetailedHTMLProps } from "react";

export type NavLinkProps = DetailedHTMLProps<AnchorHTMLAttributes<HTMLAnchorElement>, HTMLAnchorElement> & {
  currentUrl: URL;
};

export default function NavLink({ currentUrl, href, className, children, ...rest }: NavLinkProps) {
  const isActive = isHrefActive(currentUrl, href);

  return (
    <a
      href={href}
      className={clsx(
        {
          "font-semibold text-gray-900 dark:text-gray-200": isActive,
          "font-normal text-gray-500 dark:text-gray-300": !isActive,
        },
        "rounded-lg p-1 px-3 py-2 transition-all hover:bg-gray-200 dark:hover:bg-gray-800",
        className,
      )}
      {...rest}
    >
      {children}
    </a>
  );
}
