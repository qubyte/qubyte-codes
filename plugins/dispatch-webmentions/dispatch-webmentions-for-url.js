import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import fetch from 'node-fetch';
import linkHeader from 'http-link-header';
import { JSDOM } from 'jsdom';

const IGNORED_HOSTNAMES = [
  'localhost',
  'qubyte.codes',
  'webmention.io',
  'twitter.com',
  'github.com',
  'www.w3.org',
  'paypal.me'
];
const ALLOWED_PROTOCOLS = [
  'https:',
  'http:'
];

/** @param {Document} document */
function* getValidUrlsFromDocument(content, url) {
  const { window } = new JSDOM(content, { url });

  /** @type NodeListOf<HTMLAnchorElement> */
  const anchors = window.document.querySelectorAll('.h-entry a[href]');

  for (const { href } of anchors) {
    try {
      const url = new URL(href);

      if (ALLOWED_PROTOCOLS.includes(url.protocol) && !IGNORED_HOSTNAMES.includes(url.hostname)) {
        yield url;
      }
    } catch {
      continue;
    }
  }
}

/**
 * https://www.w3.org/TR/webmention/#h-sender-discovers-receiver-webmention-endpoint
 * @param {URL} url
 */
async function getEndpoint(url) {
  const res = await fetch(url);
  const [webmention] = linkHeader.parse(res.headers.link || '').rel('webmention');

  // Link header takes precedence.
  if (webmention) {
    return new URL(webmention.uri, res.url);
  }

  if (!res.ok) {
    throw new Error(`Unexpected status: ${res.status}`);
  }

  const { window } = new JSDOM(await res.text(), { url: res.url });

  // If no webmention link header is discovered, the first webmention link or
  // anchor is picked (if any).

  const href = window.document.querySelector('link[href][rel~="webmention"], a[href][rel~="webmention"]')?.href;

  try {
    return href ? new URL(href) : null;
  } catch {
    return null;
  }
}

/**
 * @param {string|URL} endpoint
 * @param {string|URL} source
 * @param {string|URL} target
 */
async function dispatchMention(endpoint, source, target) {
  const res = await fetch(endpoint, {
    method: 'POST',
    body: new URLSearchParams({ source, target })
  });

  if (!res.ok) {
    throw new Error(`Unexpected status from webmention endpoint: ${res.status}, source: ${source}, target: ${target}`);
  }
}

function pathDirToUrl(path) {
  const pathUrl = pathToFileURL(path);

  if (!pathUrl.href.endsWith('/')) {
    pathUrl.href += '/';
  }

  return pathUrl;
}

/**
 * @param {string} url
 * @param {string} baseUrl
 * @param {string} publicDir Must end with a path separator!
 */
export async function dispatchWebmentionsForUrl(url, baseUrl, publicDir) {
  if (!url.startsWith(baseUrl)) {
    throw new Error(`URL mismatch: ${url} - ${baseUrl}`);
  }

  const { pathname } = new URL(url);
  // The path must not start with a / because we want a relative resolution from
  // the public dir.
  const resolvedUrl = new URL(pathname.slice(1), pathDirToUrl(publicDir));
  const content = await readFile(resolvedUrl, 'utf8');

  for (const targetUrl of getValidUrlsFromDocument(content, url)) {
    // Note; assumes that the targetUrl is the canonical URL.
    let endpoint;

    try {
      endpoint = await getEndpoint(targetUrl);
    } catch (error) {
      console.warn('FAILED TO GET ENDPOINT:', targetUrl, error);
      continue;
    }

    if (!endpoint) {
      continue;
    }

    console.log('DISPATCHING MENTION endpoint:', endpoint.href, 'source:', url, 'target:', targetUrl.href);

    try {
      await dispatchMention(endpoint, url, targetUrl);
      console.log('DISPATCHED MENTION for target:', targetUrl.href);
    } catch (e) {
      console.error('FAILED:', e);
    }
  }
}
