const busboy = require('busboy');

exports.parseMultipart = function parseMultipart(headers, body) {
  return new Promise((resolve, reject) => {
    const bb = busboy({ headers });
    const files = {};
    const fields = {};

    bb.on('file', (fieldname, filestream, filename, _transferEncoding, mimeType) => { // eslint-disable-line max-params
      const chunks = [];

      filestream.on('data', chunk => chunks.push(chunk));

      filestream.on('close', () => {
        files[fieldname] = {
          filename,
          type: mimeType,
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

    console.log(body);

    bb.write(body);
  });
};
