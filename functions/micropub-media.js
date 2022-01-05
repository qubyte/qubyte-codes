const { checkAuth } = require('./function-helpers/check-auth');
const { responseHeaders } = require('./function-helpers/response-headers');
const { parseMultipart } = require('./function-helpers/parse-multipart');
const { uploadImage } = require('./function-helpers/upload-image');

// eslint-disable-next-line max-statements
exports.handler = async function handler(event) {
  console.log('GOT REQUEST:', { ...event.headers, authorization: '[redacted]' });

  try {
    await checkAuth(event.headers);
  } catch (e) {
    console.error(e.stack);
    return { statusCode: 401, body: 'Not authorized.' };
  }

  const parsed = await parseMultipart(event.headers, event.body);
  console.log('parsed:', parsed);

  const fileKeys = Object.keys(parsed.files);
  fileKeys.sort();

  if (!fileKeys.length) {
    return { statusCode: 400, body: 'No files found.' };
  }

  if (fileKeys.length > 1) {
    console.warn(`Unexpected number of file keys: ${fileKeys}`);
  }

  const photo = parsed.files[fileKeys[0]];

  console.log('photo:', photo);

  if (!photo) {
    console.error('No photo.');
    return { statusCode: 400, body: 'No photo found.' };
  }

  const path = await uploadImage(photo);

  console.log('path', path);

  return {
    statusCode: 202,
    headers: responseHeaders({
      location: `${process.env.URL}${path}`,
      'content-type': 'application/json'
    }),
    body: JSON.stringify({ path })
  };
};
