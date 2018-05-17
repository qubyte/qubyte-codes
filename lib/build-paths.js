'use strict';

const path = require('path');

// A helper function so I can avoid writing a bunch of path joins to src.
exports.src = (...parts) => path.join(__dirname, '..', 'src', ...parts);

// A helper function so I can avoid writing a bunch of path joins to public.
exports.public = (...parts) => path.join(__dirname, '..', 'public', ...parts);
