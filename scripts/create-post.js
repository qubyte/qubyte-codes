'use strict';

const inquirer = require('inquirer');
const fs = require('fs').promises;
const path = require('path');

const tagsPath = path.join(__dirname, '..', 'tags.txt');

function pad(part) {
  return part.toString().padStart(2, '0');
}

async function cli() {
  const { title, description, tags } = await inquirer.prompt([
    { name: 'title', message: 'Title:' },
    { name: 'description', message: 'Description:' },
    {
      type: 'checkbox',
      name: 'tags',
      choices: (await fs.readFile(tagsPath, 'utf8')).trim().split('\n'),
      message: 'Tag:'
    }
  ]);

  const now = new Date();
  const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const details = JSON.stringify({
    datetime: now.toISOString().replace(/\.[0-9]{3}Z/, 'Z'),
    updatedAt: null,
    draft: true,
    title,
    description,
    tags
  }, null, 2);
  const filePath = path.join(__dirname, '..', 'content', 'posts', `${date}.md`);

  let stats;

  try {
    stats = await fs.stat(filePath);
  } catch (e) {
    if (e.code !== 'ENOENT') {
      throw e;
    }
  }

  if (stats) {
    console.error(`File already exists: ${filePath}\n${details}`); // eslint-disable-line no-console
    return process.exit(1); // eslint-disable-line no-process-exit
  }

  await fs.writeFile(filePath, `---\n${details}\n---\n`);

  console.log('Created:', filePath); // eslint-disable-line no-console
}

cli();
