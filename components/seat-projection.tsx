'use client';

import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { AlertTriangle, Eye, ExternalLink, RefreshCw } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { partyColors } from '@/lib/elections';
import { allocateSeats, SEAT_COUNTS } from '@/lib/seat-allocation';

type PartyResult = { id: string; name: string; votes: number };
type ElectionResult = { key: string; name: string; scope: string; valid: number; reports: number; maxReports: number; parties: PartyResult[] };
type ElectionNightData = { elections: ElectionResult[]; retrieved: string };
const STADTRAT_EXAMPLE: ElectionResult = {
  key: 'stadtrat', name: 'Stadtrat', scope: 'Stadt Hildesheim', valid: 1001, reports: 125, maxReports: 125,
  parties: [
    ['CDU', 270], ['SPD', 267], ['GRÜNE', 243], ['FDP', 50], ['Die Unabhängigen', 44],
    ['DIE LINKE', 41], ['AfD', 41], ['Die PARTEI', 24], ['Interkulturelle Liga', 14],
    ['FREIE WÄHLER', 6], ['Einzelbewerber', 1],
  ].map(([name, votes], index) => ({ id: `example-${index}`, name: String(name), votes: Number(votes) })),
};

function seatPoints(count: number) {
  const rows = count > 50 ? 5 : count > 20 ? 4 : 2;
  const radii = Array.from({ length: rows }, (_, index) => 116 + index * (142 / Math.max(1, rows - 1)));
  const weight = radii.reduce((sum, radius) => sum + radius, 0);
  const perRow = radii.map((radius) => Math.max(2, Math.floor((radius / weight) * count)));
  while (perRow.reduce((sum, value) => sum + value, 0) < count) perRow[perRow.length - 1] += 1;
  while (perRow.reduce((sum, value) => sum + value, 0) > count) perRow[perRow.length - 1] -= 1;
  return radii.flatMap((radius, row) => Array.from({ length: perRow[row] }, (_, index) => {
    const angle = Math.PI - (index + .5) * Math.PI / perRow[row];
    return { x: 300 + Math.cos(angle) * radius, y: 282 - Math.sin(angle) * radius };
  })).sort((a, b) => Math.atan2(282 - a.y, a.x - 300) - Math.atan2(282 - b.y, b.x - 300));
}

