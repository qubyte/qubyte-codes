import { checkAuth } from './function-helpers/check-auth.js';
import { responseHeaders } from './function-helpers/response-headers.js';
import { parseMultipart } from './function-helpers/parse-multipart.js';
import { uploadImage } from './function-helpers/upload-image.js';

export async function handler(event) {
  console.log('GOT REQUEST:', {
    headers: { ...event.headers, authorization: '[redacted]' },
    length: event.body.length,
    isBase64Encoded: event.isBase64Encoded
  });

  try {
    await checkAuth(event.headers);
  } catch (e) {
    console.error(e.stack);
    return { statusCode: 401, body: 'Not authorized.' };
  }

  const parsed = await parseMultipart(event.headers, event.body, event.isBase64Encoded);
  const fileKeys = Object.keys(parsed.files);

  console.log('PARSED:', fileKeys);

  if (!fileKeys.length) {
    console.warn('No files found.');
    return { statusCode: 400, body: 'No files found.' };
  }

  if (fileKeys.length > 1) {
    console.warn(`Unexpected number of file keys: ${fileKeys}`);
  }

  const photo = parsed.files[fileKeys[0]];

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
}
