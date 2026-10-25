import { createApiGate } from '@/lib/server/api-gate'
import { ownerTokenFor } from '@/lib/server/owner-token'

export const onRequest = createApiGate({ ownerTokenFor })
