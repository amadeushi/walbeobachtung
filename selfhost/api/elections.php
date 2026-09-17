<?php
declare(strict_types=1);
header('Content-Type: application/json; charset=utf-8');

$year = $_GET['year'] ?? '2021';
$wahl = $_GET['wahl'] ?? 'Stadtratswahl';
$level = $_GET['level'] ?? 'wahlbereiche';
$action = $_GET['action'] ?? '';
header($year === '2026' ? 'Cache-Control: public, max-age=5, must-revalidate' : 'Cache-Control: public, max-age=30');
$httpContext = stream_context_create(['http' => ['timeout' => 30, 'user_agent' => 'Walbeobachtung/1.0']]);
$fetchJson = static function (string $url) use ($httpContext): array { $raw = @file_get_contents($url, false, $httpContext); if ($raw === false) throw new RuntimeException('Quelle nicht erreichbar'); $data = json_decode($raw, true); if (!is_array($data)) throw new RuntimeException('Ungültige Daten'); return $data; };
$wahlabendCache = __DIR__.'/../data/wahlabend-last.json';
$wahlabendLock = __DIR__.'/../data/wahlabend-refresh.lock';
$loadLiveMeta = static function (string $authority) use ($fetchJson): array {
  $local = __DIR__.'/../data/'.($authority === '03254000' ? 'live-meta-county.json' : 'live-meta-city.json');
  $data = json_decode((string)@file_get_contents($local), true);
  if (is_array($data) && !empty($data['csvs']) && !empty($data['dateifelder'])) return $data;
  return $fetchJson("http://wahlen.kreis-hi.de/wahlen/20260913/$authority/daten/opendata/open_data.json");
};
if ($action === 'personen' && in_array($year, ['2016', '2021', '2026'], true) && ($wahl === 'Stadtratswahl' || str_starts_with($wahl, 'Ortsratswahl ('))) {
  try {
    $areas = [
      'Achtum-Uppen'=>'87', 'Bavenstedt'=>'88', 'Drispenstedt'=>'89', 'Einum'=>'90',
      'Himmelsthür'=>'92', 'Itzum-Marienburg'=>'93', 'Marienburger Höhe-Galgenberg'=>'94',
      'Moritzberg und Bockfeld'=>'200', 'Neuhof-Hildesheimer Wald-Marienrode'=>'201',
      'Nordstadt'=>'97', 'Ochtersum'=>'98', 'Oststadt und Stadtfeld'=>'203',
      'Sorsum'=>'101', 'Stadtmitte Neustadt'=>'102',
    ];
    $isLocal = str_starts_with($wahl, 'Ortsratswahl (');
    $scope = $isLocal ? substr($wahl, 14, -1) : 'Gesamte Stadt';
    if ($year === '2016') {
      $officialArchive = json_decode((string)file_get_contents(__DIR__.'/../data/archive-votemanager-2016.json'), true);
      $raw = $officialArchive['persons'][$wahl] ?? null;
      if (!is_array($raw)) throw new RuntimeException('Personenstimmen 2016 nicht archiviert');
      $electionId = $isLocal ? '9' : '6';
      $areaId = $isLocal ? 'ebene_8_id_'.$areas[$scope] : 'ebene_3_id_11';
      $resultUrl = '';
    } elseif ($year === '2021') {
      if ($isLocal && !isset($areas[$scope])) throw new RuntimeException('Unbekannter Ortsrat');
      $electionId = $isLocal ? '29' : '27';
      $areaId = $isLocal ? 'ebene_8_id_'.$areas[$scope] : 'ebene_3_id_11';
      $resultUrl = "http://wahlen.kreis-hi.de/wahlen/20210912/03254021/api/praesentation/wahl_$electionId/ergebnis_{$areaId}_0.json";
    } else {
      $officialNames = ['Stadtmitte Neustadt'=>'Stadtmitte/Neustadt','Oststadt und Stadtfeld'=>'Oststadt/Stadtfeld','Marienburger Höhe-Galgenberg'=>'Marienburger Höhe/Galgenberg','Moritzberg und Bockfeld'=>'Moritzberg/Bockfeld','Neuhof-Hildesheimer Wald-Marienrode'=>'Neuhof/Hildesheimer Wald/Marienrode'];
      $actual = $isLocal ? 'Ortsratswahl '.($officialNames[$scope] ?? $scope) : 'Stadtratswahl';
      $meta = $loadLiveMeta('03254021');
      $graphic = null;
      foreach (($meta['ergebnisgrafiken'] ?? []) as $candidate) if (str_starts_with($candidate['wahl'] ?? '', $actual.' - ')) { $graphic = $candidate; break; }
      if (!$graphic) throw new RuntimeException('Ergebnisgrafik nicht gefunden');
      $electionId = (string)$graphic['wahl_id'];
      $areaId = $graphic['link']['id'];
      $resultUrl = "http://wahlen.kreis-hi.de/wahlen/20260913/03254021/daten/api/wahl_$electionId/ergebnis_{$areaId}_0.json";
    }
    if ($year !== '2016') $raw = $fetchJson($resultUrl);
    $people = [];
    foreach (($raw['Komponente']['tabelle']['zeilen'] ?? []) as $row) {
      $label = $row['label']['labelKurz'] ?? '';
      if (isset($row['sub_zeilen']) && str_ends_with($label, ' - Summe Kandidaten-Stimmen')) {
        $party = preg_replace('/ - Summe Kandidaten-Stimmen$/u', '', $label);
        foreach ($row['sub_zeilen'] as $person) $people[] = ['name'=>$person['label']['labelKurz'] ?? '', 'party'=>$party, 'votes'=>(int)str_replace('.', '', $person['zahl'] ?? '0')];
      } elseif (str_contains($label, ', Einzelwahlvorschlag ')) {
        [$personName, $nomination] = explode(', ', $label, 2);
        $people[] = ['name'=>$personName, 'party'=>$nomination, 'votes'=>(int)str_replace('.', '', $row['zahl'] ?? '0')];
      }
    }
    usort($people, static fn($a,$b) => $b['votes'] <=> $a['votes']);
    $date = $year === '2016' ? '20160911' : ($year === '2021' ? '20210912' : '20260913');
    echo json_encode(['people'=>array_slice($people,0,10),'scope'=>$scope,'source'=>"http://wahlen.kreis-hi.de/wahlen/$date/03254021/praesentation/ergebnisgrafik.html?wahl_id=$electionId&stimmentyp=0&id=$areaId"], JSON_UNESCAPED_UNICODE); exit;
  } catch (Throwable $e) { http_response_code(502); echo json_encode(['error'=>'Personenstimmen nicht verfügbar']); exit; }
}
if (!in_array($year, ['2011', '2016', '2021', '2026'], true) || (!in_array($wahl, ['Stadtratswahl', 'Kreiswahl', 'Kreistagswahl', 'Bürgermeisterwahl', 'Landratswahl'], true) && !str_starts_with($wahl, 'Ortsratswahl ('))) {
  http_response_code(400); echo json_encode(['error' => 'Ungültige Auswahl']); exit;
}
$root = dirname(__DIR__);
$n = static function (?string $v): float { return $v === null || $v === '' ? 0 : (float)str_replace(',', '.', $v); };
$parse = static function (string $raw): array {
  $lines = preg_split("/\r\n|\n|\r/", preg_replace('/^\xEF\xBB\xBF/', '', $raw));
  $headers = str_getcsv((string)array_shift($lines), ';', '"', ''); $out = [];
  foreach ($lines as $line) { if (trim($line) === '') continue; $cells = str_getcsv($line, ';', '"', ''); $row = []; foreach ($headers as $i => $h) $row[$h] = $cells[$i] ?? ''; $out[] = $row; }
  return $out;
};
$fetch = static function (string $url) use ($parse): array { $ctx = stream_context_create(['http' => ['timeout' => 30, 'user_agent' => 'Walbeobachtung/1.0']]); $raw = @file_get_contents($url, false, $ctx); if ($raw === false) throw new RuntimeException('Quelle nicht erreichbar'); return $parse($raw); };
$metaFetch = static function (string $url): array { $ctx = stream_context_create(['http' => ['timeout' => 30, 'user_agent' => 'Walbeobachtung/1.0']]); $raw = @file_get_contents($url, false, $ctx); if ($raw === false) throw new RuntimeException('Metadaten nicht erreichbar'); $data = json_decode($raw, true); if (!is_array($data)) throw new RuntimeException('Ungültige Metadaten'); return $data; };
$votes = static function (array $row, string $p) use ($n): float { foreach ([$p.'_summe_liste_kandidaten', $p.'_4', $p] as $key) if (isset($row[$key])) return $n($row[$key]); return 0; };
$short = static function (string $name): string { $map = [['/basisdemokratische|^Die PARTEI$/i','Die PARTEI'],['/Sozialdemokratische/i','SPD'],['/Christlich Demokratische/i','CDU'],['/BÜNDNIS 90/i','GRÜNE'],['/Alternative für/i','AfD'],['/Unabhängigen/i','Unabhängige'],['/Freie Demokratische/i','FDP'],['/Die Linke/i','DIE LINKE'],['/FREIE WÄHLER/i','FREIE WÄHLER'],['/Interkulturelle/i','Interkulturelle Liga'],['/Piratenpartei/i','PIRATEN'],['/Bündnis Sahra Wagenknecht/i','BSW'],['/Volt Deutschland/i','Volt'],['/Wählerplattform Gemeinsam Plus/i','Gemeinsam+'],['/Wir für Einum/i','Wir für Einum'],['/Wahl-Alternative-Sarstedt/i','WAS']]; foreach ($map as [$re,$label]) if (preg_match($re,$name)) return $label; return preg_replace('/^Einzelwahlvorschlag\s+/u', '', $name); };
try {
  if ($action === 'wahlabend') {
    if ($year !== '2026') throw new RuntimeException('Die Gesamtübersicht ist für 2026 vorgesehen');
    if (is_file($wahlabendCache) && time() - (int)filemtime($wahlabendCache) < 25) {
      $cached = @file_get_contents($wahlabendCache);
      if ($cached !== false) { header('X-Walbeobachtung-Cache: HIT'); echo $cached; exit; }
    }
    $lockHandle = @fopen($wahlabendLock, 'c');
    if ($lockHandle && !flock($lockHandle, LOCK_EX | LOCK_NB) && is_file($wahlabendCache)) {
      header('X-Walbeobachtung-Cache: STALE'); echo (string)file_get_contents($wahlabendCache); exit;
    }
    // The election server's HTTPS listener currently stalls while the same
    // official files are delivered immediately over HTTP. These URLs are
    // fetched server-side, so using the working transport creates no mixed
    // content in the browser.
    $cityBase = 'http://wahlen.kreis-hi.de/wahlen/20260913/03254021/';
    $countyBase = 'http://wahlen.kreis-hi.de/wahlen/20260913/03254000/';
    $cityMeta = $loadLiveMeta('03254021');
    $countyMeta = $loadLiveMeta('03254000');
    $definitions = [['key'=>'stadtrat','name'=>'Stadtrat','scope'=>'Stadt Hildesheim','actual'=>'Stadtratswahl','meta'=>$cityMeta,'base'=>$cityBase,'level'=>'stadt']];
    $localNames = [
      ['Achtum-Uppen','Achtum-Uppen'], ['Bavenstedt','Bavenstedt'], ['Drispenstedt','Drispenstedt'], ['Einum','Einum'],
      ['Himmelsthür','Himmelsthür'], ['Itzum-Marienburg','Itzum-Marienburg'], ['Marienburger Höhe-Galgenberg','Marienburger Höhe/Galgenberg'],
      ['Moritzberg und Bockfeld','Moritzberg/Bockfeld'], ['Neuhof-Hildesheimer Wald-Marienrode','Neuhof/Hildesheimer Wald/Marienrode'],
      ['Nordstadt','Nordstadt'], ['Ochtersum','Ochtersum'], ['Oststadt und Stadtfeld','Oststadt/Stadtfeld'], ['Sorsum','Sorsum'], ['Stadtmitte Neustadt','Stadtmitte/Neustadt'],
    ];
    $localKeys = [
      'Achtum-Uppen'=>'achtum-uppen', 'Bavenstedt'=>'bavenstedt', 'Drispenstedt'=>'drispenstedt', 'Einum'=>'einum',
      'Himmelsthür'=>'himmelsthuer', 'Itzum-Marienburg'=>'itzum-marienburg', 'Marienburger Höhe-Galgenberg'=>'marienburger-hoehe-galgenberg',
      'Moritzberg und Bockfeld'=>'moritzberg-und-bockfeld', 'Neuhof-Hildesheimer Wald-Marienrode'=>'neuhof-hildesheimer-wald-marienrode',
      'Nordstadt'=>'nordstadt', 'Ochtersum'=>'ochtersum', 'Oststadt und Stadtfeld'=>'oststadt-und-stadtfeld', 'Sorsum'=>'sorsum', 'Stadtmitte Neustadt'=>'stadtmitte-neustadt',
    ];
    foreach ($localNames as [$displayName,$officialName]) $definitions[] = ['key'=>'ortsrat-'.$localKeys[$displayName],'name'=>$displayName,'scope'=>'Ortsrat','actual'=>'Ortsratswahl '.$officialName,'meta'=>$cityMeta,'base'=>$cityBase,'level'=>'ortschaft'];
    array_splice($definitions, 1, 0, [[ 'key'=>'kreistag','name'=>'Kreistag','scope'=>'Landkreis Hildesheim','actual'=>'Kreistagswahl','meta'=>$countyMeta,'base'=>$countyBase,'level'=>'gesamtergebnis' ]]);
    array_splice($definitions, 2, 0, [[ 'key'=>'landrat','name'=>'Landratswahl','scope'=>'Landkreis · Direktwahl','actual'=>'Landratswahl','meta'=>$countyMeta,'base'=>$countyBase,'level'=>'gesamtergebnis','candidates'=>['SPD'=>'Bernd Lynack','CDU'=>'Christopher Gedeon','GRÜNE'=>'Matthias Brinkmann'] ]]);
    $previous = is_file($wahlabendCache) ? json_decode((string)file_get_contents($wahlabendCache), true) : [];
    $previousByKey = []; foreach (($previous['elections'] ?? []) as $item) $previousByKey[$item['key']] = $item;
    $multi = curl_multi_init(); $handles = []; $prepared = [];
    foreach ($definitions as $definition) {
      $entry = null;
      foreach (($definition['meta']['csvs'] ?? []) as $candidate) if (($candidate['wahl'] ?? '') === $definition['actual'] && strtolower($candidate['ebene'] ?? '') === $definition['level']) { $entry = $candidate; break; }
      if (!$entry) continue;
      $url = $definition['base'].'daten/opendata/'.$entry['url']; $definition['_url'] = $url; $prepared[] = $definition;
      $handle = curl_init($url); curl_setopt_array($handle, [CURLOPT_RETURNTRANSFER=>true,CURLOPT_FOLLOWLOCATION=>true,CURLOPT_CONNECTTIMEOUT=>5,CURLOPT_TIMEOUT=>14,CURLOPT_USERAGENT=>'Walbeobachtung/1.0']);
      $handles[$definition['key']] = $handle; curl_multi_add_handle($multi, $handle);
    }
    do { $status = curl_multi_exec($multi, $active); if ($active) curl_multi_select($multi, 1.0); } while ($active && $status === CURLM_OK);
    $elections = []; $partySet = []; $delayed = 0;
    foreach ($prepared as $definition) {
      $handle = $handles[$definition['key']]; $raw = curl_multi_getcontent($handle); $httpCode = (int)curl_getinfo($handle, CURLINFO_RESPONSE_CODE);
      $total = $httpCode === 200 && is_string($raw) ? ($parse($raw)[0] ?? []) : [];
      $field = null; foreach (($definition['meta']['dateifelder'] ?? []) as $candidate) if (($candidate['name'] ?? '') === $definition['actual']) { $field = $candidate; break; }
      $resultParties = [];
      foreach (($field['parteien'] ?? []) as $candidate) {
        $partyName = $short($candidate['wert'] ?? ''); $partySet[$partyName] = true;
        $resultParties[] = ['id'=>$candidate['feld'],'name'=>$partyName,'full'=>$candidate['wert'],'candidate'=>$definition['candidates'][$partyName] ?? null,'votes'=>$votes($total,$candidate['feld'])];
      }
      if (!$total && isset($previousByKey[$definition['key']])) { $elections[] = $previousByKey[$definition['key']]; $delayed++; }
      else $elections[] = ['key'=>$definition['key'],'name'=>$definition['name'],'scope'=>$definition['scope'],'valid'=>$n($total['D'] ?? ''),'reports'=>$n($total['anz-schnellmeldungen'] ?? ''),'maxReports'=>$n($total['max-schnellmeldungen'] ?? ''),'parties'=>$resultParties,'source'=>$definition['_url']];
      curl_multi_remove_handle($multi, $handle);
    }
    curl_multi_close($multi);
    $preferred = ['Die PARTEI','SPD','CDU','GRÜNE','AfD','FDP','Unabhängige','DIE LINKE','BSW','FREIE WÄHLER','Volt','Gemeinsam+'];
    $partyNames = array_keys($partySet); usort($partyNames, static function($a,$b) use ($preferred) { $ia=array_search($a,$preferred,true);$ib=array_search($b,$preferred,true);$ia=$ia===false?999:$ia;$ib=$ib===false?999:$ib;return $ia===$ib?strcmp($a,$b):$ia<=>$ib; });
    $payloadData = ['year'=>'2026','elections'=>$elections,'parties'=>$partyNames,'retrieved'=>date('d.m.Y H:i:s'),'source'=>$cityBase.'praesentation/opendata.html'];
    if ($delayed) $payloadData['warning'] = "$delayed amtliche Teilquellen antworten verzögert; dort wird der letzte erfolgreiche Stand gezeigt.";
    $payload = json_encode($payloadData, JSON_UNESCAPED_UNICODE);
    @file_put_contents($wahlabendCache, $payload, LOCK_EX);
    if ($lockHandle) { flock($lockHandle, LOCK_UN); fclose($lockHandle); }
    echo $payload; exit;
  }
  if ($year === '2011') {
    if (str_starts_with($wahl, 'Ortsratswahl (')) {
      $name = substr($wahl, 14, -1);
      $archive = json_decode((string)file_get_contents($root.'/data/archive-ortsrats-2011.json'), true);
      $data = $archive['elections'][$name] ?? null;
      if (!is_array($data)) throw new RuntimeException('Ortsratsdaten 2011 nicht gefunden');
    } else {
      if (!in_array($wahl, ['Kreiswahl', 'Kreistagswahl', 'Stadtratswahl'], true)) throw new RuntimeException('Für diese Auswahl liegen noch keine historischen Daten vor');
      $file = $wahl === 'Stadtratswahl' ? 'archive-stadtrat-2011.json' : 'archive-kreistag-2011.json';
      $data = json_decode((string)file_get_contents($root.'/data/'.$file), true);
    }
    $data['wahl'] = $wahl;
    echo json_encode($data, JSON_UNESCAPED_UNICODE); exit;
  }
  if ($year === '2021' && str_starts_with($wahl, 'Ortsratswahl (')) {
    $archive = json_decode((string)file_get_contents($root.'/data/archive.json'), true); $name = substr($wahl, 14, -1);
    $entry = null; foreach ($archive['metadata']['csvs'] as $c) if (($c['wahl'] ?? '') === 'Ortsratswahl' && str_contains($c['ebene'] ?? '', $name)) { $entry = $c; break; }
    if (!$entry) throw new RuntimeException('Ortsratsdaten nicht gefunden');
    $raw = $archive['files'][$entry['url']] ?? @file_get_contents('http://wahlen.kreis-hi.de/wahlen/20210912/03254021/praesentation/'.$entry['url']);
    if ($raw === false) throw new RuntimeException('Ortsratsdaten nicht erreichbar');
    $rows = $parse($raw);
    $total = $rows[0] ?? [];
    $identity = ['datum'=>true, 'wahl'=>true, 'ags'=>true, 'gebiet-nr'=>true, 'gebiet-name'=>true];
    foreach (array_keys($total) as $key) {
      if (isset($identity[$key])) continue;
      $sum = 0;
      foreach ($rows as $resultRow) $sum += (int)str_replace('.', '', $resultRow[$key] ?? '0');
      $total[$key] = (string)$sum;
    }
    $total['gebiet-nr'] = 'gesamt';
    $total['gebiet-name'] = $name;
    echo json_encode(['year'=>'2021','wahl'=>$wahl,'metadata'=>$archive['metadata'],'rows'=>$rows,'total'=>$total,'level'=>'Wahlbezirke','areaLevel'=>'wahlbezirke','sources'=>['http://wahlen.kreis-hi.de/wahlen/20210912/03254021/praesentation/'.$entry['url']],'retrieved'=>date('d.m.Y H:i:s'),'archived'=>true], JSON_UNESCAPED_UNICODE); exit;
  }
  if ($year === '2016') {
    if ($wahl === 'Landratswahl') {
      $data = json_decode((string)file_get_contents($root.'/data/archive-landrat-2016.json'), true);
      echo json_encode($data, JSON_UNESCAPED_UNICODE); exit;
    }
    $officialArchive = json_decode((string)file_get_contents($root.'/data/archive-votemanager-2016.json'), true);
    $isLocal = str_starts_with($wahl, 'Ortsratswahl (');
    $county = in_array($wahl, ['Kreiswahl', 'Kreistagswahl', 'Landratswahl'], true);
    $authority = $county ? '03254000' : '03254021';
    $source = $officialArchive['authorities'][$authority] ?? null;
    if (!is_array($source)) throw new RuntimeException('Amtliches Archiv 2016 nicht gefunden');
    $meta = $source['metadata'];
    $actual = in_array($wahl, ['Kreiswahl', 'Kreistagswahl'], true) ? 'Kreiswahl' : ($isLocal ? 'Ortsratswahl' : $wahl);
    $localName = $isLocal ? substr($wahl, 14, -1) : '';
    $options = array_values(array_filter($meta['csvs'] ?? [], static fn($c) => ($c['wahl'] ?? '') === $actual));
    $overall = null; $detail = null;
    foreach ($options as $candidate) {
      $e = strtolower($candidate['ebene'] ?? '');
      if ($isLocal && str_contains($candidate['ebene'] ?? '', $localName)) $detail = $candidate;
      if (!$isLocal && !$county && str_contains($e, 'gemeinde-ergebnis')) $overall = $candidate;
      if (!$isLocal && !$county && str_contains($e, 'ortsteile')) $detail = $candidate;
      if ($county && str_contains($e, 'kreis-ergebnis')) $overall = $candidate;
      if ($wahl === 'Landratswahl' && str_contains($e, 'gemeinden')) $detail = $candidate;
      if (($wahl === 'Kreiswahl' || $wahl === 'Kreistagswahl') && $level === 'gemeinden' && str_contains($e, 'gemeinden')) $detail = $candidate;
      if (($wahl === 'Kreiswahl' || $wahl === 'Kreistagswahl') && $level !== 'gemeinden' && str_contains($e, 'kreiswahlbereiche')) $detail = $candidate;
    }
    if (!$detail && !$overall) throw new RuntimeException('Amtliche Wahldaten 2016 nicht gefunden');
    $rows = $detail ? $parse($source['files'][$detail['url']] ?? '') : [];
    $totalRows = $overall ? $parse($source['files'][$overall['url']] ?? '') : [];
    $total = $totalRows[0] ?? ($rows[0] ?? []);
    if ($isLocal) {
      $identity = ['datum'=>true, 'wahl'=>true, 'ags'=>true, 'gebiet-nr'=>true, 'gebiet-name'=>true];
      foreach (array_keys($total) as $key) {
        if (isset($identity[$key])) continue;
        $sum = 0; foreach ($rows as $resultRow) $sum += (int)str_replace('.', '', $resultRow[$key] ?? '0');
        $total[$key] = (string)$sum;
      }
      $total['gebiet-nr'] = 'gesamt'; $total['gebiet-name'] = $localName;
    }
    $metadata = $meta;
    foreach ($metadata['dateifelder'] as &$field) if (($field['name'] ?? '') === $actual && !$isLocal) $field['name'] = $wahl;
    $baseSource = "http://wahlen.kreis-hi.de/wahlen/20160911/$authority/praesentation/";
    $sources = array_values(array_filter([$overall ? $baseSource.$overall['url'] : null, $detail ? $baseSource.$detail['url'] : null]));
    $areaKind = $isLocal ? 'wahlbezirke' : ($wahl === 'Landratswahl' ? 'gemeinden' : ($county ? ($level === 'gemeinden' ? 'gemeinden' : 'wahlbereiche') : 'ortsteile'));
    $levelName = $isLocal ? 'Wahlbezirke im Ortsratsgebiet' : ($wahl === 'Landratswahl' ? 'Gemeinden im Landkreis' : ($county ? ($level === 'gemeinden' ? 'Gemeinden im Landkreis' : 'Kreiswahlbereiche') : 'Ortsteile'));
    echo json_encode(['year'=>'2016','wahl'=>$wahl,'metadata'=>$metadata,'rows'=>$rows,'total'=>$total,'level'=>$levelName,'areaLevel'=>$areaKind,'sources'=>$sources,'retrieved'=>$officialArchive['retrieved'],'archived'=>true,'resultStatus'=>'Amtliches Endergebnis vom 11.09.2016','splitAvailable'=>true], JSON_UNESCAPED_UNICODE); exit;
  }
  $county = $wahl === 'Kreiswahl' || $wahl === 'Kreistagswahl' || $wahl === 'Landratswahl';
  $authority = $county ? '03254000' : '03254021';
  $actual = $year === '2021' && in_array($wahl, ['Kreiswahl', 'Kreistagswahl'], true) ? 'Kreiswahl' : $wahl;
  if ($year === '2026' && str_starts_with($wahl, 'Ortsratswahl (')) {
    $localName = substr($wahl, 14, -1);
    $officialNames = [
      'Stadtmitte Neustadt'=>'Stadtmitte/Neustadt',
      'Oststadt und Stadtfeld'=>'Oststadt/Stadtfeld',
      'Marienburger Höhe-Galgenberg'=>'Marienburger Höhe/Galgenberg',
      'Moritzberg und Bockfeld'=>'Moritzberg/Bockfeld',
      'Neuhof-Hildesheimer Wald-Marienrode'=>'Neuhof/Hildesheimer Wald/Marienrode',
    ];
    $actual = 'Ortsratswahl '.($officialNames[$localName] ?? $localName);
  }
  $date = $year === '2021' ? '20210912' : '20260913';
  $base = "http://wahlen.kreis-hi.de/wahlen/$date/$authority/";
  if ($year === '2021' && !$county) { $archive = json_decode((string)file_get_contents($root.'/data/archive.json'), true); $meta = $archive['metadata']; $csvBase = $base.'praesentation/'; }
  else { $meta = $year === '2026' ? $loadLiveMeta($authority) : $metaFetch($base.'api/praesentation/open_data.json'); $csvBase = $base.($year === '2021' ? 'praesentation/' : 'daten/opendata/'); }
  $options = array_values(array_filter($meta['csvs'] ?? [], static fn($c) => ($c['wahl'] ?? '') === $actual));
  $isLocal = str_starts_with($wahl, 'Ortsratswahl (');
  $overall = null; $detail = null; foreach ($options as $c) {
    $e = strtolower($c['ebene'] ?? '');
    if ($year === '2026') {
      if ($isLocal && $e === 'ortschaft') $overall = $c;
      if ($isLocal && $e === 'wahlbezirk') $detail = $c;
      if (!$isLocal && !$county && $e === 'stadt') $overall = $c;
      if (!$isLocal && !$county && $e === 'wahlbereiche') $detail = $c;
      if ($county && $e === 'gesamtergebnis') $overall = $c;
    } else {
      if (!$county && (str_contains($e,'gemeinde-ergebnis') || $e === 'gemeinde')) $overall = $c;
      if ($county && (str_contains($e,'kreis-ergebnis') || str_contains($e,'landkreis'))) $overall = $c;
      if (!$county && str_contains($e,'ortsteil')) $detail = $c;
    }
    if ($county && $wahl !== 'Landratswahl' && $level === 'gemeinden' && str_contains($e,'gemeinde')) $detail = $c;
    if ($county && $wahl !== 'Landratswahl' && $level !== 'gemeinden' && str_contains($e,'wahlbereich')) $detail = $c;
    if ($wahl === 'Landratswahl' && str_contains($e,'gemeinde')) $detail = $c;
  }
  $tables = [];
  $selectedEntries = array_values(array_filter([$overall, $detail]));
  if ($year === '2026' && $selectedEntries) {
    $singleMulti = curl_multi_init(); $singleHandles = [];
    foreach ($selectedEntries as $entry) {
      $url = $csvBase.$entry['url'];
      $handle = curl_init($url);
      curl_setopt_array($handle, [CURLOPT_RETURNTRANSFER=>true,CURLOPT_FOLLOWLOCATION=>true,CURLOPT_CONNECTTIMEOUT=>4,CURLOPT_TIMEOUT=>12,CURLOPT_USERAGENT=>'Walbeobachtung/1.0']);
      $singleHandles[$entry['ebene']] = $handle; curl_multi_add_handle($singleMulti, $handle);
    }
    do { $singleStatus = curl_multi_exec($singleMulti, $singleActive); if ($singleActive) curl_multi_select($singleMulti, 1.0); } while ($singleActive && $singleStatus === CURLM_OK);
    foreach ($selectedEntries as $entry) {
      $handle = $singleHandles[$entry['ebene']]; $raw = curl_multi_getcontent($handle); $statusCode = (int)curl_getinfo($handle, CURLINFO_RESPONSE_CODE);
      if ($statusCode === 200 && is_string($raw) && $raw !== '') $tables[$entry['ebene']] = $parse($raw);
      curl_multi_remove_handle($singleMulti, $handle);
    }
    curl_multi_close($singleMulti);
    if ($overall && empty($tables[$overall['ebene']])) {
      $fallbackPayload = is_file($wahlabendCache) ? json_decode((string)file_get_contents($wahlabendCache), true) : null;
      $fallbackKey = $wahl === 'Landratswahl' ? 'landrat' : (in_array($wahl, ['Kreiswahl','Kreistagswahl'], true) ? 'kreistag' : ($wahl === 'Stadtratswahl' ? 'stadtrat' : ''));
      $fallbackElection = null;
      foreach (($fallbackPayload['elections'] ?? []) as $cachedElection) if (($cachedElection['key'] ?? '') === $fallbackKey) { $fallbackElection = $cachedElection; break; }
      if ($fallbackElection) {
        $fallbackTotal = ['gebiet-name'=>$fallbackElection['scope'] ?? 'Gesamtergebnis','D'=>(string)($fallbackElection['valid'] ?? 0),'anz-schnellmeldungen'=>(string)($fallbackElection['reports'] ?? 0),'max-schnellmeldungen'=>(string)($fallbackElection['maxReports'] ?? 0)];
        foreach (($fallbackElection['parties'] ?? []) as $cachedParty) $fallbackTotal[$cachedParty['id']] = (string)($cachedParty['votes'] ?? 0);
        $tables[$overall['ebene']] = [$fallbackTotal];
      } else throw new RuntimeException('Gesamtergebnis nicht erreichbar');
    }
  } else {
    foreach ($selectedEntries as $entry) {
      $url = $csvBase.$entry['url'];
      $raw = $year === '2021' && !$county && isset($archive['files'][$entry['url']]) ? $archive['files'][$entry['url']] : @file_get_contents($url);
      if ($raw === false) throw new RuntimeException('CSV nicht erreichbar');
      $tables[$entry['ebene']] = $parse($raw);
    }
  }
  $rows = $detail ? ($tables[$detail['ebene']] ?? []) : []; $total = $overall ? (($tables[$overall['ebene']][0] ?? null)) : ($rows[0] ?? null); $metadata = $meta; foreach ($metadata['dateifelder'] as &$field) if (($field['name'] ?? '') === $actual) $field['name'] = $wahl;
  $levelName = $detail ? ($isLocal ? 'Wahlbezirke im Ortsratsgebiet' : ($wahl === 'Landratswahl' ? 'Gemeinden im Landkreis' : ($county ? ($level === 'gemeinden' ? 'Gemeinden im Landkreis' : 'Kreiswahlbereiche') : ($year === '2026' ? 'Stadtwahlbereiche' : 'Ortsteile')))) : 'Wahlbezirke';
  echo json_encode(['year'=>$year,'wahl'=>$wahl,'metadata'=>$metadata,'rows'=>$rows,'total'=>$total,'level'=>$levelName,'areaLevel'=>$wahl === 'Landratswahl' ? 'gemeinden' : ($county ? ($level === 'gemeinden' ? 'gemeinden' : 'wahlbereiche') : 'ortsteile'),'sources'=>array_values(array_filter([$overall ? $csvBase.$overall['url'] : null,$detail ? $csvBase.$detail['url'] : null])),'retrieved'=>date('d.m.Y H:i:s'),'archived'=>false], JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) {
  if ($action === 'wahlabend' && is_file($wahlabendCache) && time() - (int)filemtime($wahlabendCache) < 600) {
    $cached = json_decode((string)@file_get_contents($wahlabendCache), true);
    if (is_array($cached)) { $cached['warning'] = 'Die amtliche Quelle antwortet verzögert. Der letzte erfolgreiche Datenstand wird gezeigt.'; echo json_encode($cached, JSON_UNESCAPED_UNICODE); exit; }
  }
  http_response_code(502); echo json_encode(['error'=>'Die offiziellen Wahldaten konnten nicht abgerufen werden.']);
}
