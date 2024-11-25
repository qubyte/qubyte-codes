const createSessionUrl = 'https://bsky.social/xrpc/com.atproto.server.createSession';

export default async function blueskyAuth(handle, appPassword) {
  const res = await fetch(createSessionUrl, {
    headers: { 'content-type': 'application/json' },
    method: 'POST',
    body: JSON.stringify({ identifier: handle, password: appPassword })
  });

  if (!res.ok) {
    throw new Error(
      `Bluesky responded with an unexpected status: ${res.status} ${await res.text()}`
    );
  }

  return res.json();
}
