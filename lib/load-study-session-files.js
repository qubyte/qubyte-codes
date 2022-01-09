import { readdir, readFile } from 'node:fs/promises';
import handlebars from 'handlebars';
import { parse as parseDuration, toSeconds } from 'iso8601-duration';
import getTimezone from './get-timezone.js';

const makeSnippet = handlebars.compile('<p class="p-summary">{{content}}</p>');
const makeFeedItem = handlebars.compile('<p>{{content}}</p>');

// TODO: When Intl.DurationFormat is standardized, use it instead. https://github.com/tc39/proposal-intl-duration-format
function formatDuration(duration) {
  if (duration.hours) {
    if (duration.minutes) {
      return `${duration.hours}h ${duration.minutes}m`;
    }
    return `${duration.hours}h`;
  }
  return `${duration.minutes}m`;
}

export default async function loadStudySessionsFiles(dir) {
  const filenames = await readdir(dir);
  const sessions = await Promise.all(filenames.filter(fn => fn.endsWith('.json')).map(async (filename, index) => {
    const session = JSON.parse(await readFile(new URL(filename, dir), 'utf8'));
    const { type: [hType], properties: { latitude, longitude } } = session;
    const timestamp = parseInt(filename, 10);

    const duration = parseDuration(session.properties.duration[0]);
    const [content] = session.properties.name;
    const categories = session.properties.category;

    return {
      hType,
      timestamp,
      localUrl: `/study-sessions/${timestamp}`,
      timezone: getTimezone(latitude, longitude),
      filename: `${timestamp}.html`,
      type: 'study-session',
      datetime: new Date(timestamp - 1000 * toSeconds(duration)).toISOString(),
      duration: formatDuration(duration),
      title: `Study session ${index}`,
      content,
      categories,
      snippet: makeSnippet({ content }),
      feedItem: makeFeedItem({ content })
    };
  }));

  sessions.sort((a, b) => b.timestamp - a.timestamp);

  return sessions;
}
