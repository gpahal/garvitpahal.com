import { describe, expect, it } from 'vitest'

import { pdfFacts } from './resume-pdf'

describe('resume PDF checks', () => {
  it('counts pages but not the page tree, and Type 3 fonts', () => {
    const pdf = new TextEncoder().encode(
      '<< /Type /Pages /Kids [3 0 R 4 0 R] >> << /Type /Page >> << /Type/Page >> ' +
        '<< /Type /Font /Subtype /Type3 >> << /Type /Font /Subtype /TrueType >>',
    )
    expect(pdfFacts(pdf)).toEqual({ pages: 2, type3Fonts: 1 })
  })
})
