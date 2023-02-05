import { once } from 'node:events';
import FeedMe from 'feedme';

/** @param {import('stream').Readable} feedStream */
export default async function parseFeedToUrls(feedStream) {
  const parser = new FeedMe();

  /** @type Map<string, Date> */
  const items = new Map();

  function onItem({ id: url, updated, published }) {
    const lastUpdate = new Date(updated || published);
    const previousLastUpdate = items.get(url);

    if (!previousLastUpdate || previousLastUpdate < lastUpdate) {
      items.set(url, lastUpdate);
    }
  }

  parser.on('item', onItem);

  feedStream.pipe(parser);

  await once(parser, 'finish');

  parser.off('item', onItem);

  return items;
}
