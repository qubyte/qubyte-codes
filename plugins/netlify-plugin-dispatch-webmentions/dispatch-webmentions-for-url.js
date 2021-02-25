'use strict';

const events = require('events');
const Webmention = require('@remy/webmention');

function handleWmLog(...message) {
  console.log('WM log:', ...message);
}

function handleWmProgress(...message) {
  console.log('WM progress:', ...message);
}

function handleWmEndpoints(...message) {
  console.log('WM endpoints:', ...message);
}

function handleWmSent(...message) {
  console.log('WM sent:', ...message);
}

module.exports = async function dispatchWebmentionsForUrl(url) {
  const wm = new Webmention({ limit: 0, send: true });

  wm.on('log', handleWmLog);
  wm.on('progress', handleWmProgress);
  wm.on('endpoints', handleWmEndpoints);
  wm.on('sent', handleWmSent);

  wm.fetch(url);

  // await events.once(wm, 'endpoints');
  // wm.endpoints = wm.endpoints.filter(res => !sentMentions.includes(res.endpoint.url));
  // console.log('WM endpoints', wm.endpoints)
  // wm.sendWebMentions();
  await events.once(wm, 'end');

  wm.off('log', handleWmLog);
  wm.off('progress', handleWmProgress);
  wm.off('endpoints', handleWmEndpoints);
  wm.off('sent', handleWmSent);
};
