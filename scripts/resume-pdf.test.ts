import { describe, expect, it } from 'vitest'

import { pdfFacts, withPhone } from './resume-pdf'

describe('resume PDF checks', () => {
  it('counts pages but not the page tree, and Type 3 fonts', () => {
    const pdf = new TextEncoder().encode(
      '<< /Type /Pages /Kids [3 0 R 4 0 R] >> << /Type /Page >> << /Type/Page >> ' +
        '<< /Type /Font /Subtype /Type3 >> << /Type /Font /Subtype /TrueType >>',
    )
    expect(pdfFacts(pdf)).toEqual({ pages: 2, type3Fonts: 1 })
  })

  it('fills the phone slot escaped, and refuses a page without one', () => {
    expect(withPhone('<p><span data-resume-phone></span></p>', '+91 <1>')).toBe(
      '<p><span data-resume-phone> · +91 &lt;1&gt;</span></p>',
    )
    expect(() => withPhone('<p></p>', '+91 1')).toThrow(/data-resume-phone/)
  })
})
