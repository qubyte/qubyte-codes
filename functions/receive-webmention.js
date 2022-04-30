import fetch from 'node-fetch';

// Some blogs dispatch *all* mentions on every build or something. Whenever that
// happens add the offending source URL to the list.
const IGNORED_SOURCES = [
  'https://www.jvt.me/mf2/2019/06/pmsth/'
];

export async function handler(event) {
  console.log('GOT REQUEST', { body: event.body });

  const body = new URLSearchParams(event.body);

  if (!body.has('source') || !body.has('target')) {
    return { statusCode: 400, body: 'Bad body format.' };
  }

  let source;
  let target;

  try {
    source = new URL(body.get('source'));
    target = new URL(body.get('target'));
  } catch (e) {
    return { statusCode: 400, body: 'Source and target must be valid, fully qualified URLs.' };
  }

  if (!target.href.startsWith(process.env.URL)) {
    return { statusCode: 400, body: 'Target URLs must be for this domain.' };
  }

  if (IGNORED_SOURCES.includes(source)) {
    return { statusCode: 429, body: 'Please don\'t send mentions more than once if they don\'t change.' };
  }

  // This is an MVP. At the moment it will only send a source and a target to
  // GitHub in a link. Manual steps afterward:
  //
  // - Check the source actually links to the target.
  // - Get author details from the source.
  // - Determine the kind of mention (note, like, repost, etc.)

  const res = await fetch('https://api.github.com/repos/qubyte/qubyte-codes/issues', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${Buffer.from(`qubyte:${process.env.GITHUB_TOKEN}`).toString('base64')}`
    },
    body: JSON.stringify({
      title: `New webmention from ${source.hostname}!`,
      body: `source: [${source}](${source})\ntarget: [${target}](${target})\n`,
      labels: ['webmention']
    })
  });

  if (!res.ok) {
    return { statusCode: 502, body: `Unexpected response status from GitHub: ${res.status}` };
  }

  return { statusCode: 202 };
}
