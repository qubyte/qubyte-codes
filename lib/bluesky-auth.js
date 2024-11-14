export default async function blueskyAuth(handle, appPassword) {
  const res = await fetch('https://bsky.social/xrpc/com.atproto.server.createSession', {
    headers: { 'content-type': 'application/json' },
    method: 'POST',
    body: JSON.stringify({ identifier: handle, password: appPassword })
  });

  return res.json();
}
