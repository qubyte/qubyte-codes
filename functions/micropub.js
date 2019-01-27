'use strict';

const { request } = require('https');

function consumeResponse(res) {
  const chunks = [];

  function onData(d) {
    chunks.push(d);
  }

  return new Promise((resolve, reject) => {
    function onError(error) {
      res.removeListener('data', onData);
      res.removeListener('error', onError);
      res.removeListener('end', onEnd);

      reject(error);
    }

    function onEnd() {
      res.removeListener('data', onData);
      res.removeListener('error', onError);
      res.removeListener('end', onEnd);

      try {
        resolve(JSON.parse(Buffer.concat(chunks)));
      } catch (e) {
        reject(e);
      }
    }

    res.on('data', onData);
    res.on('error', onError);
    res.on('end', onEnd);
  });
}

function checkAuth(Authorization) {
  const options = {
    host: 'tokens.indieauth.com',
    path: '/token',
    headers: {
      Accept: 'application/json',
      Authorization,
      'User-Agent': 'nodejs-micropub-endpoint'
    }
  };

  return new Promise((resolve, reject) => {
    const req = request(options)
      .on('res', onRes)
      .on('error', onError)
      .end();

    async function onRes(res) {
      req.removeListener('res', onRes);
      req.removeListener('error', onError);

      let body;

      try {
        body = await consumeResponse(res);
      } catch (e) {
        console.error(e); // eslint-disable-line no-console
        return reject(e);
      }

      if (body.me !== 'https://qubyte.codes/') {
        console.error('Not authorized.'); // eslint-disable-line no-console
        return reject(new Error('Not authorized.'));
      }

      if (!(body.scope.includes('create') || body.scope.includes('post'))) {
        console.error('Not an acceptable scope.'); // eslint-disable-line no-console
        return reject(new Error('Not an acceptable scope.'));
      }

      console.log('Authorized'); // eslint-disable-line no-console
      resolve();
    }

    function onError(error) {
      req.removeListener('res', onRes);
      req.removeListener('error', onError);

      reject(error);
    }
  });
}

function createFile(message, content) {
  const body = JSON.stringify({ message, content });

  console.log('CREATING FILE:', body); // eslint-disable-line

  const options = {
    method: 'PUT',
    host: 'api.github.com',
    path: `/repos/qubyte/qubyte-codes/contents/src/notes/${Date.now()}`,
    auth: `qubyte:${process.env.GITHUB_TOKEN}`,
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body),
      'User-Agent': 'nodejs-micropub-endpoint'
    }
  };

  return new Promise((resolve, reject) => {
    const req = request(options)
      .on('res', onRes)
      .on('error', onError)
      .end(body);

    async function onRes(res) {
      req.removeListener('res', onRes);
      req.removeListener('error', onError);

      let body;

      try {
        body = await consumeResponse(res);
      } catch (e) {
        return reject(e);
      }

      if (res.statusCode === 201) {
        return resolve();
      }

      console.log(body); // eslint-disable-line

      reject(new Error(`Unexpected status from GitHub ${res.statusCode}.`));
    }

    function onError(error) {
      req.removeListener('res', onRes);
      req.removeListener('error', onError);

      reject(error);
    }
  });
}

exports.handler = async function (event, context, callback) {
  console.log('EVENT', event); // eslint-disable-line

  await checkAuth(event.headers.authorization);

  const syndications = [
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

  if (event.queryStringParameters.q === 'syndicate-to') {
    console.log('Responding to syndication query.'); // eslint-disable-line no-console
    return callback(null, {
      'syndicate-to': syndications
    });
  }

  if (event.queryStringParameters.q === 'config') {
    console.log('Responding to config query.'); // eslint-disable-line no-console
    return callback(null, {
      'syndicate-to': syndications
    });
  }

  if (!event.body) {
    console.log('Responding to empty body.'); // eslint-disable-line no-console
    return;
  }

  const encoded = event.isBase64Encoded ? event.body : Buffer.from(event.body).toString('base64');

  console.log('Creating note.'); // eslint-disable-line no-console
  await createFile('New note.', encoded);

  callback();
};
