import { parse } from 'date-fns'
import { z } from 'zod'

export const SCHEMA_DATE = z.string().transform((dateStr, ctx) => {
  try {
    const parsed = parse(dateStr, 'dd/MM/yyyy', new Date()).getTime()
    if (!parsed || parsed <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Invalid date - use format 13/02/2022',
      })
      return z.NEVER
    }
    return parsed
  } catch {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Invalid date - use format 13/02/2022',
    })
    return z.NEVER
  }
})
