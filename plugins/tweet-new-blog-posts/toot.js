import fetch from 'node-fetch';

export default async function toot(status) {
  const res = await fetch(new URL('/api/v1/statuses', process.env.MASTODON_BASE_URL), {
    headers: {
      authorization: `Bearer ${process.env.MASTODON_ACCESS_TOKEN}`
    },
    method: 'POST',
    body: new URLSearchParams({ status })
  });

  if (!res.ok) {
    throw new Error(`Unexpected status from mastodon: ${res.status}`);
  }
}
