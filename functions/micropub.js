import { STATUS_CODES } from 'http';
import { JSDOM } from 'jsdom';

import { checkAuth } from './function-helpers/check-auth.js';
import { parseMultipart } from './function-helpers/parse-multipart.js';
import { upload } from './function-helpers/upload.js';
import { uploadImage } from './function-helpers/upload-image.js';
import { responseHeaders } from './function-helpers/response-headers.js';
import { HttpError, handleError } from './function-helpers/http-error.js';
import { getEnvVar } from './function-helpers/get-env-var.js';

async function getTitle(url) {
  try {
    const dom = await JSDOM.fromURL(url);
    return dom.window.document.title;
  } catch (e) {
    return url;
  }
}

function syndications() {
  return [
    {
      uid: 'mastodon',
      name: 'qubyte on mastodon.social',
      service: {
        name: 'Mastodon',
        url: 'https://mastodon.social/'
      }
    }
  ];
}

/** @param {Request} req */
async function convertFormRequestToObject(req) {
  /** @type {Record<String, String>} */
  const properties = {};
  const query = await req.formData();
  const keys = new Set(query.keys());

  let type = 'h-entry';

  for (const key of keys) {
    const normalizedKey = key.endsWith('[]') ? key.slice(0, -2) : key;

    if (normalizedKey === 'h') {
      type = `h-${query.get(key)}`;
    } else {
      properties[normalizedKey] = query.getAll(key).filter(Boolean);
    }
  }

  return { type: [type], properties };
}

async function createFile(message, type, data, optionalFilename) {
  const time = data.published ? Date.parse(data.published) : Date.now();
  const buffer = Buffer.from(`${JSON.stringify(data, null, 2)}\n`);
  const filename = optionalFilename || `${time}.json`;

  console.log('Creating file:', filename, 'with content:', data);

  await upload(message, type, filename, buffer);

  return `https://qubyte.codes/${type}/${time}`;
}

// eslint-disable-next-line complexity
function mf2tojf2(mf2) {
  if (!mf2) {
    return undefined;
  }

  if (Object.prototype.toString.call(mf2) !== '[object Object]' || !mf2.type) {
    return mf2;
  }

  const jf2 = {};

  for (const [key, value] of Object.entries(mf2)) {
    if (key === 'type') {
      jf2.type = value[0].slice(2);
    } else if (key === 'properties') {
      for (const [pkey, pvalue] of Object.entries(value)) {
        if (!pvalue) {
          // Do nothing.
        } else if (Object.prototype.toString.call(pvalue) === '[object Object]') {
          jf2[pkey] = mf2tojf2(pvalue);
        } else if (Array.isArray(pvalue)) {
          if (pvalue.length) {
            jf2[pkey] = mf2tojf2(pvalue[0]);
          }
        } else if (pvalue.length > 1) {
          jf2[pkey] = pvalue.map(v => mf2tojf2(v));
        } else {
          jf2[pkey] = mf2tojf2(pvalue[0]);
        }
      }
    } else {
      jf2[key] = value[0];
    }
  }

  return jf2;
}

/** @param {Request} req */
async function parseBody(req) {
  const type = req.headers.get('content-type');

  let parsed = null;

  if (type.match(/multipart/)) {
    parsed = await parseMultipart(req);
  } else if (type.match(/json/)) {
    parsed = await req.json();
  } else if (type.match(/x-www-form-urlencoded/)) {
    parsed = await convertFormRequestToObject(req);
  } else {
    throw new HttpError(`Unhandled MIME type: ${type}`, { status: 400 });
  }

  parsed.properties.spoiler = [].concat(parsed.properties.spoiler || [])
    .map(s => s.trim())
    .filter(Boolean);

  return parsed;
}

async function determineTypeAndCreate(data) {
  const publishedDate = new Date();
  const filename = `${publishedDate.getTime()}.jf2.json`;
  const published = publishedDate.toISOString();

  if (data?.properties['repost-of']) {
    const name = await getTitle(data.properties['repost-of'][0]);
    return createFile('New link.', 'links', { ...mf2tojf2(data), name, published }, filename);
  }

  if (data?.properties['bookmark-of']) {
    return createFile('New link.', 'links', { ...mf2tojf2(data), published }, filename);
  }

  if (data?.properties['like-of']) {
    return createFile('New like.', 'likes', { ...mf2tojf2(data), published }, filename);
  }

  if (data?.properties['in-reply-to']) {
    const name = await getTitle(data.properties['in-reply-to'][0]);
    return createFile('New Reply.', 'replies', { ...mf2tojf2(data), name, published }, filename);
  }

  if (data?.properties?.category?.includes('study-session')) {
    return createFile('New study session.', 'study-sessions', { ...mf2tojf2(data), published }, filename);
  }

  // The default is a note, which I allow to have images.
  if (data?.files?.photo.length) { // quill uses a photo field
    const uploadedImage = await uploadImage(data.files.photo[0]);

    delete data.files;

    data.photos = [uploadedImage];
  }

  return createFile('New note.', 'notes', data);
}

/** @param {Request} req */
function isSyndicationsQuery(req) {
  const q = new URL(req.url).searchParams.get('q');

  return q === 'syndicate-to' || q === 'config';
}

/** @param {Request} req */
export default async function handler(req) {
  console.log('GOT REQUEST');

  try {
    await checkAuth(req);
  } catch (e) {
    return handleError(e, 'Error checking auth.');
  }

  if (isSyndicationsQuery(req)) {
    console.log('Responding to syndications query.');

    const baseUrl = getEnvVar('URL');

    return Response.json({
      'syndicate-to': syndications(),
      'media-endpoint': `${baseUrl}/functions/micropub-media`
    });
  }

  let data;

  try {
    data = await parseBody(req);
  } catch (e) {
    return handleError(e, 'Error parsing body.', responseHeaders());
  }

  delete data.access_token; // quill

  console.log(JSON.stringify({ data }, null, 2));

  if (!Object.keys(data).length) {
    console.log('Responding to empty body.');
    return new Response(null, { status: 204, headers: responseHeaders() });
  }

  const location = await determineTypeAndCreate(data);

  return new Response(STATUS_CODES[202], { status: 202, headers: responseHeaders({ location }) });
}

export const config = {
  path: '/functions/micropub'
};
