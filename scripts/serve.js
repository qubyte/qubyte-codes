import { createReadStream } from 'node:fs';
import { once } from 'node:events';
import { createServer } from 'node:http';

import Toisu from '@toisu/toisu';
import serveStatic from '@toisu/static';

import { build } from '../index.js';

const notFoundUrl = new URL('../public/404.html', import.meta.url);
const port = 8080;

// This watches the content of the src directory for any changes, triggering a
// build each time a change happens.
console.log('Running initial build...');
console.time('Initial build');

let graph;

try {
  graph = await build({
    baseUrl: `http://localhost:${port}`,
    repoUrl: new URL('https://github.com/qubyte/qubyte-codes'),
    baseTitle: 'DEV MODE',
    dev: true
  });
} catch (error) {
  console.error(error.stack);
  process.exit(1);
}

console.timeEnd('Initial build');

const app = new Toisu();

// In dev mode, the frontend uses server sent events to refresh itself.
app.use(async (req, res) => {
  // Don't handle requests which aren't for an event-stream.
  if (req.headers.accept !== 'text/event-stream') {
    return;
  }

  // Sending back these headers and a newline is sufficient for the browser to
  // know that this endpoint is speaking in EventSource.
  res
    .writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive'
    })
    .write('\n');

  // Function which pushes an event to the browser to notify it of a new build.
  const write = () => res.write('event: new\ndata: new\n\n');

  // Heartbeats are sent to the browser at intervals to prevent the connection
  // from timing out.
  const interval = setInterval(() => res.write('event: heartbeat\ndata: heartbeat\n\n'), 1000);

  // When a new build is generated, let the browser know.
  graph.on('rerun', write);

  // Unregister the listener on the buildEmitter when the connection closes.
  await once(req, 'close');

  // This avoids a memory leak.
  graph.off('rerun', write);

  clearInterval(interval);
});

// Host files from the public directory.
app.use(serveStatic('public', {
  extensions: ['html'],
  setHeaders(res, path) {
    // The database behind serve-static doesn't understand these endings yet,
    // so handle them manually.
    if (path.endsWith('avif')) {
      res.setHeader('Content-Type', 'image/avif');
    } else if (path.endsWith('webp')) {
      res.setHeader('Content-Type', 'image/webp');
    }

    const isHashed = res.req.url
      .split('/')
      .pop()
      .startsWith('hashed');

    if (isHashed) {
      res.setHeader('cache-control', 'max-age=315360000, public, immutable');
    }
  }
}));

// This middleware handles everything not handled before it (404).
app.use((_req, res) => {
  createReadStream(notFoundUrl).pipe(res.writeHead(404, { 'Content-Type': 'text/html; charset=UTF-8' }));
});

createServer(app.requestHandler).listen(port, () => {
  console.log(`listening on http://localhost:${port}`);
});
