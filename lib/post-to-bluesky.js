// @ts-check

export default async function post({ endpoint, body, blueskyAccessToken, headers = {} }) {
  const res = await fetch(new URL(endpoint, 'https://bsky.social'), {
    headers: { authorization: `Bearer ${blueskyAccessToken}`, ...headers },
    method: 'POST',
    body
  });

  if (!res.ok) {
    throw new Error(`Unexpected status from bluesky: ${res.status}: ${await res.text()}`);
  }

  return res.json();
}
