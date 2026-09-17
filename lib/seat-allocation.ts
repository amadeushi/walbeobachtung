export type SeatInput = { id: string; name: string; votes: number };

export const SEAT_COUNTS: Record<string, number> = {
  stadtrat: 44, kreistag: 64, 'ortsrat-achtum-uppen': 7, 'ortsrat-bavenstedt': 7,
  'ortsrat-drispenstedt': 11, 'ortsrat-einum': 7, 'ortsrat-himmelsthuer': 11,
  'ortsrat-itzum-marienburg': 11, 'ortsrat-marienburger-hoehe-galgenberg': 11,
  'ortsrat-moritzberg-und-bockfeld': 11, 'ortsrat-neuhof-hildesheimer-wald-marienrode': 9,
  'ortsrat-nordstadt': 11, 'ortsrat-ochtersum': 11, 'ortsrat-oststadt-und-stadtfeld': 11,
  'ortsrat-sorsum': 9, 'ortsrat-stadtmitte-neustadt': 11,
};

export function seatKeyFromName(name: string) {
  if (name === 'Stadtratswahl' || name === 'Stadtrat') return 'stadtrat';
  if (name === 'Kreistagswahl' || name === 'Kreistag') return 'kreistag';
  const match = name.match(/^Ortsratswahl \((.+)\)$/);
  if (!match) return '';
  const slug = match[1].toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return `ortsrat-${slug}`;
}

export function allocateSeats<T extends SeatInput>(input: T[], seatCount: number) {
  const parties = input.filter((party) => party.votes > 0);
  const total = parties.reduce((sum, party) => sum + party.votes, 0);
  if (!total || !seatCount) return [];
  const allocation = parties.map((party) => ({ ...party, quota: party.votes * seatCount / total, seats: Math.floor(party.votes * seatCount / total), remainder: party.votes * seatCount % total, tied: false }));
  let remaining = seatCount - allocation.reduce((sum, party) => sum + party.seats, 0);
  const majority = allocation.find((party) => party.votes * 2 > total);
  const ordered = [...allocation].sort((a, b) => b.remainder - a.remainder || b.votes - a.votes || a.name.localeCompare(b.name, 'de'));
  const winners: typeof allocation = [];
  if (majority && majority.seats <= seatCount / 2 && remaining > 0) { majority.seats += 1; winners.push(majority); remaining -= 1; }
  for (const party of ordered) { if (!remaining) break; if (winners.includes(party)) continue; party.seats += 1; winners.push(party); remaining -= 1; }
  const cutoff = winners.at(-1)?.remainder;
  if (cutoff !== undefined) allocation.forEach((party) => { party.tied = party.remainder === cutoff && (ordered.filter((item) => item.remainder === cutoff).length > 1); });
  return allocation.sort((a, b) => b.votes - a.votes);
}
