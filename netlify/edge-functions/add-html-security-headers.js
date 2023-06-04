const scriptSrcHashRegex = /^\s*<meta name="script-src-hash" content="(.*)">$/m;

/* eslint-env browser */
export default async function addHtmlSecurityHeaders(_, context) {
  /** @type Response */
  const response = await context.next({ sendConditionalRequest: true });

  // No need to do any work if the response cached by the client hasn't changed.
  if (response.status === 304) {
    return response;
  }

  const { headers } = response;
  const type = headers.get('content-type');

  console.log('MIME:', type); // eslint-disable-line

  if (!type || type.startsWith('text/html')) {
    const body = await response.text();
    const match = body.match(scriptSrcHashRegex);

    headers.set('strict-transport-security', 'max-age=31536000; includeSubDomains; preload');
    headers.set('x-frame-options', 'SAMEORIGIN');
    headers.set('x-xss-protection', '1');
    headers.set('x-content-type-options', 'nosniff');
    headers.set(
      'content-security-policy',
      `default-src 'self'; script-src${match ? ` '${match[1]}'` : ''} 'self'; style-src 'self'; img-src *; child-src https://www.youtube-nocookie.com 'self'; frame-src https://www.youtube-nocookie.com 'self';` // eslint-disable-line max-len
    );
    headers.set('referrer-policy', 'strict-origin-when-cross-origin');
    headers.set('cache-control', 'no-cache');
    headers.set(
      'permissions-policy',
      'accelerometer=(self), ambient-light-sensor=(self), camera=(self), fullscreen=(self), gyroscope=(self), magnetometer=(self), microphone=(self), midi=(self), picture-in-picture=(), sync-xhr=(), usb=(self), interest-cohort=()' // eslint-disable-line max-len
    );

    return new Response(body, response);
  }

  return response;
}

export const config = {
  path: '/*',
  excludedPath: '/*.{json,xml,opml,css,js,pdf,svg,png,avif,webp,jpeg,jpg,txt}'
};
