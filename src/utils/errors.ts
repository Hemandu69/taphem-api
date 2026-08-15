/**
 * Custom application error class representing operational and HTTP errors.
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: unknown;
  public readonly isOperational: boolean;

  constructor(
    message: string,
    statusCode = 500,
    code = "INTERNAL_SERVER_ERROR",
    details?: unknown
  ) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = true;

    // Restore prototype chain
    Object.setPrototypeOf(this, new.target.prototype);
    Error.captureStackTrace(this, this.constructor);
  }

  public static badRequest(message: string, code = "BAD_REQUEST", details?: unknown): AppError {
    return new AppError(message, 400, code, details);
  }

  public static notFound(message = "Resource not found", code = "NOT_FOUND"): AppError {
    return new AppError(message, 404, code);
  }

  public static internal(message = "Internal server error", code = "INTERNAL_SERVER_ERROR"): AppError {
    return new AppError(message, 500, code);
  }
}
