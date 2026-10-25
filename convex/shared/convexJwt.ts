/**
 * Fixed rather than configured: the signing key tells deployments apart, and a value that drifted
 * between the Worker and Convex would fail every sign-in with nothing to say why.
 */
export const CONVEX_JWT_ISSUER = 'https://garvitpahal.com'

export const CONVEX_JWT_AUDIENCE = 'convex'
