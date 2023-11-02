import { JSDOM } from 'jsdom';

import { getEnvVars } from './function-helpers/get-env-vars.js';

const { URL: BASE_URL, GITHUB_TOKEN } = getEnvVars('URL', 'GITHUB_TOKEN');

// Some blogs dispatch *all* mentions on every build or something. Whenever that
// happens add the offending source URL to the list.
const IGNORED_SOURCES = [];
const validTargetRegex = new RegExp(`^${BASE_URL}/(blog|japanese-notes)/`);

class HttpError extends Error {
  constructor(message, { status = 400, ...options } = {}) {
    super(message, options);
    this.status = status;
  }

  toResponseObject() {
    return new Response(this.message, { status: this.status });
  }
}

/** @param {FormData} body */
function parseBodyAndPerformSimpleChecks(body) {
  let source = null;
  let target = null;

  try {
    source = new URL(body.get('source'));
    target = new URL(body.get('target'));
  } catch (e) {
    throw new HttpError('Source and target must be valid, fully qualified URLs.');
  }

  if (source.href.startsWith(BASE_URL)) {
    throw new HttpError('Source cannot be from this domain.');
  }

  if (!validTargetRegex.test(target.href)) {
    throw new HttpError('Target URLs must be to this domain and for an article.');
  }

  if (source.protocol !== 'https:' && source.protocol !== 'http:') {
    throw new HttpError('Source URL must be an HTTP or HTTPS address.');
  }

  if (IGNORED_SOURCES.includes(source)) {
    throw new HttpError('Please don\'t send mentions more than once if they don\'t change.', { status: 429 });
  }

  return { source, target };
}

// TODO: The source check should also determine the kind of mention. i.e. a
//       like, note, or repost etc. based on microformats around the href.
/**
 * @param {URL} source
 * @param {URL} target
 */
async function checkSource(source, target) {
  const res = await fetch(source);

  if (!res.ok) {
    // The resource can't be found. It may indicate a removed mention.
    return false;
  }

  const dom = new JSDOM(await res.text(), { contentType: res.headers.get('content-type'), url: res.url });

  for (const { href } of dom.window.document.getElementsByTagName('a')) {
    try {
      if (new URL(href, res.url).href === target.href) {
        return true;
      }
    } catch { /* */ }
  }

  return false;
}

/**
 * @param {URL} source
 * @param {URL} target
 */
async function checkTarget(source, target) {
  const res = await fetch(target);

  if (!res.ok) {
    throw new HttpError('Invalid target URL.');
  }

  const dom = new JSDOM(await res.text(), { contentType: res.headers.get('content-type'), url: res.url });

  for (const { href } of dom.window.document.querySelectorAll('.h-cite .u-url')) {
    try {
      if (new URL(href).href === source.href) {
        return true;
      }
    } catch { /* */ }
  }

  return false;
}

async function createIssue({ source, target, sourceDoesMention, targetHasMention }) {
  if (sourceDoesMention && targetHasMention) {
    // TODO: This may indicate an updated mention. This could mean the author
    //       details have changed, and I should handle that rather than ignore.
    console.warn('Source and target are present on both.');
    return;
  }

  if (!sourceDoesMention && !targetHasMention) {
    console.warn('Source and target are absent on both.');
    return;
  }

  const action = sourceDoesMention ? 'add' : 'remove';

  const res = await fetch('https://api.github.com/repos/qubyte/qubyte-codes/issues', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${Buffer.from(`qubyte:${GITHUB_TOKEN}`).toString('base64')}`
    },
    body: JSON.stringify({
      title: `New webmention from ${source.hostname}!`,
      body: `source: [${source}](${source})\ntarget: [${target}](${target})\naction: ${action}`,
      labels: ['webmention']
    })
  });

  if (!res.ok) {
    throw new HttpError(`Unexpected response status from GitHub: ${res.status}`, { status: 502 });
  }
}

/**
 * @param {Error} error
 * @param {String} defaultLogMessage
 */
function handleError(error, defaultLogMessage) {
  if (error instanceof HttpError) {
    return error.toResponseObject();
  }

  console.error(defaultLogMessage, error);

  return new Response(`Unknown Error: ${error.message}`, { status: 500 });
}

/** @param {Request} req */
export default async function handler(req) {
  const body = await req.formData();

  console.log('GOT REQUEST WITH BODY', body);

  let source;
  let target;
  let sourceDoesMention;
  let targetHasMention;

  try {
    ({ source, target } = parseBodyAndPerformSimpleChecks(body));
  } catch (e) {
    return handleError(e, 'UNKNOWN ERROR PARSING REQUEST BODY:');
  }

  try {
    sourceDoesMention = await checkSource(source, target);
  } catch (e) {
    return handleError(e, 'UNKNOWN ERROR VALIDATING TARGET:');
  }

  try {
    targetHasMention = await checkTarget(source, target);
  } catch (e) {
    return handleError(e, 'UNKNOWN ERROR VALIDATING SOURCE:');
  }

  // This is an MVP. At the moment it will only send a source and a target to
  // GitHub in a link. Manual steps afterward:
  //
  // - Get author details from the source.
  // - When author details match those in a mention and it's present in both places, do nothing.
  // - Determine the kind of mention (note, like, repost, etc.)

  try {
    await createIssue({ source, target, sourceDoesMention, targetHasMention });
  } catch (e) {
    return handleError(e, 'UNKNOWN ERROR CREATING ISSUE:');
  }

  return new Response('Accepted', { status: 202 });
}

export const config = {
  path: '/functions/webmention'
};
