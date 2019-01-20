'use strict';

const { request } = require('https');
const OWNER = 'qubyte';
const REPO = 'qubyte-codes';
const PATH = 'src/notes';
const Authorization = `Basic ${Buffer.from(`${OWNER}:${process.env.GITHUB_TOKEN}`).toString('base64')}`;

function checkAuth(Authorization) {
  return new Promise((resolve, reject) => {
    const req = request('https://tokens.indieauth.com/token', {
      headers: {
        Accept: 'application/json',
        Authorization
      }
    });

    function reqOnError(error) {
      req.off('error', reqOnError);
      req.off('res', reqOnRes);

      reject(error);
    }

    function reqOnRes(res) {
      req.off('error', reqOnError);
      req.off('res', reqOnRes);

      const chunks = [];

      function resOnData(d) {
        chunks.push(d);
      }

      function resOnError(error) {
        res.off('data', resOnData);
        res.off('error', resOnError);
        res.off('end', resOnEnd);
        reject(error);
      }

      function resOnEnd() {
        res.off('data', resOnData);
        res.off('error', resOnError);
        res.off('end', resOnEnd);

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
      }

      res.on('data', resOnData);
      res.on('error', resOnError);
      res.on('end', resOnEnd);
    }

    req.on('error', reqOnError);
    req.on('res', reqOnRes);
  });
}

function createFile(message, content) {
  return new Promise((resolve, reject) => {
    const req = request(`https://api.github.com/repos/${OWNER}/${REPO}/contents/${PATH}/${Date.now()}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization },
      body: JSON.stringify({ message, content }) // TODO check base64 content
    });

    function reqOnError(error) {
      req.off('error', reqOnError);
      req.off('res', reqOnRes);
      reject(error);
    }

    function reqOnRes(res) {
      req.off('error', reqOnError);
      req.off('res', reqOnRes);

      if (res.statusCode !== 201) {
        reject(new Error(`Unexpected status from GitHub ${res.statusCode}.`));
      } else {
        resolve();
      }
    }

    req.on('error', reqOnError);
    req.on('res', reqOnRes);
  });
}

exports.handler = async function (event) {
  await checkAuth(event.headers.Authorization);

  const encoded = event.isBase64Encoded ? event.body : Buffer.from(event.body).toString('base64');

  await createFile('New note.', encoded);
};
