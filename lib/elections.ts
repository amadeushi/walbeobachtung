export type Row = Record<string, string>;
export type Meta = {
  csvs: { wahl: string; ebene: string; url: string }[];
  dateifelder: { name: string; parteien: { feld: string; wert: string }[] }[];
  file_timestamp?: string;
};
export type Dataset = {
  year: string;
  wahl: string;
  metadata: Meta;
  rows: Row[];
  total: Row | null;
  level: string;
  areaLevel?: string;
  sources: string[];
  retrieved: string;
  archived: boolean;
  warning?: string;
  absentParties?: string[];
  splitAvailable?: boolean;
  resultStatus?: string;
  comparison?: {
    scope: string;
    subareas: string;
    note: string;
  };
  sourceSHA256?: string;
  valueMode?: 'votes' | 'share';
  seats?: Record<string, number>;
  turnout?: number;
};
export function parseCSV(text: string): Row[] {
  const lines: string[][] = [];
  let row: string[] = [],
    cell = '',
    quoted = false;
  text = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else quoted = !quoted;
    } else if (c === ';' && !quoted) {
      row.push(cell);
      cell = '';
    } else if ((c === '\n' || c === '\r') && !quoted) {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell);
      if (row.some(Boolean)) lines.push(row);
      row = [];
      cell = '';
    } else cell += c;
  }
  if (cell || row.length) {
    row.push(cell);
    lines.push(row);
  }
  if (quoted) throw Error('Unvollständige CSV-Datei');
  const headers = lines.shift() || [];
  if (!headers.includes('gebiet-name') || !headers.includes('D'))
    throw Error('Unerwartetes Datenformat');
  return lines
    .filter((r) => r.some(Boolean))
    .map((r) => Object.fromEntries(headers.map((h, i) => [h, r[i] ?? ''])));
}
export const n = (v: unknown) => {
  if (v === '' || v == null) return 0;
  const x = Number(String(v).replace(',', '.'));
  return Number.isFinite(x) ? x : 0;
};
export function votes(r: Row | undefined | null, p: string) {
  if (!r) return 0;
  return n(r[p + '_summe_liste_kandidaten'] ?? r[p + '_4'] ?? r[p]);
}
export function listVotes(r: Row, p: string) {
  return n(r[p + '_liste'] ?? r[p + '_1']);
}
export function candidateVotes(r: Row, p: string) {
  return n(r[p + '_summe_kandidaten'] ?? r[p + '_3']);
}
export function aggregate(rows: Row[]): Row | null {
  if (!rows.length) return null;
  const total: Row = { 'gebiet-name': 'Stadt Hildesheim' };
  for (const key of Object.keys(rows[0]))
    if (/^(A\d*|B\d*|C\d*|D.*|(?:max|anz)-schnellmeldungen)$/.test(key))
      total[key] = String(rows.reduce((s, r) => s + n(r[key]), 0));
  return total;
}
export function shortName(name: string) {
  const names: [RegExp, string][] = [
    [/basisdemokratische|^Die PARTEI$/i, 'Die PARTEI'],
    [/Sozialdemokratische/, 'SPD'],
    [/Christlich Demokratische/, 'CDU'],
    [/BÜNDNIS 90/, 'GRÜNE'],
    [/Alternative für/, 'AfD'],
    [/Unabhängigen/, 'Unabhängige'],
    [/Freie Demokratische/, 'FDP'],
    [/Die Linke/i, 'DIE LINKE'],
    [/FREIE WÄHLER/, 'FREIE WÄHLER'],
    [/INTERKULTURELLE|Interkulturelle/, 'Interkulturelle Liga'],
    [/Piratenpartei/, 'PIRATEN'],
    [/Bündnis Sahra Wagenknecht/i, 'BSW'],
    [/Volt Deutschland/i, 'Volt'],
    [/Wählerplattform Gemeinsam Plus/i, 'Gemeinsam+'],
    [/Wählergemeinschaft "Wir für Einum"/i, 'Wir für Einum'],
    [/Wahl-Alternative-Sarstedt/i, 'WAS'],
  ];
  return (
    names.find(([re]) => re.test(name))?.[1] ??
    name.replace(/^Einzelwahlvorschlag\s+/, '')
  );
}
export function partyColors(name: string) {
  const colors: [RegExp, string, string][] = [
    [/^SPD$|Sozialdemokratische/i, '#E3000F', '#FFFFFF'],
    [/^CDU$|Christlich Demokratische/i, '#161616', '#FFFFFF'],
    [/GRÜNE|BÜNDNIS 90/i, '#46962B', '#FFFFFF'],
    [/^FDP$|Freie Demokratische/i, '#FFED00', '#142238'],
    [/AfD|Alternative für/i, '#C9A77D', '#142238'],
    [/DIE LINKE|Die Linke/i, '#BE3075', '#FFFFFF'],
    [/FREIE WÄHLER/i, '#F28C00', '#142238'],
    [/Die PARTEI|basisdemokratische/i, '#B5152B', '#FFFFFF'],
    [/PIRATEN|Piratenpartei/i, '#FF8800', '#142238'],
    [/Unabhängig/i, '#24766F', '#FFFFFF'],
    [/GUT für Sarstedt/i, '#5B8F22', '#FFFFFF'],
    [/Interkulturelle Liga/i, '#6D3C91', '#FFFFFF'],
    [/^BSW$|Bündnis Sahra Wagenknecht/i, '#7B1E5A', '#FFFFFF'],
    [/^Volt$|Volt Deutschland/i, '#502379', '#FFFFFF'],
    [/Gemeinsam\+/i, '#167D8D', '#FFFFFF'],
    [/^WAS$|Wahl-Alternative-Sarstedt/i, '#1B5E8C', '#FFFFFF'],
    [/Wir für Einum/i, '#276749', '#FFFFFF'],
    [/^Rotter$/i, '#596579', '#FFFFFF'],
    [/^Rudolph$/i, '#7A5C45', '#FFFFFF'],
    [/^Rössig$/i, '#536B5E', '#FFFFFF'],
    [/Wählergruppen/i, '#58738A', '#FFFFFF'],
    [/Einzelbewerb/i, '#6B7280', '#FFFFFF'],
    [/Olaf Levonen/i, '#E3000F', '#FFFFFF'],
    [/Christian Berndt/i, '#161616', '#FFFFFF'],
    [/Martin Gottschlich/i, '#FFED00', '#142238'],
  ];
  const match = colors.find(([pattern]) => pattern.test(name));
  return match
    ? { background: match[1], foreground: match[2] }
    : { background: '#365A78', foreground: '#FFFFFF' };
}
export function parties(meta: Meta, wahl: string) {
  const name =
    wahl === 'Bürgermeisterwahl' ? 'Wahl des/der Oberbürgermeisters/in' : wahl;
  return (meta.dateifelder.find((f) => f.name === name)?.parteien ?? []).map(
    (p) => ({ id: p.feld, name: shortName(p.wert), full: p.wert }),
  );
}
// Resolve the focus only against the active election, never against a previous
// election's D1/D2 identifiers (which can represent different nominations).
export function resolveFocus(
  options: ReturnType<typeof parties>,
  requested: string,
) {
  return (
    options.find((p) => p.name === requested) ??
    options.find((p) => p.name === 'Die PARTEI') ??
    options[0]
  );
}
