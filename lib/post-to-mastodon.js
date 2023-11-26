// @ts-check

export default async function post({ endpoint, body, mastodonBaseUrl, mastodonAccessToken, headers = {} }) {
  const res = await fetch(new URL(endpoint, mastodonBaseUrl), {
    headers: { authorization: `Bearer ${mastodonAccessToken}`, ...headers },
    method: 'POST',
    body
  });

  if (!res.ok) {
    throw new Error(`Unexpected status from mastodon: ${res.status}: ${await res.text()}`);
  }

  return res.json();
}
