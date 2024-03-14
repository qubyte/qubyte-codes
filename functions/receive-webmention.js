// @ts-check

import { JSDOM } from 'jsdom';

import { getEnvVar } from './function-helpers/get-env-var.js';

// Some blogs dispatch *all* mentions on every build or something. Whenever that
// happens add the offending source URL to the list.
const IGNORED_SOURCES = [];


class HttpError extends Error {
  /**
   * @param {string} message
   * @param {object} options
   * @param {number} [options.status]
   * @param {Error} [options.cause]
   */
  constructor(message, { status = 400, cause } = {}) {
    super(message, { cause });
    this.status = status;
  }

  toResponseObject() {
    return new Response(this.message, { status: this.status });
  }
}

/**
 * @param {FormData|URLSearchParams} form
 * @param {string} fieldName
 */
function parseUrlFromForm(form, fieldName) {
  const field = form.get(fieldName);

  if (!field) {
    throw new HttpError(`The ${fieldName} must be a valid, fully qualified URL.`);
  }

  try {
    return new URL(field.toString());
  } catch (e) {
    throw new HttpError(`The ${fieldName} must be a valid, fully qualified URL.`);
  }
}

/**
 * @param {URL} source
 * @param {URL} target
 */
function performSimpleChecks(source, target) {
  const baseUrl = getEnvVar('URL');
  const validTargetRegex = new RegExp(`^${baseUrl}/(blog|japanese-notes|colophon)/`);

  if (source.href.startsWith(baseUrl)) {
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

  const contentType = res.headers.get('content-type') || 'text/html';

  if (contentType !== 'text/html' && contentType !== 'application/xhtml+xml') {
    return false;
  }

  const dom = new JSDOM(await res.text(), { contentType, url: res.url });

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

  const contentType = res.headers.get('content-type') || 'text/html';

  if (contentType !== 'text/html' && contentType !== 'application/xhtml+xml') {
    throw new HttpError('Invalid target content type.');
  }

  const dom = new JSDOM(await res.text(), { contentType, url: res.url });

  for (const el of dom.window.document.querySelectorAll('.h-cite .u-url')) {
    if (el instanceof dom.window.HTMLAnchorElement || el instanceof dom.window.HTMLLinkElement) {
      try {
        if (new URL(el.href).href === source.href) {
          return true;
        }
      } catch { /* */ }
    }
  }

  return false;
}

/**
 * @param {object} options
 * @param {URL} options.source
 * @param {URL} options.target
 * @param {boolean} options.sourceDoesMention
 * @param {boolean} options.targetHasMention
 */
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
  const githubToken = getEnvVar('GITHUB_TOKEN');

  const res = await fetch('https://api.github.com/repos/qubyte/qubyte-codes/issues', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${Buffer.from(`qubyte:${githubToken}`).toString('base64')}`
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

  /** @type {undefined|URL} */
  let source;
  /** @type {undefined|URL} */
  let target;
  let sourceDoesMention = false;
  let targetHasMention = false;

  try {
    ([source, target] = [parseUrlFromForm(body, 'source'), parseUrlFromForm(body, 'target')]);
    performSimpleChecks(source, target);
  } catch (e) {
    return handleError(e, 'UNKNOWN ERROR PARSING REQUEST BODY');
  }

  try {
    sourceDoesMention = await checkSource(source, target);
  } catch (e) {
    return handleError(e, 'UNKNOWN ERROR VALIDATING TARGET');
  }

  try {
    targetHasMention = await checkTarget(source, target);
  } catch (e) {
    return handleError(e, 'UNKNOWN ERROR VALIDATING SOURCE');
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
    return handleError(e, 'UNKNOWN ERROR CREATING ISSUE');
  }

  return new Response('Accepted', { status: 202 });
}

export const config = {
  path: '/functions/webmention'
};
