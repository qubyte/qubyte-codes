/* eslint-disable max-len */
function htmlHeaders() {
  return [
    ['Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload'],
    ['X-Frame-Options', 'SAMEORIGIN'],
    ['X-Xss-Protection', '1'],
    ['X-Content-Type-Options', 'nosniff'],
    ['Content-Security-Policy', 'default-src \'self\'; script-src \'self\'; style-src \'self\'; img-src *; child-src https://www.youtube-nocookie.com \'self\'; frame-src https://www.youtube-nocookie.com \'self\';'],
    ['Referrer-Policy', 'strict-origin-when-cross-origin'],
    ['Cache-Control', 'max-age=0'],
    ['Permissions-Policy', 'accelerometer=(self), ambient-light-sensor=(self), camera=(self), fullscreen=(self), gyroscope=(self), magnetometer=(self), microphone=(self), midi=(self), picture-in-picture=(), sync-xhr=(), usb=(self), interest-cohort=()']
  ];
}

function immutable() {
  return [
    ['Cache-Control', 'max-age=315360000, public, immutable']
  ];
}

function base() {
  return [
    ['/', htmlHeaders()],
    ['/blog/*', htmlHeaders()],
    ['/japanese-notes/*', htmlHeaders().concat([['X-Robots-Tag', 'none']])],
    ['/likes/*', htmlHeaders()],
    ['/links/*', htmlHeaders()],
    ['/notes/*', htmlHeaders()],
    ['/replies/*', htmlHeaders()],
    ['/study-sessions/*', htmlHeaders()],
    ['/hashed-*', immutable()],
    ['/scripts/hashed-*', immutable()],
    ['/*.css', immutable()],
    ['/*.atom.xml', [['Content-Type', 'application/atom+xml; charset=utf-8']]],
    ['/feeds.opml', [['Content-Type', 'application/atom+xml; charset=utf-8']]],
    ['/sw.js', [['Content-Security-Policy', 'connect-src *;']]]
  ];
}

export default class NetlifyHeaders {
  constructor() {
    this.headers = base();
  }

  addHeaders(path, rules) {
    this.headers.push([path, rules]);
  }

  generate() {
    return this.headers.map(([path, rules]) => {
      return `${path}\n${rules.map(([name, value]) => `  ${name}: ${value}`).join('\n')}`;
    }).join('\n\n');
  }
}
