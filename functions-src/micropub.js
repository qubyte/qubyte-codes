'use strict';

const fetch = require('node-fetch');

const OWNER = 'qubyte';
const REPO = 'qubyte-codes';
const PATH = 'src/notes';
const Authorization = `Basic ${Buffer.from(`${OWNER}:${process.env.GITHUB_TOKEN}`).toString('base64')}`;

async function createFile(message, content) {
  const res = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/contents/${PATH}/${Date.now()}`, {
    method: 'PUT',
    body: JSON.stringify({ message, content }), // TODO check base64 content
    headers: { 'Content-Type': 'application/json', Authorization }
  });

  if (!res.ok) {
    throw new Error(`Unexpected status from GitHub: ${res.status}.`);
  }
}

exports.handler = async function (event, context, callback) {
  const tokenCheckRes = await fetch('https://tokens.indieauth.com/token', {
    headers: {
      Accept: 'application/json',
      Authorization: event.headers.Authorization
    }
  });

  if (!tokenCheckRes.ok) {
    return callback(new Error(`Unexpected status from tokens.indieauth.com: ${tokenCheckRes.status}.`));
  }

  const tokenCheckBody = await tokenCheckRes.json();

  if (tokenCheckBody.me !== 'https://qubyte.codes/') {
    return callback(new Error('Not authorized.'));
  }

  if (!tokenCheckBody.scope.includes('create')) {
    return callback(new Error('Not authorized to post.'));
  }

  const encoded = event.isBase64Encoded ? event.body : Buffer.from(event.body).toString('base64');

  let createFileRes;

  try {
    createFileRes = await createFile('New note.', encoded);
  } catch (e) {
    return callback(e);
  }

  if (!createFileRes.ok) {
    return callback(new Error(`Unexpected status from tokens.indieauth.com: ${tokenCheckRes.status}.`));
  }
};
