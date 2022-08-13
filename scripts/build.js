import { build } from '../index.js';

const baseUrl = process.env.CONTEXT !== 'production' ? process.env.DEPLOY_URL : process.env.URL;
const baseTitle = process.env.BASE_TITLE;
const repoUrl = new URL(process.env.REPOSITORY_URL);
const syndications = {
  mastodon: process.env.MASTODON_SYNDICATION,
  twitter: process.env.TWITTER_SYNDICATION
};

build({ baseUrl, baseTitle, repoUrl, syndications }).catch(e => {
  console.error(e); // eslint-disable-line no-console
  process.exit(1);
});
