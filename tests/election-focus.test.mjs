import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import {
  parties,
  resolveFocus,
  parseCSV,
  votes,
  partyColors,
} from '../lib/elections.ts';
const archive = JSON.parse(
  readFileSync(new URL('../lib/data/archive.json', import.meta.url), 'utf8'),
);
const council = parties(archive.metadata, 'Stadtratswahl');
const mayor = parties(archive.metadata, 'Bürgermeisterwahl');
test('Meyer cannot survive as the focus of the council election', () => {
  const meyer = resolveFocus(mayor, 'Dr. Meyer');
  assert.equal(meyer.id, 'D1');
  const focus = resolveFocus(council, meyer.name);
  assert.equal(focus.name, 'Die PARTEI');
  assert.equal(focus.id, 'D11');
  const row = parseCSV(
    archive.files['Open-Data-03254021-Stadtratswahl-Gemeinde.csv'],
  )[0];
  assert.equal(votes(row, focus.id), 2858);
  assert.notEqual(votes(row, focus.id), Number(row.D));
});
test('switch reset resolves Die PARTEI separately for every election', () => {
  for (const election of ['Stadtratswahl', 'Bürgermeisterwahl', 'Kreiswahl']) {
    const options = parties(archive.metadata, election);
    const focus = resolveFocus(options, 'Die PARTEI');
    assert.equal(focus.name, 'Die PARTEI');
    assert.ok(options.includes(focus));
  }
});
test('ordinary party selections remain selectable within the same election', () => {
  for (const p of council) assert.equal(resolveFocus(council, p.name), p);
  assert.equal(resolveFocus(mayor, 'Dr. Meyer').name, 'Dr. Meyer');
});
test('missing nominations use an available choice, empty metadata has no focus', () => {
  const options = council.filter((p) => p.name !== 'Die PARTEI');
  assert.equal(resolveFocus(options, 'Dr. Meyer'), options[0]);
  assert.equal(resolveFocus([], 'Dr. Meyer'), undefined);
});
test('party colors use CI colors and the requested light brown for AfD', () => {
  assert.equal(partyColors('SPD').background, '#E3000F');
  assert.equal(partyColors('GRÜNE').background, '#46962B');
  assert.equal(partyColors('AfD').background, '#C9A77D');
  assert.equal(partyColors('FDP').foreground, '#142238');
});
