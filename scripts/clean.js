import fs from 'node:fs/promises';

console.log('Cleaning build artefacts...');
console.time('Done cleaning');

const publidDir = new URL('../public', import.meta.url);

await fs.rm(publidDir, { recursive: true, force: true });

console.timeEnd('Done cleaning');
