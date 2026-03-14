export class AppError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number = 500,
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

/** 400 Bad Request */
export class BadRequestError extends AppError {
  constructor(message: string) {
    super(message, 400);
  }
}

/** 404 Not Found */
export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(`${resource} not found`, 404);
  }
}

/** 409 Conflict */
export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409);
  }
}

/** 422 Unprocessable Entity */
export class InsufficientFundsError extends AppError {
  constructor(message: string) {
    super(message, 422);
  }
}
