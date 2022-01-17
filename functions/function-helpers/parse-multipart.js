import busboy from 'busboy';

export function parseMultipart(headers, body, isBase64Encoded) {
  return new Promise((resolve, reject) => {
    const bb = busboy({ headers });
    const files = {};
    const fields = {};

    bb.on('file', (name, filestream, info) => { // eslint-disable-line max-params
      const chunks = [];

      filestream.on('data', chunk => chunks.push(chunk));

      filestream.on('close', () => {
        files[name] = {
          filename: info.filename,
          type: info.mime,
          content: Buffer.concat(chunks)
        };
      });
    });

    bb.on('field', (field, value) => {
      const normalizedfield = field.endsWith('[]') ? field.slice(0, -2) : field;

      if (value && !Object.prototype.hasOwnProperty.call(fields, normalizedfield)) {
        fields[normalizedfield] = value;
      }
    });

    bb.on('error', reject);
    bb.on('finish', () => resolve({ files, ...fields }));

    bb.write(isBase64Encoded ? Buffer.from(body, 'base64') : body);
  });
}