export default function SeatProjection({ refresh }: { refresh: number }) {
  const [data, setData] = useState<ElectionNightData>();
  const [selected, setSelected] = useState('stadtrat');
  const [error, setError] = useState('');
  const [showExample, setShowExample] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    const timeout = window.setTimeout(() => controller.abort(), 16000);
    fetch('./api/elections.php?year=2026&wahl=Stadtratswahl&action=wahlabend', { cache: 'no-store', signal: controller.signal })
      .then(async (response) => {
        const raw = await response.text();
        let body: ElectionNightData & { error?: string };
        try { body = JSON.parse(raw) as ElectionNightData & { error?: string }; }
        catch { throw new Error('Der Wahlserver antwortet momentan verzögert.'); }
        if (!response.ok || body.error) throw new Error(body.error || 'Abruf fehlgeschlagen');
        return body as ElectionNightData;
      })
      .then((body) => { setData(body); setError(''); })
      .catch(async (reason) => {
        if (!active) return;
        try {
          const fallback = await fetch(`./data/wahlabend-last.json?v=${refresh}`, { cache: 'no-store' });
          const body = await fallback.json() as ElectionNightData;
          if (active) { setData(body); setError('Die Livequelle antwortet verzögert; letzter amtlicher Stand.'); }
        } catch { if (active) setError(reason?.message || 'Abruf fehlgeschlagen'); }
      })
      .finally(() => clearTimeout(timeout));
    return () => { active = false; clearTimeout(timeout); controller.abort(); };
  }, [refresh]);

  const elections = useMemo(() => data?.elections.filter((election) => SEAT_COUNTS[election.key]) ?? [], [data]);
  const election = elections.find((item) => item.key === selected) ?? elections[0];
  const exampleActive = showExample && (!election || election.reports === 0 || election.valid === 0);
  const displayedElection = exampleActive ? STADTRAT_EXAMPLE : election;
  const seatCount = displayedElection ? SEAT_COUNTS[displayedElection.key] : 0;
  const allocation = displayedElection ? allocateSeats(displayedElection.parties, seatCount) : [];
  const reporting = election?.maxReports ? election.reports / election.maxReports * 100 : 0;
  const complete = !exampleActive && !!election?.maxReports && election.reports >= election.maxReports;
  const ties = allocation.some((party) => party.tied);
  const colors = allocation.flatMap((party) => Array.from({ length: party.seats }, () => partyColors(party.name).background));
  const points = seatPoints(seatCount);

  return (
    <section className="panel seat-projection">
      <header className="seat-head">
        <div>
          <div className="eyebrow">Rechnerische Sitzverteilung · Hare/Niemeyer</div>
          <h2>{displayedElection?.name ?? 'Sitzprojektion'}{exampleActive && <span className="example-badge">Beispiel</span>}</h2>
          <p>{exampleActive ? 'Gestaltungsbeispiel: Stimmenanteile 2021 auf 44 Sitze des Jahres 2026 angewendet' : complete ? 'Vollständiger Schnellmeldestand · amtliche Feststellung steht aus' : `Momentaufnahme aus ${election?.reports ?? 0}/${election?.maxReports || '–'} Schnellmeldungen`}</p>
        </div>
        <div className="seat-picker">
          <span className="seat-picker-label">GREMIUM</span>
          <Select value={election?.key ?? selected} onValueChange={(value) => value && setSelected(value)}>
            <SelectTrigger aria-label="Gremium für die Sitzprojektion"><SelectValue>{election?.name}</SelectValue></SelectTrigger>
            <SelectContent>{elections.map((item) => <SelectItem key={item.key} value={item.key}>{item.scope === 'Ortsrat' ? `Ortsrat · ${item.name}` : item.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </header>

      {error ? <div className="seat-empty"><AlertTriangle />{error}</div> : !displayedElection || !allocation.length ? (
        <div className="seat-empty"><RefreshCw /><span>Die Sitzprojektion beginnt mit der ersten auswertbaren Schnellmeldung.</span><button className="outline-button" type="button" onClick={() => { setSelected('stadtrat'); setShowExample(true); }}><Eye /> Beispielansicht öffnen</button></div>
      ) : (
        <div className="seat-body">
          <div className="hemicycle-wrap">
            <svg className="hemicycle" viewBox="0 0 600 300" aria-labelledby="hemicycle-title">
              <title id="hemicycle-title">{exampleActive ? 'Beispielansicht' : 'Projektion'} von {seatCount} Sitzen für {displayedElection.name}</title>
              {points.map((point, index) => <circle key={index} cx={point.x} cy={point.y} r={seatCount > 50 ? 8 : seatCount > 20 ? 9 : 13} fill={colors[index] ?? '#cbd5e1'} stroke="#fff" strokeWidth="2" />)}
            </svg>
            <div className="seat-total"><strong>{seatCount}</strong><span>Sitze</span></div>
          </div>
          <div className="seat-legend">
            {allocation.map((party) => (
              <div key={party.id} className="seat-party" style={{ '--seat-color': partyColors(party.name).background } as CSSProperties}>
                <i /><span>{party.name}</span><b>{party.seats}</b><small>{percent(party.votes / displayedElection.valid * 100)} %</small>{party.tied && <em>Los möglich</em>}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className={`seat-status ${complete ? 'complete' : ''} ${exampleActive ? 'example' : ''}`}>
        <div><span style={{ width: `${exampleActive ? 100 : Math.min(100, reporting)}%` }} /></div>
        <b>{exampleActive ? 'Beispieldaten 2021' : `${Math.round(reporting)} % der Schnellmeldungen`}</b>
        <p>{exampleActive
          ? 'Nur eine Vorschau des Erscheinungsbilds. Dies ist kein Ergebnis und keine Prognose für 2026.'
          : !complete
          ? 'Vorläufige Momentaufnahme: Früh eintreffende Gebiete können das Wahlgebiet verzerren. Keine Hochrechnung und keine Prognose.'
          : ties
            ? 'Stimmengleiche Zahlenbruchteile können einen Losentscheid des Wahlausschusses erfordern.'
            : 'Rechnerisch vollständig. Verbindlich sind erst Prüfung und Feststellung durch den Wahlausschuss.'}</p>
      </div>
      <footer className="seat-sources">
        <span>Ohne Sperrklausel · Mehrheitskorrektur berücksichtigt · Kandidatenbegrenzung wird nicht geschätzt</span>
        <details className="seat-method">
          <summary>Methodik &amp; Grenzen</summary>
          <div>
            <h3>Was wird berechnet?</h3>
            <p>Listen- und Personenstimmen eines Wahlvorschlags werden zusammengezählt. Die Sitze werden proportional als Quote berechnet, zunächst nach ganzen Zahlen und anschließend nach den größten Zahlenbruchteilen vergeben. Eine absolute Stimmenmehrheit erhält nötigenfalls vorab einen zusätzlichen Sitz.</p>
            <h3>Warum ist der Zwischenstand unsicher?</h3>
            <p>Die Schnellmeldungen sind keine repräsentative Stichprobe. Briefwahl und einzelne Stadt- oder Kreisgebiete können später eintreffen und die Verteilung deutlich verschieben. Deshalb zeigt das Tool eine Momentaufnahme ohne Hochrechnung.</p>
            <h3>Was kann erst amtlich entschieden werden?</h3>
            <p>Bei gleichen Restbruchteilen entscheidet das Los. Überzählige Sitze bei zu wenigen Bewerbenden können unbesetzt bleiben oder bei mehreren Wahlbereichen nach den gesetzlichen Regeln anderen Wahlvorschlägen derselben Partei zufallen. Auch die Verteilung auf Listen, Personen und Wahlbereiche erfordert die vollständigen Kandidatendaten.</p>
            <h3>Verwendete Sitzanzahlen 2026</h3>
            <p>Stadtrat: 44 gewählte Mitglieder. Kreistag: 64 gewählte Mitglieder. Die direkt gewählte Verwaltungsleitung gehört später zusätzlich der Vertretung an. Ortsräte: 7, 9 oder 11 Mitglieder gemäß Hauptsatzung.</p>
            <a href="https://www.stadt-hildesheim.de/portal/bekanntmachungen/oeffentliche-bekanntmachung-900004671-33610.html" target="_blank" rel="noreferrer">Wahlbekanntmachung Stadt Hildesheim</a>
            <a href="https://www.landkreishildesheim.de/PDF/AB_06_vom_11_Februar_2026.PDF?Ext=PDF&amp;ObjID=1921&amp;ObjLa=1&amp;ObjSvrID=3711&amp;WTR=1" target="_blank" rel="noreferrer">Wahlbekanntmachung Landkreis Hildesheim</a>
            <a href="https://www.stadt-hildesheim.de/downloads/datei/NmNiNjkwOTUxNjc4OGZhNlNLMUFBNDJvQkFCam9QUCt3T0hoU3ZzeURKM0xzOHpDOERicVVJdE9xby9uQlh5RzJjVXVjZ1dQMXM4OFJtcG40OEIrSmpwTkhHQlJKSzhiRGROVk83bUYwVW5LcFhqdHJuVC9KVlFVOGxmQUJ5QmRkOTBxS05xVDhnOWsrNng4cEtwVDZPL2tKQUNLZ2k5TDJPNDlRWktENXZVMzAvL3BwejlFK25PWXJUST0" target="_blank" rel="noreferrer">Hauptsatzung der Stadt Hildesheim</a>
          </div>
        </details>
        <a href="https://voris.wolterskluwer-online.de/browse/document/19039e57-88fc-30ef-a79e-dbfd74ef5bbf" target="_blank" rel="noreferrer">§ 36 NKWG <ExternalLink /></a>
        <a href="https://voris.wolterskluwer-online.de/browse/document/bc275384-5ef4-346f-aeff-8b8a398d418a" target="_blank" rel="noreferrer">§ 37 NKWG <ExternalLink /></a>
      </footer>
    </section>
  );
}

function percent(value: number) { return value.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
