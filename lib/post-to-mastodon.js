import fetch from 'node-fetch';

export default async function post(endpoint, body, headers = {}) {
  const res = await fetch(new URL(endpoint, process.env.MASTODON_BASE_URL), {
    headers: { authorization: `Bearer ${process.env.MASTODON_ACCESS_TOKEN}`, ...headers },
    method: 'POST',
    body
  });

  if (!res.ok) {
    throw new Error(`Unexpected status from mastodon: ${res.status}`);
  }

  return res.json();
}
