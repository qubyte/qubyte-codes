export default async function addHtmlSecurityHeaders(_, context) {
  /** @type Response */
  const response = await context.next();
  const { headers } = response;
  const type = headers.get('content-type');

  if (!type || type.startsWith('text/html')) {
    headers.set('strict-transport-security', 'max-age=31536000; includeSubDomains; preload');
    headers.set('x-frame-options', 'SAMEORIGIN');
    headers.set('x-xss-protection', '1');
    headers.set('x-content-type-options', 'nosniff');
    headers.set(
      'content-security-policy',
      'default-src \'self\'; style-src \'self\'; img-src *; child-src https://www.youtube-nocookie.com \'self\'; frame-src https://www.youtube-nocookie.com \'self\';' // eslint-disable-line max-len
    );
    headers.set('referrer-policy', 'strict-origin-when-cross-origin');
    headers.set('cache-control', 'no-cache');
    headers.set(
      'permissions-policy',
      'accelerometer=(self), ambient-light-sensor=(self), camera=(self), fullscreen=(self), gyroscope=(self), magnetometer=(self), microphone=(self), midi=(self), picture-in-picture=(), sync-xhr=(), usb=(self), interest-cohort=()' // eslint-disable-line max-len
    );
  }

  return response;
}