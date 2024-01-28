// @ts-check

export class HttpError extends Error {
  /**
   * @param {string} message
   * @param {object} options
   * @param {number} [options.status]
   * @param {Error} [options.cause]
   */
  constructor(message, { status = 400, cause } = {}) {
    super(message, { cause });
    this.status = status;
  }

  /** @param {Headers|null} headers */
  toResponseObject(headers) {
    const options = headers ? { status: this.status, headers } : { status: this.status };
    return new Response(this.message, options);
  }
}

/**
 * @param {Error} error
 * @param {String} defaultLogMessage
 * @param {Headers|null} headers
 */
export function handleError(error, defaultLogMessage, headers) {
  if (error instanceof HttpError) {
    return error.toResponseObject(headers);
  }

  console.error(defaultLogMessage, error);

  return new Response(`Unknown Error: ${error.message}`, { status: 500 });
}
