export class HttpError extends Error {
  constructor(message, { status = 400, ...options } = {}) {
    super(message, options);
    this.status = status;
  }

  toResponseObject({ headers } = {}) {
    return new Response(this.message, { status: this.status, headers });
  }
}

/**
 * @param {Error} error
 * @param {String} defaultLogMessage
 */
export function handleError(error, defaultLogMessage, headers = {}) {
  if (error instanceof HttpError) {
    return error.toResponseObject({ headers });
  }

  console.error(defaultLogMessage, error);

  return new Response(`Unknown Error: ${error.message}`, { status: 500 });
}
