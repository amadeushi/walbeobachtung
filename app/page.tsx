'use client';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
} from '@/components/ui/pagination';
import { useEffect, useState, type CSSProperties } from 'react';
import {
  ArrowUpRight,
  RefreshCw,
  Users,
  CheckCheck,
  Vote,
  CalendarDays,
  Info,
  Maximize,
  Minimize,
  Monitor,
} from 'lucide-react';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from '@/components/ui/table';
import History from '@/components/history';
import PeopleRanking from '@/components/people-ranking';
import ElectionNight from '@/components/election-night';
import SeatProjection from '@/components/seat-projection';
import { comparisonRule } from '@/lib/comparability';
import { allocateSeats, SEAT_COUNTS, seatKeyFromName } from '@/lib/seat-allocation';
import archive from '@/lib/data/archive.json';
import {
  parseCSV,
  n,
  votes,
  listVotes,
  candidateVotes,
  parties,
  resolveFocus,
  partyColors,
  type Dataset,
} from '@/lib/elections';
const fmt = (x: number) => x.toLocaleString('de-DE');
const pct = (x: number) =>
  x.toLocaleString('de-DE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
const initial: Dataset = {
  year: '2021',
  wahl: 'Stadtratswahl',
  metadata: archive.metadata,
  rows: parseCSV(
    archive.files['Open-Data-03254021-Stadtratswahl-Ortsteil.csv'],
  ),
  total: parseCSV(
    archive.files['Open-Data-03254021-Stadtratswahl-Gemeinde.csv'],
  )[0],
  level: 'Ortsteile',
  sources: [
    'http://wahlen.kreis-hi.de/wahlen/20210912/03254021/praesentation/Open-Data-03254021-Stadtratswahl-Gemeinde.csv',
  ],
  retrieved: archive.retrieved,
  archived: true,
};
function Picker({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="filter">
      <label>{label}</label>
      <Select value={value} onValueChange={(v) => v && onChange(v)}>
        <SelectTrigger aria-label={label}>
          <SelectValue>
            {options.find((o) => o.value === value)?.label ?? value}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
export default function Home() {
  const [year, setYear] = useState('2026'),
    [wahl, setWahl] = useState('Stadtratswahl'),
    [requestedParty, setRequestedParty] = useState('Die PARTEI'),
    [area, setArea] = useState('all'),
    [areaLevel, setAreaLevel] = useState('wahlbereiche'),
    [data, setData] = useState<Dataset>(initial),
    [loading, setLoading] = useState(false),
    [error, setError] = useState(''),
    [refresh, setRefresh] = useState(0),
    [sort, setSort] = useState('share'),
    [projection, setProjection] = useState(true),
    [view, setView] = useState('electionnight'),
    [page, setPage] = useState(0),
    [fullscreen, setFullscreen] = useState(false),
    [quoteIndex, setQuoteIndex] = useState(0);
  const quotes = [
    {
      text: 'Niemand hat die Absicht, eine Mauer zu errichten.',
      author: 'Walter Ulbricht',
      year: '1961',
      source: 'https://www.hdg.de/lemo/jahreschronik/1961.html',
    },
    {
      text: 'Mit Verlaub, Herr Präsident, Sie sind ein Arschloch!',
      author: 'Joschka Fischer',
      year: '1984',
      source:
        'https://www.bundestag.de/dokumente/textarchiv/07-richard-stuecklen-405200',
    },
    {
      text: 'Zum Mitschreiben: Die Rente ist sicher.',
      author: 'Norbert Blüm',
      year: '1997',
      source:
        'https://www.bundestag.de/dokumente/textarchiv/1997-10-10-rente-209618',
    },
    {
      text: 'Was kümmert mich mein Geschwätz von gestern.',
      author: 'Konrad Adenauer',
      year: '1957',
      source: 'https://www.konrad-adenauer.de/seite/zitate/',
    },
    {
      text: 'Wer Visionen hat, sollte zum Arzt gehen.',
      author: 'Helmut Schmidt',
      year: '1980',
      source: 'https://www.helmut-schmidt.de/leben-und-wirken/zitate',
    },
    {
      text: 'Rechts von uns ist nur noch die Wand.',
      author: 'Franz Josef Strauß',
      year: '1987',
      source: 'https://www.hdg.de/lemo/biografie/franz-josef-strauss.html',
    },
    {
      text: 'Ich gebe Ihnen mein Ehrenwort.',
      author: 'Uwe Barschel',
      year: '1987',
      source: 'https://www.hdg.de/lemo/jahreschronik/1987.html',
    },
    {
      text: 'Hol mir mal ne Flasche Bier.',
      author: 'Gerhard Schröder',
      year: '2002',
      source: 'https://www.bundestag.de/dokumente/textarchiv',
    },
    {
      text: 'Die Maut wird kommen.',
      author: 'Alexander Dobrindt',
      year: '2013',
      source: 'https://www.bundestag.de/dokumente/textarchiv',
    },
    {
      text: 'Wir schaffen das.',
      author: 'Angela Merkel',
      year: '2015',
      source: 'https://www.bundesregierung.de/breg-de/aktuelles/merkel-wir-schaffen-das-454634',
    },
    {
      text: 'Das Internet ist für uns alle Neuland.',
      author: 'Angela Merkel',
      year: '2013',
      source: 'https://www.bundesregierung.de/breg-de/aktuelles/merkel-internet-neuland-477864',
    },
    {
      text: 'Bayern ist ein Staat, aber kein Freistaat.',
      author: 'Edmund Stoiber',
      year: '2002',
      source: 'https://www.hdg.de/lemo/biografie/edmund-stoiber.html',
    },
    {
      text: 'Das ist die dümmste Regierung, die wir je hatten.',
      author: 'Herbert Wehner',
      year: '1976',
      source: 'https://www.hdg.de/lemo/biografie/herbert-wehner.html',
    },
    {
      text: 'Der Staat ist kein Selbstbedienungsladen.',
      author: 'Peer Steinbrück',
      year: '2009',
      source: 'https://www.bundestag.de/dokumente/textarchiv',
    },
    {
      text: 'Ich führe keine Strichliste.',
      author: 'Annegret Kramp-Karrenbauer',
      year: '2019',
      source: 'https://www.bundestag.de/dokumente/textarchiv',
    },
    {
      text: 'Ich will nicht Kanzlerin werden.',
      author: 'Angela Merkel',
      year: '2005',
      source: 'https://www.bundesregierung.de/breg-de/aktuelles',
    },
    {
      text: 'Das Volk ist jeder, der in diesem Lande lebt.',
      author: 'Gustav Heinemann',
      year: '1971',
      source: 'https://www.bundespraesident.de/DE/amt-und-aufgaben/reden-und-interviews/reden-und-interviews-node.html',
    },
    {
      text: 'Es kann mich niemand daran hindern, über Nacht klüger zu werden.',
      author: 'Konrad Adenauer',
      year: '1952',
      source: 'https://www.konrad-adenauer.de/seite/zitate/',
    },
    {
      text: 'Wer zu spät kommt, den bestraft das Leben.',
      author: 'Michail Gorbatschow',
      year: '1989',
      source: 'https://www.hdg.de/lemo/jahreschronik/1989.html',
    },
    {
      text: 'Politik ist die Kunst des Möglichen.',
      author: 'Otto von Bismarck',
      year: '1867',
      source: 'https://www.bismarck-stiftung.de/ausstellung/otto-von-bismarck/zitate/',
    },
  ];
  useEffect(() => {
    const sync = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', sync);
    return () => document.removeEventListener('fullscreenchange', sync);
  }, []);
  useEffect(() => {
    try {
      const remembered = window.localStorage.getItem('walbeobachtung-party');
      if (remembered) setRequestedParty(remembered);
    } catch {}
  }, []);
  const chooseParty = (value: string) => {
    setRequestedParty(value);
    try { window.localStorage.setItem('walbeobachtung-party', value); } catch {}
  };
  useEffect(() => {
    const id = window.setInterval(
      () => setQuoteIndex((index) => (index + 1) % quotes.length),
      30000,
    );
    return () => window.clearInterval(id);
  }, [quotes.length]);
  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      setError(
        'Vollbild ist hier nicht verfügbar. Bitte das Browserfenster maximieren.',
      );
    }
  }
  useEffect(() => {
    if (projection && year === '2026' && ['electionnight', 'seats'].includes(view)) return;
    const controller = new AbortController();
    setLoading(true);
    setError('');
    fetch(
      `./api/elections.php?year=${year}&wahl=${encodeURIComponent(year === '2021' && wahl === 'Kreistagswahl' ? 'Kreiswahl' : wahl)}&level=${areaLevel}`,
      {
        signal: controller.signal,
      },
    )
      .then(async (r) => {
        if (!r.ok)
          throw Error(
            'Die Wahldaten sind gerade nicht erreichbar. Bitte erneut versuchen.',
          );
        return r.json() as Promise<Dataset>;
      })
      .then((d) => {
        if (!controller.signal.aborted) setData(d);
      })
      .catch((e) => {
        if (e.name !== 'AbortError') setError(e.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [year, wahl, areaLevel, refresh, projection, view]);
  useEffect(() => {
    if (year !== '2026') return;
    const id = setInterval(() => setRefresh((x) => x + 1), 20000);
    return () => clearInterval(id);
  }, [year]);
  const apiWahl =
    year === '2021' && wahl === 'Kreistagswahl' ? 'Kreiswahl' : wahl;
  const county = wahl === 'Kreistagswahl' || wahl === 'Landratswahl';
  const isOrtsrat = wahl.startsWith('Ortsratswahl (');
  const directElection = wahl === 'Bürgermeisterwahl' || wahl === 'Landratswahl';
  const ready =
    data.year === year &&
    data.wahl === apiWahl &&
    (wahl !== 'Kreistagswahl' || year === '2016' || data.areaLevel === areaLevel);
  const ps = ready ? parties(data.metadata, apiWahl) : [];
  const absent = ready && data.absentParties?.includes(requestedParty);
  const selected = absent ? undefined : resolveFocus(ps, requestedParty);
  const party = selected?.name ?? 'Die PARTEI';
  const theme = partyColors(party);
  const row = ready
    ? area === 'all'
      ? data.total
      : data.rows.find((r, i) => String(i) === area)
    : null;
  const hasResult = !!row && n(row.D) > 0;
  const shareOnly = ready && data.valueMode === 'share';
  const v = selected ? votes(row, selected.id) : 0;
  const share = row && n(row.D) > 0 ? (v / n(row.D)) * 100 : 0;
  const ranking = ps
    .map((p) => ({ ...p, v: votes(row, p.id) }))
    .sort((a, b) => b.v - a.v);
  const rank = selected
    ? ranking.findIndex((p) => p.id === selected.id) + 1
    : 0;
  const overviewSeatCount = SEAT_COUNTS[seatKeyFromName(wahl)];
  const overviewSeats = area === 'all' && !shareOnly && hasResult && overviewSeatCount && selected
    ? allocateSeats(ranking.map((item) => ({ id: item.id, name: item.name, votes: item.v })), overviewSeatCount)
        .find((item) => item.id === selected.id)?.seats
    : undefined;
  const areas = ready
    ? data.rows
        .map((r, i) => ({
          r,
          i,
          v: selected ? votes(r, selected.id) : 0,
          share:
            selected && n(r.D) ? (votes(r, selected.id) / n(r.D)) * 100 : 0,
        }))
        .sort((a, b) =>
          sort === 'name'
            ? a.r['gebiet-name'].localeCompare(b.r['gebiet-name'], 'de')
            : sort === 'votes'
              ? b.v - a.v
              : b.share - a.share,
        )
    : [];
  const chooseYear = (v: string) => {
    setYear(v);
    setArea('all');
    setPage(0);
    setError('');
    setView(v === '2026' ? 'electionnight' : 'overview');
    setWahl((w) =>
      (w === 'Bürgermeisterwahl' && v !== '2021') || (w === 'Landratswahl' && v === '2011')
          ? 'Stadtratswahl'
          : w,
    );
  };
  const chooseWahl = (v: string) => {
    setWahl(v);
    setArea('all');
    setPage(0);
    setError('');
  };
  const max = ranking[0]?.v || 1;
  const multiple =
    !!row &&
    selected &&
    (selected.id + '_summe_liste_kandidaten' in row ||
      selected.id + '_4' in row);
  const source = ready && data.sources?.[0]
    ? data.sources[0]
    : year === '2016'
      ? county
        ? 'https://wahlen.statistik.niedersachsen.de/KW2016/'
        : 'http://wahlen.rathaus-hildesheim.de/gw2016stadtrat_hildesheim.html'
      : `http://wahlen.kreis-hi.de/wahlen/${year === '2021' ? '20210912' : '20260913'}/${county ? '03254000' : '03254021'}/praesentation/opendata.html`;
  const pageSize = 6;
  const pageCount = Math.max(1, Math.ceil(areas.length / pageSize));
  const currentPage = Math.min(page, pageCount - 1);
  const visibleAreas = projection
    ? areas.slice(currentPage * pageSize, (currentPage + 1) * pageSize)
    : areas;
  return (
    <main
      className={'shell ' + (projection ? 'projection' : '')}
      data-view={view}
    >
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">
            <img src="/walbeobachtung-logo.png" alt="" />
          </span>
          <span className="brand-wordmark">
            <strong>Walbeobachtung</strong><span className="brand-domain">.partei-hildesheim.de</span>
          </span>
        </div>
        <span className="top-note">
          {projection && view === 'electionnight'
            ? 'Kommunalwahlen · 2026 · Stadt und Landkreis Hildesheim'
            : `${wahl === 'Bürgermeisterwahl' ? 'Oberbürgermeisterwahl' : wahl} · ${year} · ${county ? 'Landkreis Hildesheim' : 'Hildesheim'}`}
        </span>
        <div className="screen-controls">
          <button
            className="outline-button"
            aria-pressed={projection}
            onClick={() => setProjection((p) => !p)}
          >
            <Monitor />
            {projection ? 'Detailansicht' : 'Leinwand'}
          </button>
          <button className="outline-button" onClick={toggleFullscreen}>
            {fullscreen ? <Minimize /> : <Maximize />}
            {fullscreen ? 'Vollbild beenden' : 'Vollbild'}
          </button>
          <button
            className="outline-button projection-refresh"
            disabled={loading}
            onClick={() => setRefresh((x) => x + 1)}
          >
            <RefreshCw size={16} />{' '}
            {loading ? 'Wird aktualisiert …' : 'Daten aktualisieren'}
          </button>
        </div>
      </header>
      <div className="title-row">
        <div>
          <div className="eyebrow">
            {county ? 'Landkreis Hildesheim' : 'Stadt Hildesheim'} /
            Wahlergebnisse
          </div>
          <h1>Ergebnisse am Horizont.</h1>
          <div className="subtle">
            Parteien, Stimmen und Strömungen vor Ort.
          </div>
        </div>
        <button
          className="outline-button title-refresh"
          disabled={loading}
          onClick={() => setRefresh((x) => x + 1)}
        >
          <RefreshCw size={16} />{' '}
          {loading ? 'Wird aktualisiert …' : 'Daten aktualisieren'}
        </button>
      </div>
      <section
        className="quote-carousel"
        aria-label="Historische politische Zitate"
      >
        <div className="quote-wave" aria-hidden="true">
          ≈
        </div>
        <blockquote>
          <p>„{quotes[quoteIndex].text}“</p>
          <cite>
            <a
              href={quotes[quoteIndex].source}
              target="_blank"
              rel="noreferrer"
            >
              {quotes[quoteIndex].author} · {quotes[quoteIndex].year}
            </a>
          </cite>
        </blockquote>
        <div className="quote-controls" aria-label="Zitat auswählen">
          {quotes.map((quote, index) => (
            <button
              key={quote.author}
              className={index === quoteIndex ? 'active' : ''}
              onClick={() => setQuoteIndex(index)}
              aria-label={`Zitat ${index + 1} anzeigen`}
              aria-current={index === quoteIndex ? 'true' : undefined}
            />
          ))}
        </div>
      </section>
      <section
        className={`filters ${wahl === 'Kreistagswahl' ? 'county-filters' : ''}`}
        aria-label="Wahlergebnisse filtern"
      >
        <Picker
          label="WAHLJAHR"
          value={year}
          onChange={chooseYear}
          options={[
            { value: '2011', label: '2011 · Archiv' },
            { value: '2016', label: '2016 · Archiv' },
            { value: '2021', label: '2021 · Archiv' },
            { value: '2026', label: '2026 · Aktuell' },
          ]}
        />
        <Picker
          label="WAHL"
          value={wahl}
          onChange={chooseWahl}
          options={[
            { value: 'Stadtratswahl', label: 'Stadtratswahl' },
            ...(['2011', '2016', '2021', '2026'].includes(year) ? ['Achtum-Uppen','Bavenstedt','Drispenstedt','Einum','Himmelsthür','Itzum-Marienburg','Marienburger Höhe-Galgenberg','Moritzberg und Bockfeld','Neuhof-Hildesheimer Wald-Marienrode','Nordstadt','Ochtersum','Oststadt und Stadtfeld','Sorsum','Stadtmitte Neustadt'].map((name) => ({ value: `Ortsratswahl (${name})`, label: `Ortsrat · ${name}` })) : []),
            {
              value: 'Kreistagswahl',
              label: 'Kreistagswahl',
            },
            ...(['2016', '2021', '2026'].includes(year)
              ? [{ value: 'Landratswahl', label: 'Landratswahl' }]
              : []),
            ...(year === '2021'
              ? [
                  {
                    value: 'Bürgermeisterwahl',
                    label: 'Oberbürgermeisterwahl',
                  },
                ]
              : []),
          ]}
        />
        {wahl === 'Kreistagswahl' && year !== '2016' && (
          <Picker
            label="GEBIETSEBENE"
            value={areaLevel}
            onChange={(v) => {
              setAreaLevel(v);
              setArea('all');
              setPage(0);
            }}
            options={[
              {
                value: 'wahlbereiche',
                label: `Kreiswahlbereiche (${year === '2021' ? '12' : '11'})`,
              },
              { value: 'gemeinden', label: 'Gemeinden' },
            ]}
          />
        )}
        <Picker
          key={year + wahl + 'party'}
          label={
            directElection
              ? 'WAHLVORSCHLAG IM FOKUS'
              : 'PARTEI IM FOKUS'
          }
          value={party}
          onChange={(v) => {
            chooseParty(v);
            setPage(0);
          }}
          options={[
            ...(!ps.some((p) => p.name === party)
              ? [{ value: party, label: party }]
              : []),
            ...ps.map((p) => ({ value: p.name, label: p.name })),
          ]}
        />
        <Picker
          key={year + wahl + 'area'}
          label="GEBIET"
          value={area}
          onChange={setArea}
          options={[
            {
              value: 'all',
              label: county ? 'Gesamter Landkreis' : isOrtsrat ? 'Gesamter Ortsrat' : 'Gesamte Stadt',
            },
            ...(ready
              ? data.rows.map((r, i) => ({
                  value: String(i),
                  label: r['gebiet-name'],
                }))
              : []),
          ]}
        />
      </section>
      <div className={`notice ${error ? 'error' : ''}`} role="status">
        <span className="dot" />
        {error ||
          (ready && data.warning) ||
          (year === '2016'
            ? 'Archiv 2016 · Endergebnis vom 11. September 2016'
            : year === '2021'
              ? 'Archiv 2021 · Originalergebnisse vom 12. September 2021'
              : 'Wahl 2026 · Automatische Aktualisierung alle 20 Sekunden')}
      </div>
      {(!ready || !hasResult) && !(year === '2026' && ['electionnight', 'seats'].includes(view)) ? (
        <Tabs
          value={view}
          onValueChange={(v) => setView(String(v))}
          className="presentation-tabs unavailable-tabs"
        >
          <TabsList className="view-switch" aria-label="Leinwandansicht">
            {year === '2026' && <TabsTrigger value="electionnight">Alle Wahlen</TabsTrigger>}
            {year === '2026' && <TabsTrigger value="seats">Sitze</TabsTrigger>}
            <TabsTrigger value="overview">Überblick</TabsTrigger>
            <TabsTrigger value="votes">Stimmen</TabsTrigger>
            <TabsTrigger value="districts">Gebiete</TabsTrigger>
            <TabsTrigger value="history">Zeitvergleich</TabsTrigger>
          </TabsList>
          <TabsContent value={view} className="slide-content">
            <div className="empty persistent-empty">
              {ready ? <CalendarDays size={36} /> : <RefreshCw className={loading ? 'spin' : ''} />}
              <div className="eyebrow">Kommunalwahl {year}</div>
              <h2 style={{ marginTop: 12 }}>
                {ready ? 'Noch keine Ergebnisse verfügbar.' : loading ? 'Wahldaten werden geladen' : 'Daten nicht verfügbar'}
              </h2>
              <p>
                {error || (ready
                  ? 'Für diese Wahl liegen noch keine auswertbaren Schnellmeldungen vor. Neue Veröffentlichungen werden automatisch abgefragt.'
                  : 'Die veröffentlichten Ergebnisse werden abgerufen.')}
              </p>
              <button
                className="outline-button"
                onClick={() => {
                  if (year === '2026') setView('electionnight');
                  else {
                    setYear('2021'); setWahl('Stadtratswahl'); setArea('all');
                    setPage(0);
                  }
                }}
              >
                {year === '2026' ? 'Zurück zu Alle Wahlen' : 'Ergebnisse von 2021 erkunden'} <ArrowUpRight />
              </button>
            </div>
          </TabsContent>
        </Tabs>
      ) : (
        <>
          <Tabs
            value={view}
            onValueChange={(v) => setView(String(v))}
            className="presentation-tabs"
          >
            <TabsList className="view-switch" aria-label="Leinwandansicht">
              {year === '2026' && <TabsTrigger value="electionnight">Alle Wahlen</TabsTrigger>}
              {year === '2026' && <TabsTrigger value="seats">Sitze</TabsTrigger>}
              <TabsTrigger value="overview">Überblick</TabsTrigger>
              <TabsTrigger value="votes">Stimmen</TabsTrigger>
              <TabsTrigger value="districts">Gebiete</TabsTrigger>
              <TabsTrigger value="history">Zeitvergleich</TabsTrigger>
            </TabsList>
            <TabsContent
              value={view}
              className="slide-content"
            >
              {view === 'electionnight' && <ElectionNight refresh={refresh} party={requestedParty} onPartyChange={chooseParty} />}
              {view === 'seats' && <SeatProjection refresh={refresh} />}
              <div className="dashboard">
                <section
                  className="panel focus-panel"
                  style={
                    {
                      backgroundColor: theme.background,
                      color: theme.foreground,
                      '--party-ink': theme.foreground,
                    } as CSSProperties
                  }
                >
                  <img
                    className="focus-whale"
                    src="/walbeobachtung-logo.png"
                    alt=""
                    aria-hidden="true"
                  />
                  <div className="focus-head">
                    <div>
                      <div className="eyebrow">
                        {directElection
                          ? 'Wahlvorschlag im Fokus'
                          : 'Partei im Fokus'}
                      </div>
                      <h2 className="focus-name">{party}</h2>
                    </div>
                    <span className="party-tag">
                      <i />
                      {year !== '2026'
                        ? `Ergebnis ${year}`
                        : 'Zwischenstand 2026'}
                    </span>
                  </div>
                  {selected ? (
                    <>
                      <div className="score">
                        {pct(share)} <span>%</span>
                      </div>
                      <div className="subtle">
                        der gültigen Stimmen · {row?.['gebiet-name']}
                      </div>
                      <div className="focus-bottom">
                        <div>
                          <strong>{shareOnly ? `${pct(v)} %` : fmt(v)}</strong>
                          <small>{shareOnly ? 'Historischer Anteil' : 'Stimmen insgesamt'}</small>
                        </div>
                        <div>
                          <strong>
                            {rank}{' '}
                            <span style={{ fontSize: 14, fontWeight: 400 }}>
                              von {ps.length}
                            </span>
                          </strong>
                          <small>Rang nach Stimmen</small>
                        </div>
                        <div>
                          <strong>{shareOnly ? (data.seats?.[party] ?? '—') : overviewSeats !== undefined ? overviewSeats : `${fmt(n(row?.['anz-schnellmeldungen']))}/${fmt(n(row?.['max-schnellmeldungen']))}`}</strong>
                          <small>{shareOnly ? 'Sitze' : overviewSeats !== undefined ? 'projizierte Sitze' : 'Meldungen'}</small>
                        </div>
                      </div>
                    </>
                  ) : (
                    <p
                      className="info"
                      style={{ color: '#cfdae8', marginTop: 35 }}
                    >
                      {absent
                        ? 'Die PARTEI ist 2016 nicht angetreten. Daher gibt es keinen Stimmenanteil und keinen berechenbaren Zugewinn gegenüber 2016.'
                        : `Für ${party} enthält diese Wahl keine Parteienzuordnung. Bitte eine verfügbare Partei auswählen.`}
                    </p>
                  )}
                </section>
                <div className="metric-grid">
                  <Metric
                    label={shareOnly ? 'Datengrundlage' : 'Gültige Stimmen'}
                    value={shareOnly ? 'Anteile 2011' : fmt(n(row?.D))}
                    hint={
                      shareOnly
                        ? 'Historisches Gesamtergebnis'
                        : multiple
                        ? 'Listen- und Personenstimmen'
                        : 'Alle gültigen Stimmen'
                    }
                    icon={<Vote />}
                  />
                  <Metric
                    label="Wahlbeteiligung"
                    value={
                      shareOnly && data.turnout != null
                        ? `${pct(data.turnout)} %`
                        : n(row?.A) > 0
                        ? pct((n(row?.B) / n(row?.A)) * 100) + ' %'
                        : '—'
                    }
                    hint={
                      shareOnly
                        ? 'Dokumentierte Wahlbeteiligung'
                        : n(row?.A) > 0
                        ? `${fmt(n(row?.B))} Wählende`
                        : 'Keine geeignete Bezugsgröße'
                    }
                    icon={<Users />}
                  />
                  <Metric
                    label={shareOnly ? 'Sitze im Ortsrat' : 'Wahlberechtigte'}
                    value={shareOnly ? String(Object.values(data.seats ?? {}).reduce((sum, seats) => sum + seats, 0) || '—') : n(row?.A) > 0 ? fmt(n(row?.A)) : '—'}
                    hint={shareOnly ? 'Dokumentierte Sitzverteilung' : 'im ausgewählten Gebiet'}
                    icon={<Users />}
                  />
                  <Metric
                    label={shareOnly ? 'Datenstand' : 'Meldungsstand'}
                    value={
                      shareOnly
                        ? 'Endergebnis'
                        : n(row?.['max-schnellmeldungen']) > 0
                        ? pct(
                            (n(row?.['anz-schnellmeldungen']) /
                              n(row?.['max-schnellmeldungen'])) *
                              100,
                          ) + ' %'
                        : '—'
                    }
                    hint={shareOnly ? 'Historischer Vergleichswert' : `${fmt(n(row?.['anz-schnellmeldungen']))} eingegangene Meldungen`}
                    icon={<CheckCheck />}
                  />
                </div>
                <section className="panel comparison">
                  <div className="panel-heading">
                    <div>
                      <h2>
                        {directElection
                          ? 'Wahlvorschläge im Vergleich'
                          : 'Parteien im Vergleich'}
                      </h2>
                      <p className="subtle">Anteil an allen gültigen Stimmen</p>
                    </div>
                    <span className="pill">{year}</span>
                  </div>
                  <div className="bars">
                    {ranking.map((p) => (
                      <button
                        key={p.id}
                        className={
                          'bar-row ' + (selected?.id === p.id ? 'selected' : '')
                        }
                        title={shareOnly ? `${p.full}: ${pct(p.v)} %` : `${p.full}: ${fmt(p.v)} Stimmen`}
                        onClick={() => {
                          chooseParty(p.name);
                          setPage(0);
                        }}
                      >
                        <span>{p.name}</span>
                        <div className="track">
                          <div
                            className="fill"
                            style={{
                              width: `${(p.v / max) * 100}%`,
                              backgroundColor: partyColors(p.name).background,
                            }}
                          />
                        </div>
                        <span className="bar-value">
                          {pct((p.v / n(row?.D)) * 100)} %
                        </span>
                      </button>
                    ))}
                  </div>
                </section>
                <section className="panel breakdown">
                  <div className="panel-heading">
                    <div>
                      <h2>Woher kommen die Stimmen?</h2>
                      <p className="subtle">
                        {party} · {row?.['gebiet-name']}
                      </p>
                    </div>
                    <Vote size={21} color="#78869a" />
                  </div>
                  {selected && multiple && row ? (
                    <>
                      <div className="splitbar" aria-hidden="true">
                        <div
                          style={{
                            width: `${v ? (listVotes(row, selected.id) / v) * 100 : 0}%`,
                            backgroundColor: theme.background,
                          }}
                        />
                        <div style={{ flex: 1 }} />
                      </div>
                      <div className="split-legend">
                        <div>
                          <span style={{ color: theme.background }}>●</span>{' '}
                          Listenstimmen
                          <strong>{fmt(listVotes(row, selected.id))}</strong>
                          <span className="subtle">
                            {v
                              ? pct((listVotes(row, selected.id) / v) * 100)
                              : '0,00'}{' '}
                            % der Parteistimmen
                          </span>
                        </div>
                        <div>
                          <span style={{ color: '#8291a6' }}>●</span>{' '}
                          Personenstimmen
                          <strong>
                            {fmt(candidateVotes(row, selected.id))}
                          </strong>
                          <span className="subtle">
                            {v
                              ? pct(
                                  (candidateVotes(row, selected.id) / v) * 100,
                                )
                              : '0,00'}{' '}
                            % der Parteistimmen
                          </span>
                        </div>
                      </div>
                      <p className="info">
                        Der Stimmenanteil umfasst die Stimmen für die Liste und
                        alle Kandidierenden dieser Partei. Bezugsgröße sind die
                        gültigen Stimmen aller Parteien.
                      </p>
                    </>
                  ) : (
                    <p className="info">
                      {selected
                        ? data.splitAvailable === false
                          ? 'Das Archiv 2016 enthält Parteistimmen insgesamt, aber keine getrennten Listen- und Personenstimmen. Diese Aufteilung wird nicht geschätzt.'
                          : 'Bei dieser Direktwahl gibt es keine Aufteilung in Listen- und Personenstimmen.'
                        : 'Für diese Partei ist keine Auswertung verfügbar.'}
                    </p>
                  )}
                  <div className="divider">
                    <div className="eyebrow">Daten & Einordnung</div>
                    <p className="info">{comparisonRule(wahl, area).reason}</p>
                    <p className="info">
                      {year !== '2026'
                        ? `Originaldaten der Kommunalwahl ${year}.`
                        : 'Die Ergebnisse können sich während der Auszählung verändern.'}{' '}
                      Der Meldungsstand zeigt eingegangene Schnellmeldungen und
                      ist keine Bestätigung eines amtlichen Endergebnisses.
                    </p>
                    <a
                      className="outline-button"
                      href={source}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Offizielle Datenquelle <ArrowUpRight />
                    </a>
                  </div>
                </section>
                {(!projection || view === 'votes') && (
                  <PeopleRanking year={year} wahl={wahl} area={area} refresh={refresh} />
                )}
              </div>
              <section className="panel districts">
                <div className="panel-heading">
                  <div>
                    <h2>{party} vor Ort</h2>
                    <p className="subtle">
                      {data.level} · Gebiet anklicken für die Detailansicht
                    </p>
                  </div>
                  <Picker
                    label="SORTIERUNG"
                    value={sort}
                    onChange={(v) => {
                      setSort(v);
                      setPage(0);
                    }}
                    options={[
                      { value: 'share', label: 'Stimmenanteil ↓' },
                      { value: 'votes', label: 'Stimmenzahl ↓' },
                      { value: 'name', label: 'Gebiet A–Z' },
                    ]}
                  />
                </div>
                {selected ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Gebiet</TableHead>
                        <TableHead className="num">Stimmen</TableHead>
                        <TableHead>Stimmenanteil</TableHead>
                        <TableHead className="num">Meldungen</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {visibleAreas.map((a) => (
                        <TableRow
                          key={a.i}
                          data-state={
                            area === String(a.i) ? 'selected' : undefined
                          }
                        >
                          <TableCell>
                            <button
                              className="district-name"
                              onClick={() => {
                                setArea(String(a.i));
                                setView('overview');
                                window.scrollTo({ top: 0, behavior: 'smooth' });
                              }}
                            >
                              {a.r['gebiet-name']}
                            </button>
                          </TableCell>
                          <TableCell className="num">
                            {n(a.r['anz-schnellmeldungen']) ? fmt(a.v) : '—'}
                          </TableCell>
                          <TableCell>
                            <div className="tablebar">
                              <div className="track">
                                <div
                                  className="fill"
                                  style={{
                                    width: `${(a.share / Math.max(...areas.map((a) => a.share), 1)) * 100}%`,
                                    backgroundColor: theme.background,
                                  }}
                                />
                              </div>
                              {n(a.r.D) ? pct(a.share) + ' %' : '—'}
                            </div>
                          </TableCell>
                          <TableCell className="num">
                            {a.r['anz-schnellmeldungen']} /{' '}
                            {a.r['max-schnellmeldungen']}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="info">
                    Bitte eine verfügbare Partei auswählen.
                  </p>
                )}
                <div className="paging">
                  {projection && (
                    <>
                      <span>
                        {currentPage * pageSize + 1}–
                        {Math.min((currentPage + 1) * pageSize, areas.length)}{' '}
                        von {areas.length} Gebieten
                      </span>
                      <Pagination
                        className="area-pagination"
                        aria-label="Gebietsseiten"
                      >
                        <PaginationContent>
                          <PaginationItem>
                            <button
                              className="outline-button"
                              disabled={currentPage === 0}
                              onClick={() => setPage((p) => Math.max(0, p - 1))}
                            >
                              ← Zurück
                            </button>
                          </PaginationItem>
                          <PaginationItem>
                            <span>
                              {' '}
                              {currentPage + 1} / {pageCount}{' '}
                            </span>
                          </PaginationItem>
                          <PaginationItem>
                            <button
                              className="outline-button"
                              disabled={currentPage + 1 >= pageCount}
                              onClick={() => setPage((p) => p + 1)}
                            >
                              Weiter →
                            </button>
                          </PaginationItem>
                        </PaginationContent>
                      </Pagination>
                    </>
                  )}
                </div>
                <p className="info district-note" style={{ marginBottom: 0 }}>
                  Gebietsanteile beziehen sich auf die gültigen Stimmen im
                  jeweiligen Gebiet. Briefwahl ist entsprechend der Zuordnung
                  der Quelle enthalten; Gebietsebenen werden nicht miteinander
                  aufsummiert.
                </p>
              </section>
              <section className="panel historical">
                {(!projection || view === 'history') && (
                  <History
                    wahl={wahl}
                    area={area}
                    party={party}
                    archive2021={initial}
                    current={ready ? data : undefined}
                  />
                )}
              </section>
            </TabsContent>
          </Tabs>
        </>
      )}
      {ready && data.warning && (
        <p className="notice">
          <Info size={16} />
          {data.warning}
        </p>
      )}
      <footer>
        <span>
          Walbeobachtung · Unabhängige Darstellung der offiziellen Wahldaten
        </span>
        <span>
          {ready
            ? (data.archived ? 'Archiv gespeichert am ' : 'Abgerufen am ') +
              data.retrieved
            : ''}{' '}
          ·{' '}
          <a href={source} target="_blank" rel="noreferrer">
            Quelle & Datenformat ↗
          </a>
        </span>
      </footer>
    </main>
  );
}
function Metric({
  label,
  value,
  hint,
  icon,
}: {
  label: string;
  value: string;
  hint: string;
  icon: React.ReactNode;
}) {
  return (
    <section className="panel metric">
      <div className="metric-label">
        {label}
        {icon}
      </div>
      <strong>{value}</strong>
      <small>{hint}</small>
    </section>
  );
}
