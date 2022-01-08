import { readdir, readFile } from 'node:fs/promises';
import handlebars from 'handlebars';
import getTimezone from './get-timezone.js';

const makeSnippet = handlebars.compile('<p class="p-summary">{{content}}</p>');
const makeFeedItem = handlebars.compile('<p>{{content}}</p>');

export default async function loadStudySessionsFiles(dir) {
  const filenames = await readdir(dir);
  const sessions = await Promise.all(filenames.filter(fn => fn.endsWith('.json')).map(async (filename, index) => {
    const session = JSON.parse(await readFile(new URL(filename, dir), 'utf8'));
    const { type: [hType], properties: { latitude, longitude } } = session;
    const timestamp = parseInt(filename, 10);

    const duration = parseInt(session.properties.duration, 10);
    const [content] = session.properties.name;
    const categories = session.properties.category;

    return {
      hType,
      timestamp,
      localUrl: `/study-sessions/${timestamp}`,
      timezone: getTimezone(latitude, longitude),
      filename: `${timestamp}.html`,
      type: 'study-session',
      datetime: new Date(timestamp - 60000 * duration).toISOString(),
      duration,
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
