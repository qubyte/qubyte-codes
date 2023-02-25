export default async function retry(fn, times, timeout = 5000) {
  try {
    return await fn();
  } catch (e) {
    if (times) {
      // eslint-disable-next-line no-console
      console.error('Retrying after error:', e.stack || e.message);
      await new Promise(resolve => setTimeout(resolve, timeout));
      return retry(fn, times - 1);
    }
  }
}
