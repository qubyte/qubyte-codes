'use strict';

/* eslint no-console: off */

const http = require('http');
const Toisu = require('toisu');
const Router = require('toisu-router');
const serveStatic = require('toisu-static');
const chokidar = require('chokidar');
const childProcess = require('child_process');
const { EventEmitter } = require('events');
const { promisify } = require('util');
const exec = promisify(childProcess.exec);

const buildEmitter = new EventEmitter();

async function build() {
  console.log('Sources changed. Rebuilding...');

  const { stderr } = await exec('npm run build');

  if (stderr) {
    return console.error(stderr);
  }

  console.log('Build succeeded');

  buildEmitter.emit('new');
}

build();

const watcher = chokidar.watch(['src'])
  .once('ready', () => {
    watcher.on('all', build);
  });

const app = new Toisu();
const router = new Router();

router.route('/events', {
  GET: [function (req, res) {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive'
    });

    res.write('\n');

    buildEmitter.on('new', () => res.write('event: new\ndata: new\n\n'));

    setInterval(() => res.write('event: heartbeat\ndata: heartbeat\n\n'), 1000);

    return new Promise(() => {}); // Prevent the stack from progressing.
  }]
});

app.use(router.middleware);
app.use(serveStatic('public', { extensions: ['html'] }));

http.createServer(app.requestHandler).listen(8000, () => {
  console.log('listening on 8000');
});
