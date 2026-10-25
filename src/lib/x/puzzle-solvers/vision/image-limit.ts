/**
 * The largest decoded JPEG a request may carry. The endpoint may refuse a larger one after the
 * admission is spent, so the browser re-encodes until it fits. Zod-free so the Worker can import it.
 *
 * The cap keeps a request within the Workers Free plan's 10 ms of CPU, past which an isolate gets
 * error 1102: a local replay took about 4.5 ms at this size. Check Workers Logs `cpuTime` on the
 * largest reads before raising it or changing image preparation.
 */
export const MAX_IMAGE_BYTES = 1024 * 1024
