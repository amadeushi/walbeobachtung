import archive2016 from '@/lib/data/archive-2016.json';
import county2016 from '@/lib/data/archive-kreistag-2016.json';
import archive from '@/lib/data/archive.json';
import { parseCSV, aggregate, type Dataset, type Meta } from '@/lib/elections';
const archiveFiles = archive.files as Record<string, string>;
const ROOT = 'http://wahlen.kreis-hi.de/wahlen/';
async function read(url: string) {
  const r = await fetch(url, {
    signal: AbortSignal.timeout(15000),
    cache: 'no-store',
  });
  if (!r.ok) throw Error(`Quelle antwortet mit ${r.status}`);
  return r.text();
}
export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const year = params.get('year') ?? '2021';
  const requested = params.get('wahl') ?? 'Stadtratswahl';
  const requestedLevel = params.get('level') ?? 'wahlbereiche';
  if (
    !['2016', '2021', '2026'].includes(year) ||
    ![
      'Stadtratswahl',
      'Kreiswahl',
      'Kreistagswahl',
      'Bürgermeisterwahl',
    ].includes(requested)
  )
    return Response.json({ error: 'Ungültige Auswahl' }, { status: 400 });
  if (year === '2016') {
    const data =
      requested === 'Kreiswahl' || requested === 'Kreistagswahl'
        ? county2016
        : archive2016;
    return Response.json(data, {
      headers: { 'Cache-Control': 'public, max-age=3600' },
    });
  }
  const wahl = requested;
  const matchWahl =
    requested === 'Kreiswahl' || requested === 'Kreistagswahl'
      ? year === '2021'
        ? 'Kreiswahl'
        : 'Kreistagswahl'
      : requested;
  const county = requested === 'Kreiswahl' || requested === 'Kreistagswahl';
  const authority = county ? '03254000' : '03254021';
  const base =
    ROOT + (year === '2021' ? '20210912' : '20260913') + `/${authority}/`;
  const csvBase =
    base + (year === '2021' ? 'praesentation/' : 'daten/opendata/');
  try {
    let archived = false;
    let metadata: Meta;
    let warning: string | undefined;
    if (year === '2021' && !county) {
      metadata = archive.metadata;
    } else {
      metadata = JSON.parse(
        await read(
          base +
            (year === '2021'
              ? 'api/praesentation/open_data.json'
              : 'daten/opendata/open_data.json'),
        ),
      );
      if (!Array.isArray(metadata.csvs) || !Array.isArray(metadata.dateifelder))
        throw Error('Metadaten unvollständig');
    }
    const options = metadata.csvs.filter((c) => c.wahl === matchWahl);
    const overall = county
      ? options.find((c) => /Kreis-Ergebnis|Landkreis/.test(c.ebene))
      : options.find(
          (c) => c.ebene === 'Gemeinde-Ergebnis' || c.ebene === 'Gemeinde',
        );
    const detail = county
      ? requestedLevel === 'gemeinden'
        ? options.find((c) => /Gemeinde/i.test(c.ebene))
        : options.find((c) => /Wahlbereich/i.test(c.ebene))
      : (options.find((c) => /Ortsteil/.test(c.ebene)) ??
        options.find((c) => /Wahlbezirk/.test(c.ebene)));
    const selected = [
      ...new Set([overall, detail].filter(Boolean)),
    ] as Meta['csvs'];
    const tables = await Promise.all(
      selected.map(async (c) => {
        if (!/^Open-Data-[A-Za-z0-9_-]+\.csv$/.test(c.url))
          throw Error('Nicht unterstützter Dateiname');
        let raw: string;
        try {
          raw = await read(csvBase + c.url);
        } catch (e) {
          if (year === '2021' && !county && archiveFiles[c.url]) {
            raw = archiveFiles[c.url];
            archived = true;
            warning =
              'Die Quelle ist gerade nicht erreichbar. Angezeigt wird der gespeicherte Originaldatenstand vom 08.09.2026.';
          } else throw e;
        }
        return { entry: c, rows: parseCSV(raw) };
      }),
    );
    const rows = tables.find((t) => t.entry === detail)?.rows ?? [];
    const total =
      tables.find((t) => t.entry === overall)?.rows[0] ?? aggregate(rows);
    const metadataOut = {
      ...metadata,
      dateifelder: metadata.dateifelder.map((f) =>
        f.name === matchWahl ? { ...f, name: wahl } : f,
      ),
    };
    const result: Dataset = {
      year,
      wahl,
      metadata: metadataOut,
      rows,
      total,
      level: detail?.ebene.includes('Ortsteil')
        ? 'Ortsteile'
        : /Gemeinde/i.test(detail?.ebene ?? '')
          ? 'Gemeinden im Landkreis'
          : /Wahlbereich/i.test(detail?.ebene ?? '')
            ? `Kreiswahlbereiche (${year === '2021' ? '12' : '11'})`
            : 'Wahlbezirke',
      areaLevel: county
        ? requestedLevel === 'gemeinden'
          ? 'gemeinden'
          : 'wahlbereiche'
        : 'ortsteile',
      sources: selected.map((c) => csvBase + c.url),
      retrieved: archived
        ? '08.09.2026'
        : new Date().toLocaleString('de-DE', { timeZone: 'Europe/Berlin' }),
      archived,
      warning,
    };
    return Response.json(result, {
      headers: { 'Cache-Control': 'public, max-age=30' },
    });
  } catch {
    return Response.json(
      { error: 'Die offiziellen Wahldaten konnten nicht abgerufen werden.' },
      { status: 502, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
