/* eslint no-console: 0 */

import { readdir, readFile } from 'node:fs/promises';
import { parse as parseDuration, toSeconds } from 'iso8601-duration';
import { JSDOM } from 'jsdom';

const year = parseInt(process.argv[2], 10);
const directory = new URL('../content/study-sessions/', import.meta.url);
const aggregate = {};

function formatDate(date) {
  const day = `${date.getUTCDate()}`.padStart(2, '0');
  const month = `${date.getUTCMonth() + 1}`.padStart(2, '0');
  return `${date.getUTCFullYear()}-${month}-${day}`;
}

function setAttributesNS(element, attributes) {
  for (const [key, val] of Object.entries(attributes)) {
    element.setAttributeNS(null, key, val);
  }

  return element;
}


for (const filename of await readdir(directory)) {
  const path = new URL(filename, directory);
  const date = new Date(parseInt(filename, 10));
  const formattedDate = formatDate(date);

  if (!formattedDate.startsWith(`${year}-`)) {
    continue;
  }

  const session =  JSON.parse(await readFile(path, 'utf8'));
  const isoDuration = session.properties.duration[0];
  const duration = parseDuration(isoDuration);
  const minutes = toSeconds(duration) / 60;


  if (!aggregate[formattedDate]) {
    aggregate[formattedDate] = 0;
  }

  aggregate[formattedDate] += minutes;
}

const date = new Date(`${year}-01-01T00:00:00Z`);
const dayAggregated = {};
const weekAggregated = [0];
const dayOfWeekAggregated = [0, 0, 0, 0, 0, 0, 0];
const dayOfWeekCount = [0, 0, 0, 0, 0, 0, 0];

// First day of the year probably isn't a Monday.
let week = 0;

while (date.getFullYear() === year) {
  const formatted = formatDate(date);
  const minutes = aggregate[formatted] || 0;
  const dayOfWeek = date.getUTCDay();

  dayAggregated[formatted] = minutes;
  dayOfWeekCount[dayOfWeek]++;
  dayOfWeekAggregated[dayOfWeek] += minutes;

  if (weekAggregated.length === week) {
    weekAggregated.push(0);
  }

  weekAggregated[week] += aggregate[formatted] || 0;

  date.setUTCDate(date.getUTCDate() + 1);

  if (date.getDay() === 0) {
    week++;
  }
}

function outputIsoDays() {
  console.log('date,minutes');

  for (const [date, minutes] of Object.entries(dayAggregated)) {
    console.log(`${date},${minutes}`);
  }
}

function outputIsoDaysSvg() {

}

function outputWeeks() {
  console.log('week,minutes');

  for (let i = 0; i < weekAggregated.length; i++) {
    console.log(`${week + 1},${weekAggregated[i]}`);
  }
}

function outputWeeksSvg() {
  const max = Math.max(...weekAggregated);
  const { window: { document } } = new JSDOM();
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  setAttributesNS(svg, { width: 800, height: 400, viewBox: `0 0 ${weekAggregated.length * 10} ${max}` });

  for (let i = 0; i < weekAggregated.length; i++) {
    const minutes = weekAggregated[i];
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    setAttributesNS(group, { transform: `translate(${i * 10}, ${max})` });
    const bar = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    setAttributesNS(bar, { x: 1, y: -minutes, width: 8, height: minutes });
    const label = document.createElementNS('http://www.w3.org/2000/svg', 'title');
    label.textContent = `Week ${i + 1}, ${minutes} minutes`;
    group.append(label, bar);
    svg.append(group);
  }

  console.log(svg.outerHTML.replace('<svg ', '<?xml version="1.0" standalone="yes"?>\n<svg xmlns="http://www.w3.org/2000/svg" '));
}

function outputDaysOfWeek() {
  console.log('day,average minutes');
  console.log(`Monday,${dayOfWeekAggregated[0] / dayOfWeekCount[0]}`);
  console.log(`Tuesday,${dayOfWeekAggregated[1] / dayOfWeekCount[1]}`);
  console.log(`Wednesday,${dayOfWeekAggregated[2] / dayOfWeekCount[2]}`);
  console.log(`Thursday,${dayOfWeekAggregated[3] / dayOfWeekCount[3]}`);
  console.log(`Friday,${dayOfWeekAggregated[4] / dayOfWeekCount[4]}`);
  console.log(`Saturday,${dayOfWeekAggregated[5] / dayOfWeekCount[5]}`);
  console.log(`Sunday,${dayOfWeekAggregated[6] / dayOfWeekCount[6]}`);
}

function outputDaysOfWeekSvg() {

}

const outputSvg = process.argv.includes('--svg');

if (process.argv.includes('--weeks')) {
  if (outputSvg) {
    outputWeeksSvg();
  } else {
    outputWeeks();
  }
} else if (process.argv.includes('--days')) {
  if (outputSvg) {
    outputDaysOfWeekSvg();
  } else {
    outputDaysOfWeek();
  }
} else {
  if (outputSvg) {
    outputIsoDaysSvg();
  } else {
    outputIsoDays();
  }
}
