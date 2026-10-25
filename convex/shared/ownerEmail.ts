/**
 * A to Z alone: `toLowerCase` folds letters such as the Kelvin sign (U+212A) into `k`, which would
 * let a different address match.
 */
function asciiLowerCase(value: string): string {
  return value.replaceAll(/[A-Z]/g, (letter) => letter.toLowerCase())
}

/**
 * Shared by the Worker and Convex so they agree on the owner. Trimmed and compared ignoring ASCII
 * case, local part included, as providers treat it case-insensitively. An empty or missing owner
 * matches nobody, not even an empty candidate.
 */
export function isOwnerEmail(
  candidate: string | undefined,
  ownerEmail: string | undefined,
): boolean {
  const owner = asciiLowerCase(ownerEmail?.trim() ?? '')
  return owner !== '' && asciiLowerCase(candidate?.trim() ?? '') === owner
}
