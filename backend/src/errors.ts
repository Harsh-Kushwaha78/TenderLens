export const ERROR_CODES = [
  'VALIDATION_ERROR', 'BAD_REQUEST', 'NOT_FOUND', 'INVALID_STATUS_TRANSITION', 'CONFLICT',
  'UNSUPPORTED_CHARACTERS', 'DOCUMENT_GENERATION_FAILED', 'SERVICE_UNAVAILABLE', 'INTERNAL_ERROR',
] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];

export interface ErrorDetail {
  field?: string;
  message: string;
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: ErrorCode,
    message: string,
    public readonly details: ErrorDetail[] = [],
  ) {
    super(message);
  }
}

export const validationError = (details: ErrorDetail[], message = 'Request validation failed.') =>
  new ApiError(400, 'VALIDATION_ERROR', message, details);
export const notFound = (message = 'Project not found.') => new ApiError(404, 'NOT_FOUND', message);
