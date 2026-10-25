import { describe, expect, it } from 'vitest'

import { isOwnerEmail } from './ownerEmail'

describe('isOwnerEmail', () => {
  it('matches the owner whatever the case or the stray whitespace', () => {
    expect(isOwnerEmail('owner@example.com', 'owner@example.com')).toBe(true)
    expect(isOwnerEmail('Owner@Example.COM', 'owner@example.com')).toBe(true)
    expect(isOwnerEmail(' owner@example.com ', 'owner@example.com')).toBe(true)
    expect(isOwnerEmail('owner@example.com', ' OWNER@example.com ')).toBe(true)
  })

  it('matches no other address', () => {
    expect(isOwnerEmail('someone@example.com', 'owner@example.com')).toBe(false)
    expect(isOwnerEmail('', 'owner@example.com')).toBe(false)
    // An identity with no email at all, which a JWT need not carry.
    expect(isOwnerEmail(undefined, 'owner@example.com')).toBe(false)
    // Not a prefix or a suffix match.
    expect(isOwnerEmail('owner@example.com.evil.test', 'owner@example.com')).toBe(false)
    expect(isOwnerEmail('notowner@example.com', 'owner@example.com')).toBe(false)
    // Only ASCII letters fold: Unicode would turn the Kelvin sign (U+212A) into `k`.
    expect(isOwnerEmail('\u{212A}ate@example.com', 'kate@example.com')).toBe(false)
    expect(isOwnerEmail('kate@example.com', '\u{212A}ate@example.com')).toBe(false)
  })

  it('matches nobody when no owner is set', () => {
    expect(isOwnerEmail('owner@example.com', undefined)).toBe(false)
    // Above all: an empty identity must not match an empty owner.
    expect(isOwnerEmail('', ' ')).toBe(false)
    expect(isOwnerEmail(undefined, undefined)).toBe(false)
  })
})
