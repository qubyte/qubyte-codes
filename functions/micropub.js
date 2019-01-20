'use strict';

const { request } = require('https');
const OWNER = 'qubyte';
const REPO = 'qubyte-codes';
const PATH = 'src/notes';
const Authorization = `Basic ${Buffer.from(`${OWNER}:${process.env.GITHUB_TOKEN}`).toString('base64')}`;

function checkAuth(Authorization) {
  const options = {
    host: 'tokens.indieauth.com',
    path: '/token',
    headers: {
      Accept: 'application/json',
      Authorization
    }
  };

  return new Promise((resolve, reject) => {
    request(options, res => {
      const chunks = [];

      res.on('data', d => chunks.push(d));
      res.on('error', reject);
      res.on('end', () => {
        let body;

        try {
          body = JSON.parse(Buffer.concat(chunks));
        } catch (e) {
          return reject(e);
        }

        if (body.me !== 'https://qubyte.codes/') {
          return reject(new Error('Not authorized.'));
        }

        if (!body.scope.includes('create')) {
          return reject(new Error('Not authorized to post.'));
        }

        resolve();
      });
    })
      .on('error', reject)
      .end();
  });
}

function createFile(message, content) {
  const body = JSON.stringify({ message, content }); // TODO check base64 content
  const options = {
    method: 'PUT',
    host: 'api.github.com',
    path: `/repos/${OWNER}/${REPO}/contents/${PATH}/${Date.now()}`,
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body),
      Authorization
    }
  };

  return new Promise((resolve, reject) => {
    request(options, res => {
      if (res.statusCode !== 201) {
        reject(new Error(`Unexpected status from GitHub ${res.statusCode}.`));
      } else {
        resolve();
      }
    })
      .on('error', reject)
      .end(body);
  });
}

exports.handler = async function (event) {
  console.log(event.headers) // eslint-disable-line
  await checkAuth(event.headers.Authorization);

  const encoded = event.isBase64Encoded ? event.body : Buffer.from(event.body).toString('base64');

  await createFile('New note.', encoded);
};
