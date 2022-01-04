const { checkAuth } = require('./function-helpers/check-auth');
const { responseHeaders } = require('./function-helpers/response-headers');
const { parseMultipart } = require('./function-helpers/parse-multipart');
const { uploadImage } = require('./function-helpers/upload-image');

exports.handler = async function handler(event) {
  console.log('GOT REQUEST:', { ...event.headers, authorization: '[redacted]' });

  try {
    await checkAuth(event.headers);
  } catch (e) {
    console.error(e.stack);
    return { statusCode: 401, body: 'Not authorized.' };
  }

  const parsed = await parseMultipart(event.headers, event.body);
  const fileKeys = Object.keys(parsed.files);
  fileKeys.sort();

  if (!fileKeys.length) {
    return { statusCode: 400, body: 'No files found.' };
  }

  if (fileKeys.length > 1) {
    console.warn(`Unexpected number of file keys: ${fileKeys}`);
  }

  const media = fileKeys.flatMap(key => parsed.files[key]);
  const photo = media[0];

  if (!photo) {
    console.error('No photo.');
    return { statusCode: 400, body: 'No photo found.' };
  }

  const path = await uploadImage(photo);

  return {
    statusCode: 202,
    headers: responseHeaders({
      location: `${process.env.URL}${path}`,
      'content-type': 'application/json'
    }),
    body: JSON.stringify({ path })
  };
};
