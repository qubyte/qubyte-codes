import { Readable } from 'node:stream';
import busboy from 'busboy';

/** @param {Request} req  */
export function parseMultipart(req) {
  console.log('In parseMultipart');

  const headers = Object.fromEntries(req.headers.entries());

  return new Promise((resolve, reject) => {
    const bb = busboy({ headers });
    const files = {};
    const fields = {};

    bb.on('file', async (name, filestream, info) => { // eslint-disable-line max-params
      console.log('file:', name, info);

      const chunks = await filestream.toArray();

      files[name] = {
        filename: info.filename,
        type: info.mime,
        content: Buffer.concat(chunks)
      };
    });

    bb.on('field', (field, value) => {
      console.log('field:', field, value);

      const normalizedfield = field.endsWith('[]') ? field.slice(0, -2) : field;

      if (value && !Object.prototype.hasOwnProperty.call(fields, normalizedfield)) {
        fields[normalizedfield] = value;
      }
    });

    bb.on('error', reject);
    bb.on('close', () => resolve({ files, ...fields }));

    Readable.fromWeb(req.body.getReader()).pipe(bb);
  });
}
