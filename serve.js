'use strict';

const http = require('http');
const Toisu = require('toisu');
const serveStatic = require('toisu-static');

const app = new Toisu();

app.use(serveStatic('public', { extensions: ['html'] }));

http.createServer(app.requestHandler).listen(8000, () => {
  console.log('listening on 8000'); // eslint-disable-line no-console
});
