import { readdir, readFile } from 'node:fs/promises';
import handlebars from 'handlebars';
import { parse as parseDuration, toSeconds } from 'iso8601-duration';
import getTimezone from './get-timezone.js';
import Page from './page.js';

const makeSnippet = handlebars.compile('<p class="p-summary">{{content}}</p>');
const makeFeedItem = handlebars.compile('<p>{{content}}</p>');
const durationFormatter = new Intl.DurationFormat('en-gb', { style: 'narrow' });

class StudySessionPage extends Page {
  /**
   * @param {object} options
   * @param {string|URL} options.baseUrl
   * @param {string} options.content
   * @param {Date} options.date
   * @param {string} options.timezone
   * @param {{hours: number?, minutes: number?}} options.isoDuration
   * @param {string[]} options.categories
   */
  constructor({
    baseUrl,
    content,
    date,
    timezone,
    isoDuration,
    title,
    categories,
    hType
  }) {
    const timestamp = date.getTime();

    super({
      baseUrl,
      localUrl: `/study-sessions/${timestamp}`,
      content,
      filename: `${timestamp}.html`
    });

    const duration = parseDuration(isoDuration);

    this.timestamp = timestamp;
    this.timezone = timezone;
    this.datetime = new Date(timestamp - 1000 * toSeconds(duration)).toISOString();
    this.duration = durationFormatter.format(duration);
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

    return new StudySessionPage({
      baseUrl,
      content: session.name,
      date: new Date(session.published),
      timezone: getTimezone(session.location?.latitude, session.location?.longitude),
      isoDuration: session.duration,
      title: `Study session ${index}`,
      categories: [].concat(session.category).filter(c => c !== 'study-session'),
      hType: `h-${session.type}`
    });
  }));

  sessions.sort((a, b) => b.timestamp - a.timestamp);

  return sessions;
}
