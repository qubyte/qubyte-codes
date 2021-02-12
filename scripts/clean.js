/* eslint no-console: off */

console.log('Cleaning build artefacts...');
console.time('Done cleaning');

import { promises as fs } from 'fs';

const publidDir = new URL('../public', import.meta.url);

fs.rmdir(publidDir, { recursive: true })
  .then(() => console.timeEnd('Done cleaning'));
