import { promisify } from 'node:util';
import { exec } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const pexec = promisify(exec);

export default async function getLastPostCommitTime(dir) {
  const { stdout, stderr } = await pexec(`git log -1 --format=%ct ${fileURLToPath(dir)}`);

  if (stderr) {
    throw new Error(`Error from exec: ${stderr}`);
  }

  return new Date(parseInt(stdout.trim(), 10) * 1000);
}
