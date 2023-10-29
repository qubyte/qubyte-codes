import { HttpError } from './http-error.js';

/**
 * Returns a promise which rejects when auth fails, and resolves with no data
 * when auth is successful.
 *
 * When a header named short-circuit-auth is defined, the authorization header
 * is checked against a shared secret (this is to make writing Apple shortcuts
 * easier). Otherwise the authorization header is used with an IndieAuth
 * request, and the response of that request checked.
 *
 * @param {Request} req
 **/
export async function checkAuth(req) {
  const authorization = req.headers.get('authorization');

  if (req.headers.get('short-circuit-auth')) {
    if (authorization !== `Bearer ${process.env.SHORT_CIRCUIT_AUTH}`) {
      throw new HttpError(`Secret mismatch. Got: ${authorization?.slice(0, 4)}`, { status: 401 });
    }
    return;
  }

  const res = await fetch('https://tokens.indieauth.com/token', {
    headers: {
      accept: 'application/json',
      authorization: headers.authorization
    }
  });

  if (!res.ok) {
    console.log(`Unexpected response: ${await res.text()}`);
    throw new HttpError(`Unexpected status: ${res.status}`, { status: res.status });
  }

  const body = await res.json();

  if (body.me !== 'https://qubyte.codes/') {
    throw new HttpError('Not authorized.', { status: 403 });
  }

  if (!(body.scope.includes('create') || body.scope.includes('post'))) {
    throw new HttpError('Not an acceptable scope.');
  }

  console.log('Authorized');
}
