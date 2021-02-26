'use strict';

const events = require('events');
const FeedMe = require('feedme');

module.exports = async function parseFeedToUrls(feedStream) {
  const parser = new FeedMe();
  const urls = new Set();

  parser.on('item', item => urls.add(item.id));

  feedStream.pipe(parser);

  await events.once(parser, 'finish');

  return urls;
};
