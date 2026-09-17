'use client';

import archive2016 from '@/lib/data/archive-2016.json';
import county2016 from '@/lib/data/archive-kreistag-2016.json';
import {
  boundarySources,
  comparisonRule,
  historyPoint,
} from '@/lib/comparability';
import type { Dataset } from '@/lib/elections';
import { partyColors } from '@/lib/elections';
import { AlertTriangle, ArrowUpRight } from 'lucide-react';
import { useEffect, useState } from 'react';

const fmt = (value: number) => value.toLocaleString('de-DE');
const pct = (value: number) =>
  value.toLocaleString('de-DE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

export default function History({
  wahl,
  area,
  party,
  archive2021,
  current,
}: {
  wahl: string;
  area: string;
  party: string;
  archive2021: Dataset;
  current?: Dataset;
}) {
  const rule = comparisonRule(wahl, area);
  const county = wahl === 'Kreiswahl' || wahl === 'Kreistagswahl';
  const isOrtsrat = wahl.startsWith('Ortsratswahl (');
  const normalizedWahl = county
    ? 'Kreistagswahl'
    : isOrtsrat
      ? wahl
      : 'Stadtratswahl';
  const current2026 = current?.year === '2026' ? current : undefined;
  const [fetched2026, setFetched2026] = useState<Dataset | undefined>();
  const [fetched2021, setFetched2021] = useState<Dataset | undefined>();
  const [fetched2016, setFetched2016] = useState<Dataset | undefined>();
  const [fetched2011, setFetched2011] = useState<Dataset | undefined>();
  useEffect(() => {
    const controller = new AbortController();
    const query = `wahl=${encodeURIComponent(normalizedWahl)}&level=wahlbereiche`;
    Promise.all([
      current2026
        ? Promise.resolve(current2026)
        : fetch(`./api/elections.php?year=2026&${query}`, {
            signal: controller.signal,
          }).then((r) => (r.ok ? r.json() : undefined)),
      county
        || isOrtsrat
        ? fetch(`./api/elections.php?year=2021&${query}`, {
            signal: controller.signal,
          }).then((r) => (r.ok ? r.json() : undefined))
        : Promise.resolve(archive2021),
    ])
      .then(([result2026, result2021]) => {
        if (!controller.signal.aborted) {
          setFetched2026(result2026 as Dataset | undefined);
          setFetched2021(result2021 as Dataset | undefined);
        }
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [current2026, county, isOrtsrat, normalizedWahl, archive2021]);
  useEffect(() => {
    if (!isOrtsrat) {
      setFetched2016(undefined);
      return;
    }
    const controller = new AbortController();
    fetch(
      `./api/elections.php?year=2016&wahl=${encodeURIComponent(normalizedWahl)}`,
      { signal: controller.signal },
    )
      .then((r) => (r.ok ? r.json() : undefined))
      .then((result) => !controller.signal.aborted && setFetched2016(result as Dataset | undefined))
      .catch(() => undefined);
    return () => controller.abort();
  }, [isOrtsrat, normalizedWahl]);
  useEffect(() => {
    const controller = new AbortController();
    fetch(`./api/elections.php?year=2011&wahl=${encodeURIComponent(normalizedWahl)}`, { signal: controller.signal })
      .then((r) => (r.ok ? r.json() : undefined))
      .then((result) => !controller.signal.aborted && setFetched2011(result as Dataset | undefined))
      .catch(() => undefined);
    return () => controller.abort();
  }, [normalizedWahl]);
  const live2026 = current2026 ?? fetched2026;
  const data2016 = isOrtsrat ? fetched2016 : county ? county2016 : archive2016;
  const data2021 = county || isOrtsrat ? fetched2021 : archive2021;
  const points = [
    { year: '2011', point: historyPoint(fetched2011, party, normalizedWahl) },
    {
      year: '2016',
      point: historyPoint(data2016 as Dataset, party, normalizedWahl),
    },
    { year: '2021', point: historyPoint(data2021, party, normalizedWahl) },
    {
      year: '2026',
      point: historyPoint(live2026, party, normalizedWahl),
    },
  ];
  const scale = Math.max(1, ...points.map(({ point }) => point.share ?? 0));
  const partyTheme = partyColors(party);
  const delta =
    points[2].point.share != null && points[3].point.share != null
      ? points[3].point.share - points[2].point.share
      : null;

  return (
    <div className="history-content">
      <div className="panel-heading">
        <div>
          <h2>Zeitvergleich</h2>
          <p className="subtle">
            {party} · {county ? 'gesamter Landkreis' : isOrtsrat ? wahl.replace('Ortsratswahl ', '') : 'gesamte Stadt'}{' '}
            {!isOrtsrat && 'Hildesheim'}
          </p>
        </div>
        <span className={`comparison-badge ${rule.allowed ? 'ok' : 'limited'}`}>
          {rule.allowed ? 'Vergleichbar' : 'Eingeschränkt'}
        </span>
      </div>

      {!rule.allowed ? (
        <div className="comparison-warning">
          <AlertTriangle aria-hidden="true" />
          <div>
            <strong>Kein belastbarer Zeitvergleich für diese Auswahl</strong>
            <p>{rule.reason}</p>
            {(wahl === 'Kreiswahl' || wahl === 'Kreistagswahl') && (
              <p>
                2021 wurden zwölf Wahlbereiche verwendet, 2026 sind es elf. Die
                neue amtliche Einteilung führt die Hildesheimer Stadtteile in
                den Bereichen F bis I.
              </p>
            )}
          </div>
        </div>
      ) : (
        <>
          <div className="history-bars">
            {points.map(({ year, point }) => (
              <div className="history-row" key={year}>
                <strong>{year}</strong>
                {point.status === 'complete' ? (
                  <>
                    <div className="history-track" aria-hidden="true">
                      <div
                        className="history-fill"
                        style={{
                          width: `${((point.share ?? 0) / scale) * 100}%`,
                          background: partyTheme.background,
                        }}
                      />
                    </div>
                    <span className="history-value">
                      {pct(point.share ?? 0)} %
                      <small>{point.valueMode === 'share' ? 'historischer Anteil' : `${fmt(point.votes ?? 0)} Stimmen`}</small>
                    </span>
                  </>
                ) : (
                  <div className={`history-status ${point.status}`}>
                    {point.status === 'absent'
                      ? 'nicht angetreten'
                      : point.status === 'partial'
                        ? 'Zwischenstand – Vergleich folgt nach Vollständigkeit'
                        : point.status === 'unknown'
                          ? 'Wahlvorschlag nicht eindeutig zugeordnet'
                          : 'noch keine Ergebnisse'}
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="history-summary">
            <div>
              <span>Veränderung 2021 → 2026</span>
              <strong>
                {delta == null
                  ? 'noch nicht berechenbar'
                  : `${delta >= 0 ? '+' : ''}${pct(delta)} Prozentpunkte`}
              </strong>
            </div>
            <p>{rule.reason}</p>
          </div>
        </>
      )}

      <div className="history-sources">
        <span>Methodik und Gebietsstände:</span>
        <a href={boundarySources[2021]} target="_blank" rel="noreferrer">
          Einteilung 2021 <ArrowUpRight />
        </a>
        <a href={boundarySources[2026]} target="_blank" rel="noreferrer">
          Einteilung 2026 <ArrowUpRight />
        </a>
      </div>
    </div>
  );
}
