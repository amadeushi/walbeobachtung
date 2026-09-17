import { n, parties, votes, type Dataset } from './elections.ts';
export const boundarySources = {
  2021: 'https://ratsinfoservice.de/ris/hildesheimlk/file/getfile/71017',
  2026: 'https://www.landkreishildesheim.de/loadDocument.phtml?Ext=PDF&FID=3711.1824.1',
};
export function comparisonRule(wahl: string, area: string) {
  if ((wahl === 'Kreiswahl' || wahl === 'Kreistagswahl') && area !== 'all')
    return {
      allowed: false,
      reason:
        'Kreistagswahl: 12 Wahlbereiche (2021) → 11 (2026). Einzelne Wahlbereiche sind über die Jahre nicht direkt vergleichbar.',
    };
  if (wahl === 'Kreiswahl' || wahl === 'Kreistagswahl')
    return {
      allowed: true,
      reason:
        'Verglichen wird jeweils der gesamte Landkreis Hildesheim. Die Änderung von zwölf auf elf Wahlbereiche verändert dieses Gesamtgebiet nicht.',
    };
  if (wahl.startsWith('Ortsratswahl (')) {
    if (area !== 'all')
      return {
        allowed: false,
        reason:
          'Der Zeitvergleich bezieht sich auf das gesamte Ortsratsgebiet. Wahl- und Briefwahlbezirke werden wegen möglicher Zuordnungsänderungen nicht einzeln verglichen.',
      };
    return {
      allowed: true,
      reason:
        'Ortsratswahl · Vergleich der gesamten Ortsratsergebnisse. Stimmenanteile werden aus den amtlichen Stimmenzahlen berechnet.',
    };
  }
  if (wahl !== 'Stadtratswahl')
    return {
      allowed: false,
      reason:
        'Das Archiv 2016 enthält die Stadtratswahl. Ein Vergleich mit einer Direktwahl ist nicht zulässig.',
    };
  if (area !== 'all')
    return {
      allowed: false,
      reason:
        'Die Gebietsstände und die Briefwahlzuordnung sind noch nicht abgeglichen. Der Zeitvergleich ist deshalb nur für die gesamte Stadt verfügbar.',
    };
  return {
    allowed: true,
    reason:
      'Stadtratswahl · gesamte Stadt Hildesheim. Vergleich der jeweiligen Stadtergebnisse, keine gebietsbereinigte Bezirksanalyse. Stimmenanteile werden aus den Stimmenzahlen berechnet, nicht als Mittelwert der Bezirksprozente.',
  };
}
export function historyPoint(
  data: Dataset | undefined,
  party: string,
  wahl = 'Stadtratswahl',
) {
  if (!data?.total || n(data.total.D) === 0)
    return { status: 'missing' as const, share: null, votes: null };
  const p = parties(data.metadata, wahl).find((p) => p.name === party);
  if (!p)
    return {
      status: data.absentParties?.includes(party)
        ? ('absent' as const)
        : ('unknown' as const),
      share: null,
      votes: null,
    };
  const total = data.total;
  const max = n(total['max-schnellmeldungen']);
  if (max <= 0 || n(total['anz-schnellmeldungen']) !== max)
    return { status: 'partial' as const, share: null, votes: null };
  const count = votes(total, p.id);
  return {
    status: 'complete' as const,
    share: (count / n(total.D)) * 100,
    votes: count,
    valueMode: data.valueMode,
  };
}
