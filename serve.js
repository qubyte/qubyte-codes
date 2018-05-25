'use strict';

/* eslint no-console: off */

const http = require('http');
const Toisu = require('toisu');
const Router = require('toisu-router');
const serveStatic = require('toisu-static');
const chokidar = require('chokidar');
const { EventEmitter } = require('events');
const exec = require('util').promisify(require('child_process').exec);

const buildEmitter = new EventEmitter();

// This watches the content of the src directory for any changes, triggering a
// build each time a change happens.
const watcher = chokidar.watch(['src'])
  .once('ready', build);

// Refreshes the build, and after alerts the browser to refresh itself.
async function build(...args) {
  console.log('Sources changed. Rebuilding...', args);

  const { stderr } = await exec('npm run build -- --no-css-compile --dev');

  if (stderr) {
    return console.error(stderr);
  }

  console.log('Build succeeded');

  buildEmitter.emit('new');
  watcher.once('all', build);
}

const app = new Toisu();
const router = new Router();

// This route is for consumption by EventSource browser connections. In
// development mode, templates insert a script which establishes an EventSource
// connection. Whenever a build completes, a message is sent to the browser,
// which then reloads.
router.route('/events', {
  GET: [function (req, res) {
    // Sending back these headers and a newline is sufficient for the browser
    // to know that this endpoint is speaking in EventSource.
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
    // This avoids a memory leak.
    return new Promise(resolve => {
      req.once('close', () => {
        buildEmitter.removeListener('new', write);
        clearInterval(interval);
        resolve();
      });
    });
  }]
});

app.use(router.middleware);

// Mostly this server just hosts the public directory, resolving unsuffixed
// addresses and / to their proper HTML files.
app.use(serveStatic('public', { extensions: ['html'] }));

http.createServer(app.requestHandler).listen(8000, () => {
  console.log('listening on 8000');
});
