import { HttpError } from './http-error.js';
import { getEnvVars } from './get-env-vars.js';

const { GITHUB_TOKEN } = getEnvVars('URL');

export async function upload(message, type, filename, buffer) {
  const body = JSON.stringify({ message, content: buffer.toString('base64') });
  const path = `content/${type}/${filename}`;

  console.log('UPLOADING FILE:', path);

  const url = `https://api.github.com/repos/qubyte/qubyte-codes/contents/${path}`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${Buffer.from(`qubyte:${GITHUB_TOKEN}`).toString('base64')}`
    },
    body
  });

  if (!res.ok) {
    throw new HttpError(`Unexpected response from GitHub: ${res.status}`, { status: 502 });
  }

  const result = await res.json();

  console.log('Uploaded', result.content.html_url);

  return result;
}
