interface V8ErrorConstructor {
  captureStackTrace(targetObject: object, constructorOpt?: unknown): void;
}

/**
 * Custom application error class representing operational and HTTP errors.
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: unknown;
  public readonly externalUrl?: string;
  public readonly isOperational: boolean;

  constructor(
    message: string,
    statusCode = 500,
    code = "INTERNAL_SERVER_ERROR",
    details?: unknown,
    externalUrl?: string
  ) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.externalUrl = externalUrl;
    this.isOperational = true;

    // Restore prototype chain
    Object.setPrototypeOf(this, new.target.prototype);

    if ("captureStackTrace" in Error) {
      (Error as unknown as V8ErrorConstructor).captureStackTrace(this, this.constructor);
    }
  }

  public static badRequest(message: string, code = "BAD_REQUEST", details?: unknown): AppError {
    return new AppError(message, 400, code, details);
  }

  public static notFound(message = "Resource not found", code = "NOT_FOUND"): AppError {
    return new AppError(message, 404, code);
  }

  public static externalChapter(
    message = "This chapter is available through an external publisher and does not contain hosted page images.",
    externalUrl?: string
  ): AppError {
    return new AppError(message, 409, "SOURCE_CHAPTER_EXTERNAL_ONLY", undefined, externalUrl);
  }

  public static internal(message = "Internal server error", code = "INTERNAL_SERVER_ERROR"): AppError {
    return new AppError(message, 500, code);
  }
}
