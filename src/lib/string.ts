export function stripPrefix(s: string, prefix: string): string {
  return s.startsWith(prefix) ? s.slice(prefix.length) : s;
}

export function stripSuffix(s: string, suffix: string): string {
  return s.endsWith(suffix) ? s.slice(0, s.length - suffix.length) : s;
}

export function trimStart(s: string, chars?: string): string {
  if (!chars) {
    return s.trimStart();
  }
  return s.replace(new RegExp(`^[${chars}]+`), "");
}

export function trimEnd(s: string, chars?: string): string {
  if (!chars) {
    return s.trimEnd();
  }
  return s.replace(new RegExp(`[${chars}]+$`), "");
}

export function trim(s: string, chars?: string): string {
  return trimEnd(trimStart(s, chars), chars);
}

export function arrayToSlug(slug: string[]): string {
  return slug
    .map((s) => trim(s))
    .filter((s) => s !== "")
    .join("/");
}

export function slugToArray(slug: string): string[] {
  return trim(trim(slug), "/")
    .split("/")
    .map((s) => trim(s))
    .filter((s) => s !== "");
}

export function sanitizeSlugArray(slugArr: string[]): string[] {
  return slugArr.map((s) => trim(s)).filter((s) => s !== "");
}
