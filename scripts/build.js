import { build } from '../index.js';

const baseUrl = process.env.CONTEXT !== 'production' ? process.env.DEPLOY_URL : process.env.URL;
const baseTitle = process.env.BASE_TITLE;
const repoUrl = new URL(process.env.REPOSITORY_URL);

try {
  await build({ baseUrl, baseTitle, repoUrl });
} catch (e) {
  console.error(e);
  process.exit(1);
}
