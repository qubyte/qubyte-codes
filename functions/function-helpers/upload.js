// @ts-check

import { HttpError } from './http-error.js';
import { getEnvVar } from './get-env-var.js';

function buildAuthHeaderVal() {
  return `Basic ${Buffer.from(`qubyte:${getEnvVar('GITHUB_TOKEN')}`).toString('base64')}`;
}

export async function upload(message, type, filename, buffer) {
  console.log('UPLOADING FILE:', type, filename);

  const res = await fetch(`https://api.github.com/repos/qubyte/qubyte-codes/contents/content/${type}/${filename}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: buildAuthHeaderVal() },
    body: JSON.stringify({ message, content: buffer.toString('base64') })
  });

  if (!res.ok) {
    throw new HttpError(`Unexpected response from GitHub: ${res.status}`, { status: 502 });
  }

  const result = await res.json();

  console.log('Uploaded:', result?.content?.html_url);

  return result;
}
