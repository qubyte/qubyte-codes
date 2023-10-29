import { checkAuth } from './function-helpers/check-auth.js';
import { responseHeaders } from './function-helpers/response-headers.js';
import { parseMultipart } from './function-helpers/parse-multipart.js';
import { uploadImage } from './function-helpers/upload-image.js';
import { handleError } from './function-helpers/http-error.js';
import { getEnvVars } from './function-helpers/get-env-vars.js';

const { URL: BASE_URL } = getEnvVars('URL');

/** @param {Request} req */
// eslint-disable-next-line max-statements
export default async function handler(req) {
  console.log('GOT REQUEST');

  try {
    await checkAuth(req);
  } catch (e) {
    return handleError(e, 'Error checking auth.', responseHeaders());
  }

  const contentType = req.headers.get('content-type');

  // This is not to spec, but Apple Shortcuts have broken support for multipart
  // form uploads.
  if (contentType?.startsWith('image/')) {
    console.log('PLAIN FILE UPLOAD OF ', contentType);

    const body = Buffer.from(await req.arrayBuffer());
    const path = await uploadImage({ content: body, type: contentType });

    console.log('path', path);

    return Response.json(
      { path },
      { headers: responseHeaders({ location: `${BASE_URL}${path}` }) }
    );
  }

  console.log('BEFORE PARSING.');

  let parsed;

  try {
    parsed = await parseMultipart(req);
  } catch (e) {
    return handleError(e, 'Error parsing multipart body.');
  }

  const fileKeys = Object.keys(parsed.files);

  console.log('PARSED:', fileKeys);

  if (!fileKeys.length) {
    console.log('No files found.');
    return new Response('No files found.', { status: 400 });
  }

  if (fileKeys.length > 1) {
    console.log('Unexpected number of file keys:', fileKeys);
  }

  const photo = parsed.files[fileKeys[0]];

  if (!photo) {
    console.error('No photo.');
    return new Response('No photo found.', { status: 400 });
  }

  const path = await uploadImage(photo);

  console.log('path', path);

  return Response.json(
    { path },
    {
      status: 202,
      headers: responseHeaders({ location: `${BASE_URL}${path}` })
    }
  );
}
