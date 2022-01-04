const fetch = require('node-fetch');

exports.checkAuth = async function checkAuth(headers) {
  if (headers['short-circuit-auth']) {
    if (headers.authorization !== `Bearer ${process.env.SHORT_CIRCUIT_AUTH}`) {
      throw new Error(`Secret mismatch. Got: ${headers.authorization?.slice(0, 4)}`);
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
    throw new Error(`Unexpected status: ${res.status}`);
  }

  const body = await res.json();

  if (body.me !== 'https://qubyte.codes/') {
    throw new Error('Not authorized.');
  }

  if (!(body.scope.includes('create') || body.scope.includes('post'))) {
    throw new Error('Not an acceptable scope.');
  }

  console.log('Authorized');
};
