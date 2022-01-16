import { once } from 'node:events';
import FeedMe from 'feedme';

export default async function parseFeedToUrls(feedStream) {
  const parser = new FeedMe();
  const urls = new Set();
  const onItem = item => urls.add(item.id);

  parser.on('item', onItem);

  feedStream.pipe(parser);

  await once(parser, 'finish');

  parser.off('item', onItem);

  return urls;
}
