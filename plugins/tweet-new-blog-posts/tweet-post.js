'use strict';

const getTagsForUrl = require('./get-tags-for-url');
const twitterClient = require('./twitter-client');

module.exports = async function tweetPost(url) {
  const tags = await getTagsForUrl(url);

  await twitterClient.post('statuses/update', {
    status: `New blog post published! ${url}${tags.reduce((s, t) => `${s} ${t}`, '')}`
  });
};
