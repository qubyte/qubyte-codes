'use strict';

/* eslint no-console: off */

const { createReadStream } = require('fs');
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
const syndications = {
  mastodon: 'https://mastodon.social/@qubyte',
  twitter: 'https://twitter.com/qubyte'
};

// Maps base paths to associated node names to rerun on changes.
const matchers = [
  [path.join(contentPath, 'likes'), 'likeFiles'],
  [path.join(contentPath, 'links'), 'linkFiles'],
  [path.join(contentPath, 'notes'), 'noteFiles'],
  [path.join(contentPath, 'images'), 'staticFiles'],
  [path.join(contentPath, 'papers'), 'staticFiles'],
  [path.join(contentPath, 'scripts'), 'staticFiles'],
  [path.join(contentPath, 'posts'), 'postFiles'],
  [path.join(contentPath, 'replies'), 'replyFiles'],
  [path.join(sourcePath, 'css'), 'css'],
  [path.join(sourcePath, 'fonts'), 'staticFiles'],
  [path.join(sourcePath, 'icons'), 'staticFiles'],
  [path.join(sourcePath, 'img'), 'staticFiles'],
  [path.join(sourcePath, 'templates'), 'templates'],
  [sourcePath, 'staticFiles']
];

// eslint-disable-next-line complexity, max-statements
async function watchForChanges(watcher, graph) {
  try {
    const [, pathStr] = await once(watcher, 'all');
    const matched = matchers.find(([path]) => pathStr.startsWith(path));
    const name = matched && matched[1];

    if (name) {
      const t0 = Date.now();
      console.log('Rerunning Node:', name);
      await graph.rerunNode({ name });
      console.log(`Build succeeded for ${name}: ${Date.now() - t0}ms`);
      buildEmitter.emit('new');
    } else {
      console.log('No node to rerun for changed path:', pathStr);
    }
  } catch (e) {
    console.error('BUILD ERROR:', e.stack);
  }

  return watchForChanges(watcher, graph);
}

// This watches the content of the src directory for any changes, triggering a
// build each time a change happens.
const watcher = chokidar.watch([sourcePath, contentPath]);

once(watcher, 'ready')
  .then(() => {
    console.log('No event or path, or a source file changed. Running initial build...');
    console.time('Initial build');

    return blogEngine.build({ baseUrl: `http://localhost:${port}`, baseTitle: 'DEV MODE', syndications, dev: true });
  })
  .then(graph => {
    buildEmitter.emit('new');
    console.timeEnd('Initial build');

    return watchForChanges(watcher, graph);
  })
  .catch(error => console.error(error));

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
