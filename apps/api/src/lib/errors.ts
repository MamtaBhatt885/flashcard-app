import type { FieldErrors } from '@flashcards/shared';

/** Errors the service layer throws. The error handler maps them to HTTP responses. */
export class AppError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly details?: FieldErrors,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class NotFoundError extends AppError {
  constructor(what = 'Resource') {
    super(404, `${what} not found`);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Not signed in') {
    super(401, message);
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(409, message);
  }
}

export class BadRequestError extends AppError {
  constructor(message: string, details?: FieldErrors) {
    super(400, message, details);
  }
}
