import events from 'events';
import Webmention from '@remy/webmention';

const handleWmLog = (...args) => console.log('WM log:', ...args);
const handleWmProgress = (...args) => console.log('WM progress:', ...args);
const handleWmEndpoints = (...args) => console.log('WM endpoints:', ...args);
const handleWmSent = (...args) => console.log('WM sent:', ...args);

export default async function dispatchWebmentionsForUrl(url) {
  const wm = new Webmention({ limit: 0, send: true });

  wm.on('log', handleWmLog);
  wm.on('progress', handleWmProgress);
  wm.on('endpoints', handleWmEndpoints);
  wm.on('sent', handleWmSent);

  try {
    wm.fetch(url);
    await events.once(wm, 'end');
  } finally {
    wm.off('log', handleWmLog);
    wm.off('progress', handleWmProgress);
    wm.off('endpoints', handleWmEndpoints);
    wm.off('sent', handleWmSent);
  }
}
