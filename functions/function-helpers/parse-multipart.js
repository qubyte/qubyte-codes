// @ts-check

import { Readable } from 'node:stream';
import busboy from 'busboy';

/**
 * @param {Request} req
 * @returns {Promise<{files: Record<string, {filename: string|undefined, type: string, content: Buffer}>, [propName: string]: any}>}
 */
export function parseMultipart(req) {
  console.log('In parseMultipart');

  const body = req.body;

  if (!req.body) {
    return Promise.resolve({ files: {} });
  }

  const headers = Object.fromEntries(req.headers.entries());

  return new Promise((resolve, reject) => {
    const bb = busboy({ headers });

    /** @type {Record<string, {filename: string|undefined, type: string, content: Buffer}>} */
    const files = {};

    /** @type {Record<string, string>} */
    const fields = {};

    bb.on('file', async (name, filestream, info) => {
      console.log('file:', name, info);

      try {
        const chunks = await filestream.toArray();

        files[name] = {
          filename: info.filename,
          type: info.mimeType,
          content: Buffer.concat(chunks)
        };
      } catch (error) {
        reject(error);
      }
    });

    bb.on('field', (field, value) => {
      console.log('field:', field, value);

      const normalizedfield = field.endsWith('[]') ? field.slice(0, -2) : field;

      if (value && !Object.prototype.hasOwnProperty.call(fields, normalizedfield)) {
        fields[normalizedfield] = value;
      }
    });

    bb.on('error', reject);

    bb.on('close', () => {
      resolve({ ...fields, files });
    });

    Readable.fromWeb(/** @type {import('node:stream/web').ReadableStream} */ (body)).pipe(bb);
  });
}
