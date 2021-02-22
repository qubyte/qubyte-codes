/* eslint no-console: off */

import { createReadStream } from 'fs';
import { once } from 'events';
import http from 'http';

import Toisu from 'toisu';
import serveStatic from 'toisu-static';

import { build } from '../index.js';

const notFoundUrl = new URL('../public/404.html', import.meta.url);
const port = 8080;
const syndications = {
  mastodon: 'https://mastodon.social/@qubyte',
  twitter: 'https://twitter.com/qubyte'
};

// This watches the content of the src directory for any changes, triggering a
// build each time a change happens.

(async () => {
  console.log('No event or path, or a source file changed. Running initial build...');
  console.time('Initial build');

  let graph;

  try {
    graph = await build({
      baseUrl: `http://localhost:${port}`,
      baseTitle: 'DEV MODE',
      syndications,
      dev: true
    });
  } catch (error) {
    console.error(error.stack);
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
  app.use(serveStatic('public', { extensions: ['html'] }));

  // This middleware handles everything not handled before it (404).
  app.use((_req, res) => {
    createReadStream(notFoundUrl).pipe(res.writeHead(404, { 'Content-Type': 'text/html; charset=UTF-8' }));
  });

  http
    .createServer(app.requestHandler)
    .listen(port, () => console.log(`listening on http://localhost:${port}`));
})();
