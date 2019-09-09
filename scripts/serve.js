'use strict';

/* eslint no-console: off */

const { createReadStream, promises: { rmdir } } = require('fs');
const http = require('http');
const path = require('path');
const Toisu = require('toisu');
const serveStatic = require('toisu-static');
const chokidar = require('chokidar');
const { EventEmitter, once } = require('events');
const blogEngine = require('..');

const notFoundPath = path.join(__dirname, '..', 'public', '404.html');
const sourcePath = path.join(__dirname, '..', 'src');
const contentPath = path.join(__dirname, '..', 'content');
const buildEmitter = new EventEmitter();
const port = 8000;

// This watches the content of the src directory for any changes, triggering a
// build each time a change happens.
const watcher = chokidar.watch([sourcePath, contentPath]).once('ready', async function build() {
  const d0 = Date.now();

  try {
    await rmdir(path.join(__dirname, '..', 'public'), { recursive: true });
    await blogEngine.build({ baseUrl: `http://localhost:${port}`, baseTitle: 'DEV MODE', dev: true });
    console.log(`Build succeeded: ${Date.now() - d0}ms`);
    buildEmitter.emit('new');
  } catch (e) {
    console.error(e);
  }

  // Now the build is complete, listen for changes to trigger the build again.
  watcher.once('all', build);
});

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
  buildEmitter.on('new', write);

  // Unregister the listener on the buildEmitter when the connection closes.
  await once(req, 'close');

  // This avoids a memory leak.
  buildEmitter.off('new', write);

  clearInterval(interval);
});

// Host files from the public directory.
app.use(serveStatic('public', { extensions: ['html'] }));

// This middleware handles everything not handled before it (404).
app.use((_req, res) => {
  createReadStream(notFoundPath).pipe(res.writeHead(404, { 'Content-Type': 'text/html' }));
});

http
  .createServer(app.requestHandler)
  .listen(port, () => console.log(`listening on http://localhost:${port}`));
