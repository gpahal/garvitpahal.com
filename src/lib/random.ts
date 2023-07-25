const ALPHA_NUM_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
const ALPHA_NUM_CHARS_LEN = ALPHA_NUM_CHARS.length

export function generateRandomString(length: number): string {
  let result = ''
  let counter = 0
  while (counter < length) {
    result += ALPHA_NUM_CHARS.charAt(Math.floor(Math.random() * ALPHA_NUM_CHARS_LEN))
    counter += 1
  }
  return result
}
