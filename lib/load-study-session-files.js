import { readdir, readFile } from 'node:fs/promises';
import handlebars from 'handlebars';
import { parse as parseDuration, toSeconds } from 'iso8601-duration';
import getTimezone from './get-timezone.js';
import Page from './page.js';

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

class StudySessionPage extends Page {
  /**
   * @param {object} options
   * @param {string|URL} options.baseUrl
   * @param {string} options.content
   * @param {number} options.timestamp
   * @param {string} options.timezone
   * @param {{hours: number?, minutes: number?}} options.isoDuration
   * @param {string[]} options.categories
   */
  constructor({
    baseUrl,
    content,
    timestamp,
    timezone,
    isoDuration,
    title,
    categories,
    hType
  }) {
    super({
      baseUrl,
      localUrl: `/study-sessions/${timestamp}`,
      content,
      filename: `${timestamp}.html`
    });

    const duration = parseDuration(isoDuration);

    this.timezone = timezone;
    this.datetime = new Date(timestamp - 1000 * toSeconds(duration)).toISOString();
    this.duration = formatDuration(duration);
    this.title = title;
    this.categories = categories;
    this.snippet = makeSnippet({ content });
    this.feedItem = makeFeedItem({ content });
    this.type = 'study-session';
    this.hType = hType;
  }
}

export default async function loadStudySessionsFiles({ baseUrl, dir }) {
  const filenames = await readdir(dir);
  const sessions = await Promise.all(filenames.filter(fn => fn.endsWith('.json')).map(async (filename, index) => {
    const session = JSON.parse(await readFile(new URL(filename, dir), 'utf8'));
    const { type: [hType], properties: { latitude, longitude } } = session;
    const timestamp = parseInt(filename, 10);

    const isoDuration = session.properties.duration[0];
    const [content] = session.properties.name;
    const categories = (session.properties.category || []).filter(c => c !== 'study-session');

    return new StudySessionPage({
      baseUrl,
      content,
      timestamp,
      timezone: getTimezone(latitude, longitude),
      isoDuration,
      title: `Study session ${index}`,
      categories,
      hType
    });
  }));

  sessions.sort((a, b) => b.timestamp - a.timestamp);

  return sessions;
}
