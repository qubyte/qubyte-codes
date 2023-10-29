/** @param {...String} names */
export function getEnvVars(...names) {
  /** @type {Record<String, String>} */
  const vars = {};

  let loggedStrategy = false;

  for (const name of names) {
    try {
      vars[name] = Netlify.env.get(name);

      if (!loggedStrategy) {
        loggedStrategy = true;
        console.log('Used Netify global for environment variables.');
      }
    } catch {
      vars[name] = process.env[name];

      if (!loggedStrategy) {
        loggedStrategy = true;
        console.log('Used process.env global for environment variables.');
      }
    }
  }

  return vars;
}
