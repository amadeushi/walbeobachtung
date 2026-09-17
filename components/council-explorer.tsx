'use client';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useEffect, useMemo, useState } from 'react';

const councils = [
  'Alfeld (Leine)', 'Algermissen', 'Bad Salzdetfurth', 'Bockenem',
  'Diekholzen', 'Elze', 'Freden (Leine)', 'Giesen', 'Harsum', 'Hildesheim',
  'Holle', 'Lamspringe', 'Nordstemmen', 'Sarstedt', 'Schellerten',
  'Sibbesse', 'Söhlde',
];

const jointCouncils = ['Leinebergland', 'Freden (Leine)', 'Sibbesse'];
const localCouncils = [
  'Achtum-Uppen', 'Bavenstedt', 'Drispenstedt', 'Einum', 'Himmelsthür',
  'Itzum-Marienburg', 'Marienburger Höhe-Galgenberg', 'Moritzberg und Bockfeld',
  'Neuhof-Hildesheimer Wald-Marienrode', 'Nordstadt', 'Ochtersum',
  'Oststadt und Stadtfeld', 'Sorsum', 'Stadtmitte Neustadt',
];

export default function CouncilExplorer() {
  const [year, setYear] = useState('2021');
  const [kind, setKind] = useState('rat');
  const [place, setPlace] = useState('Hildesheim');
  const [people, setPeople] = useState<{name:string;party:string;votes:number}[]>([]);
  const places = useMemo(() =>
    kind === 'ortsrat' ? localCouncils : kind === 'samtgemeinde' ? jointCouncils : councils,
  [kind]);
  const available = year === '2021' && kind === 'rat' && place === 'Hildesheim';
  useEffect(() => { if (!available) { setPeople([]); return; } fetch('./api/elections.php?year=2021&wahl=Stadtratswahl&action=personen').then(r=>r.ok?r.json() as Promise<{people?: {name:string;party:string;votes:number}[]}>:{people:[]}).then(d=>setPeople(d.people ?? [])).catch(()=>setPeople([])); }, [available]);

  return (
    <section className="panel council-explorer">
      <div className="panel-heading">
        <div>
          <h2>Räte &amp; Personenstimmen</h2>
          <p className="subtle">Stadt-, Gemeinde-, Samtgemeinde- und Ortsratswahlen</p>
        </div>
        <span className="pill">Landkreis Hildesheim</span>
      </div>
      <div className="council-filters">
        <label><span>WAHLJAHR</span><Select value={year} onValueChange={(value) => value && setYear(value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="2016">2016 · Archiv</SelectItem><SelectItem value="2021">2021 · Archiv</SelectItem><SelectItem value="2026">2026 · Aktuell</SelectItem></SelectContent></Select></label>
        <label><span>VERTRETUNG</span><Select value={kind} onValueChange={(value) => { if (!value) return; setKind(value); setPlace(value === 'ortsrat' ? localCouncils[0] : value === 'samtgemeinde' ? jointCouncils[0] : 'Hildesheim'); }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="rat">Stadt- / Gemeinderat</SelectItem><SelectItem value="samtgemeinde">Samtgemeinderat</SelectItem><SelectItem value="ortsrat">Ortsrat Hildesheim</SelectItem></SelectContent></Select></label>
        <label><span>KOMMUNE / ORTSRAT</span><Select value={place} onValueChange={(value) => value && setPlace(value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{places.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select></label>
      </div>
      <div className="council-grid">
        <div className="council-summary">
          <span className="eyebrow">Ausgewählte Wahl</span>
          <strong>{kind === 'ortsrat' ? `Ortsratswahl ${place}` : `${place} · ${kind === 'samtgemeinde' ? 'Samtgemeinderat' : 'Rat'}`}</strong>
          <p>{year === '2026' ? 'Die Rangliste erscheint automatisch, sobald die amtlichen Schnellmeldungen veröffentlicht sind.' : 'Die amtlichen Stimmen werden mit dem jeweiligen Wahlvorschlag und den Kandidierenden abgeglichen.'}</p>
        </div>
        <div className="person-votes">
          <span className="eyebrow">Top 10 Personenstimmen</span>
          <strong>{available ? 'Amtliche Top 10' : 'Noch nicht verfügbar'}</strong>
          {available ? <ol>{people.map((p)=><li key={p.name}><b>{p.name}</b> · {p.party} <span>{p.votes.toLocaleString('de-DE')}</span></li>)}</ol> : <p>Diese Auswahl wird erst angezeigt, sobald Wahl- und Gebiet-ID amtlich verifiziert sind.</p>}
        </div>
      </div>
      <p className="info council-note">Die landesweiten Ergebnisdateien liefern die Ratsergebnisse. Für die Top 10 werden Stimmenfelder und amtliche Kandidatenlisten zusammengeführt; dadurch bleiben Namen und Stimmen nachvollziehbar.</p>
    </section>
  );
}
