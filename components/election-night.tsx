'use client';

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { ChevronLeft, ChevronRight, Pause, Play, Radio, RefreshCw } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { partyColors } from '@/lib/elections';
import { allocateSeats, SEAT_COUNTS } from '@/lib/seat-allocation';

type PartyResult = { id: string; name: string; full: string; candidate?: string | null; votes: number };
type ElectionResult = {
  key: string;
  name: string;
  scope: string;
  valid: number;
  reports: number;
  maxReports: number;
  parties: PartyResult[];
  source: string;
};
type ElectionNightData = {
  year: string;
  elections: ElectionResult[];
  parties: string[];
  retrieved: string;
  source: string;
  warning?: string;
};
type TickerItem = { id: string; text: string; tone: 'news' | 'rise' | 'fall' | 'complete' };

const number = new Intl.NumberFormat('de-DE');
const percent = new Intl.NumberFormat('de-DE', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const normalized = (value: string) =>
  value.trim().toLocaleLowerCase('de-DE').replace(/\s+/g, ' ');

const partyResult = (election: ElectionResult, party: string) =>
  election.parties.find((candidate) => normalized(candidate.name) === normalized(party));
const partyRank = (election: ElectionResult, party: string) => {
  const result = partyResult(election, party);
  if (!result || election.valid <= 0) return null;
  return 1 + election.parties.filter((candidate) => candidate.votes > result.votes).length;
};
const partyShare = (election: ElectionResult, party: string) => {
  const result = partyResult(election, party);
  return result && election.valid > 0 ? (result.votes / election.valid) * 100 : null;
};

function tickerChanges(previous: ElectionNightData | undefined, current: ElectionNightData, party: string) {
  if (!previous) {
    const reports = current.elections.reduce((sum, election) => sum + election.reports, 0);
    const maxReports = current.elections.reduce((sum, election) => sum + election.maxReports, 0);
    return [{
      id: `stand-${current.retrieved}`,
      text: reports
        ? `Aktueller Stand: ${number.format(reports)} von ${number.format(maxReports)} Schnellmeldungen eingegangen`
        : `${current.elections.length} Wahlen werden automatisch auf neue Schnellmeldungen geprüft`,
      tone: 'news' as const,
    }];
  }

  const items: TickerItem[] = [];
  current.elections.forEach((election) => {
    const old = previous.elections.find((candidate) => candidate.key === election.key);
    if (!old || election.reports <= old.reports) return;
    const increase = election.reports - old.reports;
    if (old.reports === 0) {
      items.push({ id: `${election.key}-start-${election.reports}`, text: `${election.name}: Die Auszählung hat begonnen`, tone: 'news' });
    }
    items.push({
      id: `${election.key}-reports-${election.reports}`,
      text: `${election.name}: +${increase} ${increase === 1 ? 'Schnellmeldung' : 'Schnellmeldungen'} · ${election.reports}/${election.maxReports || '–'} ausgezählt`,
      tone: election.maxReports > 0 && election.reports >= election.maxReports ? 'complete' : 'news',
    });

    const oldRank = partyRank(old, party);
    const newRank = partyRank(election, party);
    if (oldRank && newRank && oldRank !== newRank) {
      const rises = newRank < oldRank;
      items.push({
        id: `${election.key}-rank-${newRank}-${election.reports}`,
        text: `${party} ${rises ? 'steigt' : 'fällt'} bei ${election.name} auf Rang ${newRank}`,
        tone: rises ? 'rise' : 'fall',
      });
    }
    const oldShare = partyShare(old, party);
    const newShare = partyShare(election, party);
    if (oldShare !== null && newShare !== null && Math.abs(newShare - oldShare) >= 0.1) {
      const delta = newShare - oldShare;
      items.push({
        id: `${election.key}-share-${election.reports}`,
        text: `${party} bei ${election.name}: ${percent.format(newShare)} % · ${delta >= 0 ? '+' : '−'}${percent.format(Math.abs(delta))} Prozentpunkte`,
        tone: delta >= 0 ? 'rise' : 'fall',
      });
    }
  });
  return items.slice(0, 24);
}

function ResultCard({
  election,
  party,
  prominent = false,
  featured = false,
}: {
  election: ElectionResult;
  party: string;
  prominent?: boolean;
  featured?: boolean;
}) {
  const result = election.parties.find(
    (candidate) => normalized(candidate.name) === normalized(party),
  );
  const share = result && election.valid > 0 ? (result.votes / election.valid) * 100 : 0;
  const rank = result && election.valid > 0
    ? 1 + election.parties.filter((candidate) => candidate.votes > result.votes).length
    : null;
  const ranking = [...election.parties].sort((a, b) => b.votes - a.votes);
  const leader = ranking[0];
  const runnerUp = ranking[1];
  const reporting = election.maxReports > 0
    ? Math.min(100, (election.reports / election.maxReports) * 100)
    : 0;
  const started = election.reports > 0 || election.valid > 0;
  const comparison = result && election.valid > 0 && leader
    ? rank === 1 && runnerUp
      ? { value: ((result.votes - runnerUp.votes) / election.valid) * 100, word: 'vor', opponent: runnerUp.candidate || runnerUp.name }
      : { value: ((leader.votes - result.votes) / election.valid) * 100, word: 'hinter', opponent: leader.candidate || leader.name }
    : null;
  const showTopThree = (prominent || featured) && started;
  const color = partyColors(party).background;
  const foreground = partyColors(party).foreground;
  const seatCount = SEAT_COUNTS[election.key];
  const projectedSeats = seatCount && started
    ? allocateSeats(election.parties, seatCount).find((candidate) => normalized(candidate.name) === normalized(party))?.seats
    : undefined;

  return (
    <article
      className={`night-card ${prominent ? 'prominent' : ''} ${featured ? 'featured' : ''}`}
      style={{
        '--night-color': color,
        '--night-foreground': foreground,
      } as CSSProperties}
    >
      <header>
        <div>
          <span>{election.scope}</span>
          <h3>{election.name}</h3>
          {result?.candidate && <div className="night-candidate">{result.candidate}</div>}
        </div>
        <div className="night-outcome">
          <strong className="night-share">
            {result && started ? `${percent.format(share)} %` : '—'}
          </strong>
          <span className={`night-rank ${rank === 1 ? 'leader' : ''}`}>
            {rank ? `Rang ${rank}/${election.parties.length}` : 'Rang —'}
          </span>
          {seatCount && <span className="night-seats" title="Rechnerische Sitzprojektion">{projectedSeats ?? '—'} Sitze</span>}
        </div>
      </header>
      <div className="night-meta">
        <span>
          {started
            ? result
              ? `${number.format(result.votes)} Stimmen`
              : 'nicht angetreten'
            : 'Noch keine Auszählung'}
        </span>
        <b>{election.reports}/{election.maxReports || '–'} Meldungen</b>
      </div>
      <div className="night-competition">
        {comparison
          ? `${rank === 1 ? '+' : '−'}${percent.format(comparison.value)} Prozentpunkte ${comparison.word} ${comparison.opponent}`
          : 'Vergleich ab erster Meldung'}
      </div>
      {showTopThree && (
        <div className="night-top-three" aria-label="Die drei führenden Wahlvorschläge">
          {ranking.slice(0, 3).map((candidate, index) => {
            const candidateShare = election.valid ? (candidate.votes / election.valid) * 100 : 0;
            return (
              <div className={normalized(candidate.name) === normalized(party) ? 'selected' : ''} key={candidate.id}>
                <span><b>{index + 1}</b>{candidate.candidate || candidate.name}</span>
                <i><em style={{ width: `${leader?.votes ? (candidate.votes / leader.votes) * 100 : 0}%`, backgroundColor: partyColors(candidate.name).background }} /></i>
                <strong>{percent.format(candidateShare)} %</strong>
              </div>
            );
          })}
        </div>
      )}
      <div className="night-mini-chart">
        <div className="night-chart-label"><span>Ausgezählt</span><b>{election.maxReports ? `${Math.round(reporting)} %` : '—'}</b></div>
        <div className="night-progress" aria-label={`${reporting.toFixed(0)} Prozent ausgezählt`}>
          <i style={{ width: `${reporting}%` }} />
        </div>
      </div>
    </article>
  );
}

export default function ElectionNight({ refresh, party, onPartyChange }: { refresh: number; party: string; onPartyChange: (party: string) => void }) {
  const [data, setData] = useState<ElectionNightData>();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [ticker, setTicker] = useState<TickerItem[]>([]);
  const [tickerIndex, setTickerIndex] = useState(0);
  const [tickerPaused, setTickerPaused] = useState(false);
  const previousData = useRef<ElectionNightData | undefined>(undefined);
  const currentData = useRef<ElectionNightData | undefined>(undefined);
  const partyRef = useRef(party);

  useEffect(() => {
    partyRef.current = party;
    if (!currentData.current) return;
    const summaries = currentData.current.elections
      .filter((election) => election.reports > 0 && partyResult(election, party))
      .map((election) => {
        const share = partyShare(election, party);
        const rank = partyRank(election, party);
        return {
          id: `focus-${party}-${election.key}-${election.reports}`,
          text: `${party} bei ${election.name}: ${share === null ? '—' : `${percent.format(share)} %`} · ${rank ? `Rang ${rank}/${election.parties.length}` : 'Rang —'}`,
          tone: 'news' as const,
        };
      });
    setTicker(summaries.length ? summaries : [{
      id: `focus-${party}-waiting`,
      text: `${party}: Noch keine ausgezählten Ergebnisse in den Wahlen mit Kandidatur`,
      tone: 'news',
    }]);
    setTickerIndex(0);
  }, [party]);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    const timeout = window.setTimeout(() => controller.abort(), 16000);
    setLoading(true);
    fetch('./api/elections.php?year=2026&wahl=Stadtratswahl&action=wahlabend', {
      cache: 'no-store',
      signal: controller.signal,
    })
      .then(async (response) => {
        const raw = await response.text();
        let body: Partial<ElectionNightData> & { error?: string };
        try { body = JSON.parse(raw) as Partial<ElectionNightData> & { error?: string }; }
        catch { throw new Error('Der Wahlserver antwortet momentan verzögert. Der letzte Datenstand bleibt sichtbar.'); }
        if (!response.ok || body.error) throw new Error(body.error || 'Abruf fehlgeschlagen');
        return body as ElectionNightData;
      })
      .then((body) => {
        const changes = tickerChanges(previousData.current, body, partyRef.current);
        previousData.current = body;
        currentData.current = body;
        setData(body);
        if (changes.length) {
          setTicker(changes);
          setTickerIndex(0);
        }
        setError('');
      })
      .catch(async (reason) => {
        if (!active) return;
        try {
          const fallback = await fetch(`./data/wahlabend-last.json?v=${refresh}`, { cache: 'no-store' });
          const body = await fallback.json() as ElectionNightData;
          body.warning = 'Die Livequelle antwortet verzögert. Der letzte amtlich abgerufene Stand wird gezeigt.';
          previousData.current = body; currentData.current = body; setData(body); setError('');
        } catch { setError(reason?.message || 'Abruf fehlgeschlagen'); }
      })
      .finally(() => { clearTimeout(timeout); if (active) setLoading(false); });
    return () => { active = false; clearTimeout(timeout); controller.abort(); };
  }, [refresh]);

  useEffect(() => {
    if (tickerPaused || ticker.length <= 1 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const id = window.setInterval(() => setTickerIndex((index) => (index + 1) % ticker.length), 8000);
    return () => window.clearInterval(id);
  }, [ticker.length, tickerPaused]);

  const parties = useMemo(() => data?.parties ?? ['Die PARTEI'], [data]);
  const hasParty = (election: ElectionResult) =>
    election.parties.some((candidate) => normalized(candidate.name) === normalized(party));
  const main = (data?.elections.filter((election) => ['stadtrat', 'kreistag'].includes(election.key)) ?? []).filter(hasParty);
  const landrat = data?.elections.find((election) => election.key === 'landrat' && hasParty(election));
  const local = (data?.elections.filter((election) => election.scope === 'Ortsrat') ?? []).filter((election) =>
    hasParty(election),
  );
  const lowerCount = local.length + (landrat ? 1 : 0);
  const localColumns = lowerCount <= 4
    ? Math.max(1, lowerCount)
    : lowerCount <= 8
      ? 4
      : lowerCount <= 12
        ? 6
        : 7;
  const reports = data?.elections.reduce((sum, election) => sum + election.reports, 0) ?? 0;
  const maxReports = data?.elections.reduce((sum, election) => sum + election.maxReports, 0) ?? 0;
  const tickerItem = ticker[tickerIndex % Math.max(1, ticker.length)];
  const moveTicker = (direction: number) => {
    if (!ticker.length) return;
    setTickerIndex((index) => (index + direction + ticker.length) % ticker.length);
  };

  if (!data && loading) {
    return <section className="panel election-night night-loading"><RefreshCw className="spin" />Alle Wahlergebnisse werden geladen …</section>;
  }
  if (!data) {
    return <section className="panel election-night night-loading">{error || 'Die Wahldaten konnten nicht abgerufen werden.'}</section>;
  }

  return (
    <section className="panel election-night">
      <div
        className="night-ticker"
        onMouseEnter={() => setTickerPaused(true)}
        onMouseLeave={() => setTickerPaused(false)}
        onFocusCapture={() => setTickerPaused(true)}
        onBlurCapture={() => setTickerPaused(false)}
        aria-label="Aktuelle Veränderungen"
      >
        <div className="night-ticker-label"><Radio /> NEU</div>
        <div className={`night-ticker-message ${tickerItem?.tone ?? 'news'}`} aria-live="polite" aria-atomic="true">
          <i />
          <span>{tickerItem?.text ?? 'Wahlmonitor bereit'}</span>
        </div>
        <div className="night-ticker-controls">
          <small>{ticker.length ? `${tickerIndex + 1}/${ticker.length}` : '1/1'}</small>
          <button type="button" onClick={() => moveTicker(-1)} disabled={ticker.length <= 1} aria-label="Vorherige Meldung"><ChevronLeft /></button>
          <button type="button" onClick={() => setTickerPaused((paused) => !paused)} disabled={ticker.length <= 1} aria-label={tickerPaused ? 'Meldungen fortsetzen' : 'Meldungen anhalten'}>
            {tickerPaused ? <Play /> : <Pause />}
          </button>
          <button type="button" onClick={() => moveTicker(1)} disabled={ticker.length <= 1} aria-label="Nächste Meldung"><ChevronRight /></button>
        </div>
      </div>
      <div className="night-head">
        <div>
          <div className="eyebrow"><Radio /> Wahlabend 2026 · Liveübersicht</div>
          <h2>Alle Wahlen für <em>{party}</em></h2>
          <p>Stadtrat, Kreistag, Landratswahl und Ortsräte mit Kandidatur</p>
        </div>
        <div className="night-controls">
          <label>PARTEI IM FOKUS</label>
          <Select value={party} onValueChange={(value) => value && onPartyChange(value)}>
            <SelectTrigger aria-label="Partei im Fokus"><SelectValue>{party}</SelectValue></SelectTrigger>
            <SelectContent>
              {parties.map((name) => <SelectItem key={name} value={name}>{name}</SelectItem>)}
            </SelectContent>
          </Select>
          <small>{loading ? 'Aktualisierung läuft …' : `${reports}/${maxReports || '–'} Schnellmeldungen · ${data.retrieved}`}</small>
        </div>
      </div>
      {(error || data.warning) && <div className="night-warning">{error ? `Letzter Datenstand wird gezeigt · ${error}` : data.warning}</div>}
      {main.length ? (
        <>
          <div className="night-section-label">Stadt- und Kreisebene · {main.length === 2 ? '2 Kandidaturen' : '1 Kandidatur'}</div>
          <div className="night-main" style={{ '--main-cols': main.length } as CSSProperties}>
            {main.map((election) => <ResultCard key={election.key} election={election} party={party} prominent />)}
          </div>
        </>
      ) : (
        <div className="night-no-main">Keine Kandidatur für Stadtrat oder Kreistag</div>
      )}
      <div className="night-section-label">
        Direkt- und Ortsratswahlen · {lowerCount === 1 ? '1 sichtbare Wahl' : `${lowerCount} sichtbare Wahlen`}
      </div>
      {lowerCount ? (
        <div className="night-local" style={{ '--local-cols': localColumns } as CSSProperties}>
          {landrat && <ResultCard election={landrat} party={party} featured />}
          {local.map((election) => <ResultCard key={election.key} election={election} party={party} />)}
        </div>
      ) : (
        <div className="night-no-local">Für {party} ist weder eine Landrats- noch eine Hildesheimer Ortsratskandidatur hinterlegt.</div>
      )}
      <div className="night-foot">Jeder Balken zeigt den Meldungsstand der jeweiligen Wahl. Stimmen verschiedener Wahlen werden nicht addiert.</div>
    </section>
  );
}
