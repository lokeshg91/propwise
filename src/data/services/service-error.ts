export type ServiceErrorCode = 'not-found' | 'conflict' | 'invalid'

/** Error raised by data services. `field` points at the offending input, if any. */
export class ServiceError extends Error {
  readonly code: ServiceErrorCode
  readonly field: string | undefined

  constructor(code: ServiceErrorCode, message: string, field?: string) {
    super(message)
    this.name = 'ServiceError'
    this.code = code
    this.field = field
  }
}

export const isServiceError = (error: unknown): error is ServiceError => error instanceof ServiceError
