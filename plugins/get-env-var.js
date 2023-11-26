/** @param {string} name */
export default function getEnvVar(name) {
  const value = process.env[name];

  if (typeof value !== 'string') {
    throw new Error(`No environment variable for "${name}"`);
  }

  return value;
}
