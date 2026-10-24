export class DomainError extends Error {
  constructor(public code: string, message: string, public status = 409, public retryable = false) { super(message); }
}
