import fetch from 'node-fetch';

// These environment variables must be available in environments which use this
// function:
// - MASTODON_BASE_URL
// - MASTODON_ACCESS_TOKEN

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
