import { expect, test } from 'vitest'

import { SOCIAL_LINKS } from './site'
import { personJsonLd } from './structured-data'

test('describes the person with every profile but email, and the resume, as script-safe JSON', () => {
  const json = personJsonLd(new URL('https://example.com'))
  expect(json).not.toContain('<')
  const person = JSON.parse(json) as Record<string, unknown>
  expect(person).toMatchObject({
    '@type': 'Person',
    url: 'https://example.com',
    subjectOf: { url: 'https://example.com/docs/resume.pdf' },
  })
  const profiles = Object.values(SOCIAL_LINKS)
    .map(({ href }) => href)
    .filter((href) => !href.startsWith('mailto:'))
  expect(person.sameAs).toEqual(profiles)
})
