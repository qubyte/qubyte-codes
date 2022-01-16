import getTagsForUrl from './get-tags-for-url.js';
import twitterClient from './twitter-client.js';

export default async function tweetPost(url) {
  const tags = await getTagsForUrl(url);

  await twitterClient.post('statuses/update', {
    status: `New blog post published! ${url}${tags.reduce((s, t) => `${s} ${t}`, '')}`
  });
}
