const { JSDOM } = require('jsdom');

const { checkAuth } = require('./function-helpers/check-auth');
const { parseMultipart } = require('./function-helpers/parse-multipart');
const { upload } = require('./function-helpers/upload');
const { uploadImage } = require('./function-helpers/upload-image');
const { responseHeaders } = require('./function-helpers/response-headers');

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
      uid: 'https://twitter.com/qubyte',
      name: 'qubyte on twitter',
      service: {
        name: 'Twitter',
        url: 'https://twitter.com/'
      },
      user: {
        name: 'qubyte',
        url: 'https://twitter.com/qubyte',
        photo: 'https://pbs.twimg.com/profile_images/958386895037267968/K7X2jWDU.jpg'
      }
    },
    {
      uid: 'https://mastodon.social/@qubyte',
      name: 'qubyte on mastodon.social',
      service: {
        name: 'Mastodon',
        url: 'https://mastodon.social/'
      },
      user: {
        name: '@qubyte',
        url: 'https://mastodon.social/@qubyte',
        photo: 'https://files.mastodon.social/accounts/avatars/000/034/232/original/19ce997f84ca75fe.png'
      }
    }
  ];
}

function convertQueryStringToObject(queryString) {
  const query = new URLSearchParams(queryString);
  const keys = new Set(query.keys());
  const properties = {};

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

async function createFile(message, type, data) {
  const time = Date.now();
  const buffer = Buffer.from(`${JSON.stringify(data, null, 2)}\n`);

  await upload(message, type, time, '.json', buffer);

  return `https://qubyte.codes/${type}/${time}`;
}

function parseBody(headers, body, isBase64Encoded) {
  const type = headers['content-type'];

  if (type.match(/multipart/)) {
    return parseMultipart(headers, body, isBase64Encoded);
  }

  if (type.match(/json/)) {
    return JSON.parse(body);
  }

  if (type.match(/x-www-form-urlencoded/)) {
    return convertQueryStringToObject(body);
  }

  throw new Error(`Unhandled MIME type: ${type}`);
}

exports.handler = async function handler(event) {
  /* eslint max-statements: off */
  /* eslint complexity: off */

  console.log('GOT REQUEST:', { ...event.headers, authorization: '[redacted]' });

  try {
    await checkAuth(event.headers);
  } catch (e) {
    console.error(e.stack);
    return { statusCode: 401, body: 'Not authorized.' };
  }

  if (event.queryStringParameters.q === 'syndicate-to' || event.queryStringParameters.q === 'config') {
    console.log(`Responding to ${event.queryStringParameters.q} query.`); // eslint-disable-line no-console

    return {
      statusCode: 200,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        'syndicate-to': syndications(),
        'media-endpoint': `${process.env.URL}/micropub-media`
      })
    };
  }

  let data;

  try {
    data = await parseBody(event.headers, event.body, event.isBase64Encoded);
  } catch (e) {
    console.error(e);
    return { statusCode: 400, headers: responseHeaders(), body: '' };
  }

  delete data.access_token; // quill

  console.log(JSON.stringify({ data }, null, 2));

  if (!Object.keys(data).length) {
    console.log('Responding to empty body.'); // eslint-disable-line no-console
    return { statusCode: 204, headers: responseHeaders(), body: '' };
  }

  let created;

  if (data?.properties['repost-of']) {
    data.name = await getTitle(data.properties['repost-of'][0]);
    created = await createFile('New link.', 'links', data);
  } else if (data?.properties['bookmark-of']) {
    created = await createFile('New link.', 'links', data);
  } else if (data?.properties['like-of']) {
    created = await createFile('New like.', 'likes', data);
  } else if (data?.properties['in-reply-to']) {
    data.name = await getTitle(data.properties['in-reply-to'][0]);
    created = await createFile('New Reply.', 'replies', data);
  } else if (data?.properties?.category?.includes('study-session')) {
    created = await createFile('New study session.', 'study-sessions', data);
  } else {
    // The default is a note, which I allow to have images.
    if (data.files && data.files.photo && data.files.photo.length) { // quill uses a photo field
      const uploadedImage = await uploadImage(data.files.photo[0]);

      delete data.files;

      data.photos = [uploadedImage];
    }
    created = await createFile('New note.', 'notes', data);
  }

  return { statusCode: 202, headers: responseHeaders({ location: created }), body: '' };
};
