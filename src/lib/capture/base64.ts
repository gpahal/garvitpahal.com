/** Chunked so a large image does not blow the argument limit of a single spread call. */
const CHUNK_SIZE = 0x80_00

/** Base64 for a JSON body, without a data-URL prefix. */
export async function blobToBase64(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer()
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let offset = 0; offset < bytes.length; offset += CHUNK_SIZE) {
    binary += String.fromCodePoint(...bytes.subarray(offset, offset + CHUNK_SIZE))
  }
  return btoa(binary)
}
