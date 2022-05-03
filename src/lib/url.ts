import path from "path";

import { trim } from "~lib/string";

/**
 * Handles:
 * - //
 * - http://
 * - https://
 * - ftp://
 * - ... and other possible protocols
 */
const ABSOLUTE_PATH_REGEX = /^(?:[a-zA-Z]+:)?\/\//;

export function isAbsoluteUrl(urlString: string): boolean {
  return !!ABSOLUTE_PATH_REGEX.exec(urlString) || (!urlString.startsWith("/") && path.isAbsolute(urlString));
}

export function getAbsoluteUrl(currentUrl: URL, urlString: string): URL {
  if (isAbsoluteUrl(urlString)) {
    return new URL(urlString);
  }
  if (!urlString.startsWith("/")) {
    urlString = `/${urlString}`;
  }
  return new URL(`${currentUrl.origin}${urlString}`);
}

export function isHrefActive(currentUrl: URL, href?: string) {
  const currentPathname = trim(currentUrl.pathname, "/");
  const hrefPathname = trim(getAbsoluteUrl(currentUrl, href || "").pathname, "/");
  return hrefPathname ? currentPathname.startsWith(hrefPathname) : currentPathname === hrefPathname;
}
