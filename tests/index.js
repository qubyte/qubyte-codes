import fs from 'node:fs/promises';

const UNIT_TEST_DIRECTORY = new URL('units/', import.meta.url);

for (const filename of await fs.readdir(UNIT_TEST_DIRECTORY)) {
  const path = new URL(filename, UNIT_TEST_DIRECTORY);

  if (path.href.endsWith('.test.js')) {
    await import(path);
  }
}
