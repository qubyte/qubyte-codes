import { JSDOM } from 'jsdom';

// Some blogs dispatch *all* mentions on every build or something. Whenever that
// happens add the offending source URL to the list.
const IGNORED_SOURCES = [];
const validTargetRegex = new RegExp(`^${process.env.URL}/(blog|japanese-notes)/`);

class HttpError extends Error {
  constructor(message, { status = 400, ...options } = {}) {
    super(message, options);
    this.status = status;
  }

  toResponseObject() {
    return { statusCode: this.status, body: this.message };
  }
}

function parseBodyAndPerformSimpleChecks(raw) {
  const body = new URLSearchParams(raw);

  if (!body.has('source') || !body.has('target')) {
    return { statusCode: 400, body: 'Bad body format.' };
  }

  let source;
  let target;

  try {
    source = new URL(body.get('source'));
    target = new URL(body.get('target'));
  } catch (e) {
    throw new HttpError('Source and target must be valid, fully qualified URLs.');
  }

  if (source.href.startsWith(process.env.URL)) {
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
      if (new URL(href).href === target.href) {
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
      Authorization: `Basic ${Buffer.from(`qubyte:${process.env.GITHUB_TOKEN}`).toString('base64')}`
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

// eslint-disable-next-line max-statements
export async function handler(event) {
  console.log('GOT REQUEST', { body: event.body });

  let source;
  let target;

  try {
    ({ source, target } = parseBodyAndPerformSimpleChecks(event.body));
  } catch (e) {
    if (e instanceof HttpError) {
      return e.toResponseObject();
    }

    console.error('UNKNOWN ERROR PARSING REQUEST BODY:', e);

    return { statusCode: 500, body: `Unknown Error: ${e.message}` };
  }

  let sourceDoesMention;

  try {
    sourceDoesMention = await checkSource(source, target);
  } catch (e) {
    if (e instanceof HttpError) {
      return e.toResponseObject();
    }

    console.error('UNKNOWN ERROR VALIDATING TARGET:', e);

    return { statusCode: 500, body: `Unknown Error: ${e.message}` };
  }

  let targetHasMention;

  try {
    targetHasMention = await checkTarget(source, target);
  } catch (e) {
    if (e instanceof HttpError) {
      return e.toResponseObject();
    }

    console.error('UNKNOWN ERROR VALIDATING SOURCE:', e);

    return { statusCode: 500, body: `Unknown Error: ${e.message}` };
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
    if (e instanceof HttpError) {
      return e.toResponseObject();
    }

    console.error('UNKNOWN ERROR CREATING ISSUE:', e);

    return { statusCode: 500, body: `Unexpected error posting to GitHub: ${e.message}` };
  }

  return { statusCode: 202 };
}
