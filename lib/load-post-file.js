'use strict';

const fs = require('fs');

module.exports = async function loadPostFile(path) {
  const stream = fs.createReadStream(path, 'utf8');

  let accumulated = '';

  for await (const chunk of stream) {
    accumulated += chunk;

    const lines = accumulated.split('\n');
    const closeIndex = lines.slice(1).findIndex(line => /^---*$/.test(line)) + 1;

    if (closeIndex) {
      const offset = lines.slice(0, closeIndex + 1).join('\n').length;
      const metadata = JSON.parse(lines.slice(1, closeIndex).join('\n'));

      stream.close();

      return { metadata, offset, post: fs.promises.readFile(path, { offset, encoding: 'utf8' }) };
    }
  }
};
