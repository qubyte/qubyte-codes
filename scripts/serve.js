'use strict';

/* eslint no-console: off */

const { readFile, rmdir } = require('fs').promises;
const http = require('http');
const path = require('path');
const Toisu = require('toisu');
const serveStatic = require('toisu-static');
const chokidar = require('chokidar');
const { EventEmitter, once } = require('events');
const blogEngine = require('..');

const buildEmitter = new EventEmitter();
const port = 8000;

// This watches the content of the src directory for any changes, triggering a
// build each time a change happens.
const watcher = chokidar.watch([
  path.join(__dirname, '..', 'src'),
  path.join(__dirname, '..', 'content')
]).once('ready', build);

// Refreshes the build, and after alerts the browser to refresh itself.
async function build() {
  const d0 = Date.now();

  try {
    await rmdir(path.join(__dirname, '..', 'public'), { recursive: true });
    await blogEngine.build({ baseUrl: `http://localhost:${port}`, baseTitle: 'DEV MODE', dev: true });
    console.log(`Build succeeded: ${Date.now() - d0}ms`);
    buildEmitter.emit('new');
  } catch (e) {
    console.error(e);
  }

  watcher.once('all', build);
}

const app = new Toisu();

// This route is for consumption by EventSource browser connections. In
// development mode, templates insert a script which establishes an EventSource
// connection. Whenever a build completes, a message is sent to the browser,
// which then reloads.

// In dev mode, the frontend uses server sent events to refresh itself.
app.use(async (req, res) => {
  // Don't handle requests which aren't for an event-stream.
  if (req.headers.accept !== 'text/event-stream') {
    return;
  }

  // Sending back these headers and a newline is sufficient for the browser to
  // know that this endpoint is speaking in EventSource.
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive'
  });

  res.write('\n');

  // A function which pushes an event to the browser to notify it of a new
  // build.
  const write = () => res.write('event: new\ndata: new\n\n');

  // Heartbeats are sent to the browser at intervals to prevent the connection
  // from timing out.
  const interval = setInterval(() => res.write('event: heartbeat\ndata: heartbeat\n\n'), 1000);

  buildEmitter.on('new', write);

  // Unregister the listener on the buildEmitter when the connection closes.
  await once(req, 'close');

  // This avoids a memory leak.
  buildEmitter.off('new', write);

  clearInterval(interval);
});

// Mostly this server just hosts the public directory, resolving unsuffixed
// addresses and / to their proper HTML files.
app.use(serveStatic('public', { extensions: ['html'] }));

// This middleware handles everything not handled before it (404).
app.use(async (_req, res) => {
  const html = await readFile(path.join(__dirname, '..', 'public', '404.html'));

  res.writeHead(404, { 'Content-Type': 'text/html', 'Content-Length': html.length }).end(html);
});

http
  .createServer(app.requestHandler)
  .listen(port, () => console.log(`listening on http://localhost:${port}`));
