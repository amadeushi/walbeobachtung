'use client';

import { useEffect, useState } from 'react';
import { ExternalLink, UserRound } from 'lucide-react';
import { partyColors } from '@/lib/elections';

type Person = { name: string; party: string; votes: number };
type Ranking = { people: Person[]; scope: string; source: string };

export default function PeopleRanking({ year, wahl, area, refresh }: { year: string; wahl: string; area: string; refresh: number }) {
  const supported = area === 'all' && ['2016', '2021', '2026'].includes(year) && (wahl === 'Stadtratswahl' || wahl.startsWith('Ortsratswahl ('));
  const [ranking, setRanking] = useState<Ranking | null>(null);

  useEffect(() => {
    setRanking(null);
    if (!supported) return;
    const controller = new AbortController();
    fetch(`./api/elections.php?year=${year}&wahl=${encodeURIComponent(wahl)}&action=personen`, { signal: controller.signal })
      .then((response) => response.ok ? response.json() as Promise<Ranking> : Promise.reject())
      .then((data) => {
        if (Array.isArray(data.people) && data.people.length) setRanking(data);
      })
      .catch(() => {});
    return () => controller.abort();
  }, [supported, year, wahl, area, refresh]);

  if (!ranking) return null;
  const maximum = Math.max(...ranking.people.map((person) => person.votes), 1);

  return (
    <section className="panel people-ranking">
      <div className="panel-heading">
        <div>
          <h2>Top 10 Personenstimmen</h2>
          <p className="subtle">{ranking.scope} · {year === '2026' ? 'aktueller Auszählungsstand' : `amtliches Endergebnis ${year}`}</p>
        </div>
        <UserRound size={21} color="#78869a" />
      </div>
      <ol className="people-list">
        {ranking.people.map((person, index) => {
          const color = partyColors(person.party).background;
          return (
            <li key={`${person.name}-${person.party}`}>
              <span className="people-rank">{index + 1}</span>
              <span className="people-name"><strong>{person.name}</strong><small>{person.party}</small></span>
              <span className="people-bar"><i style={{ width: `${(person.votes / maximum) * 100}%`, backgroundColor: color }} /></span>
              <strong className="people-votes">{person.votes.toLocaleString('de-DE')}</strong>
            </li>
          );
        })}
      </ol>
      <a className="people-source" href={ranking.source} target="_blank" rel="noreferrer">Amtliche Ergebnisquelle <ExternalLink size={14} /></a>
    </section>
  );
}
