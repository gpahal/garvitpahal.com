import clsx from "clsx";

import type { ReactNode } from "react";

type SocialLinkProps = {
  title: string;
  href: string;
  className?: string;
  svgInner: ReactNode;
  viewBox: string;
  svgClassName?: string;
};

function SocialLink({ title, href, className, svgInner, viewBox, svgClassName }: SocialLinkProps) {
  return (
    <a
      href={href}
      className={clsx(
        "relative inline-flex items-center rounded-xl border-2 border-transparent p-2 text-base text-gray-400 hover:text-white dark:text-gray-500 dark:hover:text-white",
        "after:absolute after:left-0 after:right-0 after:top-0 after:bottom-0 after:-z-10 after:my-0 after:-mx-1.5 after:origin-bottom after:scale-0 after:transform after:rounded-xl after:border after:border-transparent after:transition",
        "after:hover:scale-100",
        className,
      )}
    >
      <svg
        role="img"
        xmlns="http://www.w3.org/2000/svg"
        viewBox={viewBox}
        fill="currentColor"
        className={clsx("h-6 w-6 flex-shrink-0", svgClassName)}
      >
        <title>{title}</title>
        {svgInner}
      </svg>
    </a>
  );
}

export default function SocialLinks() {
  return (
    <div className="-ml-2 flex flex-row flex-wrap items-center">
      <SocialLink
        title="Twitter"
        href="https://twitter.com/g10pahal"
        className="after:bg-[#1da1f2] after:dark:bg-[#1da1f2]"
        svgInner={
          <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z" />
        }
        viewBox="0 0 24 24"
      />
      <SocialLink
        title="GitHub"
        href="https://github.com/gpahal"
        className="after:bg-[#181717] after:dark:bg-[#333333]"
        svgInner={
          <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
        }
        viewBox="0 0 24 24"
      />
      <SocialLink
        title="LinkedIn"
        href="https://www.linkedin.com/in/gpahal/"
        className="after:bg-[#0a66c2] after:dark:bg-[#0a66c2]"
        svgInner={
          <g xmlns="http://www.w3.org/2000/svg">
            <path d="M72.16,99.73H9.927c-2.762,0-5,2.239-5,5v199.928c0,2.762,2.238,5,5,5H72.16c2.762,0,5-2.238,5-5V104.73   C77.16,101.969,74.922,99.73,72.16,99.73z" />
            <path d="M41.066,0.341C18.422,0.341,0,18.743,0,41.362C0,63.991,18.422,82.4,41.066,82.4   c22.626,0,41.033-18.41,41.033-41.038C82.1,18.743,63.692,0.341,41.066,0.341z" />
            <path d="M230.454,94.761c-24.995,0-43.472,10.745-54.679,22.954V104.73c0-2.761-2.238-5-5-5h-59.599   c-2.762,0-5,2.239-5,5v199.928c0,2.762,2.238,5,5,5h62.097c2.762,0,5-2.238,5-5v-98.918c0-33.333,9.054-46.319,32.29-46.319   c25.306,0,27.317,20.818,27.317,48.034v97.204c0,2.762,2.238,5,5,5H305c2.762,0,5-2.238,5-5V194.995   C310,145.43,300.549,94.761,230.454,94.761z" />
          </g>
        }
        viewBox="0 0 325 325"
        svgClassName="-mt-0.5"
      />
    </div>
  );
}
