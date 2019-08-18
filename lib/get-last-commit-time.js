'use strict';

const exec = require('util').promisify(require('child_process').exec);

module.exports = async function getLastPostCommitTime(dir) {
  const { stdout, stderr } = await exec(`git log -1 --format=%ct ${dir}`);

  if (stderr) {
    throw new Error(`Error from exec: ${stderr}`);
  }

  return new Date(parseInt(stdout.trim(), 10) * 1000);
};
