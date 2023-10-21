import { HttpError } from './http-error.js';

export async function checkAuth(headers) {
  if (headers['short-circuit-auth']) {
    if (headers.authorization !== `Bearer ${process.env.SHORT_CIRCUIT_AUTH}`) {
      throw new HttpError(`Secret mismatch. Got: ${headers.authorization?.slice(0, 4)}`, { status: 401 });
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
