const fetch = require('node-fetch');

exports.upload = async function upload(message, type, time, suffix, buffer) { // eslint-disable-line max-params
  const body = JSON.stringify({ message, content: buffer.toString('base64') });
  const path = `content/${type}/${time}${suffix}`;

  console.log('UPLOADING FILE:', path); // eslint-disable-line

  const url = `https://api.github.com/repos/qubyte/qubyte-codes/contents/${path}`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${Buffer.from(`qubyte:${process.env.GITHUB_TOKEN}`).toString('base64')}`
    },
    body
  });

  if (!res.ok) {
    console.error(`Unexpected response from GitHub: ${await res.text()}`);
    throw new Error(`Unexpected response from GitHub: ${res.status}`);
  }

  const result = await res.json();

  console.log('Uploaded', result.content.html_url);

  return result;
};
