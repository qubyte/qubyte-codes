/**
 * Originally written to abstract around a bug in Netlify functions. I've
 * retained this function because it's useful to throw an error when an
 * environment variable is missing (and easy to forget the undefined case).
 *
 * @param {String} name
 */
export function getEnvVar(name) {
  /** @type {String|undefined} */
  let val = undefined;

  try {
    val = Netlify.env.get(name);
    console.log('Used Netify global for environment variables:', name);
  } catch {
    val = process.env[name];
    console.log('Used process.env global for environment variable:', name);
  }

  if (!val) {
    throw new Error('Environment variable not resolved:', name);
  }

  return val;
}
