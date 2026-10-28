import { SITE_NAME, SITE_TAGLINE, SOCIAL_LINKS } from '@/lib/site'

/**
 * The home page's schema.org `Person`, so search engines tie the name to its profiles and resume.
 * The school repeats `src/content/resume/profile.yaml`.
 */
export function personJsonLd(site: URL): string {
  const person = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: SITE_NAME,
    url: new URL('/', site).href.replace(/\/$/, ''),
    image: new URL('/images/self/self-320x320.jpg', site).href,
    jobTitle: 'Software engineer',
    description: SITE_TAGLINE,
    alumniOf: { '@type': 'CollegeOrUniversity', name: 'Indian Institute of Technology Kanpur' },
    sameAs: [SOCIAL_LINKS.github.href, SOCIAL_LINKS.linkedin.href, SOCIAL_LINKS.x.href],
    subjectOf: {
      '@type': 'DigitalDocument',
      name: `${SITE_NAME} resume`,
      url: new URL('/docs/resume.pdf', site).href,
      encodingFormat: 'application/pdf',
    },
  }
  // So no value can close the script element the JSON sits in.
  return JSON.stringify(person).replaceAll('<', String.raw`\u003c`)
}
