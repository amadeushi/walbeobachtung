import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { comparisonRule, historyPoint } from '../lib/comparability.ts';

const data2016 = JSON.parse(
  readFileSync(
    new URL('../lib/data/archive-2016.json', import.meta.url),
    'utf8',
  ),
);
const county2016 = JSON.parse(
  readFileSync(
    new URL('../lib/data/archive-kreistag-2016.json', import.meta.url),
    'utf8',
  ),
);

test('2016 archive totals and completeness are preserved', () => {
  assert.equal(data2016.rows.length, 114);
  assert.equal(data2016.total.D, '115016');
  assert.equal(data2016.total['anz-schnellmeldungen'], '114');
  assert.equal(data2016.total['max-schnellmeldungen'], '114');
});

test('absence is distinct from zero votes', () => {
  const point = historyPoint(data2016, 'Die PARTEI');
  assert.equal(point.status, 'absent');
  assert.equal(point.share, null);
  assert.equal(point.votes, null);
});

test('citywide council results are comparable, subareas are not', () => {
  assert.equal(comparisonRule('Stadtratswahl', 'all').allowed, true);
  assert.equal(comparisonRule('Stadtratswahl', '0').allowed, false);
});

test('county council boundary break blocks direct comparison', () => {
  assert.equal(comparisonRule('Kreistagswahl', 'all').allowed, true);
  const rule = comparisonRule('Kreistagswahl', '0');
  assert.equal(rule.allowed, false);
  assert.match(rule.reason, /12 Wahlbereiche \(2021\) → 11 \(2026\)/);
});

test('2016 county archive represents the full Landkreis total', () => {
  assert.equal(county2016.total['gebiet-name'], 'Landkreis Hildesheim');
  assert.equal(county2016.total.D, '379247');
  assert.equal(county2016.rows.length, 0);
  assert.equal(
    historyPoint(county2016, 'Die PARTEI', 'Kreistagswahl').status,
    'absent',
  );
});

test('partial 2026 results do not produce a misleading delta', () => {
  const partial = structuredClone(data2016);
  partial.year = '2026';
  partial.total['anz-schnellmeldungen'] = '100';
  assert.equal(historyPoint(partial, 'SPD').status, 'partial');
});
