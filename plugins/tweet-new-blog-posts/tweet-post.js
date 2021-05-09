import getTagsForUrl from './get-tags-for-url';
import twitterClient from './twitter-client';

export default async function tweetPost(url) {
  const tags = await getTagsForUrl(url);

  await twitterClient.post('statuses/update', {
    status: `New blog post published! ${url}${tags.reduce((s, t) => `${s} ${t}`, '')}`
  });
}
